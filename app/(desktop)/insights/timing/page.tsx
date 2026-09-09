import PageTransition from "@/app/components/PageTransition";
import TimingClient from "./timing-client";
import { TimingMissingParams, TimingUnavailable } from "./timing-fallbacks";
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
        <TimingMissingParams />
      </PageTransition>
    );
  }

  let payload: ChartApiResponse | null = null;
  /* Split in two so the client fallback can translate its own default copy
     without losing the message a real Error carried. */
  let errorMessage = "";
  let calculationFailed = false;

  try {
    payload = getChartPayload(chartParams);
  } catch (cause) {
    if (cause instanceof Error) {
      errorMessage = cause.message;
    } else {
      calculationFailed = true;
    }
  }

  if (!payload) {
    return (
      <PageTransition>
        <TimingUnavailable
          historyQs={chartParamsToQuery(chartParams)}
          errorMessage={errorMessage}
          calculationFailed={calculationFailed}
        />
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
