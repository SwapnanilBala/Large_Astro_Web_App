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
 * LIMITATION, stated plainly rather than discovered later: the counters live in
 * process memory. On a serverless deployment each warm instance keeps its own
 * tally, so the real ceiling is (instances x limit), not the number below. That
 * still bounds a runaway client loop and a single determined abuser -- which is
 * what empties a key in practice -- but it is not a hard global cap. A hard cap
 * needs shared state; this app already runs Neon, so a counter table keyed on
 * (utc_day, route) with an atomic upsert is the upgrade path, at the cost of one
 * round trip per paid call.
 */

import { getClientIp } from "@/lib/rate-limiter";

export type LlmRouteKey =
  | "/api/chart/dasha-interpretation"
  | "/api/chart/domain-brief"
  | "/api/palm-reading";

type LlmBudgetConfig = {
  /** Paid calls this route may make in one UTC day, across every caller. */
  perDay: number;
  /** Paid calls one caller may make against this route in one UTC day. */
  perCallerPerDay: number;
};

/*
 * Sized by what the call costs, not by what feels generous.
 *
 * The two text routes are Claude Opus 5 at low effort with max_tokens 1000 and a
 * cached system prefix -- fractions of a cent each, and both cache their result,
 * so a user who revisits a chain or a domain pays nothing. The per-caller number
 * is set above what a thorough session looks like (a five-level dasha drill-down
 * is at most a few dozen distinct chains; the Ultimate Module has exactly seven
 * domains) so a real reader never meets it.
 *
 * Palm reading is a different order of magnitude: GPT-4o vision over a 5MB image
 * at detail "high" with max_tokens 4500, and nothing about it is cached. A real
 * visitor uploads a palm once or twice, ever, so the ceiling is tight on purpose.
 */
const LLM_BUDGETS: Record<LlmRouteKey, LlmBudgetConfig> = {
  "/api/chart/dasha-interpretation": { perDay: 2500, perCallerPerDay: 80 },
  "/api/chart/domain-brief": { perDay: 2500, perCallerPerDay: 60 },
  "/api/palm-reading": { perDay: 200, perCallerPerDay: 5 },
};

const MS_PER_DAY = 86_400_000;

/** Counts for the current UTC day only; the whole map is dropped on rollover. */
const counters = new Map<string, number>();
let countersDay = -1;

function utcDayNumber(now: number) {
  return Math.floor(now / MS_PER_DAY);
}

function secondsUntilUtcMidnight(now: number) {
  const nextMidnight = (utcDayNumber(now) + 1) * MS_PER_DAY;
  return Math.max(1, Math.ceil((nextMidnight - now) / 1000));
}

function rollOver(now: number) {
  const day = utcDayNumber(now);
  if (day !== countersDay) {
    /* A new UTC day makes every existing count meaningless, so there is nothing
       to scan or filter -- the map goes. This is also the only pruning this
       module needs, which is why there is no cleanup timer here. */
    counters.clear();
    countersDay = day;
  }
}

export type LlmBudgetResult =
  | { allowed: true; remaining: number; callerRemaining: number }
  | {
      allowed: false;
      /** Which ceiling refused: the route's day total, or this caller's. */
      scope: "global" | "caller";
      retryAfterSeconds: number;
    };

/**
 * Reserve one paid call against `route`'s daily budget.
 *
 * Call this *after* the cache lookup and immediately before the provider call,
 * so a served-from-cache response costs nothing. A reservation is not released
 * if the provider then fails: counting an attempt that reached the provider is
 * the safe direction, because a provider erroring after it has already billed
 * us is exactly the case a budget is for.
 */
export function consumeLlmBudget(
  route: LlmRouteKey,
  request: Request,
  now: number = Date.now(),
): LlmBudgetResult {
  rollOver(now);

  const config = LLM_BUDGETS[route];
  const globalKey = route;
  const callerKey = `${route}::${getClientIp(request)}`;

  const globalUsed = counters.get(globalKey) ?? 0;
  if (globalUsed >= config.perDay) {
    return {
      allowed: false,
      scope: "global",
      retryAfterSeconds: secondsUntilUtcMidnight(now),
    };
  }

  const callerUsed = counters.get(callerKey) ?? 0;
  if (callerUsed >= config.perCallerPerDay) {
    return {
      allowed: false,
      scope: "caller",
      retryAfterSeconds: secondsUntilUtcMidnight(now),
    };
  }

  counters.set(globalKey, globalUsed + 1);
  counters.set(callerKey, callerUsed + 1);

  return {
    allowed: true,
    remaining: config.perDay - globalUsed - 1,
    callerRemaining: config.perCallerPerDay - callerUsed - 1,
  };
}

/** Current usage for one route, for logging and for the tests. */
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
}
