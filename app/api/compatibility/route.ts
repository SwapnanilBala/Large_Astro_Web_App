import { NextRequest, NextResponse } from "next/server";
import { buildCompatibility } from "@/lib/engines/compatibility-service";
import type { BirthDetailsInput } from "@/lib/engines/compatibility-service";
import { CompatibilityInputSchema, firstZodError } from "@/lib/schemas";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import { serverCaches, makeCacheKey } from "@/lib/server-cache";

const CACHE_HEADER = "private, max-age=3600, stale-while-revalidate=1800";

// --------------------------------------------------------------------------
// POST /api/compatibility
// --------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = CompatibilityInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, firstZodError(parsed.error));
    }

    const primary = parsed.data.primary as BirthDetailsInput;
    const partner = parsed.data.partner as BirthDetailsInput;

    // -- Cache lookup --
    const cacheKey = makeCacheKey("compat", {
      p_name: primary.name,
      p_bd: primary.birth_date,
      p_bt: primary.birth_time,
      p_eng: primary.engine_id,
      p_tz: primary.timezone_offset_minutes,
      p_lat: primary.latitude,
      p_lng: primary.longitude,
      r_name: partner.name,
      r_bd: partner.birth_date,
      r_bt: partner.birth_time,
      r_eng: partner.engine_id,
      r_tz: partner.timezone_offset_minutes,
      r_lat: partner.latitude,
      r_lng: partner.longitude,
    });

    const cached = serverCaches.compatibility.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": CACHE_HEADER,
          "X-Cache": "HIT",
        },
      });
    }

    // -- Compute --
    const result = buildCompatibility(primary, partner);

    serverCaches.compatibility.set(cacheKey, result);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": CACHE_HEADER,
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("Compatibility API error:", error);
    return errorResponse(error, "Compatibility calculation failed");
  }
}
