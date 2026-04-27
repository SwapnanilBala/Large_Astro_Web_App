import { NextRequest, NextResponse } from "next/server";
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

function isBirthDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isBirthTime(value: string) {
  return /^\d{2}:\d{2}(:\d{2})?$/.test(value);
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const birthDate = sp.get("birth_date") ?? "";
  const birthTime = sp.get("birth_time") || "12:00";
  const engineId = sp.get("engine_id") || "lahiri_classic";
  const timezoneOffsetMinutes = Number.parseInt(sp.get("timezone_offset_minutes") ?? "0", 10);

  if (!isBirthDate(birthDate) || !isBirthTime(birthTime) || !Number.isFinite(timezoneOffsetMinutes)) {
    return NextResponse.json({ error: "Invalid sun sign input" }, { status: 400 });
  }

  const positions = calculate({
    ...parseBirthUtc(birthDate, birthTime, timezoneOffsetMinutes),
    latitude: 0,
    longitude: 0,
    engine_id: engineId,
  });

  const sun = positions.planets.find((planet) => planet.name === "Sun");
  if (!sun) {
    return NextResponse.json({ error: "Sun position unavailable" }, { status: 500 });
  }

  return NextResponse.json({
    sign: sun.sign,
    degree_in_sign: sun.degree_in_sign,
    longitude: sun.longitude,
    engine_id: engineId,
  });
}
