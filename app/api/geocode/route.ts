import { NextRequest, NextResponse } from "next/server";
import tzLookup from "tz-lookup";
import { getTimezoneOffset } from "date-fns-tz";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const city = searchParams.get("city") ?? "";
  const state = searchParams.get("state") ?? "";
  const country = searchParams.get("country") ?? "";
  const birthDate = searchParams.get("birthDate") ?? "";
  const birthTime = searchParams.get("birthTime") ?? "";

  if (!city && !state && !country) {
    return NextResponse.json(
      { error: "At least one location param required" },
      { status: 400 }
    );
  }

  const query = [city, state, country].filter(Boolean).join(", ");

  try {
    const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search");
    nominatimUrl.searchParams.set("q", query);
    nominatimUrl.searchParams.set("format", "json");
    nominatimUrl.searchParams.set("limit", "1");

    const response = await fetch(nominatimUrl.toString(), {
      headers: {
        "User-Agent": "AstroIntelligenceStudio/1.0 (educational-astrology-app)",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Geocoding service error" },
        { status: 502 }
      );
    }

    const data = await response.json();
    if (!data.length) {
      return NextResponse.json({ lat: null, lon: null, found: false });
    }

    const latitude = Number(data[0].lat);
    const longitude = Number(data[0].lon);
    let timeZoneId = "";
    let timezoneOffsetMinutes: number | null = null;

    try {
      timeZoneId = tzLookup(latitude, longitude);
      if (birthDate && birthTime) {
        timezoneOffsetMinutes = Math.round(
          getTimezoneOffset(timeZoneId, new Date(`${birthDate}T${birthTime}:00`)) / 60000
        );
      }
    } catch {
      timeZoneId = "";
      timezoneOffsetMinutes = null;
    }

    return NextResponse.json({
      lat: data[0].lat,
      lon: data[0].lon,
      displayName: data[0].display_name,
      timeZoneId,
      timezoneOffsetMinutes,
      found: true,
    });
  } catch {
    return NextResponse.json(
      { error: "Geocoding request failed" },
      { status: 500 }
    );
  }
}
