import type { Metadata } from "next";
import Link from "next/link";
import { FiTrendingUp } from "react-icons/fi";
import PageTransition from "@/app/components/PageTransition";
import DetailPageShell from "@/app/(desktop)/insights/components/detail-page-shell";
import MajorShiftsPanel from "@/app/(desktop)/insights/components/major-shifts-panel";
import PanelErrorBoundary from "@/app/(desktop)/insights/components/PanelErrorBoundary";
import {
  chartParamsToQuery,
  getChartPayload,
  hasAllChartParams,
  readChartParams,
} from "@/lib/chart-params";
import type { ChartApiResponse } from "@/lib/astro-types";

export const maxDuration = 60;

type LifeShiftsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: LifeShiftsPageProps): Promise<Metadata> {
  const params = readChartParams(await searchParams);
  return { title: params.name ? `${params.name} — Life chapters` : "Life chapters" };
}

export default async function LifeShiftsPage({ searchParams }: LifeShiftsPageProps) {
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
              the life chapters.
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

  if (!payload) {
    return (
      <PageTransition>
        <div className="insights-shell below-navbar">
          <section className="dashboard-shell">
            <p className="kicker">Life chapters</p>
            <h1>The life chapters could not be prepared.</h1>
            <p className="lead">{error || "No chart data was returned."}</p>
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
        backHref={`/insights?${historyQs}#life-shifts`}
        kicker="Major life shifts"
        title={`${payload.client.name}'s life chapters`}
        lead="Every chapter this chart marks out — the one running now, what follows it, and the ones already behind you. Dates are planning windows, not deadlines."
        icon={<FiTrendingUp />}
      >
        <PanelErrorBoundary panelName="Major Life Shifts">
          <MajorShiftsPanel payload={payload} variant="full" />
        </PanelErrorBoundary>
      </DetailPageShell>
    </PageTransition>
  );
}
