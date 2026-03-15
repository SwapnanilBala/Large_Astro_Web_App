import { profileInitialState, type ProfileQueryInput } from "@/lib/astro-types";

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
] as const satisfies ReadonlyArray<keyof ProfileQueryInput>;

export function parseProfileQueryString(queryString: string): ProfileQueryInput {
  const params = new URLSearchParams(queryString.startsWith("?") ? queryString.slice(1) : queryString);

  return profileQueryKeys.reduce<ProfileQueryInput>(
    (profile, key) => ({
      ...profile,
      [key]: params.get(key) ?? "",
    }),
    { ...profileInitialState }
  );
}

export function buildBirthDetailsPayload(profile: ProfileQueryInput) {
  return {
    name: profile.name.trim(),
    birth_date: profile.birthDate,
    birth_time: profile.birthTime,
    engine_id: profile.engineId.trim() || "lahiri_classic",
    timezone_offset_minutes: Number(profile.timezoneOffsetMinutes || "0"),
    latitude: Number(profile.latitude || "0"),
    longitude: Number(profile.longitude || "0"),
    country: profile.country.trim(),
    state: profile.state.trim(),
    city: profile.city.trim(),
    town: profile.town.trim(),
    time_zone_id: profile.timeZoneId.trim(),
  };
}

export function buildSavedChartPayload(queryString: string, ascendantSign: string) {
  const profile = parseProfileQueryString(queryString);

  return {
    name: profile.name.trim(),
    city: profile.city.trim(),
    birth_date: profile.birthDate,
    birth_time: profile.birthTime,
    timezone_offset_minutes: Number(profile.timezoneOffsetMinutes || "0"),
    country: profile.country.trim(),
    state: profile.state.trim(),
    town: profile.town.trim(),
    latitude: Number(profile.latitude || "0"),
    longitude: Number(profile.longitude || "0"),
    time_zone_id: profile.timeZoneId.trim(),
    ascendant_sign: ascendantSign,
    query_string: queryString,
  };
}
