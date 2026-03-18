import { NextRequest, NextResponse } from "next/server";
import { findMuhurta } from "@/lib/engines/muhurta-engine";
import type { MuhurtaActivity } from "@/lib/engines/muhurta-engine";
import { MuhurtaInputSchema, firstZodError } from "@/lib/schemas";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import { serverCaches, makeCacheKey } from "@/lib/server-cache";

const CACHE_HEADER = "private, max-age=3600";

// --------------------------------------------------------------------------
// GET /api/muhurta
// --------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;

    const parsed = MuhurtaInputSchema.safeParse({
      activity: sp.get("activity") ?? "",
      start_date: sp.get("start_date") ?? "",
      end_date: sp.get("end_date") ?? "",
      latitude: sp.get("latitude") ?? "0",
      longitude: sp.get("longitude") ?? "0",
      timezone_offset_minutes: sp.get("timezone_offset_minutes") ?? "0",
    });

    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, firstZodError(parsed.error));
    }

    const { activity, start_date, end_date, latitude, longitude, timezone_offset_minutes } =
      parsed.data;

    // -- Cache lookup --
    const cacheKey = makeCacheKey("muhurta", {
      activity,
      start_date,
      end_date,
      lat: latitude,
      lng: longitude,
      tz: timezone_offset_minutes,
    });

    const cached = serverCaches.muhurta.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": CACHE_HEADER,
          "X-Cache": "HIT",
        },
      });
    }

    // -- Compute --
    // Parse dates: treat as local noon to avoid day-boundary issues
    const startDate = new Date(`${start_date}T00:00:00Z`);
    const endDate = new Date(`${end_date}T23:59:59Z`);

    // Adjust to UTC by subtracting timezone offset
    const startUtc = new Date(startDate.getTime() - timezone_offset_minutes * 60 * 1000);
    const endUtc = new Date(endDate.getTime() - timezone_offset_minutes * 60 * 1000);

    const windows = findMuhurta(
      activity as MuhurtaActivity,
      startUtc,
      endUtc,
      latitude,
      longitude,
      timezone_offset_minutes,
    );

    const result = {
      activity,
      activity_label: activity.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      search_window: { start_date, end_date },
      timezone_offset_minutes,
      windows,
      computed_at_utc: new Date().toISOString(),
    };

    serverCaches.muhurta.set(cacheKey, result);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": CACHE_HEADER,
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("Muhurta API error:", error);
    return errorResponse(error, "Muhurta calculation failed");
  }
}
