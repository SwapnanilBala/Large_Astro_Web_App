import { NextRequest, NextResponse } from "next/server";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import {
  chartParamsToBirthInput,
  hasAllChartParams,
  readChartParams,
} from "@/lib/chart-params";
import type { ChartApiResponse } from "@/lib/astro-types";
import { buildChart } from "@/lib/engines/chart-service";
import { buildPersonalStory } from "@/lib/story-engine";
import { verifyChartForStory } from "@/lib/story-verification";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const rawParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const chartParams = readChartParams(rawParams);

    if (!hasAllChartParams(chartParams)) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        "Complete birth details are required for a verified story report.",
      );
    }

    let birth;
    try {
      birth = chartParamsToBirthInput(chartParams);
    } catch (error) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        error instanceof Error ? error.message : "Invalid birth details.",
      );
    }

    // The PDF path performs a complete report calculation rather than reusing
    // the partially enriched browser payload. Premium layers, life-domain
    // matrices, transits, and timing are all completed before prose begins.
    const payload = buildChart(birth, {
      includeTransits: true,
      includePremium: true,
      includeUltimate: true,
      deferLifeDomains: false,
      subscriptionTier: "guest",
    }) as unknown as ChartApiResponse;

    const verification = verifyChartForStory(payload);
    if (verification.status === "failed") {
      throw new ApiError(
        ErrorCode.COMPUTATION_FAILED,
        "The report calculation did not pass its core consistency checks.",
        {
          details: {
            failed_checks: verification.checks
              .filter((item) => item.status === "failed")
              .map((item) => item.id),
          },
        },
      );
    }

    const story = buildPersonalStory(payload, { verification });
    return NextResponse.json(
      { generated_at_utc: new Date().toISOString(), story },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      route: "/api/chart/story-report [GET]",
      error: error instanceof Error ? error.message : String(error),
    }));
    return errorResponse(error, "Verified story generation failed");
  }
}
