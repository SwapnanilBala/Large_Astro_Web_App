import Link from "next/link";
import InsightsLoader from "@/app/(desktop)/insights/components/insights-loader";
import BackButton from "@/app/components/BackButton";
import PageTransition from "@/app/components/PageTransition";
import {
  getChartPayload,
  getTopLifeDomainSummary,
  hasAllChartParams,
  readChartParams,
} from "@/lib/chart-params";
import type { ChartApiResponse, TopLifeDomainSummary } from "@/lib/astro-types";
import { chartPageMetadata } from "@/lib/page-metadata";

export const maxDuration = 60;

type InsightsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const generateMetadata = chartPageMetadata("Chart");

export default async function InsightsPage({ searchParams }: InsightsPageProps) {
  const rawParams = await searchParams;
  const chartParams = readChartParams(rawParams);

  if (!hasAllChartParams(chartParams)) {
    return (
      <PageTransition>
      <div className="insights-shell below-navbar">
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

  /* The Top Takeaways card's life area, so it is final at first paint rather
     than swapped in (and taller) once the deferred domains arrive: see
     getTopLifeDomainSummary. Skipped where the client would not load the
     domains either. A failure here only costs the card its life area. */
  let initialTopLifeDomain: TopLifeDomainSummary | null = null;
  if (initialPayload && !initialPayload.access.locked_features.includes("life_domain_readings")) {
    try {
      initialTopLifeDomain = getTopLifeDomainSummary(chartParams);
    } catch {
      initialTopLifeDomain = null;
    }
  }

  return (
    <PageTransition>
    <div className="insights-shell below-navbar">
      <BackButton href="/" />
      <InsightsLoader
        chartParams={chartParams}
        initialPayload={initialPayload}
        initialError={initialError}
        initialTopLifeDomain={initialTopLifeDomain}
      />
    </div>
    </PageTransition>
  );
}
