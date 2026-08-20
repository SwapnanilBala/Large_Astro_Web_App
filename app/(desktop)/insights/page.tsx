import Link from "next/link";
import InsightsLoader from "@/app/(desktop)/insights/components/insights-loader";
import BackButton from "@/app/components/BackButton";
import PageTransition from "@/app/components/PageTransition";
import {
  getChartPayload,
  hasAllChartParams,
  readChartParams,
} from "@/lib/chart-params";
import type { ChartApiResponse } from "@/lib/astro-types";

export const maxDuration = 60;

type InsightsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InsightsPage({ searchParams }: InsightsPageProps) {
  const rawParams = await searchParams;
  const chartParams = readChartParams(rawParams);

  if (!hasAllChartParams(chartParams)) {
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

  let initialPayload: ChartApiResponse | null = null;
  let initialError = "";

  try {
    initialPayload = getChartPayload(chartParams);
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
