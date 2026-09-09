import PageTransition from "@/app/components/PageTransition";
import FullReadingClient from "./full-reading-client";
import FullReadingNotice from "./full-reading-notice";
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
          <FullReadingNotice variant="missingInput" />
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
          <FullReadingNotice
            variant="error"
            detail={error}
            backHref={`/insights?${chartParamsToQuery(chartParams)}`}
          />
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
