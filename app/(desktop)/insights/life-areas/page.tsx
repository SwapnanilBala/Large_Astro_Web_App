import type { Metadata } from "next";
import Link from "next/link";
import { FiCompass } from "react-icons/fi";
import PageTransition from "@/app/components/PageTransition";
import DetailPageShell from "@/app/(desktop)/insights/components/detail-page-shell";
import LifeAreasClient from "./life-areas-client";
import {
  chartParamsToQuery,
  getChartPayload,
  getLifeDomainPayload,
  hasAllChartParams,
  readChartParams,
} from "@/lib/chart-params";
import type { ChartApiResponse, LifeDomainInsight } from "@/lib/astro-types";

export const maxDuration = 60;

type LifeAreasPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: LifeAreasPageProps): Promise<Metadata> {
  const params = readChartParams(await searchParams);
  return { title: params.name ? `${params.name} — Life areas` : "Life areas" };
}

export default async function LifeAreasPage({ searchParams }: LifeAreasPageProps) {
  const rawParams = await searchParams;
  const chartParams = readChartParams(rawParams);

  if (!hasAllChartParams(chartParams)) {
    return (
      <PageTransition>
        <div className="insights-shell">
          <section className="dashboard-shell">
            <p className="kicker">Missing Input</p>
            <h1>Chart details are incomplete.</h1>
            <p className="lead">
              Return to intake and provide complete birth details before opening
              the life areas.
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

  /*
   * Both built here rather than fetched on the client.
   *
   * On the results page the domains load late on purpose -- they sit far down
   * a long report and the section is one of many. Here they are the entire
   * page, so a client fetch would mean opening a link and watching a spinner
   * where the content should be. The chart comes along for the dasha, which
   * the timing windows are read against.
   */
  let payload: ChartApiResponse | null = null;
  let insights: LifeDomainInsight[] = [];
  let error = "";

  try {
    payload = getChartPayload(chartParams);
    insights = getLifeDomainPayload(chartParams).insights;
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Chart calculation failed";
  }

  if (!payload || insights.length === 0) {
    return (
      <PageTransition>
        <div className="insights-shell">
          <section className="dashboard-shell">
            <p className="kicker">Life areas</p>
            <h1>The life area readings could not be prepared.</h1>
            <p className="lead">{error || "No life domain data was returned."}</p>
            <Link href={`/insights?${historyQs}`} className="ghost-link">
              Back to your reading
            </Link>
          </section>
        </div>
      </PageTransition>
    );
  }

  /* ?domain= is how the results page hands off the area a reader was already
     looking at. An unknown or absent key falls through to the most active. */
  const requested = rawParams.domain;
  const requestedKey = Array.isArray(requested) ? requested[0] : requested;

  return (
    <PageTransition>
      <DetailPageShell
        backHref={`/insights?${historyQs}#ultimate`}
        kicker="Ultimate Module · Life areas"
        title={`${payload.client.name}'s life areas in full`}
        lead="Each area runs its own evidence matrix across natal promise, supporting factors, divisional confirmation, measured strength, house support, combinations, timing, and contradictions."
        icon={<FiCompass />}
      >
        <LifeAreasClient
          insights={insights}
          dasha={payload.chart.dasha}
          initialDomainKey={requestedKey ?? ""}
        />
      </DetailPageShell>
    </PageTransition>
  );
}
