import { NextRequest, NextResponse } from "next/server";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import {
  chartParamsToBirthInput,
  hasAllChartParams,
  readChartParams,
} from "@/lib/chart-params";
import { buildLifeDomainInsights } from "@/lib/engines/chart-service";
import { RULES_SCHEMA_VERSION } from "@/lib/rules";
import { makeCacheKey, serverCaches } from "@/lib/server-cache";
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

    let birth;
    try {
      birth = chartParamsToBirthInput(chartParams);
    } catch (error) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        error instanceof Error ? error.message : "Invalid birth details."
      );
    }

    const cacheKey = makeCacheKey("life_domains", {
      birth_date: birth.birth_date,
      birth_time: birth.birth_time,
      engine_id: birth.engine_id,
      tz: birth.timezone_offset_minutes,
      lat: birth.latitude,
      lng: birth.longitude,
      rules_schema: RULES_SCHEMA_VERSION,
    });
    const cached = serverCaches.lifeDomains.get(cacheKey) as LifeDomainInsightsResponse | null;

    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": CACHE_HEADER, "X-Cache": "HIT" },
      });
    }

    const result: LifeDomainInsightsResponse = {
      generated_at_utc: new Date().toISOString(),
      insights: buildLifeDomainInsights(birth),
    };
    serverCaches.lifeDomains.set(cacheKey, result);

    return NextResponse.json(result, {
      headers: { "Cache-Control": CACHE_HEADER, "X-Cache": "MISS" },
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
