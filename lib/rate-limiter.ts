/**
 * Edge-compatible in-memory sliding window rate limiter.
 *
 * Uses only standard Web APIs (Map, Date) so it works in the Next.js Edge runtime.
 * Each entry stores an array of request timestamps within the current window.
 * Expired entries are cleaned up every 5 minutes automatically.
 *
 * PER INSTANCE, which is worth knowing before trusting a number below. The
 * store is this process's memory, so on Vercel every running instance counts
 * on its own and a cold start begins from zero: "20 a minute" is 20 a minute
 * per instance per caller, and under load the platform adds instances. These
 * limits slow a runaway client; they are not a ceiling on anything.
 *
 * What does bound each kind of route:
 * - All of /api/, before any code here runs: a Vercel Firewall rate-limit
 *   rule, live since 2026-09-23. Vercel counts requests per IP at its edge,
 *   in one count shared by every instance (kept per region, so a caller
 *   spread over several regions can get a little past it). When the rule's
 *   action is 429 rather than Log, an over-limit request is answered by Vercel
 *   and the function never starts, so a flood costs no compute, no Neon query
 *   and no geocoder call. It is one count for the whole prefix, not one per
 *   route. The rule is dashboard config, not code: its limit and its action
 *   live under Project -> Firewall and are not repeated here. Every 429 the
 *   app sends itself has a JSON body, so a 429 without one is that rule.
 * - The paid LLM routes: lib/llm-budget.ts, a daily count shared through Neon
 *   across every instance. That is the number that caps the bill.
 * - Nominatim: lib/nominatim-throttle.ts spaces calls 1s apart per instance,
 *   the server cache absorbs repeats, and since typeahead moved to Photon it
 *   is called about once per chart.
 * - Everything else (chart calculation, compatibility, forecasts): the
 *   firewall's one per-IP count, and the per-instance numbers below. A shared
 *   limit per route needs a firewall rule per route -- Vercel allows one
 *   rate-limit rule per project on Hobby and 40 on Pro, and @vercel/firewall's
 *   checkRateLimit is how code would use one -- or a counter table like the
 *   LLM budget's, and is deliberately not faked here.
 */

type RateLimitConfig = {
  /** Maximum number of requests allowed within the window. */
  limit: number;
  /** Window duration in milliseconds. */
  windowMs: number;
};

/** Per-route rate limit configuration. Key is matched against the request pathname. */
const ROUTE_LIMITS: Record<string, RateLimitConfig> = {
  "/api/chart/forecast": { limit: 20, windowMs: 60_000 },
  "/api/chart/life-domains": { limit: 20, windowMs: 60_000 },
  "/api/chart/dasha-subperiods": { limit: 40, windowMs: 60_000 },
  /* Paid LLM calls. Drilling through a dasha chain or clicking along the
     Ultimate Module's seven cards fires these in quick succession, so the
     window has to allow a real session; the spend ceiling that actually
     protects the key is the per-day budget in lib/llm-budget.ts. */
  "/api/chart/dasha-interpretation": { limit: 12, windowMs: 60_000 },
  /* Longest-prefix match puts this ahead of "/api/chart", which is the point
     of the sort below. Asked once per chart on mount and then served from
     cache, so a real visitor needs it a handful of times an hour at most --
     six is the atlas's number, for the same reason. */
  "/api/chart/current-period": { limit: 6, windowMs: 60_000 },
  "/api/chart/domain-brief": { limit: 12, windowMs: 60_000 },
  /* The atlas asks once per chart and then reads from cache, so a real visitor
     needs this a handful of times an hour at most. Low enough that a loop is
     stopped at the minute rather than at the day, which is the one place the
     other two LLM routes cannot be: they are driven by clicking. */
  "/api/chart/varga-commentary": { limit: 6, windowMs: 60_000 },
  /* Asked once per chart when the yoga section mounts, then answered from
     cache, so the atlas's number fits for the same reason. */
  "/api/chart/yoga-classics": { limit: 6, windowMs: 60_000 },
  /* Asked once per life-areas visit for every area at once, then served from
     cache; moving between areas never asks again. The yoga note's number. */
  "/api/chart/area-classics": { limit: 6, windowMs: 60_000 },
  /* One unpaid request per visit to learn which questions can be answered,
     then one per question the reader clicks, each answered from cache after
     the first time. Ten a minute is a reader going through the questions,
     not a loop. */
  "/api/chart/ask-classics": { limit: 10, windowMs: 60_000 },
  /* Same shape as the atlas: asked once per chart on mount and then served
     from cache. Slightly higher because the panel mounts on two pages, so a
     visitor who opens the results page and then /insights/life-shifts
     legitimately asks twice for overlapping chapters. */
  "/api/chart/life-shifts": { limit: 8, windowMs: 60_000 },
  "/api/chart": { limit: 30, windowMs: 60_000 },
  /* Each call builds two full charts and compares them, and writes nothing. A
     visitor sends one per pairing they ask about, plus one when a shared link
     opens with both people filled in, so ten a minute is room for a person
     and not for a loop. A repeat pairing is answered from the server cache
     but still counts here: this check runs before the route does. */
  "/api/compatibility": { limit: 10, windowMs: 60_000 },
  "/api/geocode": { limit: 20, windowMs: 60_000 },
  "/api/palm-reading": { limit: 5, windowMs: 60_000 },
  /* A minute is longer than the call, so this is really "one download at a
     time, plus room for a retry after a failure". The report is cached by its
     facts, so a second download of the same reading never reaches here. */
  "/api/chart/story-prose": { limit: 3, windowMs: 60_000 },
  "/api/suggest": { limit: 60, windowMs: 60_000 },
  /* Read once per results page for a signed-in visitor, written once per click
     on the chart-style switch. Thirty a minute is a person toggling to compare
     the two drawings, not a loop. */
  "/api/account/preferences": { limit: 30, windowMs: 60_000 },
};

/**
 * Order matters: more specific routes must be checked first so that
 * `/api/chart/forecast` doesn't accidentally match `/api/chart`.
 */
const ORDERED_ROUTE_KEYS = Object.keys(ROUTE_LIMITS).sort(
  (a, b) => b.length - a.length
);

/** Map<compositeKey, timestamps[]> where compositeKey = `${clientKey}::${routeKey}` */
const store = new Map<string, number[]>();

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanupTimer() {
  if (cleanupTimer !== null) return;
  // Run every 5 minutes to purge expired entries
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of store) {
      // Keep only timestamps within the largest possible window (60 s currently)
      const filtered = timestamps.filter((t) => now - t < 120_000);
      if (filtered.length === 0) {
        store.delete(key);
      } else {
        store.set(key, filtered);
      }
    }
  }, 5 * 60_000);

  // In Edge runtime setInterval returns a number; we don't have unref().
  // This is fine because the middleware module lives for the lifetime of the worker.
}

function normalizeIpHeader(value: string | null) {
  /* The RIGHTMOST entry, not the leftmost. A forwarding header is a chain that
     each proxy appends to, so the last entry is the one written by the hop
     closest to us and the first is whatever the client opened with. Reading
     the left end lets a caller pick their own identity by sending
     `x-forwarded-for: <anything>`; reading the right end is correct whether
     the platform appends to the header or replaces it outright. */
  const parts = value?.split(",") ?? [];
  const candidate = parts[parts.length - 1]?.trim() ?? "";
  return candidate.replace(/[^0-9a-fA-F:.%]/g, "").slice(0, 80);
}

/**
 * Caller identity from the headers the platform sets, and only those.
 *
 * The limits count clientKey, built from this, and lib/llm-budget.ts keys its
 * per-caller ceilings on that same value: two different notions of "who is
 * calling" would let a caller sit under one limit while blowing through the
 * other. Exported whole for the sign-in audit trail.
 *
 * THE RULE, because getting this wrong is silent: a forwarding header is only
 * evidence of anything if something we trust wrote it. Every header below is
 * one the serving platform sets and overwrites, so a client sending its own
 * copy cannot choose what we read.
 *
 * `cf-connecting-ip` used to be first in this list and is now behind a flag.
 * Nothing here runs behind Cloudflare -- deployment is Vercel, see vercel.json
 * -- so that header was never set by a proxy and arrived verbatim from
 * whoever sent the request. One extra header per request bought a brand new
 * identity, which silently emptied both this module's per-minute window and
 * the per-caller half of the daily LLM budget. Set TRUST_CLOUDFLARE_CLIENT_IP
 * only if Cloudflare is genuinely terminating in front of the app, because
 * that is the one arrangement in which the header means something.
 *
 * `x-vercel-forwarded-for` leads because the `x-vercel-*` namespace is
 * Vercel's own and it replaces anything a client puts there. The two generic
 * names below it are the fallback for a different host, and they are weaker:
 * they are only as good as that host's willingness to overwrite them.
 */
const TRUST_CLOUDFLARE_CLIENT_IP = process.env.TRUST_CLOUDFLARE_CLIENT_IP === "true";

export function getClientIp(request: Request): string {
  const headers = request.headers;
  const candidates = [
    TRUST_CLOUDFLARE_CLIENT_IP ? headers.get("cf-connecting-ip") : null,
    headers.get("x-vercel-forwarded-for"),
    headers.get("x-real-ip"),
    headers.get("x-forwarded-for"),
  ];

  for (const candidate of candidates) {
    const ip = normalizeIpHeader(candidate);
    if (ip) {
      return ip;
    }
  }

  /* No forwarding header at all means local dev, or a platform that sets none.
     One shared bucket is the deliberate answer: handing every unattributable
     request a fresh allowance is the same as having no per-caller limit. */
  return "unknown";
}

/**
 * The caller as the limits count them: getClientIp's answer, except that an
 * IPv6 address counts as its /64.
 *
 * An IPv6 home or mobile connection is handed a whole /64 -- 2^64 addresses
 * -- and may send from any of them, so counting whole addresses gave one
 * signed-out caller a fresh per-minute window and a fresh slice of the daily
 * LLM allowance for every address they cared to use. The /64 is the smallest
 * block a subscriber is given, so it is one caller. (A provider that hands
 * out /56s still leaves 256 per subscriber; narrow this to /56 if the logs
 * ever show that.) IPv4 counts per address as before, and an IPv4 address in
 * IPv6 dress (::ffff:203.0.113.9) counts as that IPv4 address.
 *
 * Both the per-minute window below and lib/llm-budget.ts key on this.
 * getClientIp itself still returns the whole address, for the sign-in audit
 * trail, which records where a session came from rather than counting it.
 */
export function clientKey(request: Request): string {
  return limitKeyFor(getClientIp(request));
}

/** An address as the limits count it; see clientKey. Exported for the tests. */
export function limitKeyFor(ip: string): string {
  if (!ip.includes(":")) return ip;
  const groups = ipv6Groups(ip);
  /* Not parseable as IPv6: count it as written, which is still bounded and
     still not the caller's to choose (see getClientIp). */
  if (!groups) return ip;
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join(".");
  }
  return `${groups
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(":")}::/64`;
}

const HEX_GROUP = /^[0-9a-f]{1,4}$/;

/** The eight 16-bit groups of an IPv6 address, or null when it is not one. */
function ipv6Groups(ip: string): number[] | null {
  /* A zone id ("fe80::1%eth0") names an interface, not part of the address. */
  let address = ip.split("%")[0].toLowerCase();

  /* The last 32 bits may be written as a dotted IPv4 address. */
  let tail: number[] = [];
  const dotted = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
  if (dotted) {
    const octets = dotted.slice(1).map(Number);
    if (octets.some((octet) => octet > 255)) return null;
    tail = [(octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]];
    address = address.slice(0, dotted.index);
    if (!address.endsWith(":")) return null;
    if (!address.endsWith("::")) address = address.slice(0, -1);
  }

  const halves = address.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] === "" ? [] : halves[0].split(":");
  const right = halves.length === 2 && halves[1] !== "" ? halves[1].split(":") : [];
  if (![...left, ...right].every((group) => HEX_GROUP.test(group))) return null;

  const written = left.length + right.length + tail.length;
  /* Without "::" every group is written; with it, at least one is not. */
  if (halves.length === 1 ? written !== 8 : written > 7) return null;
  const elided = halves.length === 2 ? Array<string>(8 - written).fill("0") : [];
  return [...left, ...elided, ...right].map((group) => parseInt(group, 16)).concat(tail);
}

function matchRoute(pathname: string): string | null {
  for (const key of ORDERED_ROUTE_KEYS) {
    if (pathname === key || pathname.startsWith(key + "/") || pathname.startsWith(key + "?")) {
      return key;
    }
  }
  return null;
}

export type RateLimitResult =
  | { allowed: true; limit: number; remaining: number; resetMs: number }
  | { allowed: false; limit: number; remaining: 0; retryAfterSeconds: number; resetMs: number };

/**
 * Check whether a request is allowed under the rate limit for the matched route.
 *
 * @param request  The incoming Request object (Edge-compatible).
 * @param routeKey Optional explicit route key override (e.g. "/api/chart").
 *                 If omitted the route is inferred from the request URL pathname.
 * @returns        A result object indicating whether the request is allowed, plus headers info.
 */
export function checkRateLimit(
  request: Request,
  routeKey?: string
): RateLimitResult | null {
  ensureCleanupTimer();

  const pathname = routeKey ?? new URL(request.url).pathname;
  const matched = matchRoute(pathname);
  if (!matched) {
    // No rate limit configured for this route
    return null;
  }

  const config = ROUTE_LIMITS[matched];
  const storeKey = `${clientKey(request)}::${matched}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Retrieve and prune old timestamps
  let timestamps = store.get(storeKey) ?? [];
  timestamps = timestamps.filter((t) => t > windowStart);

  if (timestamps.length >= config.limit) {
    // Rate limit exceeded
    const oldestInWindow = timestamps[0];
    const resetMs = oldestInWindow + config.windowMs;
    const retryAfterSeconds = Math.ceil((resetMs - now) / 1000);

    store.set(storeKey, timestamps);

    return {
      allowed: false,
      limit: config.limit,
      remaining: 0,
      retryAfterSeconds: Math.max(retryAfterSeconds, 1),
      resetMs,
    };
  }

  // Allow the request and record the timestamp
  timestamps.push(now);
  store.set(storeKey, timestamps);

  return {
    allowed: true,
    limit: config.limit,
    remaining: config.limit - timestamps.length,
    resetMs: now + config.windowMs,
  };
}
