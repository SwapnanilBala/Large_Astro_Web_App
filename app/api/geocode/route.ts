import { NextRequest, NextResponse } from "next/server";
import tzLookup from "tz-lookup";
import { getTimezoneOffset } from "date-fns-tz";
import { nominatimFetch } from "@/lib/nominatim-throttle";
import { GeocodeInputSchema, firstZodError } from "@/lib/schemas";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import { serverCaches, makeCacheKey } from "@/lib/server-cache";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const parsed = GeocodeInputSchema.safeParse({
      city: searchParams.get("city") ?? "",
      state: searchParams.get("state") ?? "",
      country: searchParams.get("country") ?? "",
      birthDate: searchParams.get("birthDate") ?? "",
      birthTime: searchParams.get("birthTime") ?? "",
    });

    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, firstZodError(parsed.error));
    }

    const { city, state, country, birthDate, birthTime } = parsed.data;
    const query = [city, state, country].filter(Boolean).join(", ");

    // -- Cache lookup --
    const cacheKey = makeCacheKey("geocode", {
      q: query,
      bd: birthDate,
      bt: birthTime,
    });

    const cached = serverCaches.geocode.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "X-Cache": "HIT" },
      });
    }

    const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search");
    nominatimUrl.searchParams.set("q", query);
    nominatimUrl.searchParams.set("format", "json");
    nominatimUrl.searchParams.set("limit", "1");

    const response = await nominatimFetch(nominatimUrl.toString(), {
      headers: {
        "User-Agent": "AstroIntelligenceStudio/1.0 (educational-astrology-app)",
      },
    });

    if (!response.ok) {
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "Geocoding service error",
      );
    }

    const data = await response.json();
    if (!data.length) {
      const notFound = { lat: null, lon: null, found: false };
      serverCaches.geocode.set(cacheKey, notFound);
      return NextResponse.json(notFound);
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

    const result = {
      lat: data[0].lat,
      lon: data[0].lon,
      displayName: data[0].display_name,
      timeZoneId,
      timezoneOffsetMinutes,
      found: true,
    };

    serverCaches.geocode.set(cacheKey, result);

    return NextResponse.json(result, {
      headers: { "X-Cache": "MISS" },
    });
  } catch (error) {
    console.error("Geocode API error:", error);
    return errorResponse(error, "Geocoding request failed");
  }
}
