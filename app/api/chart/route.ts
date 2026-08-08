import { NextRequest, NextResponse } from "next/server";
import { buildChart } from "@/lib/engines/chart-service";
import type { BirthDetailsInput } from "@/lib/engines/compatibility-service";
import { BirthInputSchema, firstZodError } from "@/lib/schemas";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import { serverCaches, makeCacheKey } from "@/lib/server-cache";
import { RULES_SCHEMA_VERSION } from "@/lib/rules";

// ---------------------------------------------------------------------------
// Structured error logger
// ---------------------------------------------------------------------------

function logApiError(route: string, error: unknown, context?: Record<string, unknown>) {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    route,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
  }));
}

const CACHE_HEADER = "private, max-age=3600, stale-while-revalidate=1800";

// --------------------------------------------------------------------------
// GET /api/chart  (query-string based)
// --------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;

    const parsed = BirthInputSchema.safeParse({
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
    });

    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, firstZodError(parsed.error));
    }

    const birth = parsed.data as BirthDetailsInput;
    const includeTransits = sp.get("include_transits") === "true";

    // -- Cache lookup --
    const cacheKey = makeCacheKey("chart", {
      name: birth.name,
      birth_date: birth.birth_date,
      birth_time: birth.birth_time,
      engine_id: birth.engine_id,
      tz: birth.timezone_offset_minutes,
      lat: birth.latitude,
      lng: birth.longitude,
      transits: includeTransits,
      rules_schema: RULES_SCHEMA_VERSION,
    });

    const cached = serverCaches.chart.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": CACHE_HEADER,
          "X-Cache": "HIT",
        },
      });
    }

    // -- Compute --
    const result = buildChart(birth, {
      includeTransits,
      includePremium: true,
      includeUltimate: true,
      subscriptionTier: "guest",
    });

    serverCaches.chart.set(cacheKey, result);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": CACHE_HEADER,
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    logApiError("/api/chart [GET]", error, {
      params: Object.fromEntries(request.nextUrl.searchParams.entries()),
    });
    return errorResponse(error, "Chart calculation failed");
  }
}

// --------------------------------------------------------------------------
// POST /api/chart  (JSON body based)
// --------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sp = request.nextUrl.searchParams;
    const includeTransits = sp.get("include_transits") === "true";

    const parsed = BirthInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, firstZodError(parsed.error));
    }

    const birth = parsed.data as BirthDetailsInput;

    // -- Cache lookup --
    const cacheKey = makeCacheKey("chart", {
      name: birth.name,
      birth_date: birth.birth_date,
      birth_time: birth.birth_time,
      engine_id: birth.engine_id,
      tz: birth.timezone_offset_minutes,
      lat: birth.latitude,
      lng: birth.longitude,
      transits: includeTransits,
      rules_schema: RULES_SCHEMA_VERSION,
    });

    const cached = serverCaches.chart.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": CACHE_HEADER,
          "X-Cache": "HIT",
        },
      });
    }

    // -- Compute --
    const result = buildChart(birth, {
      includeTransits,
      includePremium: true,
      includeUltimate: true,
      subscriptionTier: "guest",
    });

    serverCaches.chart.set(cacheKey, result);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": CACHE_HEADER,
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    logApiError("/api/chart [POST]", error);
    return errorResponse(error, "Chart calculation failed");
  }
}
