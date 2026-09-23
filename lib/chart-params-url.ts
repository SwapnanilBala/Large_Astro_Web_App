/**
 * The URL half of chart parameters: reading them off a request, checking the
 * required ones are there, and writing them back into a query string.
 *
 * Split out of lib/chart-params.ts so the browser can use it. That module
 * also builds charts, so it imports the whole engine, the rules and a
 * crypto-hashed cache at its top -- and a client component importing even one
 * string helper from it was shipping all of that to the browser, including
 * Node's crypto shim, whose vm polyfill is an eval. Nothing here imports
 * anything; lib/chart-params.ts re-exports all of it, so server code is
 * unchanged. lib/__tests__/chart-params-url keeps this file import-free.
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

/** Rebuild the query string for linking between the two trees. */
export function chartParamsToQuery(params: ChartParams): string {
  const search = new URLSearchParams();
  (Object.entries(params) as [string, string][]).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  return search.toString();
}
