import { buildChart } from "@/lib/engines/chart-service";
import type { BirthDetailsInput } from "@/lib/engines/compatibility-service";
import { BirthInputSchema, firstZodError } from "@/lib/schemas";
import { makeCacheKey, serverCaches } from "@/lib/server-cache";
import { RULES_SCHEMA_VERSION } from "@/lib/rules";
import type { ChartApiResponse } from "@/lib/astro-types";

/**
 * Turning URL parameters into a chart.
 *
 * Both /insights and /m/insights run through this, so the two trees cannot
 * drift into computing different charts from the same link. A divergence here
 * would be invisible — the page would render fine and simply be wrong on one
 * device — so there is deliberately only one implementation.
 */

export const REQUIRED_CHART_PARAMS = [
  "name",
  "birthDate",
  "birthTime",
  "timezoneOffsetMinutes",
  "latitude",
  "longitude",
  "country",
  "state",
  "city",
] as const;

export type ChartParams = Record<(typeof REQUIRED_CHART_PARAMS)[number], string> & {
  town: string;
  timeZoneId: string;
  engineId: string;
  birthTimeAccuracy: string;
  birthTimeSource: string;
  birthTimeFallback: string;
};

type RawParams = Record<string, string | string[] | undefined>;

const getSingle = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

export function readChartParams(raw: RawParams): ChartParams {
  return {
    name: getSingle(raw.name),
    birthDate: getSingle(raw.birthDate),
    birthTime: getSingle(raw.birthTime),
    timezoneOffsetMinutes: getSingle(raw.timezoneOffsetMinutes),
    latitude: getSingle(raw.latitude),
    longitude: getSingle(raw.longitude),
    country: getSingle(raw.country),
    state: getSingle(raw.state),
    city: getSingle(raw.city),
    town: getSingle(raw.town),
    timeZoneId: getSingle(raw.timeZoneId),
    engineId: getSingle(raw.engineId) || "lahiri_classic",
    birthTimeAccuracy: getSingle(raw.birthTimeAccuracy),
    birthTimeSource: getSingle(raw.birthTimeSource),
    birthTimeFallback: getSingle(raw.birthTimeFallback),
  };
}

export function hasAllChartParams(params: ChartParams): boolean {
  return REQUIRED_CHART_PARAMS.every((key) => params[key].trim().length > 0);
}

export function chartParamsToBirthInput(chartParams: ChartParams): BirthDetailsInput {
  const parsed = BirthInputSchema.safeParse({
    name: chartParams.name,
    birth_date: chartParams.birthDate,
    birth_time: chartParams.birthTime,
    engine_id: chartParams.engineId || "lahiri_classic",
    timezone_offset_minutes: chartParams.timezoneOffsetMinutes,
    latitude: chartParams.latitude,
    longitude: chartParams.longitude,
    country: chartParams.country,
    state: chartParams.state,
    city: chartParams.city,
    town: chartParams.town,
    time_zone_id: chartParams.timeZoneId,
    birth_time_accuracy: chartParams.birthTimeAccuracy,
    birth_time_source: chartParams.birthTimeSource,
    birth_time_fallback: chartParams.birthTimeFallback,
  });

  if (!parsed.success) {
    throw new Error(firstZodError(parsed.error));
  }

  return parsed.data as BirthDetailsInput;
}

/**
 * Build the chart, reusing the server cache.
 *
 * The cache key covers only the inputs the ephemeris actually depends on, so
 * a desktop and a mobile request for the same birth details share one entry
 * rather than each paying the full computation.
 */
export function getChartPayload(chartParams: ChartParams): ChartApiResponse {
  const birth = chartParamsToBirthInput(chartParams);
  const includeTransits = true;

  const cacheKey = makeCacheKey("chart", {
    name: birth.name,
    birth_date: birth.birth_date,
    birth_time: birth.birth_time,
    engine_id: birth.engine_id,
    tz: birth.timezone_offset_minutes,
    lat: birth.latitude,
    lng: birth.longitude,
    transits: includeTransits,
    domains: "deferred",
    rules_schema: RULES_SCHEMA_VERSION,
  });

  const cached = serverCaches.chart.get(cacheKey) as ChartApiResponse | null;
  if (cached) return cached;

  const payload = buildChart(birth, {
    includeTransits,
    includePremium: true,
    includeUltimate: true,
    deferLifeDomains: true,
    subscriptionTier: "guest",
  }) as unknown as ChartApiResponse;

  serverCaches.chart.set(cacheKey, payload);
  return payload;
}

/** Rebuild the query string for linking between the two trees. */
/**
 * The query string a chart is filed and reopened under.
 *
 * Narrower than `chartParamsToQuery`, and deliberately: this is what lands in
 * chart history, in a shared link and in `chart_calculations.input_snapshot_json`,
 * so it carries the birth facts and the engine and nothing incidental to one
 * page view. Optional fields are omitted rather than sent blank, because the
 * string is compared and fingerprinted downstream and a trailing `&town=` would
 * make two identical charts look different.
 *
 * Lived in two loaders as identical copies before the mobile tree needed a
 * third.
 */
export function buildChartHistoryQuery(params: ChartParams): string {
  const qs: Record<string, string> = {
    name: params.name,
    birthDate: params.birthDate,
    birthTime: params.birthTime,
    timezoneOffsetMinutes: params.timezoneOffsetMinutes,
    latitude: params.latitude,
    longitude: params.longitude,
    country: params.country,
    state: params.state,
    city: params.city,
    engineId: params.engineId,
  };

  if (params.town) qs.town = params.town;
  if (params.timeZoneId) qs.timeZoneId = params.timeZoneId;
  if (params.birthTimeAccuracy) qs.birthTimeAccuracy = params.birthTimeAccuracy;
  if (params.birthTimeSource) qs.birthTimeSource = params.birthTimeSource;
  if (params.birthTimeFallback) qs.birthTimeFallback = params.birthTimeFallback;

  return new URLSearchParams(qs).toString();
}

export function chartParamsToQuery(params: ChartParams): string {
  const search = new URLSearchParams();
  (Object.entries(params) as [string, string][]).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  return search.toString();
}
