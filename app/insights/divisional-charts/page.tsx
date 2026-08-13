import Link from "next/link";
import PageTransition from "@/app/components/PageTransition";
import DivisionalChartsClient from "./divisional-charts-client";
import {
  chartParamsToQuery,
  getChartPayload,
  hasAllChartParams,
  readChartParams,
} from "@/lib/chart-params";
import type { ChartApiResponse } from "@/lib/astro-types";

export const maxDuration = 60;

type DivisionalChartsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DivisionalChartsPage({
  searchParams,
}: DivisionalChartsPageProps) {
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
              the divisional chart atlas.
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

  if (!payload?.chart.divisional_charts) {
    return (
      <PageTransition>
        <div className="insights-shell">
          <section className="dashboard-shell">
            <p className="kicker">Varga Atlas</p>
            <h1>The divisional charts could not be prepared.</h1>
            <p className="lead">{error || "No divisional chart data was returned."}</p>
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

  const historyQs = chartParamsToQuery(chartParams);

  return (
    <PageTransition>
      <DivisionalChartsClient
        clientName={payload.client.name}
        engineLabel={payload.engine.engine_label}
        charts={payload.chart.divisional_charts}
        historyQs={historyQs}
        birthTimeAccuracy={chartParams.birthTimeAccuracy}
        birthTimeFallback={chartParams.birthTimeFallback === "true"}
      />
    </PageTransition>
  );
}
