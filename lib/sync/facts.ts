/**
 * Turning the /insights query string into the facts a row needs.
 *
 * The query string is already the app's canonical description of a chart's
 * inputs — it is what /insights renders from, what chart history stores and
 * what a shared link carries. Deriving the database columns from it, rather
 * than having the client send a parallel set of fields, means there is one
 * definition of "what a chart's input is" and no second list to forget to
 * update.
 *
 * Nothing here trusts the input. It shapes it; `ChartSyncFactsSchema` in
 * lib/schemas.ts is the gate.
 */

import { parseProfileQueryString } from "@/lib/chart-query";

/** What the engine version is recorded as on a stored calculation. */
export const CALCULATION_VERSION = "astronomy-engine-2026-09-v1";

export type ChartFactsCandidate = {
  facts: {
    name: string;
    birthDate: string;
    birthTime: string;
    latitude: number | null;
    longitude: number | null;
    timezoneOffsetMinutes: number;
    timeZoneId: string;
    country: string;
    state: string;
    city: string;
    town: string;
  };
  engineId: string;
  birthTimeAccuracy: string;
  birthTimeIsFallback: boolean;
};

/**
 * Coordinates are stored as a pair or not at all —
 * birth_profiles_coordinate_pair_check enforces `(lat is null) = (long is
 * null)`. A query string carrying one usable value and one blank is therefore
 * not half-usable; it is a chart with no location.
 */
function coordinatePair(rawLatitude: string, rawLongitude: string) {
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);

  const usable =
    rawLatitude.trim() !== "" &&
    rawLongitude.trim() !== "" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  return usable ? { latitude, longitude } : { latitude: null, longitude: null };
}

export function chartFactsFromQueryString(queryString: string): ChartFactsCandidate {
  const profile = parseProfileQueryString(queryString);
  const offset = Number(profile.timezoneOffsetMinutes);

  return {
    facts: {
      name: profile.name,
      birthDate: profile.birthDate,
      birthTime: profile.birthTime,
      ...coordinatePair(profile.latitude, profile.longitude),
      /* A blank offset is 0, not NaN. UTC is a real answer and the intake
         leaves the field empty for it. */
      timezoneOffsetMinutes: Number.isFinite(offset) ? offset : 0,
      timeZoneId: profile.timeZoneId,
      country: profile.country,
      state: profile.state,
      city: profile.city,
      town: profile.town,
    },
    engineId: profile.engineId || "lahiri_classic",
    birthTimeAccuracy: profile.birthTimeAccuracy || "exact",
    /* The intake writes "fallback" here when it had to invent a time. */
    birthTimeIsFallback: profile.birthTimeFallback === "fallback",
  };
}

/**
 * `time` columns want HH:MM:SS; the intake produces HH:MM.
 *
 * Widening here rather than in the schema keeps the query string the app
 * already builds unchanged.
 */
export function toSqlTime(value: string): string {
  const [hours = "00", minutes = "00", seconds = "00"] = value.trim().split(":");
  return [
    hours.padStart(2, "0"),
    minutes.padStart(2, "0"),
    seconds.padStart(2, "0"),
  ].join(":");
}

export type BirthTimeColumns = {
  reportedBirthTime: string | null;
  calculationBirthTime: string;
  birthTimeAccuracy: string;
  calculationTimeIsFallback: boolean;
};

/**
 * Reconcile the app's two birth-time fields with the table's four columns.
 *
 * Two check constraints are in play, and between them they leave exactly two
 * legal shapes:
 *
 * - `birth_profiles_exact_time_check` — an "exact" accuracy requires a
 *   reported time equal to the calculation time, with the fallback flag clear.
 * - `birth_profiles_fallback_consistency_check` — anything else requires the
 *   fallback flag set.
 *
 * So a contradictory input — "exact" accuracy on a time the app had to invent —
 * is resolved down to "unknown" rather than rejected. The honest description of
 * an invented time is that nobody knows it, and refusing the whole chart over
 * a mislabelled field would lose data to make a point.
 */
export function resolveBirthTimeColumns(
  birthTime: string,
  accuracy: string,
  isFallback: boolean,
): BirthTimeColumns {
  const calculationBirthTime = toSqlTime(birthTime);
  const fallback = isFallback || accuracy !== "exact";

  return {
    reportedBirthTime: fallback ? null : calculationBirthTime,
    calculationBirthTime,
    birthTimeAccuracy: fallback ? (accuracy === "exact" ? "unknown" : accuracy) : "exact",
    calculationTimeIsFallback: fallback,
  };
}

/**
 * Which of the three sources the UTC offset actually came from.
 *
 * Named zone wins over coordinates: a zone id survives a boundary change or a
 * DST rule revision, and a latitude/longitude pair has to be re-resolved
 * against a tz database to mean anything.
 */
export function timezoneSource(facts: {
  timeZoneId: string;
  latitude: number | null;
  longitude: number | null;
}): "time_zone_id" | "coordinates" | "numeric_offset" {
  if (facts.timeZoneId.trim()) return "time_zone_id";
  if (facts.latitude !== null && facts.longitude !== null) return "coordinates";
  return "numeric_offset";
}
