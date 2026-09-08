import { NextRequest, NextResponse } from "next/server";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import {
  chartParamsToBirthInput,
  getWeeklyEnergyPayload,
  hasAllChartParams,
  readChartParams,
} from "@/lib/chart-params";
import { WeeklyEnergyInputSchema, firstZodError } from "@/lib/schemas";
import { currentWeekStart } from "@/lib/format-week";
import type { WeeklyEnergyResponse } from "@/lib/astro-types";

const CACHE_HEADER = "private, max-age=3600, stale-while-revalidate=1800";

/**
 * GET /api/chart/weekly-energy?<birth params>&week_start=YYYY-MM-DD
 *
 * Birth details are read camelCase through readChartParams, following
 * /api/chart/life-domains rather than /api/chart/forecast's snake_case. The
 * two named precedents disagree, and life-domains is the right one here: the
 * panel mounts inside insights-content.tsx, which already holds `historyQs`,
 * so the fetch is that string plus one extra param with no conversion. It also
 * lets the route delegate to getWeeklyEnergyPayload, which is what keeps the
 * cache key in a single place.
 *
 * `week_start` stays snake_case to match the sibling extras target_date /
 * target_year / start_date.
 *
 * No `export const maxDuration`: this is seven ephemeris samples, not the
 * hourly search the muhurta route runs.
 */
export async function GET(request: NextRequest) {
  try {
    const rawParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const chartParams = readChartParams(rawParams);

    if (!hasAllChartParams(chartParams)) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        "Complete birth details are required for the weekly energy reading."
      );
    }

    /* Parsed here purely to turn a bad input into a 400 before the engine
       throws its own error deeper down. */
    try {
      chartParamsToBirthInput(chartParams);
    } catch (error) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        error instanceof Error ? error.message : "Invalid birth details."
      );
    }

    /* Defaulted before validation and before the cache key is built, so
       nothing in a cached value depends on when it was first requested. */
    const requestedWeek = rawParams.week_start ?? currentWeekStart();

    const parsed = WeeklyEnergyInputSchema.safeParse({ week_start: requestedWeek });
    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, firstZodError(parsed.error));
    }

    /* Cache lookup, key and build all live in getWeeklyEnergyPayload so this
       route cannot drift onto a different key from any other caller. */
    const result: WeeklyEnergyResponse = getWeeklyEnergyPayload(
      chartParams,
      parsed.data.week_start
    );

    /* No X-Cache header: the hit/miss happens inside the payload helper, so
       this side cannot tell them apart, and a header that says MISS on every
       hit is worse than no header. Same reasoning as the life-domains route.
       `private` matters -- this is a personal reading. */
    return NextResponse.json(result, {
      headers: { "Cache-Control": CACHE_HEADER },
    });
  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      route: "/api/chart/weekly-energy [GET]",
      error: error instanceof Error ? error.message : String(error),
    }));
    return errorResponse(error, "Weekly energy calculation failed");
  }
}
