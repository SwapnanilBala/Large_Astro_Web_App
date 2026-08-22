import Link from "next/link";
import PageTransition from "@/app/components/PageTransition";
import FullReadingClient from "./full-reading-client";
import {
  chartParamsToQuery,
  getChartPayload,
  hasAllChartParams,
  readChartParams,
} from "@/lib/chart-params";
import type { ChartApiResponse } from "@/lib/astro-types";

export const maxDuration = 60;

type FullReadingPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FullReadingPage({ searchParams }: FullReadingPageProps) {
  const rawParams = await searchParams;
  const chartParams = readChartParams(rawParams);

  if (!hasAllChartParams(chartParams)) {
    return (
      <PageTransition>
        <div className="insights-shell">
          <section className="dashboard-shell">
            <p className="kicker">Missing Input</p>
            <h1>Chart details are incomplete.</h1>
            <p className="lead">
              Return to intake and provide complete birth details before opening
              the full reading.
            </p>
            <Link href="/" className="ghost-link">
              Back to Intake
            </Link>
          </section>
        </div>
      </PageTransition>
    );
  }

  let payload: ChartApiResponse | null = null;
  let error = "";

  try {
    payload = getChartPayload(chartParams);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Chart calculation failed";
  }

  if (!payload) {
    return (
      <PageTransition>
        <div className="insights-shell">
          <section className="dashboard-shell">
            <p className="kicker">Full reading</p>
            <h1>The full reading could not be prepared.</h1>
            <p className="lead">{error || "No chart data was returned."}</p>
            <Link
              href={`/insights?${chartParamsToQuery(chartParams)}`}
              className="ghost-link"
            >
              Back to your reading
            </Link>
          </section>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <FullReadingClient
        payload={payload}
        historyQs={chartParamsToQuery(chartParams)}
      />
    </PageTransition>
  );
}
