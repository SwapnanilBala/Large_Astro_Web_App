import PageTransition from "@/app/components/PageTransition";
import AtlasNotice from "./atlas-notice";
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
        <AtlasNotice variant="missing-input" />
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
        <AtlasNotice
          variant="unavailable"
          backHref={`/insights?${chartParamsToQuery(chartParams)}`}
          error={error}
        />
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
