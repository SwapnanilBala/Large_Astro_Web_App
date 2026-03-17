import { NextRequest, NextResponse } from "next/server";
import { nominatimFetch } from "@/lib/nominatim-throttle";
import { SuggestInputSchema } from "@/lib/schemas";
import { serverCaches, makeCacheKey } from "@/lib/server-cache";

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

    const parsed = SuggestInputSchema.safeParse({
      q: searchParams.get("q") ?? "",
      type: searchParams.get("type") ?? "city",
      country: searchParams.get("country") ?? "",
      state: searchParams.get("state") ?? "",
    });

    if (!parsed.success) {
      // For suggest, return empty array on validation failure (matches previous behavior)
      return NextResponse.json([]);
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

    const response = await nominatimFetch(nominatimUrl.toString(), {
      headers: {
        "User-Agent": "AstroIntelligenceStudio/1.0 (educational-astrology-app)",
      },
    });

    if (!response.ok) {
      return NextResponse.json([]);
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
  } catch {
    return NextResponse.json([]);
  }
}
