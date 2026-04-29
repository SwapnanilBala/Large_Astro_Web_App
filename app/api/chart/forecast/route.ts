import { NextRequest, NextResponse } from "next/server";
import { buildForecast } from "@/lib/engines/chart-service";
import type { BirthDetailsInput } from "@/lib/engines/compatibility-service";
import { ForecastInputSchema, firstZodError } from "@/lib/schemas";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import { serverCaches, makeCacheKey } from "@/lib/server-cache";

const CACHE_HEADER = "private, max-age=300";

// --------------------------------------------------------------------------
// GET /api/chart/forecast
// --------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;

    const parsed = ForecastInputSchema.safeParse({
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
      target_date: sp.get("target_date") ?? "",
    });

    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, firstZodError(parsed.error));
    }

    const { target_date, ...birthFields } = parsed.data;
    const birth = birthFields as BirthDetailsInput;

    // -- Cache lookup --
    const cacheKey = makeCacheKey("forecast", {
      name: birth.name,
      birth_date: birth.birth_date,
      birth_time: birth.birth_time,
      engine_id: birth.engine_id,
      tz: birth.timezone_offset_minutes,
      lat: birth.latitude,
      lng: birth.longitude,
      target: target_date,
    });

    const cached = serverCaches.forecast.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": CACHE_HEADER,
          "X-Cache": "HIT",
        },
      });
    }

    // -- Compute --
    const result = buildForecast(birth, target_date);

    serverCaches.forecast.set(cacheKey, result);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": CACHE_HEADER,
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("Forecast API error:", error);
    return errorResponse(error, "Forecast calculation failed");
  }
}
