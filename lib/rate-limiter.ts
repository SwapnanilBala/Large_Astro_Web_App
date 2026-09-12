/**
 * Edge-compatible in-memory sliding window rate limiter.
 *
 * Uses only standard Web APIs (Map, Date) so it works in the Next.js Edge runtime.
 * Each entry stores an array of request timestamps within the current window.
 * Expired entries are cleaned up every 5 minutes automatically.
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
  "/api/chart/domain-brief": { limit: 12, windowMs: 60_000 },
  "/api/chart": { limit: 30, windowMs: 60_000 },
  /* Tight: a POST here can insert a workspace row, so an unthrottled loop is a
     way to fill the table. A real visitor needs it once per device, ever. */
  "/api/compatibility": { limit: 10, windowMs: 60_000 },
  "/api/geocode": { limit: 20, windowMs: 60_000 },
  "/api/palm-reading": { limit: 5, windowMs: 60_000 },
  "/api/suggest": { limit: 60, windowMs: 60_000 },
};

/**
 * Order matters: more specific routes must be checked first so that
 * `/api/chart/forecast` doesn't accidentally match `/api/chart`.
 */
const ORDERED_ROUTE_KEYS = Object.keys(ROUTE_LIMITS).sort(
  (a, b) => b.length - a.length
);

/** Map<compositeKey, timestamps[]> where compositeKey = `${ip}::${routeKey}` */
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
 * Exported because lib/llm-budget.ts keys its per-caller ceilings on the same
 * value: two different notions of "who is calling" would let a caller sit under
 * one limit while blowing through the other.
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
  const ip = getClientIp(request);
  const storeKey = `${ip}::${matched}`;
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
