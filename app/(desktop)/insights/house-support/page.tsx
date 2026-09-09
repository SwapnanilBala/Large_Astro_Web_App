import type { Metadata } from "next";
import { FiGrid } from "react-icons/fi";
import PageTransition from "@/app/components/PageTransition";
import DetailPageShell from "@/app/(desktop)/insights/components/detail-page-shell";
import HouseSupportPanel from "@/app/(desktop)/insights/components/house-support-panel";
import {
  HouseSupportHeroLead,
  HouseSupportHeroTitle,
  HouseSupportMissingState,
  HouseSupportUnavailableState,
} from "@/app/(desktop)/insights/components/house-support-page-copy";
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
          <HouseSupportMissingState />
        </div>
      </PageTransition>
    );
  }

  const historyQs = chartParamsToQuery(chartParams);

  let payload: ChartApiResponse | null = null;
  let error = "";
  let failed = false;
  try {
    payload = getChartPayload(chartParams);
  } catch (cause) {
    /* A thrown message is English wherever it came from, so it is passed
       through as-is. The "it threw and said nothing" case has no message to
       pass through, and that sentence is ours, so it is translated in the
       client child instead of being written here. */
    failed = true;
    error = cause instanceof Error ? cause.message : "";
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
          <HouseSupportUnavailableState
            backHref={`/insights?${historyQs}`}
            error={error}
            failed={failed}
          />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <DetailPageShell
        backHref={`/insights?${historyQs}#house-support`}
        kicker="Ashtakavarga · House support"
        title={<HouseSupportHeroTitle name={payload.client.name} />}
        lead={<HouseSupportHeroLead />}
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
