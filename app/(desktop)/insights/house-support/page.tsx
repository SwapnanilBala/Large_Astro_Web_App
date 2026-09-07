import type { Metadata } from "next";
import Link from "next/link";
import { FiGrid } from "react-icons/fi";
import PageTransition from "@/app/components/PageTransition";
import DetailPageShell from "@/app/(desktop)/insights/components/detail-page-shell";
import HouseSupportPanel from "@/app/(desktop)/insights/components/house-support-panel";
import PanelErrorBoundary from "@/app/(desktop)/insights/components/PanelErrorBoundary";
import {
  chartParamsToQuery,
  getChartPayload,
  hasAllChartParams,
  readChartParams,
} from "@/lib/chart-params";
import type { ChartApiResponse } from "@/lib/astro-types";

export const maxDuration = 60;

type HouseSupportPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: HouseSupportPageProps): Promise<Metadata> {
  const params = readChartParams(await searchParams);
  return {
    title: params.name ? `${params.name} — House support` : "House support",
  };
}

export default async function HouseSupportPage({ searchParams }: HouseSupportPageProps) {
  const chartParams = readChartParams(await searchParams);

  if (!hasAllChartParams(chartParams)) {
    return (
      <PageTransition>
        <div className="insights-shell below-navbar">
          <section className="dashboard-shell">
            <p className="kicker">Missing Input</p>
            <h1>Chart details are incomplete.</h1>
            <p className="lead">
              Return to intake and provide complete birth details before opening
              the house support breakdown.
            </p>
            <Link href="/" className="ghost-link">
              Back to Intake
            </Link>
          </section>
        </div>
      </PageTransition>
    );
  }

  const historyQs = chartParamsToQuery(chartParams);

  let payload: ChartApiResponse | null = null;
  let error = "";
  try {
    payload = getChartPayload(chartParams);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Chart calculation failed";
  }

  /* Same gate the results page uses. Without twelve SAV totals and twelve
     houses the panel returns null, and a hero over nothing reads as a bug. */
  const hasSupport =
    payload?.ashtakavarga?.sarvashtakavarga?.length === 12 &&
    payload?.chart.houses?.length === 12;

  if (!payload || !hasSupport) {
    return (
      <PageTransition>
        <div className="insights-shell below-navbar">
          <section className="dashboard-shell">
            <p className="kicker">House support</p>
            <h1>The house support breakdown could not be prepared.</h1>
            <p className="lead">
              {error ||
                "This chart did not return a complete Ashtakavarga, so the twelve houses cannot be scored."}
            </p>
            <Link href={`/insights?${historyQs}`} className="ghost-link">
              Back to your reading
            </Link>
          </section>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <DetailPageShell
        backHref={`/insights?${historyQs}#house-support`}
        kicker="Ashtakavarga · House support"
        title={`${payload.client.name}'s house support in full`}
        lead="How much support each of the twelve houses holds, what each one is responsible for, and the arithmetic behind both."
        icon={<FiGrid />}
      >
        <PanelErrorBoundary panelName="House Support">
          <HouseSupportPanel
            ashtakavarga={payload.ashtakavarga}
            houses={payload.chart.houses}
            variant="full"
          />
        </PanelErrorBoundary>
      </DetailPageShell>
    </PageTransition>
  );
}
