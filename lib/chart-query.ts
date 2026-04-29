import { profileInitialState, type ProfileQueryInput } from "@/lib/astro-types";

type ProfileApiQuery = {
  name: string;
  birth_date: string;
  birth_time: string;
  engine_id: string;
  timezone_offset_minutes: string;
  latitude: string;
  longitude: string;
  country: string;
  state: string;
  city: string;
  town: string;
  time_zone_id: string;
  birth_time_accuracy: string;
  birth_time_source: string;
  birth_time_fallback: string;
};

type ProfileApiQuerySource = ProfileQueryInput | URLSearchParams | string;
type QueryValue = string | number | boolean | null | undefined;

export const profileQueryKeys = [
  "name",
  "birthDate",
  "birthTime",
  "engineId",
  "timezoneOffsetMinutes",
  "latitude",
  "longitude",
  "country",
  "state",
  "city",
  "town",
  "timeZoneId",
  "birthTimeAccuracy",
  "birthTimeSource",
  "birthTimeFallback",
] as const satisfies ReadonlyArray<keyof ProfileQueryInput>;

const profileApiQueryFields = [
  ["name", "name", ""],
  ["birthDate", "birth_date", ""],
  ["birthTime", "birth_time", ""],
  ["engineId", "engine_id", "lahiri_classic"],
  ["timezoneOffsetMinutes", "timezone_offset_minutes", "0"],
  ["latitude", "latitude", "0"],
  ["longitude", "longitude", "0"],
  ["country", "country", ""],
  ["state", "state", ""],
  ["city", "city", ""],
  ["town", "town", ""],
  ["timeZoneId", "time_zone_id", ""],
  ["birthTimeAccuracy", "birth_time_accuracy", ""],
  ["birthTimeSource", "birth_time_source", ""],
  ["birthTimeFallback", "birth_time_fallback", ""],
] as const satisfies ReadonlyArray<
  readonly [keyof ProfileQueryInput, keyof ProfileApiQuery, string]
>;

const profileLocationApiQueryKeys = [
  "timezone_offset_minutes",
  "latitude",
  "longitude",
] as const satisfies ReadonlyArray<keyof ProfileApiQuery>;

function toSearchParams(input: string | URLSearchParams) {
  if (typeof input !== "string") {
    return input;
  }

  return new URLSearchParams(input.startsWith("?") ? input.slice(1) : input);
}

function isSearchParamsSource(input: ProfileApiQuerySource): input is string | URLSearchParams {
  return typeof input === "string" || input instanceof URLSearchParams;
}

export function parseProfileQueryString(queryString: string): ProfileQueryInput {
  const params = toSearchParams(queryString);

  return profileQueryKeys.reduce<ProfileQueryInput>(
    (profile, key) => ({
      ...profile,
      [key]: params.get(key) ?? "",
    }),
    { ...profileInitialState }
  );
}

export function buildProfileApiQuery(input: ProfileApiQuerySource): ProfileApiQuery {
  if (isSearchParamsSource(input)) {
    const params = toSearchParams(input);

    return profileApiQueryFields.reduce<ProfileApiQuery>(
      (query, [profileKey, apiKey, defaultValue]) => ({
        ...query,
        [apiKey]: params.get(profileKey) ?? defaultValue,
      }),
      {} as ProfileApiQuery
    );
  }

  return profileApiQueryFields.reduce<ProfileApiQuery>(
    (query, [profileKey, apiKey, defaultValue]) => ({
      ...query,
      [apiKey]: input[profileKey] ?? defaultValue,
    }),
    {} as ProfileApiQuery
  );
}

export function appendChartApiSearchParams(
  searchParams: URLSearchParams,
  query: Record<string, QueryValue>
) {
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  return searchParams;
}

export function appendProfileApiSearchParams(
  searchParams: URLSearchParams,
  input: ProfileApiQuerySource
) {
  return appendChartApiSearchParams(searchParams, buildProfileApiQuery(input));
}

export function appendProfileLocationApiSearchParams(
  searchParams: URLSearchParams,
  input: ProfileApiQuerySource
) {
  const profileApiQuery = buildProfileApiQuery(input);
  const locationQuery = profileLocationApiQueryKeys.reduce<Record<string, string>>(
    (query, key) => ({
      ...query,
      [key]: profileApiQuery[key],
    }),
    {}
  );

  return appendChartApiSearchParams(searchParams, locationQuery);
}

export function buildProfileApiSearchParams(input: ProfileApiQuerySource) {
  const params = new URLSearchParams();
  appendProfileApiSearchParams(params, input);
  return params;
}

export function buildBirthProfileApiUrl(
  pathname: string,
  origin: string,
  input: ProfileApiQuerySource,
  query: Record<string, QueryValue> = {}
) {
  const url = new URL(pathname, origin);
  appendProfileApiSearchParams(url.searchParams, input);
  appendChartApiSearchParams(url.searchParams, query);
  return url.toString();
}

export function buildBirthDetailsPayload(profile: ProfileQueryInput) {
  const query = buildProfileApiQuery(profile);

  return {
    name: query.name.trim(),
    birth_date: query.birth_date,
    birth_time: query.birth_time,
    engine_id: query.engine_id.trim() || "lahiri_classic",
    timezone_offset_minutes: Number(query.timezone_offset_minutes || "0"),
    latitude: Number(query.latitude || "0"),
    longitude: Number(query.longitude || "0"),
    country: query.country.trim(),
    state: query.state.trim(),
    city: query.city.trim(),
    town: query.town.trim(),
    time_zone_id: query.time_zone_id.trim(),
  };
}

export function buildSavedChartPayload(queryString: string, ascendantSign: string) {
  const profile = parseProfileQueryString(queryString);
  const query = buildProfileApiQuery(profile);

  return {
    name: query.name.trim(),
    city: query.city.trim(),
    birth_date: query.birth_date,
    birth_time: query.birth_time,
    timezone_offset_minutes: Number(query.timezone_offset_minutes || "0"),
    country: query.country.trim(),
    state: query.state.trim(),
    town: query.town.trim(),
    latitude: Number(query.latitude || "0"),
    longitude: Number(query.longitude || "0"),
    time_zone_id: query.time_zone_id.trim(),
    ascendant_sign: ascendantSign,
    query_string: queryString,
  };
}
