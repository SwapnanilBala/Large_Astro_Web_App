import { NextRequest, NextResponse } from "next/server";
import { computeSubPeriods } from "@/lib/engines/nakshatra-engine";
import { DashaSubperiodsInputSchema, firstZodError } from "@/lib/schemas";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import { serverCaches, makeCacheKey } from "@/lib/server-cache";

// --------------------------------------------------------------------------
// GET /api/chart/dasha-subperiods
// --------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;

    const parsed = DashaSubperiodsInputSchema.safeParse({
      parent_lord: sp.get("parent_lord") ?? "",
      parent_start: sp.get("parent_start") ?? "",
      parent_end: sp.get("parent_end") ?? "",
      level: sp.get("level") ?? "2",
      parent_lords: sp.get("parent_lords") ?? "",
      sequence_start: sp.get("sequence_start") || undefined,
      sequence_end: sp.get("sequence_end") || undefined,
    });

    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, firstZodError(parsed.error));
    }

    const {
      parent_lord,
      parent_start,
      parent_end,
      level,
      parent_lords: parentLordsStr,
      sequence_start,
      sequence_end,
    } = parsed.data;

    const parentLords = parentLordsStr ? parentLordsStr.split(",") : [];

    // -- Cache lookup --
    const cacheKey = makeCacheKey("dasha", {
      lord: parent_lord,
      start: parent_start,
      end: parent_end,
      level,
      lords: parentLordsStr,
      seqStart: sequence_start,
      seqEnd: sequence_end,
    });

    const cached = serverCaches.dasha.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": "private, max-age=1800",
          "X-Cache": "HIT",
        },
      });
    }

    // -- Compute --
    const result = computeSubPeriods(
      parent_lord,
      parent_start,
      parent_end,
      level,
      parentLords,
      sequence_start,
      sequence_end,
    );

    serverCaches.dasha.set(cacheKey, result);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, max-age=1800",
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("Dasha subperiods API error:", error);
    return errorResponse(error, "Dasha subperiod calculation failed");
  }
}
