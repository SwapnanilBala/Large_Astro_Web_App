"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { FiArrowLeft, FiClock } from "react-icons/fi";
import PanelErrorBoundary from "@/app/(desktop)/insights/components/PanelErrorBoundary";
import { useRouteMessages } from "@/lib/i18n-context";
import timingMessages from "@/messages/en.timing.json";
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

/* A component rather than a bare string, because dynamic()'s loading option is
   evaluated at module scope where a hook cannot run. */
function PanelLoading({ messageKey }: { messageKey: string }) {
  const tr = useRouteMessages(timingMessages);
  return <p className={styles.loading}>{tr(messageKey)}</p>;
}

const FutureForecastPanel = dynamic(() => import("../components/future-forecast-panel"), {
  ssr: false,
  loading: () => <PanelLoading messageKey="timing.client.loadingForecast" />,
});
const MuhurtaPanel = dynamic(() => import("../components/muhurta-panel"), {
  ssr: false,
  loading: () => <PanelLoading messageKey="timing.client.loadingMuhurta" />,
});
const VarshaphalPanel = dynamic(() => import("../components/varshaphal-panel"), {
  ssr: false,
  loading: () => <PanelLoading messageKey="timing.client.loadingVarshaphal" />,
});

type Props = {
  clientName: string;
  historyQs: string;
  birthDate: string;
};

/* Keys spelled out rather than derived from `id`, so a grep for a key finds
   the place it is read and the coverage checks can see it. */
const SECTIONS = [
  {
    id: "forecast",
    kickerKey: "timing.client.sections.forecast.kicker",
    titleKey: "timing.client.sections.forecast.title",
    leadKey: "timing.client.sections.forecast.lead",
  },
  {
    id: "muhurta",
    kickerKey: "timing.client.sections.muhurta.kicker",
    titleKey: "timing.client.sections.muhurta.title",
    leadKey: "timing.client.sections.muhurta.lead",
  },
  {
    id: "varshaphal",
    kickerKey: "timing.client.sections.varshaphal.kicker",
    titleKey: "timing.client.sections.varshaphal.title",
    leadKey: "timing.client.sections.varshaphal.lead",
  },
] as const;

export default function TimingClient({ clientName, historyQs, birthDate }: Props) {
  const tr = useRouteMessages(timingMessages);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href={`/insights?${historyQs}`} className={styles.back}>
          <FiArrowLeft aria-hidden="true" />
          {tr("timing.client.backToClientReading", { name: clientName })}
        </Link>

        <p className={styles.kicker}>
          <FiClock aria-hidden="true" />
          {tr("timing.client.kicker")}
        </p>
        <h1 className={styles.title}>{tr("timing.client.title")}</h1>
        <p className={styles.lead}>{tr("timing.client.lead")}</p>
      </header>

      {SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className={styles.section}>
          <div className={styles.sectionHead}>
            <p className={styles.sectionKicker}>{tr(section.kickerKey)}</p>
            <h2>{tr(section.titleKey)}</h2>
            <p className={styles.sectionLead}>{tr(section.leadKey)}</p>
          </div>

          <div className={styles.panel}>
            {section.id === "forecast" && (
              <PanelErrorBoundary panelName={tr("timing.client.panels.forecast")}>
                <FutureForecastPanel queryString={historyQs} />
              </PanelErrorBoundary>
            )}
            {section.id === "muhurta" && (
              <PanelErrorBoundary panelName={tr("timing.client.panels.muhurta")}>
                <MuhurtaPanel queryString={historyQs} />
              </PanelErrorBoundary>
            )}
            {section.id === "varshaphal" && (
              <PanelErrorBoundary panelName={tr("timing.client.panels.varshaphal")}>
                <VarshaphalPanel queryString={historyQs} birthDate={birthDate} />
              </PanelErrorBoundary>
            )}
          </div>
        </section>
      ))}

      <footer className={styles.footer}>
        <Link href={`/insights?${historyQs}`} className={styles.back}>
          <FiArrowLeft aria-hidden="true" />
          {tr("timing.client.backToFullReading")}
        </Link>
      </footer>
    </div>
  );
}
