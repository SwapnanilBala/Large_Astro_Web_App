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
  "/api/chart/dasha-subperiods": { limit: 40, windowMs: 60_000 },
  "/api/chart": { limit: 30, windowMs: 60_000 },
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

function getClientIp(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return headers.get("x-real-ip") ?? "unknown";
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
