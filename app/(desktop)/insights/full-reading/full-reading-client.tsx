"use client";

import Link from "next/link";
import { FiArrowLeft, FiBookOpen } from "react-icons/fi";
import PanelErrorBoundary from "@/app/(desktop)/insights/components/PanelErrorBoundary";
import type { ChartApiResponse } from "@/lib/astro-types";
import { useRouteMessages } from "@/lib/i18n-context";
import fullReadingMessages from "@/messages/en.full-reading.json";
import FindingsRoom from "./findings-room";
import YogasRoom from "./yogas-room";
import KarmaRoom from "./karma-room";
import styles from "./full-reading.module.css";

/*
 * The full reading, on its own page.
 *
 * On the results page this was a collapsed section holding every finding the
 * engine produced. Given a page of its own it first became a card grid -- two
 * abreast for the findings, three for the yogas -- which on a desktop ran to
 * some twenty screens of boxes that all looked alike.
 *
 * Now each block is a reading room (reading-room.tsx): a pinned list on the
 * left, one item read in full on the right with its evidence beside it. The
 * findings, the yogas and the karma reading each get one, so the whole page is
 * about three screens and every item is one click from any other.
 *
 * All three render with the page rather than as lazily imported panels: their
 * data is already in the payload, and the "Preparing…" placeholders they used
 * to show were only ever waiting on JavaScript.
 */

type Props = {
  payload: ChartApiResponse;
  historyQs: string;
};

export default function FullReadingClient({ payload, historyQs }: Props) {
  /* tr, not t: this page's copy is a namespace of its own that ships with the
     route rather than riding in the desktop baseline. */
  const tr = useRouteMessages(fullReadingMessages);
  const rules = payload.chart.deterministic_rules;
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
          <PanelErrorBoundary panelName="Findings">
            <FindingsRoom rules={rules} />
          </PanelErrorBoundary>
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
          <PanelErrorBoundary panelName="Yogas">
            <YogasRoom yogas={yogas} />
          </PanelErrorBoundary>
        </section>
      )}

      <section id="karma" className={styles.section}>
        <div className={styles.sectionHead}>
          <p className={styles.sectionKicker}>{tr("fullReading.karmaKicker")}</p>
          <h2>{tr("fullReading.karmaHeading")}</h2>
          <p className={styles.sectionLead}>{tr("fullReading.karmaLead")}</p>
        </div>
        <PanelErrorBoundary panelName="Karma, Fate, and Vocation">
          <KarmaRoom payload={payload} />
        </PanelErrorBoundary>
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
