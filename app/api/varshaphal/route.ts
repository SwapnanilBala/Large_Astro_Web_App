import { NextRequest, NextResponse } from "next/server";
import { computeVarshaphal } from "@/lib/engines/varshaphal-engine";
import type { BirthDetailsInput } from "@/lib/engines/compatibility-service";
import { BirthInputSchema, firstZodError } from "@/lib/schemas";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import { serverCaches, makeCacheKey } from "@/lib/server-cache";
import { z } from "zod";

const CACHE_HEADER = "private, max-age=3600, stale-while-revalidate=1800";

const VarshaphalInputSchema = BirthInputSchema.extend({
  target_year: z.coerce
    .number({ error: "target_year is required" })
    .int("target_year must be an integer")
    .min(1900, "target_year must be 1900 or later")
    .max(2100, "target_year must be 2100 or earlier"),
});

// --------------------------------------------------------------------------
// GET /api/varshaphal
// --------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;

    const parsed = VarshaphalInputSchema.safeParse({
      name: sp.get("name") ?? "",
      birth_date: sp.get("birth_date") ?? "",
      birth_time: sp.get("birth_time") ?? "",
      engine_id: sp.get("engine_id") ?? "lahiri_classic",
      timezone_offset_minutes: sp.get("timezone_offset_minutes") ?? "0",
      latitude: sp.get("latitude") ?? "0",
      longitude: sp.get("longitude") ?? "0",
      country: sp.get("country") ?? "",
      state: sp.get("state") ?? "",
      city: sp.get("city") ?? "",
      town: sp.get("town") ?? "",
      time_zone_id: sp.get("time_zone_id") ?? "",
      birth_time_accuracy: sp.get("birth_time_accuracy") ?? "",
      birth_time_source: sp.get("birth_time_source") ?? "",
      birth_time_fallback: sp.get("birth_time_fallback") ?? "",
      target_year: sp.get("target_year") ?? "",
    });

    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, firstZodError(parsed.error));
    }

    const { target_year, ...birthFields } = parsed.data;
    const birth = birthFields as BirthDetailsInput;

    // Validate target_year is >= birth year
    const [birthYear] = birth.birth_date.split("-").map(Number);
    if (target_year < birthYear) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        `target_year (${target_year}) must be on or after the birth year (${birthYear})`,
      );
    }

    // -- Cache lookup --
    const cacheKey = makeCacheKey("varshaphal", {
      name: birth.name,
      birth_date: birth.birth_date,
      birth_time: birth.birth_time,
      engine_id: birth.engine_id,
      tz: birth.timezone_offset_minutes,
      lat: birth.latitude,
      lng: birth.longitude,
      year: target_year,
    });

    const cached = serverCaches.varshaphal.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": CACHE_HEADER,
          "X-Cache": "HIT",
        },
      });
    }

    // -- Compute --
    const result = computeVarshaphal(birth, target_year);

    serverCaches.varshaphal.set(cacheKey, result);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": CACHE_HEADER,
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("Varshaphal API error:", error);
    return errorResponse(error, "Varshaphal calculation failed");
  }
}
