import type { Metadata } from "next";
import {
  chartParamsToQuery,
  getChartPayload,
  hasAllChartParams,
  readChartParams,
} from "@/lib/chart-params";
import type { ChartApiResponse } from "@/lib/astro-types";
import MobileInsights from "./mobile-insights";
import styles from "../mobile.module.css";

export const maxDuration = 60;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = readChartParams(await searchParams);
  const query = chartParamsToQuery(params);
  return {
    title: params.name ? `${params.name} — Chart` : "Chart",
    /* Point search engines at the desktop twin of this exact chart. */
    alternates: { canonical: query ? `/insights?${query}` : "/insights" },
  };
}

export default async function MobileInsightsPage({ searchParams }: PageProps) {
  const chartParams = readChartParams(await searchParams);

  if (!hasAllChartParams(chartParams)) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Chart details are incomplete</h1>
          <p className={styles.lead}>
            Head back to intake and fill in the birth details to generate a chart.
          </p>
        </header>
        <a className={styles.backToIntake} href="/m">
          Back to intake
        </a>
      </div>
    );
  }

  /* Same function the desktop route calls, same server cache entry. */
  let payload: ChartApiResponse | null = null;
  let error = "";
  try {
    payload = getChartPayload(chartParams);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Chart calculation failed";
  }

  return (
    <MobileInsights
      payload={payload}
      error={error}
      desktopHref={`/insights?${chartParamsToQuery(chartParams)}&view=desktop`}
    />
  );
}
