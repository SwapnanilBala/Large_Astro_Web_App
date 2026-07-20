import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limiter";

export function proxy(request: NextRequest) {
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

export const config = {
  matcher: "/api/:path*",
};