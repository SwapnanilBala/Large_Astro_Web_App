import { NextRequest, NextResponse } from "next/server";
import { outboundUserAgent } from "@/lib/site-url";
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

/*
 * Place suggestions as the visitor types, from Photon.
 *
 * These used to come from the public Nominatim server, whose usage policy
 * lists autocomplete among the uses that are "strictly forbidden and will get
 * you banned", and caps any client at one request a second -- a single person
 * typing a city fired several. A ban would land on the server's address, and
 * on Vercel that address is shared, so the failure would have been nobody
 * able to enter a birthplace at all.
 *
 * Photon is komoot's OpenStreetMap geocoder built for exactly this ("search-
 * as-you-type"), and its public API asks only that use be fair. It promises
 * no availability, so a failure here returns an empty list: the field still
 * takes typed text, and the one-off lookup that places the chart
 * (/api/geocode, still Nominatim, once per chart) is unaffected.
 *
 * Both are OpenStreetMap data, credited under the suggestion list (see
 * .autocomplete-dropdown::after).
 */
const PHOTON_URL = "https://photon.komoot.io/api/";
const SUGGEST_TIMEOUT_MS = 6_000;
const MAX_PARAM_LENGTH = 200;

// Map of common country names to ISO 3166-1 alpha-2 codes, for keeping
// suggestions inside a country the visitor has already chosen.
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

/* Photon's layer per field. "city" covers towns and villages too. */
const layerFor: Record<string, string> = {
  country: "country",
  state: "state",
  city: "city",
};

type PhotonFeature = {
  properties?: {
    name?: string;
    state?: string;
    county?: string;
    country?: string;
    countrycode?: string;
    osm_key?: string;
    osm_value?: string;
  };
};

/*
 * Photon matches a partial word by prefix first, so for "Mumb" a town in
 * Angola came back ahead of Mumbai. Its results carry the OSM place class,
 * and for a birthplace the bigger settlement is the likelier answer, so city
 * sorts before town before village. Ties keep Photon's own order.
 */
const SETTLEMENT_RANK: Record<string, number> = {
  city: 0,
  town: 1,
  village: 2,
  suburb: 3,
  hamlet: 4,
  locality: 5,
};

function settlementRank(p: NonNullable<PhotonFeature["properties"]>): number {
  if (p.osm_key !== "place") return 7;
  return SETTLEMENT_RANK[p.osm_value ?? ""] ?? 6;
}

type Suggestion = {
  name: string;
  displayName: string;
  /*
   * The place this result sits inside, when the geocoder gave it to us.
   *
   * Purely additive: every existing caller reads `name` and `displayName` and
   * is unaffected. It exists so one "birth place" field can fill city, state
   * and country from a single choice -- without it `onSelect` hands back the
   * bare city name and the other two have to be typed again, which is the
   * whole reason that form asks three questions to learn one fact.
   */
  state?: string;
  country?: string;
};

function normalizeLocationName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreStateSuggestion(query: string, suggestion: Suggestion) {
  const normalizedQuery = normalizeLocationName(query);
  const normalizedName = normalizeLocationName(suggestion.name);
  const normalizedDisplay = normalizeLocationName(suggestion.displayName);
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);

  if (!normalizedName || !normalizedQuery) return -1;
  if (normalizedName === normalizedQuery) return 100;
  if (normalizedName.startsWith(normalizedQuery)) return 90;
  if (normalizedName.includes(normalizedQuery)) return 80;
  if (queryTokens.every((token) => normalizedName.includes(token))) return 70;
  if (queryTokens.every((token) => normalizedDisplay.includes(token))) return 50;

  return -1;
}

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

    const countryName = contextCountry.trim();
    const countryCode = countryCodeMap[countryName.toLowerCase()]?.toUpperCase();
    const wantState = normalizeLocationName(contextState);

    const photonUrl = new URL(PHOTON_URL);
    photonUrl.searchParams.set("q", query);
    photonUrl.searchParams.set("lang", "en");
    photonUrl.searchParams.set("layer", layerFor[type] ?? "city");
    /* More than will be shown when a country is fixed: those are filtered
       down below, and Photon ranks worldwide. */
    photonUrl.searchParams.set("limit", countryName && type !== "country" ? "15" : "8");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SUGGEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(photonUrl.toString(), {
        headers: { "User-Agent": outboundUserAgent() },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      logApiError("/api/suggest", new Error(`Photon returned ${response.status}`), {
        url: photonUrl.toString(),
        status: response.status,
      });
      return NextResponse.json({ error: "Suggestion service temporarily unavailable", results: [] });
    }

    const data = (await response.json()) as { features?: PhotonFeature[] };

    const inCountry = (p: NonNullable<PhotonFeature["properties"]>) => {
      if (!countryName || type === "country") return true;
      if (countryCode && p.countrycode) return p.countrycode.toUpperCase() === countryCode;
      return normalizeLocationName(p.country ?? "") === normalizeLocationName(countryName);
    };

    const suggestions: Suggestion[] = (data.features ?? [])
      .map((feature) => feature.properties ?? {})
      .filter(inCountry)
      .sort((a, b) => (type === "city" ? settlementRank(a) - settlementRank(b) : 0))
      .map((p) => {
        const name = p.name ?? "";
        if (type === "country") {
          return { name, displayName: name, country: p.country ?? name };
        }
        if (type === "state") {
          return {
            name,
            displayName: [name, p.country].filter(Boolean).join(", "),
            state: name,
            country: p.country ?? undefined,
          };
        }
        /* `county` is the fallback where a place has no administrative
           state, which is common outside the US. */
        const state = p.state ?? p.county ?? undefined;
        return {
          name,
          displayName: [name, state, p.country].filter(Boolean).join(", "),
          state,
          country: p.country ?? undefined,
        };
      })
      /* A state already chosen ranks its own places first, without hiding the
         rest -- spellings of a state differ, and hiding on a near miss would
         leave the list empty. */
      .sort((a, b) => {
        if (type !== "city" || !wantState) return 0;
        const aHit = normalizeLocationName(a.state ?? "") === wantState ? 0 : 1;
        const bHit = normalizeLocationName(b.state ?? "") === wantState ? 0 : 1;
        return aHit - bHit;
      });

    const rankedSuggestions: Suggestion[] = type === "state"
      ? suggestions
          .map((suggestion) => ({
            ...suggestion,
            score: scoreStateSuggestion(query, suggestion),
          }))
          .filter((suggestion) => suggestion.score >= 0)
          .sort((a, b) => b.score - a.score)
          .map(({ score: _score, ...suggestion }) => suggestion)
      : suggestions;

    /* One entry per place, not per name: keyed on the name alone, the five
       Springfields collapsed into whichever came first, so someone born in
       Springfield, Ohio could only choose Massachusetts -- and the chart is
       then built from the wrong coordinates. */
    const seen = new Set<string>();
    const unique = rankedSuggestions.filter((s) => {
      if (!s.name) return false;
      const key = [s.name, s.state, s.country].map((part) => normalizeLocationName(part ?? "")).join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 5);

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
