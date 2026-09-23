import { buildChart, buildLifeDomainInsights } from "@/lib/engines/chart-service";
import type { BirthDetailsInput } from "@/lib/engines/compatibility-service";
import { BirthInputSchema, firstZodError } from "@/lib/schemas";
import { makeCacheKey, serverCaches } from "@/lib/server-cache";
import { RULES_SCHEMA_VERSION } from "@/lib/rules";
import { LIFE_DOMAIN_RULES_VERSION } from "@/lib/engines/rule-engine";
import type {
  ChartApiResponse,
  LifeDomainInsightsResponse,
  WeeklyEnergyResponse,
} from "@/lib/astro-types";
import {
  computeWeeklyEnergy,
  WEEKLY_ENERGY_MODEL_VERSION,
} from "@/lib/engines/weekly-energy-engine";
import type { ChartParams } from "@/lib/chart-params-url";

/* The URL helpers moved to ./chart-params-url so the browser can import them
   without this module's engine imports; re-exported so nothing else moves. */
export {
  REQUIRED_CHART_PARAMS,
  buildChartHistoryQuery,
  chartParamsToQuery,
  hasAllChartParams,
  readChartParams,
} from "@/lib/chart-params-url";
export type { ChartParams } from "@/lib/chart-params-url";

/**
 * Turning URL parameters into a chart.
 *
 * Both /insights and /m/insights run through this, so the two trees cannot
 * drift into computing different charts from the same link. A divergence here
 * would be invisible — the page would render fine and simply be wrong on one
 * device — so there is deliberately only one implementation.
 */

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

/**
 * The life-domain readings for a chart.
 *
 * getChartPayload builds with `deferLifeDomains: true`, so the domains are not
 * in the chart payload -- the results page fetches them separately once the
 * section scrolls close. /insights/life-areas renders them server-side instead,
 * because that page is nothing but the domains and a spinner for its whole
 * body would be the page.
 *
 * Extracted from app/api/chart/life-domains/route.ts rather than reimplemented
 * beside it: the cache key has to match exactly, or the page and the endpoint
 * compute the same readings twice under two entries and can disagree after a
 * rules bump.
 */
export function getLifeDomainPayload(
  chartParams: ChartParams,
): LifeDomainInsightsResponse {
  const birth = chartParamsToBirthInput(chartParams);

  const cacheKey = makeCacheKey("life_domains", {
    birth_date: birth.birth_date,
    birth_time: birth.birth_time,
    engine_id: birth.engine_id,
    tz: birth.timezone_offset_minutes,
    lat: birth.latitude,
    lng: birth.longitude,
    birth_time_accuracy: birth.birth_time_accuracy,
    birth_time_fallback: birth.birth_time_fallback,
    rules_schema: RULES_SCHEMA_VERSION,
    life_domain_rules: LIFE_DOMAIN_RULES_VERSION,
  });

  const cached = serverCaches.lifeDomains.get(cacheKey) as LifeDomainInsightsResponse | null;
  if (cached) return cached;

  const result: LifeDomainInsightsResponse = {
    generated_at_utc: new Date().toISOString(),
    insights: buildLifeDomainInsights(birth),
  };
  serverCaches.lifeDomains.set(cacheKey, result);
  return result;
}

/**
 * The weekly-energy reading for one chart and one week.
 *
 * Here rather than in the route for the same reason as getLifeDomainPayload:
 * the cache key lives in exactly one place. Two implementations of this key
 * would compute the same week twice under two entries and could disagree after
 * a model bump.
 *
 * Deliberately does NOT read payload.transits. getChartPayload's key carries
 * `transits: true` as a plain boolean against a one-hour chart TTL, so a cached
 * payload can hold aspects computed up to an hour ago -- and reading them here
 * would smear one moment's aspects across all seven days. The engine
 * recomputes positions per day, at that day's sunrise.
 */
export function getWeeklyEnergyPayload(
  chartParams: ChartParams,
  weekStart: string,
): WeeklyEnergyResponse {
  const birth = chartParamsToBirthInput(chartParams);

  /* No `name`: the reading does not depend on it, and including it would split
     the cache per spelling of the same person. Follows getLifeDomainPayload,
     not getChartPayload. `lng` is keyed even though the sunrise approximation
     currently ignores longitude -- a later true-sunrise fix will use it, and
     keying now avoids a silent stale-cache bug then. */
  const cacheKey = makeCacheKey("weekly_energy", {
    birth_date: birth.birth_date,
    birth_time: birth.birth_time,
    engine_id: birth.engine_id,
    tz: birth.timezone_offset_minutes,
    lat: birth.latitude,
    lng: birth.longitude,
    birth_time_accuracy: birth.birth_time_accuracy,
    birth_time_fallback: birth.birth_time_fallback,
    week_start: weekStart,
    model: WEEKLY_ENERGY_MODEL_VERSION,
  });

  const cached = serverCaches.weeklyEnergy.get(cacheKey) as WeeklyEnergyResponse | null;
  if (cached) return cached;

  /* The natal chart itself comes from the shared cache, so a reader who has
     already loaded /insights pays nothing extra for it here. */
  const chart = getChartPayload(chartParams);

  const week = computeWeeklyEnergy({
    weekStart,
    latitude: birth.latitude,
    longitude: birth.longitude,
    timezoneOffsetMinutes: birth.timezone_offset_minutes,
    engineId: birth.engine_id,
    natalPlanets: chart.chart.planets,
    ascendantSign: chart.chart.ascendant.sign,
  });

  const result: WeeklyEnergyResponse = {
    ...week,
    generated_at_utc: new Date().toISOString(),
  };
  serverCaches.weeklyEnergy.set(cacheKey, result);
  return result;
}
