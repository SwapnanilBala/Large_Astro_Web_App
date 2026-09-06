import { NextRequest, NextResponse } from "next/server";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import {
  chartParamsToBirthInput,
  getLifeDomainPayload,
  hasAllChartParams,
  readChartParams,
} from "@/lib/chart-params";
import type { LifeDomainInsightsResponse } from "@/lib/astro-types";

const CACHE_HEADER = "private, max-age=3600, stale-while-revalidate=1800";

export async function GET(request: NextRequest) {
  try {
    const rawParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const chartParams = readChartParams(rawParams);

    if (!hasAllChartParams(chartParams)) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        "Complete birth details are required for life-domain analysis."
      );
    }

    /* Parsed here purely to turn a bad input into a 400 before the builder
       throws its own error deeper down. */
    try {
      chartParamsToBirthInput(chartParams);
    } catch (error) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        error instanceof Error ? error.message : "Invalid birth details."
      );
    }

    /* Cache lookup, key and build all live in getLifeDomainPayload so this
       route and /insights/life-areas cannot drift onto different keys. */
    const result: LifeDomainInsightsResponse = getLifeDomainPayload(chartParams);

    /* No X-Cache here any more. The hit/miss now happens inside
       getLifeDomainPayload, so this side cannot tell the two apart, and a
       header that says MISS on every hit is worse than no header. */
    return NextResponse.json(result, {
      headers: { "Cache-Control": CACHE_HEADER },
    });
  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      route: "/api/chart/life-domains [GET]",
      error: error instanceof Error ? error.message : String(error),
    }));
    return errorResponse(error, "Life-domain analysis failed");
  }
}
