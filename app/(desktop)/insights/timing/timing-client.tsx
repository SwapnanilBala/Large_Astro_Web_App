"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { FiArrowLeft, FiClock } from "react-icons/fi";
import PanelErrorBoundary from "@/app/(desktop)/insights/components/PanelErrorBoundary";
import styles from "./timing.module.css";

/*
 * Timing and electional, on its own page.
 *
 * These three panels were a collapsed section on the results page and between
 * them they are the longest thing in the report — a forecast, a muhurta finder
 * and an annual chart. Collapsed, they were invisible; expanded, they buried
 * everything after them.
 *
 * With a page to themselves the type can be larger and each panel gets a
 * standfirst explaining what it answers, which the results page had no room
 * for.
 */

const FutureForecastPanel = dynamic(() => import("../components/future-forecast-panel"), {
  ssr: false,
  loading: () => <p className={styles.loading}>Preparing your forecast…</p>,
});
const MuhurtaPanel = dynamic(() => import("../components/muhurta-panel"), {
  ssr: false,
  loading: () => <p className={styles.loading}>Preparing electional windows…</p>,
});
const VarshaphalPanel = dynamic(() => import("../components/varshaphal-panel"), {
  ssr: false,
  loading: () => <p className={styles.loading}>Preparing the annual chart…</p>,
});

type Props = {
  clientName: string;
  historyQs: string;
  birthDate: string;
};

const SECTIONS = [
  {
    id: "forecast",
    kicker: "Forecast",
    title: "What the coming periods carry",
    lead:
      "Dasha and transit movement read together, so you can see which themes are " +
      "active now and which are still approaching. Periods are listed with their " +
      "dates rather than described in the abstract.",
  },
  {
    id: "muhurta",
    kicker: "Electional",
    title: "Choosing a moment to begin",
    lead:
      "Muhurta works the other way round from a natal reading: instead of asking " +
      "what a chart means, it asks when to start something so the sky supports it. " +
      "Windows below are scored against your own chart, not a generic calendar.",
  },
  {
    id: "varshaphal",
    kicker: "Annual",
    title: "This year's chart",
    lead:
      "The solar return, cast for the moment the Sun comes back to its natal " +
      "position, with the annual profection alongside it. Read it as the weather " +
      "for one year inside the longer dasha climate.",
  },
] as const;

export default function TimingClient({ clientName, historyQs, birthDate }: Props) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href={`/insights?${historyQs}`} className={styles.back}>
          <FiArrowLeft aria-hidden="true" />
          Back to {clientName}&rsquo;s reading
        </Link>

        <p className={styles.kicker}>
          <FiClock aria-hidden="true" />
          Timing and electional
        </p>
        <h1 className={styles.title}>When, not what</h1>
        <p className={styles.lead}>
          The natal chart describes the shape of a life. These three views
          describe its schedule — which periods are running, which moments
          favour a beginning, and what this particular year is carrying.
        </p>
      </header>

      {SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className={styles.section}>
          <div className={styles.sectionHead}>
            <p className={styles.sectionKicker}>{section.kicker}</p>
            <h2>{section.title}</h2>
            <p className={styles.sectionLead}>{section.lead}</p>
          </div>

          <div className={styles.panel}>
            {section.id === "forecast" && (
              <PanelErrorBoundary panelName="Future Forecast">
                <FutureForecastPanel queryString={historyQs} />
              </PanelErrorBoundary>
            )}
            {section.id === "muhurta" && (
              <PanelErrorBoundary panelName="Muhurta">
                <MuhurtaPanel queryString={historyQs} />
              </PanelErrorBoundary>
            )}
            {section.id === "varshaphal" && (
              <PanelErrorBoundary panelName="Varshaphal & Annual Profections">
                <VarshaphalPanel queryString={historyQs} birthDate={birthDate} />
              </PanelErrorBoundary>
            )}
          </div>
        </section>
      ))}

      <footer className={styles.footer}>
        <Link href={`/insights?${historyQs}`} className={styles.back}>
          <FiArrowLeft aria-hidden="true" />
          Back to the full reading
        </Link>
      </footer>
    </div>
  );
}
