import Link from "next/link";
import InsightsLoader from "@/app/insights/components/insights-loader";
import BackButton from "@/app/components/BackButton";
import PageTransition from "@/app/components/PageTransition";
import { buildChart } from "@/lib/engines/chart-service";
import type { BirthDetailsInput } from "@/lib/engines/compatibility-service";
import { BirthInputSchema, firstZodError } from "@/lib/schemas";
import { makeCacheKey, serverCaches } from "@/lib/server-cache";
import type { ChartApiResponse } from "@/lib/astro-types";

export const maxDuration = 60;

type InsightsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const requiredParams = [
  "name",
  "birthDate",
  "birthTime",
  "timezoneOffsetMinutes",
  "latitude",
  "longitude",
  "country",
  "state",
  "city"
] as const;

const getSingle = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

type ChartParams = Record<(typeof requiredParams)[number], string> & {
  town: string;
  timeZoneId: string;
  engineId: string;
  birthTimeAccuracy: string;
  birthTimeSource: string;
  birthTimeFallback: string;
};

function chartParamsToBirthInput(chartParams: ChartParams): BirthDetailsInput {
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

function getInitialChartPayload(chartParams: ChartParams): ChartApiResponse {
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
  });

  const cached = serverCaches.chart.get(cacheKey) as ChartApiResponse | null;
  if (cached) {
    return cached;
  }

  const payload = buildChart(birth, {
    includeTransits,
    includePremium: true,
    includeUltimate: true,
    subscriptionTier: "guest",
  }) as unknown as ChartApiResponse;
  serverCaches.chart.set(cacheKey, payload);
  return payload;
}

export default async function InsightsPage({ searchParams }: InsightsPageProps) {
  const rawParams = await searchParams;
  const params: Record<(typeof requiredParams)[number], string> = {
    name: getSingle(rawParams.name),
    birthDate: getSingle(rawParams.birthDate),
    birthTime: getSingle(rawParams.birthTime),
    timezoneOffsetMinutes: getSingle(rawParams.timezoneOffsetMinutes),
    latitude: getSingle(rawParams.latitude),
    longitude: getSingle(rawParams.longitude),
    country: getSingle(rawParams.country),
    state: getSingle(rawParams.state),
    city: getSingle(rawParams.city)
  };

  const town = getSingle(rawParams.town);
  const timeZoneId = getSingle(rawParams.timeZoneId);
  const engineId = getSingle(rawParams.engineId) || "lahiri_classic";
  const birthTimeAccuracy = getSingle(rawParams.birthTimeAccuracy);
  const birthTimeSource = getSingle(rawParams.birthTimeSource);
  const birthTimeFallback = getSingle(rawParams.birthTimeFallback);

  const hasAllInputs = requiredParams.every((param) => params[param].trim().length > 0);

  if (!hasAllInputs) {
    return (
      <PageTransition>
      <div className="insights-shell">
        <BackButton href="/" />
        <section className="dashboard-shell">
          <p className="kicker">Missing Input</p>
          <h1>Chart details are incomplete.</h1>
          <p className="lead">
            Please return to intake and provide complete birth metadata.
          </p>
          <Link href="/" className="ghost-link">
            Back to Intake
          </Link>
        </section>
      </div>
      </PageTransition>
    );
  }

  /* Build the query params object to pass to the client component */
  const chartParams: ChartParams = {
    ...params,
    town,
    timeZoneId,
    engineId,
    birthTimeAccuracy,
    birthTimeSource,
    birthTimeFallback,
  };

  let initialPayload: ChartApiResponse | null = null;
  let initialError = "";

  try {
    initialPayload = getInitialChartPayload(chartParams);
  } catch (error) {
    initialError = error instanceof Error ? error.message : "Chart calculation failed";
  }

  return (
    <PageTransition>
    <div className="insights-shell">
      <BackButton href="/" />
      <InsightsLoader
        chartParams={chartParams}
        initialPayload={initialPayload}
        initialError={initialError}
      />
    </div>
    </PageTransition>
  );
}
