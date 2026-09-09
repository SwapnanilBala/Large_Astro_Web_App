"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { FiArrowLeft, FiBookOpen } from "react-icons/fi";
import PanelErrorBoundary from "@/app/(desktop)/insights/components/PanelErrorBoundary";
import RuleCard, { bySelectionRank } from "../components/rule-card";
import type { ChartApiResponse } from "@/lib/astro-types";
import { useRouteMessages } from "@/lib/i18n-context";
import fullReadingMessages from "@/messages/en.full-reading.json";
import styles from "./full-reading.module.css";

/*
 * The full reading, on its own page.
 *
 * On the results page this was a collapsed section holding every finding the
 * engine produced — dozens of rule cards, the yoga summary and the past-life
 * panel — stacked in a narrow column. Collapsed it was invisible; open it was
 * the longest thing on the page by a wide margin.
 *
 * Here the cards sit in a two-column grid on wide screens so the eye has
 * somewhere to go, the type is a step larger throughout, and each block gets a
 * standfirst rather than a single line of grey text.
 */

/* A component rather than the <p> inline, so the placeholder can read the
   catalog: dynamic()'s `loading` is evaluated at module scope, where a hook
   cannot run, but what it returns is rendered inside the tree like anything
   else. */
function LoadingLine({ messageKey }: { messageKey: string }) {
  const tr = useRouteMessages(fullReadingMessages);
  return <p className={styles.loading}>{tr(messageKey)}</p>;
}

const YogaLifetimeSummary = dynamic(() => import("../components/yoga-lifetime-summary"), {
  ssr: false,
  loading: () => <LoadingLine messageKey="fullReading.loadingCombinations" />,
});
const PastLifeInsightsPanel = dynamic(() => import("../components/past-life-insights-panel"), {
  ssr: false,
  loading: () => <LoadingLine messageKey="fullReading.loadingKarma" />,
});

type Props = {
  payload: ChartApiResponse;
  historyQs: string;
};

export default function FullReadingClient({ payload, historyQs }: Props) {
  /* tr, not t: this page's copy is a namespace of its own that ships with the
     route rather than riding in the desktop baseline. */
  const tr = useRouteMessages(fullReadingMessages);
  /* Most significant first. This page inherited the list from the results page
     but not its ordering, so the findings were arriving in raw engine order. */
  const rules = [...payload.chart.deterministic_rules].sort(bySelectionRank);
  const yogas = payload.chart.yogas ?? [];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href={`/insights?${historyQs}`} className={styles.back}>
          <FiArrowLeft aria-hidden="true" />
          {tr("fullReading.backToNamedReading", { name: payload.client.name })}
        </Link>

        <p className={styles.kicker}>
          <FiBookOpen aria-hidden="true" />
          {tr("fullReading.kicker")}
        </p>
        <h1 className={styles.title}>{tr("fullReading.title")}</h1>
        <p className={styles.lead}>{tr("fullReading.lead")}</p>
        <p className={styles.count}>
          <strong>{rules.length}</strong> {tr("fullReading.findings")}
          {yogas.length > 0 && (
            <>
              {" · "}
              <strong>{yogas.length}</strong>{" "}
              {tr("fullReading.longTermCombinations")}
            </>
          )}
        </p>
      </header>

      {rules.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <p className={styles.sectionKicker}>{tr("fullReading.patternsKicker")}</p>
            <h2>{tr("fullReading.patternsHeading")}</h2>
            <p className={styles.sectionLead}>{tr("fullReading.patternsLead")}</p>
          </div>

          <div className={styles.ruleGrid}>
            {rules.map((rule, i) => (
              <RuleCard key={rule.instance_key} rule={rule} index={i} />
            ))}
          </div>
        </section>
      )}

      {yogas.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <p className={styles.sectionKicker}>
              {tr("fullReading.combinationsKicker")}
            </p>
            <h2>{tr("fullReading.combinationsHeading")}</h2>
            <p className={styles.sectionLead}>{tr("fullReading.combinationsLead")}</p>
          </div>
          <div className={styles.panel}>
            <PanelErrorBoundary panelName="Yoga Lifetime Summary">
              <YogaLifetimeSummary yogas={yogas} />
            </PanelErrorBoundary>
          </div>
        </section>
      )}

      <section id="karma" className={styles.section}>
        <div className={styles.sectionHead}>
          <p className={styles.sectionKicker}>{tr("fullReading.karmaKicker")}</p>
          <h2>{tr("fullReading.karmaHeading")}</h2>
          <p className={styles.sectionLead}>{tr("fullReading.karmaLead")}</p>
        </div>
        <div className={styles.panel}>
          <PanelErrorBoundary panelName="Karma, Fate, and Vocation">
            <PastLifeInsightsPanel payload={payload} />
          </PanelErrorBoundary>
        </div>
      </section>

      <footer className={styles.footer}>
        <Link href={`/insights?${historyQs}`} className={styles.back}>
          <FiArrowLeft aria-hidden="true" />
          {tr("fullReading.backToReading")}
        </Link>
      </footer>
    </div>
  );
}
