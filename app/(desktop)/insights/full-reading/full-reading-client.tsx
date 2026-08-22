"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { FiArrowLeft, FiBookOpen } from "react-icons/fi";
import PanelErrorBoundary from "@/app/(desktop)/insights/components/PanelErrorBoundary";
import RuleCard, { bySelectionRank } from "../components/rule-card";
import type { ChartApiResponse } from "@/lib/astro-types";
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

const YogaLifetimeSummary = dynamic(() => import("../components/yoga-lifetime-summary"), {
  ssr: false,
  loading: () => <p className={styles.loading}>Preparing combinations…</p>,
});
const PastLifeInsightsPanel = dynamic(() => import("../components/past-life-insights-panel"), {
  ssr: false,
  loading: () => <p className={styles.loading}>Preparing the karmic reading…</p>,
});

type Props = {
  payload: ChartApiResponse;
  historyQs: string;
};

export default function FullReadingClient({ payload, historyQs }: Props) {
  /* Most significant first. This page inherited the list from the results page
     but not its ordering, so the findings were arriving in raw engine order. */
  const rules = [...payload.chart.deterministic_rules].sort(bySelectionRank);
  const yogas = payload.chart.yogas ?? [];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href={`/insights?${historyQs}`} className={styles.back}>
          <FiArrowLeft aria-hidden="true" />
          Back to {payload.client.name}&rsquo;s reading
        </Link>

        <p className={styles.kicker}>
          <FiBookOpen aria-hidden="true" />
          Full reading
        </p>
        <h1 className={styles.title}>Every finding in the chart</h1>
        <p className={styles.lead}>
          The three priorities at the top of your report are drawn from this set.
          Everything the engine matched is here, each with the placement it rests
          on, so you can see the reasoning rather than only the conclusion.
        </p>
        <p className={styles.count}>
          <strong>{rules.length}</strong> findings
          {yogas.length > 0 && (
            <>
              {" · "}
              <strong>{yogas.length}</strong> long-term combinations
            </>
          )}
        </p>
      </header>

      {rules.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <p className={styles.sectionKicker}>Patterns</p>
            <h2>What the placements say</h2>
            <p className={styles.sectionLead}>
              Each card states the reading, then the placement behind it. Open
              &ldquo;Why this reading&rdquo; to see the technical basis and how
              common the pattern is.
            </p>
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
            <p className={styles.sectionKicker}>Combinations</p>
            <h2>Patterns that run for a lifetime</h2>
            <p className={styles.sectionLead}>
              Yogas are combinations rather than single placements, and they
              describe standing conditions in the chart rather than a passing
              period.
            </p>
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
          <p className={styles.sectionKicker}>Karma</p>
          <h2>Inherited patterns and vocation</h2>
          <p className={styles.sectionLead}>
            A secondary reading of what the chart suggests was carried in, where
            it asks to be released, and the kind of work it points toward.
          </p>
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
          Back to the reading
        </Link>
      </footer>
    </div>
  );
}
