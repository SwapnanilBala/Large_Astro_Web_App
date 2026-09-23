import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limiter";
import {
  MOBILE_ROUTING_ENABLED,
  VIEW_OVERRIDE_COOKIE,
  VIEW_OVERRIDE_PARAM,
  readViewPreference,
  resolveRoute,
} from "@/lib/device";
import { IMPORTANT_DIVISIONAL_CHARTS } from "@/lib/divisional-chart-guide";

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

const DIVISION_PATH = /^\/insights\/divisional-charts\/([^/]+)\/?$/;
const KEY_DIVISIONS = new Set(IMPORTANT_DIVISIONAL_CHARTS.map((chart) => String(chart.division)));

/**
 * The 404 the division page cannot give itself.
 *
 * Only the key vargas have a page, and the page calls notFound() for anything
 * else -- but by then the insights loading.tsx has started streaming a 200,
 * and a status cannot change mid-stream. So /insights/divisional-charts/999
 * drew a not-found page under a 200, which link checkers and monitors read as
 * a working page. (Next also marks it noindex, so search was only half the
 * problem.) Route-level dynamicParams does not help: the page reads the chart
 * from the query string, so it renders per request and the list is ignored.
 *
 * Deciding here, before anything renders, gives a real 404. The rewrite goes
 * to a path no route matches, which is the app's own not-found page; the
 * address bar keeps what the visitor typed. Valid divisions pass straight
 * through, as they did before this ran on them.
 */
function refuseUnknownDivision(request: NextRequest): NextResponse {
  const match = DIVISION_PATH.exec(request.nextUrl.pathname);
  if (!match || KEY_DIVISIONS.has(match[1])) return NextResponse.next();
  const target = request.nextUrl.clone();
  target.pathname = "/__unknown-division";
  target.search = "";
  return NextResponse.rewrite(target);
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
  if (request.nextUrl.pathname.startsWith("/insights/divisional-charts/")) {
    return refuseUnknownDivision(request);
  }
  return routeByDevice(request);
}

export const config = {
  /* API routes for rate limiting, plus the page routes that have a mobile
   * counterpart. Everything else — including static assets and _next
   * internals — never reaches this middleware. */
  matcher: [
    "/api/:path*",
    "/",
    "/insights",
    "/insights/divisional-charts/:division",
    "/login",
    "/engine-select",
    "/m",
    "/m/:path*",
  ],
};
