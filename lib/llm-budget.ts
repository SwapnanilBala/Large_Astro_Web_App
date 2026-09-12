/**
 * Daily spend ceilings for the routes that call a paid LLM provider.
 *
 * Why this exists alongside lib/rate-limiter.ts: that module answers "is this
 * one caller hammering us right now", and it answers it well. It cannot answer
 * "is today's bill about to be a problem", because its window resets every 60
 * seconds -- 5 requests a minute is 7,200 requests a day -- and a caller with a
 * pool of addresses never trips a per-IP limit at all. Those are the two ways an
 * API key actually gets burned, and neither is a burst.
 *
 * So this is the second layer, and it is deliberately a different shape: a
 * ceiling per UTC day, counted both globally per route and per caller, checked
 * immediately before the provider call and never on a cache hit.
 *
 * WHO A CALLER IS
 *
 * A signed-in account and a signed-out address are both callers here, but they
 * are not the same kind of thing and they do not get the same allowance. An
 * address is a weak name for a person in both directions at once -- a proxy
 * pool makes one abuser look like thousands, a campus NAT makes thousands of
 * people look like one -- so no single number set on it is right. The signed-out
 * tier is therefore sized as a taste of the feature, and the full allowance is
 * attached to an account, which is a name a caller cannot mint by the thousand
 * and cannot have imposed on them by their employer's router.
 *
 * A refusal at the signed-out tier reports `scope: "anonymous"` rather than
 * `"caller"`, because it is the one refusal the visitor can lift themselves.
 *
 * TWO LAYERS, AND WHY BOTH
 *
 * The counters live in Postgres (`llm_budget_counters`, incremented by a single
 * atomic upsert in lib/db/llm-budget-counters.ts), which is what makes the
 * number below a real ceiling rather than a per-instance one. They are also
 * mirrored in process memory, and the mirror is consulted first.
 *
 * The mirror is a *fast rejection* layer, and it is sound as one for a specific
 * reason: an instance's local tally only ever counts calls that instance made,
 * so it is a lower bound on the shared total. Local >= limit therefore implies
 * shared >= limit, and the refusal needs no round trip. The converse does not
 * hold, so local < limit proves nothing and the shared counter is consulted.
 * An allowed call pays one round trip; a refused one, after the first, pays
 * nothing -- which is the right way round, because the traffic being refused is
 * by definition the traffic there is a lot of.
 *
 * Mirroring the returned count back into memory is what closes the loop: once
 * the shared counter has told an instance the route is spent, that instance
 * refuses locally from then on, and stops writing rows for callers it has never
 * seen. The table cannot be inflated by the abuse it is there to stop.
 *
 * WHEN NEON IS DOWN
 *
 * The failure mode is a deliberate choice, so: **a database error degrades to
 * the process-local ceiling. It does not block the call.** The degraded state
 * is not "no ceiling" -- it is exactly the (instances x limit) ceiling this
 * module shipped with, which still bounds a runaway client loop and a single
 * determined abuser, i.e. the ways a key is actually emptied. Failing closed
 * would trade a bounded, time-limited overspend for a certain and immediate
 * outage of three user-facing features every time Neon hiccups, which is the
 * worse trade for an app whose LLM output is an enrichment on top of chart
 * arithmetic that still works. A failing round trip is also not retried on
 * every subsequent call: the first error opens a short circuit breaker so an
 * outage does not add a database timeout to every LLM request's latency.
 */

import {
  bumpSharedLlmCounters,
  isSharedLlmCounterConfigured,
  pruneSharedLlmCounters,
  type SharedLlmCounts,
} from "@/lib/db/llm-budget-counters";
import { SESSION_COOKIE, resolveSession } from "@/lib/identity/session";
import { getClientIp } from "@/lib/rate-limiter";

export type LlmRouteKey =
  | "/api/chart/dasha-interpretation"
  | "/api/chart/domain-brief"
  | "/api/palm-reading";

type LlmBudgetConfig = {
  /** Paid calls this route may make in one UTC day, across every caller. */
  perDay: number;
  /** Paid calls one signed-in account may make in one UTC day. */
  perCallerPerDay: number;
  /** Paid calls one signed-out address may make in one UTC day. */
  perAnonPerDay: number;
};

/*
 * Sized by what the call costs, not by what feels generous.
 *
 * The route totals are whole-deployment numbers rather than per-instance ones,
 * so they bite where they read. They are sized by what a call costs: the two
 * text routes are Claude Opus 5 at low effort with max_tokens 1000 and a cached
 * system prefix, fractions of a cent each, while palm reading is GPT-4o vision
 * over a 5MB image at detail "high" with max_tokens 4500 and nothing cached --
 * an order of magnitude dearer, hence 200 a day against 2500.
 *
 * THE TWO TIERS are 2 free, then 10 once registered, on each of the three
 * routes. An address is a weak name for a person in both directions at once --
 * a proxy pool makes one abuser look like thousands, a campus NAT makes
 * thousands of people look like one -- so no number set on it is right, and the
 * signed-out one is set to a taste of the feature rather than a working
 * allowance. Registering is what buys a real one, because an account is a name
 * a caller cannot mint by the thousand and cannot have imposed on them by their
 * employer's router.
 *
 * Two is deliberately enough to see what the feature does and not enough to use
 * it, which is what makes the sign-in prompt land at a moment the visitor has
 * already decided they want more.
 *
 * WHERE 10 WILL CHAFE, said now rather than discovered from a support message:
 * the two text routes cache, so only *distinct* requests count -- revisiting a
 * dasha chain or a domain is free. Even so, a five-level drill-down reaches
 * dozens of distinct chains, so a thorough reader on /insights will meet the
 * dasha ceiling in one sitting. If that shows up, raise
 * `/api/chart/dasha-interpretation` first: it is the cheapest of the three per
 * call (Opus at low effort, 1000 max tokens, cached system prefix) and the one
 * a real session burns fastest. Palm reading is the opposite -- GPT-4o vision
 * over a 5MB image with nothing cached -- so its 10 is the expensive one, and
 * the route's own 200/day total is what actually bounds that exposure.
 */
const LLM_BUDGETS: Record<LlmRouteKey, LlmBudgetConfig> = {
  "/api/chart/dasha-interpretation": { perDay: 2500, perCallerPerDay: 10, perAnonPerDay: 2 },
  "/api/chart/domain-brief": { perDay: 2500, perCallerPerDay: 10, perAnonPerDay: 2 },
  "/api/palm-reading": { perDay: 200, perCallerPerDay: 10, perAnonPerDay: 2 },
};

const MS_PER_DAY = 86_400_000;

/** Days of spent counters to keep for reading back; today is day zero of these. */
const COUNTER_RETENTION_DAYS = 7;

/** How long one database error suppresses the round trip on this instance. */
const SHARED_OUTAGE_COOLDOWN_MS = 30_000;

/**
 * This instance's view of the counters, for the current UTC day only.
 *
 * Holds the larger of what this instance has spent and what the shared counter
 * last reported, so it is always a lower bound on the true total -- which is
 * the property the fast rejection above depends on.
 */
const counters = new Map<string, number>();
let countersDay = -1;

/** Set on a database error; the shared counter is skipped until `now` passes it. */
let sharedUnavailableUntil = 0;

/** The UTC day whose prune has already been issued by this instance. */
let prunedDay = -1;

function utcDayNumber(now: number) {
  return Math.floor(now / MS_PER_DAY);
}

/** The `utc_day` key: the UTC calendar date, derived from the day number. */
function utcDayKey(dayNumber: number) {
  return new Date(dayNumber * MS_PER_DAY).toISOString().slice(0, 10);
}

function secondsUntilUtcMidnight(now: number) {
  const nextMidnight = (utcDayNumber(now) + 1) * MS_PER_DAY;
  return Math.max(1, Math.ceil((nextMidnight - now) / 1000));
}

function rollOver(now: number) {
  const day = utcDayNumber(now);
  if (day !== countersDay) {
    /* A new UTC day makes every existing count meaningless, so there is nothing
       to scan or filter -- the map goes. Postgres cannot do the same trick
       because the rows outlive the process, hence the prune below. */
    counters.clear();
    countersDay = day;
  }
}

/**
 * Which ceiling refused.
 *
 * `anonymous` is split out from `caller` because it is the only one of the
 * three a visitor can do something about right now, and "rate limited, try
 * again tomorrow" is the wrong thing to tell someone whose actual position is
 * "sign in and carry on". The routes pass this through to the client so the
 * refusal can read as an invitation rather than a wall.
 */
export type LlmBudgetScope = "global" | "caller" | "anonymous";

export type LlmBudgetResult =
  | { allowed: true; remaining: number; callerRemaining: number }
  | {
      allowed: false;
      scope: LlmBudgetScope;
      retryAfterSeconds: number;
    };

function refuse(scope: LlmBudgetScope, now: number): LlmBudgetResult {
  return { allowed: false, scope, retryAfterSeconds: secondsUntilUtcMidnight(now) };
}

/**
 * Who is spending, and therefore which allowance applies.
 *
 * `user:` and `ip:` are namespaced rather than bare so the two can never name
 * the same bucket, and so a row in `llm_budget_counters` says which kind of
 * caller it counted without anyone having to infer it from the shape.
 */
type LlmCaller = {
  key: string;
  signedIn: boolean;
};

/** The session cookie's value, without parsing the whole jar. */
function sessionTokenFrom(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(separator + 1).trim()) || null;
    }
  }
  return null;
}

/**
 * Resolve the caller, falling back to the address on any doubt.
 *
 * No cookie means no query -- `resolveSession` returns on a null token before
 * it touches the database -- so the signed-out path, which is the one abuse
 * arrives on, costs nothing extra.
 *
 * A failed lookup is treated as signed out rather than propagated. These three
 * routes have never required an account and must not start 500ing because the
 * session store is unreachable; the cost of guessing wrong is the smaller
 * allowance, which is the safe direction to be wrong in.
 */
async function resolveLlmCaller(request: Request): Promise<LlmCaller> {
  const token = sessionTokenFrom(request);
  if (token) {
    try {
      const session = await resolveSession(token);
      if (session) {
        return { key: `user:${session.userId}`, signedIn: true };
      }
    } catch {
      /* Fall through to the address. */
    }
  }
  return { key: `ip:${getClientIp(request)}`, signedIn: false };
}

/**
 * Ask for the old days to go, once per process per day, without blocking.
 *
 * Deliberately not awaited and deliberately swallowing its error: a failed
 * prune means seven-day-old rows live a little longer, which is not a reason to
 * fail or slow down the request that happened to trigger it. `prunedDay` is set
 * before the call, not after, so a burst of concurrent requests issues one
 * delete rather than one each.
 */
function schedulePrune(day: number) {
  if (prunedDay === day) {
    return;
  }
  prunedDay = day;
  void pruneSharedLlmCounters(utcDayKey(day - COUNTER_RETENTION_DAYS)).catch(() => {});
}

/**
 * Reserve one paid call against `route`'s daily budget.
 *
 * Call this *after* the cache lookup and immediately before the provider call,
 * so a served-from-cache response costs nothing. A reservation is not released
 * if the provider then fails: counting an attempt that reached the provider is
 * the safe direction, because a provider erroring after it has already billed
 * us is exactly the case a budget is for.
 */
export async function consumeLlmBudget(
  route: LlmRouteKey,
  request: Request,
  now: number = Date.now(),
): Promise<LlmBudgetResult> {
  rollOver(now);

  const config = LLM_BUDGETS[route];
  const caller = await resolveLlmCaller(request);
  /* One number or the other, chosen once, so every check below and the
     `remaining` reported back all speak about the same allowance. */
  const callerLimit = caller.signedIn ? config.perCallerPerDay : config.perAnonPerDay;
  const callerScope: LlmBudgetScope = caller.signedIn ? "caller" : "anonymous";
  const globalKey = route;
  const callerKey = `${route}::${caller.key}`;

  /* Layer one: this instance's mirror. A refusal here is free and correct --
     see the header on why a local count can only understate the shared one. */
  const localGlobal = counters.get(globalKey) ?? 0;
  if (localGlobal >= config.perDay) {
    return refuse("global", now);
  }

  const localCaller = counters.get(callerKey) ?? 0;
  if (localCaller >= callerLimit) {
    return refuse(callerScope, now);
  }

  /* Reserved locally before the await, so that concurrent calls on this
     instance cannot all pass the check above on the same stale reading, and so
     the ceiling still exists at all if the round trip below never happens. */
  counters.set(globalKey, localGlobal + 1);
  counters.set(callerKey, localCaller + 1);

  const localResult: LlmBudgetResult = {
    allowed: true,
    remaining: config.perDay - localGlobal - 1,
    callerRemaining: callerLimit - localCaller - 1,
  };

  if (!isSharedLlmCounterConfigured() || now < sharedUnavailableUntil) {
    return localResult;
  }

  const day = utcDayNumber(now);
  let shared: SharedLlmCounts;
  try {
    shared = await bumpSharedLlmCounters(utcDayKey(day), route, caller.key);
  } catch (error) {
    sharedUnavailableUntil = now + SHARED_OUTAGE_COOLDOWN_MS;
    console.warn(JSON.stringify({
      timestamp: new Date(now).toISOString(),
      route,
      event: "llm_budget_shared_counter_unavailable",
      /* Named so the log reads as the decision it is, not as a bare error. */
      degradedTo: "per-instance ceiling",
      cooldownSeconds: SHARED_OUTAGE_COOLDOWN_MS / 1000,
      error: error instanceof Error ? error.message : String(error),
    }));
    return localResult;
  }

  sharedUnavailableUntil = 0;
  schedulePrune(day);

  /* The shared totals include every other instance, so they can only be larger.
     Taking the max both keeps the mirror a valid lower bound and arms the fast
     rejection above: once the shared counter says the route is spent, this
     instance stops asking. */
  counters.set(globalKey, Math.max(counters.get(globalKey) ?? 0, shared.routeTotal));
  counters.set(callerKey, Math.max(counters.get(callerKey) ?? 0, shared.caller));

  /* Strictly greater, because the returned counts already include this call. */
  if (shared.routeTotal > config.perDay) {
    return refuse("global", now);
  }
  if (shared.caller > callerLimit) {
    return refuse(callerScope, now);
  }

  return {
    allowed: true,
    remaining: config.perDay - shared.routeTotal,
    callerRemaining: callerLimit - shared.caller,
  };
}

/**
 * Current usage for one route, for logging and for the tests.
 *
 * This instance's view, which is the shared total as of its last round trip and
 * never higher than the truth. Synchronous on purpose: the callers of this are
 * log lines and assertions, and neither is worth a query. `used` can read above
 * `limit` once the ceiling has been hit, because a refused attempt is counted
 * before it is refused.
 */
export function readLlmBudgetUsage(route: LlmRouteKey, now: number = Date.now()) {
  rollOver(now);
  return {
    used: counters.get(route) ?? 0,
    limit: LLM_BUDGETS[route].perDay,
  };
}

/** Test seam. Never called by application code. */
export function __resetLlmBudgetForTests() {
  counters.clear();
  countersDay = -1;
  sharedUnavailableUntil = 0;
  prunedDay = -1;
}
