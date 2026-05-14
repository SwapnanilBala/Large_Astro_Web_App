import { NextRequest, NextResponse } from "next/server";
import { buildCalendarPlanner } from "@/lib/engines/calendar-planner-engine";
import { CalendarPlannerInputSchema, firstZodError } from "@/lib/schemas";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";

const CACHE_HEADER = "private, max-age=300";

// --------------------------------------------------------------------------
// GET /api/calendar
// --------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;

    const parsed = CalendarPlannerInputSchema.safeParse({
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
      start_date: sp.get("start_date") ?? "",
      end_date: sp.get("end_date") ?? "",
      intent: sp.get("intent") || undefined,
    });

    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, firstZodError(parsed.error));
    }

    const result = buildCalendarPlanner(parsed.data);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": CACHE_HEADER,
      },
    });
  } catch (error) {
    console.error("Calendar planner API error:", error);
    return errorResponse(error, "Calendar planner calculation failed");
  }
}
