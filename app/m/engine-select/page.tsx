import type { Metadata } from "next";
import { chartParamsToQuery, hasAllChartParams, readChartParams } from "@/lib/chart-params";
import MobileEngineSelect from "./mobile-engine-select";
import shell from "../mobile.module.css";

/* The desktop route is the canonical one; /m/engine-select is the handset
   rendering of it. */

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const query = chartParamsToQuery(readChartParams(await searchParams));
  return {
    title: "Choose a method · Lagna Atelier",
    alternates: { canonical: query ? `/engine-select?${query}` : "/engine-select" },
  };
}

export default async function MobileEngineSelectPage({ searchParams }: PageProps) {
  /* readChartParams is what /insights and /m/insights already parse with, so
     the birth details — including the birth-time accuracy markers — survive
     this hop in exactly the shape the chart builder expects on the far side. */
  const chartParams = readChartParams(await searchParams);

  if (!hasAllChartParams(chartParams)) {
    return (
      <div className={shell.page}>
        <header className={shell.header}>
          <h1 className={`${shell.title} mGold`}>Chart details are incomplete</h1>
          <p className={shell.lead}>
            Head back to intake and fill in the birth details to choose a method.
          </p>
        </header>
        <a className={shell.backToIntake} href="/m">
          Back to intake
        </a>
      </div>
    );
  }

  /* The query goes over as a string rather than an object: the client only
     ever appends engineId and forwards it, so there is nothing to gain from
     re-parsing it on both sides. */
  return (
    <MobileEngineSelect
      query={chartParamsToQuery(chartParams)}
      defaultEngineId={chartParams.engineId}
    />
  );
}
