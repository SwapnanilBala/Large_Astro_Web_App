import Link from "next/link";
import PageTransition from "@/app/components/PageTransition";
import TimingClient from "./timing-client";
import {
  chartParamsToQuery,
  getChartPayload,
  hasAllChartParams,
  readChartParams,
} from "@/lib/chart-params";
import type { ChartApiResponse } from "@/lib/astro-types";

/* The three panels each hit their own API route, so allow the same budget the
   varga atlas gets. */
export const maxDuration = 60;

type TimingPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TimingPage({ searchParams }: TimingPageProps) {
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
              the timing and electional views.
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
            <p className="kicker">Timing</p>
            <h1>The timing views could not be prepared.</h1>
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
      <TimingClient
        clientName={payload.client.name}
        historyQs={chartParamsToQuery(chartParams)}
        birthDate={chartParams.birthDate}
      />
    </PageTransition>
  );
}
