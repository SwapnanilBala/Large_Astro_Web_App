import Link from "next/link";
import InsightsContent from "@/app/insights/components/insights-content";
import type { ChartApiResponse } from "@/lib/astro-types";

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

const buildChartApiUrl = (
  params: Record<string, string>,
  town: string,
  timeZoneId: string,
  engineId: string,
) => {
  const baseUrl =
    process.env.ASTRO_API_BASE_URL ??
    process.env.NEXT_PUBLIC_ASTRO_API_BASE_URL ??
    "http://127.0.0.1:8000";

  const url = new URL("/api/v1/chart", baseUrl);
  url.searchParams.set("name", params.name);
  url.searchParams.set("birth_date", params.birthDate);
  url.searchParams.set("birth_time", params.birthTime);
  url.searchParams.set("engine_id", engineId || "lahiri_classic");
  url.searchParams.set("timezone_offset_minutes", params.timezoneOffsetMinutes);
  url.searchParams.set("latitude", params.latitude);
  url.searchParams.set("longitude", params.longitude);
  url.searchParams.set("country", params.country);
  url.searchParams.set("state", params.state);
  url.searchParams.set("city", params.city);
  url.searchParams.set("town", town);
  url.searchParams.set("time_zone_id", timeZoneId);
  url.searchParams.set("include_transits", "true");
  return url.toString();
};

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

  const hasAllInputs = requiredParams.every((param) => params[param].trim().length > 0);

  if (!hasAllInputs) {
    return (
      <main className="insights-shell">
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
      </main>
    );
  }

  const chartUrl = buildChartApiUrl(params, town, timeZoneId, engineId);

  let payload: ChartApiResponse | null = null;
  let fetchError = "";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(chartUrl, {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`Chart API error (${response.status})`);
    }
    payload = (await response.json()) as ChartApiResponse;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      fetchError = "Request timed out after 8 seconds. Is the backend running?";
    } else {
      fetchError = error instanceof Error ? error.message : "Unknown API error";
    }
  }

  if (!payload) {
    return (
      <main className="insights-shell">
        <section className="dashboard-shell">
          <p className="kicker">Backend Unreachable</p>
          <h1>FastAPI chart service is not available.</h1>
          <p className="lead">
            Start the Python backend on <code>http://127.0.0.1:8000</code> or set
            <code> ASTRO_API_BASE_URL</code> in your Next.js environment.
          </p>
          <p className="error-note">Error: {fetchError}</p>
          <Link href="/" className="ghost-link">
            Edit Intake Data
          </Link>
        </section>
      </main>
    );
  }

  /* ── Reconstruct query string for history saver ──── */
  const historyQs = new URLSearchParams({
    ...params,
    engineId,
    ...(town ? { town } : {}),
    ...(timeZoneId ? { timeZoneId } : {}),
  }).toString();

  return (
    <main className="insights-shell">
      <InsightsContent
        payload={payload}
        birthDate={params.birthDate}
        historyQs={historyQs}
      />
    </main>
  );
}
