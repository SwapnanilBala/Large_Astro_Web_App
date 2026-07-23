import { NextRequest, NextResponse } from "next/server";
import tzLookup from "tz-lookup";
import { getTimezoneOffset } from "date-fns-tz";
import { nominatimFetch } from "@/lib/nominatim-throttle";
import { GeocodeInputSchema, firstZodError } from "@/lib/schemas";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import { serverCaches, makeCacheKey } from "@/lib/server-cache";

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

const NOMINATIM_TIMEOUT_MS = 10_000;
const MAX_PARAM_LENGTH = 200;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    // -- Input validation: trim and length limits --
    const rawCity = (searchParams.get("city") ?? "").trim();
    const rawState = (searchParams.get("state") ?? "").trim();
    const rawCountry = (searchParams.get("country") ?? "").trim();
    const rawBirthDate = (searchParams.get("birthDate") ?? "").trim();
    const rawBirthTime = (searchParams.get("birthTime") ?? "").trim();

    if (
      rawCity.length > MAX_PARAM_LENGTH ||
      rawState.length > MAX_PARAM_LENGTH ||
      rawCountry.length > MAX_PARAM_LENGTH
    ) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        "Parameter exceeds maximum length of 200 characters",
      );
    }

    const parsed = GeocodeInputSchema.safeParse({
      city: rawCity,
      state: rawState,
      country: rawCountry,
      birthDate: rawBirthDate,
      birthTime: rawBirthTime,
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);
    let response: Response;
    try {
      response = await nominatimFetch(nominatimUrl.toString(), {
        headers: {
          "User-Agent": "AstroIntelligenceStudio/1.0 (educational-astrology-app)",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      logApiError("/api/geocode", new Error(`Nominatim returned ${response.status}`), {
        url: nominatimUrl.toString(),
        status: response.status,
        query,
      });
      return NextResponse.json(
        { found: false, error: "Geocoding service unavailable" },
        { status: 502 },
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

    let timezoneError: string | undefined;
    try {
      timeZoneId = tzLookup(latitude, longitude);
      if (birthDate && birthTime) {
        timezoneOffsetMinutes = Math.round(
          getTimezoneOffset(timeZoneId, new Date(`${birthDate}T${birthTime}:00`)) / 60000
        );
      }
    } catch (tzError) {
      logApiError("/api/geocode", tzError, {
        context: "timezone_lookup",
        latitude,
        longitude,
      });
      timeZoneId = "";
      timezoneOffsetMinutes = null;
      timezoneError = "Timezone lookup failed";
    }

    const result: Record<string, unknown> = {
      lat: latitude,
      lon: longitude,
      displayName: data[0].display_name,
      timeZoneId,
      timezoneOffsetMinutes,
      found: true,
    };

    if (timezoneError) {
      result.error = timezoneError;
    }

    serverCaches.geocode.set(cacheKey, result);

    return NextResponse.json(result, {
      headers: { "X-Cache": "MISS" },
    });
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    logApiError("/api/geocode", error, {
      type: isTimeout ? "timeout" : "unknown",
    });
    if (isTimeout) {
      return NextResponse.json(
        { found: false, error: "Geocoding service timed out" },
        { status: 504 },
      );
    }
    return errorResponse(error, "Geocoding request failed");
  }
}
