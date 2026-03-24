import { NextRequest, NextResponse } from "next/server";
import { nominatimFetch } from "@/lib/nominatim-throttle";
import { SuggestInputSchema } from "@/lib/schemas";
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

// Map of common country names to ISO 3166-1 alpha-2 codes for Nominatim countrycodes filter
const countryCodeMap: Record<string, string> = {
  india: "in",
  "united states": "us",
  "united states of america": "us",
  usa: "us",
  "united kingdom": "gb",
  uk: "gb",
  canada: "ca",
  australia: "au",
  germany: "de",
  france: "fr",
  japan: "jp",
  china: "cn",
  brazil: "br",
  mexico: "mx",
  russia: "ru",
  "south africa": "za",
  italy: "it",
  spain: "es",
  "south korea": "kr",
  indonesia: "id",
  netherlands: "nl",
  "new zealand": "nz",
  pakistan: "pk",
  bangladesh: "bd",
  "sri lanka": "lk",
  nepal: "np",
  singapore: "sg",
  malaysia: "my",
  thailand: "th",
  philippines: "ph",
  vietnam: "vn",
  "united arab emirates": "ae",
  uae: "ae",
  "saudi arabia": "sa",
  nigeria: "ng",
  egypt: "eg",
  kenya: "ke",
  sweden: "se",
  norway: "no",
  denmark: "dk",
  finland: "fi",
  poland: "pl",
  portugal: "pt",
  ireland: "ie",
  switzerland: "ch",
  austria: "at",
  belgium: "be",
  argentina: "ar",
  colombia: "co",
  chile: "cl",
  peru: "pe",
  turkey: "tr",
  israel: "il",
  iran: "ir",
  iraq: "iq",
  myanmar: "mm",
  cambodia: "kh",
};

const featureMap: Record<string, string> = {
  country: "country",
  state: "state",
  city: "city",
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    // -- Input validation: length limits --
    const rawQ = (searchParams.get("q") ?? "").trim();
    const rawType = (searchParams.get("type") ?? "city").trim();
    const rawCountry = (searchParams.get("country") ?? "").trim();
    const rawState = (searchParams.get("state") ?? "").trim();

    if (
      rawQ.length > MAX_PARAM_LENGTH ||
      rawType.length > MAX_PARAM_LENGTH ||
      rawCountry.length > MAX_PARAM_LENGTH ||
      rawState.length > MAX_PARAM_LENGTH
    ) {
      return NextResponse.json(
        { error: "Parameter exceeds maximum length of 200 characters", results: [] },
        { status: 400 },
      );
    }

    const parsed = SuggestInputSchema.safeParse({
      q: rawQ,
      type: rawType,
      country: rawCountry,
      state: rawState,
    });

    if (!parsed.success) {
      // For suggest, return empty results with error info on validation failure
      return NextResponse.json({ error: "Invalid input parameters", results: [] });
    }

    const { q: query, type, country: contextCountry, state: contextState } = parsed.data;

    // -- Cache lookup --
    const cacheKey = makeCacheKey("suggest", {
      q: query,
      type,
      country: contextCountry,
      state: contextState,
    });

    const cached = serverCaches.suggest.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "X-Cache": "HIT" },
      });
    }

    // Build a hierarchical query string so Nominatim scopes results correctly
    let fullQuery = query;
    if (type === "state" && contextCountry.trim()) {
      fullQuery = `${query}, ${contextCountry.trim()}`;
    } else if (type === "city") {
      const parts = [query];
      if (contextState.trim()) parts.push(contextState.trim());
      if (contextCountry.trim()) parts.push(contextCountry.trim());
      fullQuery = parts.join(", ");
    }

    const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search");
    nominatimUrl.searchParams.set("q", fullQuery);
    nominatimUrl.searchParams.set("format", "json");
    nominatimUrl.searchParams.set("limit", "5");
    nominatimUrl.searchParams.set("addressdetails", "1");

    if (featureMap[type]) {
      nominatimUrl.searchParams.set("featuretype", featureMap[type]);
    }

    // Apply countrycodes filter when we know the country
    if (contextCountry.trim()) {
      const code = countryCodeMap[contextCountry.trim().toLowerCase()];
      if (code) {
        nominatimUrl.searchParams.set("countrycodes", code);
      }
    }

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
      logApiError("/api/suggest", new Error(`Nominatim returned ${response.status}`), {
        url: nominatimUrl.toString(),
        status: response.status,
      });
      return NextResponse.json({ error: "Suggestion service temporarily unavailable", results: [] });
    }

    const data = await response.json();

    const suggestions = data.map(
      (item: { display_name?: string; name?: string; address?: Record<string, string> }) => {
        let name = item.name ?? "";

        if (type === "country" && item.address?.country) {
          name = item.address.country;
        } else if (type === "state" && item.address?.state) {
          name = item.address.state;
        } else if (type === "city") {
          name = item.address?.city ?? item.address?.town ?? item.name ?? "";
        }

        return {
          name,
          displayName: item.display_name ?? name,
        };
      }
    );

    const uniqueNames = new Set<string>();
    const unique = suggestions.filter((s: { name: string }) => {
      if (!s.name || uniqueNames.has(s.name)) return false;
      uniqueNames.add(s.name);
      return true;
    });

    serverCaches.suggest.set(cacheKey, unique);

    return NextResponse.json(unique, {
      headers: { "X-Cache": "MISS" },
    });
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    logApiError("/api/suggest", error, {
      type: isTimeout ? "timeout" : "unknown",
    });
    return NextResponse.json({
      error: isTimeout
        ? "Suggestion service timed out"
        : "Suggestion service temporarily unavailable",
      results: [],
    });
  }
}
