import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limiter";
import {
  MOBILE_ROUTING_ENABLED,
  VIEW_OVERRIDE_COOKIE,
  VIEW_OVERRIDE_PARAM,
  readViewPreference,
  resolveRoute,
} from "@/lib/device";

/**
 * Route a page request to the mobile or desktop tree.
 *
 * Redirects are 307, never 308: the mapping depends on the User-Agent and on
 * an overridable preference, so it must not be cached as permanent by a
 * browser or an intermediary.
 */
function routeByDevice(request: NextRequest): NextResponse {
  /* Groundwork is in place but the /m routes do not exist yet, so redirecting
   * would send every phone to a 404. Pass everything through until they land. */
  if (!MOBILE_ROUTING_ENABLED) {
    return NextResponse.next();
  }

  const { pathname, search, searchParams } = request.nextUrl;

  const paramValue = searchParams.get(VIEW_OVERRIDE_PARAM);
  const cookieValue = request.cookies.get(VIEW_OVERRIDE_COOKIE)?.value;
  const preference = readViewPreference(paramValue, cookieValue);

  const decision = resolveRoute({
    pathname,
    userAgent: request.headers.get("user-agent"),
    preference,
  });

  let response: NextResponse;
  if (decision.action === "redirect") {
    const target = request.nextUrl.clone();
    target.pathname = decision.pathname;
    /* Birth details travel as query parameters on /insights, so the search
     * string has to survive the hop or the chart cannot be rebuilt on the
     * other side. clone() already carries it; this is explicit to make the
     * requirement visible to anyone editing this. */
    target.search = search;
    response = NextResponse.redirect(target, 307);
  } else {
    response = NextResponse.next();
  }

  /* An explicit ?view= choice is remembered, so the visitor is not bounced
   * back by the User-Agent guess on their next navigation. */
  if (paramValue && preference) {
    response.cookies.set(VIEW_OVERRIDE_COOKIE, preference, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  /* The response depends on the User-Agent and the override cookie, so any
   * shared cache must key on both. Without this a CDN can hand the mobile
   * page to a desktop visitor. */
  response.headers.set("Vary", "User-Agent, Cookie");
  return response;
}

function rateLimitApi(request: NextRequest): NextResponse {
  const result = checkRateLimit(request);

  // No rate-limit config for this route — pass through
  if (result === null) {
    return NextResponse.next();
  }

  const resetEpochSeconds = Math.ceil(result.resetMs / 1000);

  if (!result.allowed) {
    return NextResponse.json(
      {
        detail: `Rate limit exceeded. Try again in ${result.retryAfterSeconds} seconds.`,
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(result.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(resetEpochSeconds),
          "Retry-After": String(result.retryAfterSeconds),
        },
      }
    );
  }

  // Allowed — attach rate-limit headers to the response
  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(resetEpochSeconds));
  return response;
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return rateLimitApi(request);
  }
  return routeByDevice(request);
}

export const config = {
  /* API routes for rate limiting, plus the page routes that have a mobile
   * counterpart. Everything else — including static assets and _next
   * internals — never reaches this middleware. */
  matcher: ["/api/:path*", "/", "/insights", "/login", "/m", "/m/:path*"],
};
