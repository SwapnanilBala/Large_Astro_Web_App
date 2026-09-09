import type { Metadata } from "next";
import { FiTrendingUp } from "react-icons/fi";
import PageTransition from "@/app/components/PageTransition";
import DetailPageShell from "@/app/(desktop)/insights/components/detail-page-shell";
import MajorShiftsPanel from "@/app/(desktop)/insights/components/major-shifts-panel";
import PanelErrorBoundary from "@/app/(desktop)/insights/components/PanelErrorBoundary";
import LifeShiftsNotice from "./life-shifts-notice";
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
          <LifeShiftsNotice variant="missingInput" />
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
          <LifeShiftsNotice
            variant="error"
            detail={error}
            backHref={`/insights?${historyQs}`}
          />
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
