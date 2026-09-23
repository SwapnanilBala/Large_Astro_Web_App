import { NextRequest, NextResponse } from "next/server";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import { calculate } from "@/lib/engines/swiss-ephemeris-engine";

function parseBirthUtc(
  birthDate: string,
  birthTime: string,
  timezoneOffsetMinutes: number,
) {
  const [year, month, day] = birthDate.split("-").map(Number);
  const [hour = 12, minute = 0, second = 0] = birthTime.split(":").map(Number);
  const utcTotalMinutes = hour * 60 + minute - timezoneOffsetMinutes;
  const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, second));
  utcDate.setUTCMinutes(utcDate.getUTCMinutes() + utcTotalMinutes);

  return {
    utc_year: utcDate.getUTCFullYear(),
    utc_month: utcDate.getUTCMonth() + 1,
    utc_day: utcDate.getUTCDate(),
    utc_hour: utcDate.getUTCHours(),
    utc_minute: utcDate.getUTCMinutes(),
    utc_second: utcDate.getUTCSeconds(),
  };
}

/* A real calendar day, not just the shape of one: "1990-02-31" used to pass
   and quietly return the sun for 3 March. */
function isBirthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isBirthTime(value: string) {
  return /^\d{2}:\d{2}(:\d{2})?$/.test(value);
}

/* The offsets real time zones use, as the rest of the API bounds them. */
const MIN_OFFSET_MINUTES = -12 * 60;
const MAX_OFFSET_MINUTES = 14 * 60;

export async function GET(request: NextRequest) {
  /* Errors in the same { error: { code, message } } shape as every other
     route; this one used to return a bare string, and a throw inside the
     ephemeris escaped as an unformatted 500. */
  try {
    const sp = request.nextUrl.searchParams;
    const birthDate = sp.get("birth_date") ?? "";
    const birthTime = sp.get("birth_time") || "12:00";
    const engineId = sp.get("engine_id") || "lahiri_classic";
    const timezoneOffsetMinutes = Number.parseInt(sp.get("timezone_offset_minutes") ?? "0", 10);

    if (
      !isBirthDate(birthDate) ||
      !isBirthTime(birthTime) ||
      !Number.isFinite(timezoneOffsetMinutes) ||
      timezoneOffsetMinutes < MIN_OFFSET_MINUTES ||
      timezoneOffsetMinutes > MAX_OFFSET_MINUTES
    ) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        "A sun sign needs birth_date (a real YYYY-MM-DD date), birth_time (HH:MM) and a timezone_offset_minutes between -720 and 840.",
      );
    }

    const positions = calculate({
      ...parseBirthUtc(birthDate, birthTime, timezoneOffsetMinutes),
      latitude: 0,
      longitude: 0,
      engine_id: engineId,
    });

    const sun = positions.planets.find((planet) => planet.name === "Sun");
    if (!sun) {
      throw new ApiError(ErrorCode.INTERNAL, "Sun position unavailable", { statusCode: 500 });
    }

    return NextResponse.json({
      sign: sun.sign,
      degree_in_sign: sun.degree_in_sign,
      longitude: sun.longitude,
      engine_id: engineId,
    });
  } catch (error) {
    return errorResponse(error, "Sun sign lookup failed");
  }
}
