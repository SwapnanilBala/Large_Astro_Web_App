"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiArrowRight,
  FiBookOpen,
  FiCheckCircle,
  FiClock,
  FiCompass,
  FiGrid,
  FiLayers,
} from "react-icons/fi";
import type { DivisionalChartInfo } from "@/lib/astro-types";
import {
  IMPORTANT_DIVISIONAL_CHARTS,
  getImportantDivisionalChartGuide,
  type DivisionalChartSensitivity,
} from "@/lib/divisional-chart-guide";
import { useRouteMessages } from "@/lib/i18n-context";
import divisionalMessages from "@/messages/en.divisional.json";
import styles from "./divisional-charts.module.css";

/** What useRouteMessages hands back — a translator with interpolation. */
type Translate = (key: string, params?: Record<string, string>) => string;

type DivisionalChartsClientProps = {
  clientName: string;
  engineLabel: string;
  charts: Record<number, DivisionalChartInfo>;
  historyQs: string;
  birthTimeAccuracy: string;
  birthTimeFallback: boolean;
};

const PLANET_GLYPHS: Record<string, string> = {
  Ascendant: "↑",
  Sun: "☉",
  Moon: "☽",
  Mercury: "☿",
  Venus: "♀",
  Mars: "♂",
  Jupiter: "♃",
  Saturn: "♄",
  Rahu: "☊",
  Ketu: "☋",
};

const SENSITIVITY_COPY: Record<
  DivisionalChartSensitivity,
  { labelKey: string; className: "steady" | "careful" | "strict" }
> = {
  foundation: {
    labelKey: "divisional.atlas.sensitivity.foundation",
    className: "steady",
  },
  "exact-time": {
    labelKey: "divisional.atlas.sensitivity.exactTime",
    className: "careful",
  },
  "rectified-time": {
    labelKey: "divisional.atlas.sensitivity.rectifiedTime",
    className: "strict",
  },
};

function birthTimeQualityLabel(tr: Translate, accuracy: string, fallback: boolean) {
  if (fallback || !accuracy || accuracy === "unknown") {
    return tr("divisional.atlas.hero.exploratoryTime");
  }
  if (accuracy === "exact") return tr("divisional.atlas.hero.exactTime");
  return tr("divisional.atlas.hero.timeWindow", {
    accuracy: `${accuracy[0].toUpperCase()}${accuracy.slice(1)}`,
  });
}

function reliabilityCopy(tr: Translate, accuracy: string, fallback: boolean) {
  if (accuracy === "exact" && !fallback) {
    return {
      title: tr("divisional.atlas.reliability.goodTitle"),
      body: tr("divisional.atlas.reliability.goodBody"),
      tone: "good" as const,
    };
  }

  return {
    title: tr("divisional.atlas.reliability.cautionTitle"),
    body: tr("divisional.atlas.reliability.cautionBody"),
    tone: "caution" as const,
  };
}

function positionFor(chart: DivisionalChartInfo, name: string) {
  return chart.positions.find((position) => position.name === name);
}

function detailHref(division: number, historyQs: string) {
  const query = historyQs ? `?${historyQs}` : "";
  return `/insights/divisional-charts/${division}${query}`;
}

export default function DivisionalChartsClient({
  clientName,
  engineLabel,
  charts,
  historyQs,
  birthTimeAccuracy,
  birthTimeFallback,
}: DivisionalChartsClientProps) {
  const tr = useRouteMessages(divisionalMessages);
  const divisionNumbers = useMemo(
    () => Object.keys(charts).map(Number).sort((left, right) => left - right),
    [charts],
  );
  const [selectedDivision, setSelectedDivision] = useState(
    divisionNumbers.includes(9) ? 9 : (divisionNumbers[0] ?? 1),
  );
  const detailRef = useRef<HTMLElement>(null);

  const chart = charts[selectedDivision];
  const guide = getImportantDivisionalChartGuide(selectedDivision);
  const reliability = reliabilityCopy(tr, birthTimeAccuracy, birthTimeFallback);
  const backHref = `/insights?${historyQs}#divisional-charts`;

  if (!chart) return null;

  const ascendant = positionFor(chart, "Ascendant");
  const sun = positionFor(chart, "Sun");
  const moon = positionFor(chart, "Moon");
  const repeatedPositions = chart.positions.filter(
    (position) => position.rashi_sign === position.divisional_sign,
  );

  const selectChart = (division: number, moveToDetail = false) => {
    setSelectedDivision(division);
    if (moveToDetail) {
      window.requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.ambientOne} aria-hidden="true" />
      <div className={styles.ambientTwo} aria-hidden="true" />

      <div className={styles.shell}>
        <Link href={backHref} className={styles.backButton}>
          <FiArrowLeft aria-hidden="true" />
          {tr("divisional.atlas.backToReading")}
        </Link>

        <header className={styles.hero}>
          <div className={styles.heroIcon} aria-hidden="true">
            <FiLayers />
          </div>
          <p className={styles.kicker}>{tr("divisional.atlas.hero.kicker")}</p>
          <h1>{tr("divisional.atlas.hero.heading", { name: clientName })}</h1>
          <p className={styles.lead}>{tr("divisional.atlas.hero.lead")}</p>
          <div className={styles.heroFacts}>
            <span><FiGrid aria-hidden="true" /> {tr("divisional.atlas.hero.supportedCharts", { count: String(divisionNumbers.length) })}</span>
            <span><FiCompass aria-hidden="true" /> {engineLabel}</span>
            <span><FiClock aria-hidden="true" /> {birthTimeQualityLabel(tr, birthTimeAccuracy, birthTimeFallback)}</span>
          </div>
        </header>

        <section
          className={`${styles.reliability} ${reliability.tone === "good" ? styles.reliabilityGood : styles.reliabilityCaution}`}
          aria-label={tr("divisional.atlas.reliability.label")}
        >
          {reliability.tone === "good" ? (
            <FiCheckCircle aria-hidden="true" />
          ) : (
            <FiAlertCircle aria-hidden="true" />
          )}
          <div>
            <h2>{reliability.title}</h2>
            <p>{reliability.body}</p>
          </div>
        </section>

        <section className={styles.importantSection} aria-labelledby="important-vargas-title">
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>{tr("divisional.atlas.important.kicker")}</p>
            <h2 id="important-vargas-title">{tr("divisional.atlas.important.heading")}</h2>
            <p>{tr("divisional.atlas.important.lead")}</p>
          </div>

          <div className={styles.importantGrid}>
            {IMPORTANT_DIVISIONAL_CHARTS.filter((item) => charts[item.division]).map((item) => {
              const sensitivity = SENSITIVITY_COPY[item.sensitivity];
              const isSelected = item.division === selectedDivision;
              return (
                <article
                  key={item.division}
                  className={`${styles.importantCard} ${isSelected ? styles.importantCardActive : ""}`}
                >
                  <button
                    type="button"
                    className={styles.importantCardSelect}
                    onClick={() => selectChart(item.division, true)}
                    aria-pressed={isSelected}
                    aria-label={tr("divisional.atlas.important.previewLabel", {
                      label: item.label,
                      name: item.name,
                    })}
                  >
                    <span className={styles.cardTopline}>
                      <strong>{item.label}</strong>
                      <small className={styles[sensitivity.className]}>{tr(sensitivity.labelKey)}</small>
                    </span>
                    <span className={styles.cardName}>{item.name}</span>
                    <span className={styles.cardFocus}>{item.focus}</span>
                    <span className={styles.cardSummary}>{item.summary}</span>
                  </button>
                  <Link
                    href={detailHref(item.division, historyQs)}
                    className={styles.importantCardLink}
                    aria-label={tr("divisional.atlas.important.openDetails", {
                      label: item.label,
                    })}
                  >
                    {tr("divisional.atlas.important.showMore")}
                    <FiArrowRight aria-hidden="true" />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        <section className={styles.atlasSection} aria-labelledby="complete-atlas-title">
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>{tr("divisional.atlas.complete.kicker")}</p>
            <h2 id="complete-atlas-title">{tr("divisional.atlas.complete.heading")}</h2>
            <p>{tr("divisional.atlas.complete.lead")}</p>
          </div>

          <div
            className={styles.chartTabs}
            role="tablist"
            aria-label={tr("divisional.atlas.complete.tablistLabel")}
          >
            {divisionNumbers.map((division) => {
              const item = charts[division];
              const isSelected = division === selectedDivision;
              const isImportant = Boolean(getImportantDivisionalChartGuide(division));
              return (
                <button
                  key={division}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`${styles.chartTab} ${isSelected ? styles.chartTabActive : ""}`}
                  onClick={() => selectChart(division)}
                >
                  <strong>{item.label}</strong>
                  {isImportant && <span>{tr("divisional.atlas.complete.keyBadge")}</span>}
                </button>
              );
            })}
          </div>
        </section>

        <section ref={detailRef} className={styles.detailSection} aria-live="polite">
          <div className={styles.detailIntro}>
            <div className={styles.detailTitleRow}>
              <span className={styles.detailBadge}>{chart.label}</span>
              <div>
                <p className={styles.kicker}>
                  {guide?.name ?? tr("divisional.atlas.detail.fallbackName")}
                </p>
                <h2>{guide?.focus ?? chart.description}</h2>
                {/* D5, D6, D8 and D11 are not among Parashara's sixteen. They
                    sit in the same atlas as the classical vargas, so say which
                    is which rather than letting the presentation imply equal
                    authority. */}
                {chart.tradition === "extended" && (
                  <p className={styles.traditionNote}>
                    {tr("divisional.atlas.detail.traditionNote")}
                  </p>
                )}
                {guide && (
                  <Link
                    href={detailHref(selectedDivision, historyQs)}
                    className={styles.detailPageLink}
                  >
                    {tr("divisional.atlas.important.openDetails", {
                      label: chart.label,
                    })}
                    <FiArrowRight aria-hidden="true" />
                  </Link>
                )}
              </div>
            </div>

            <p className={styles.detailLead}>{guide?.summary ?? chart.description}</p>

            {guide ? (
              <div className={styles.guidanceGrid}>
                <article>
                  <FiBookOpen aria-hidden="true" />
                  <div><h3>{tr("divisional.atlas.detail.readWith")}</h3><p>{guide.readWith}</p></div>
                </article>
                <article>
                  <FiCompass aria-hidden="true" />
                  <div><h3>{tr("divisional.atlas.detail.clientQuestion")}</h3><p>{guide.clientQuestion}</p></div>
                </article>
                <article>
                  <FiClock aria-hidden="true" />
                  <div><h3>{tr("divisional.atlas.detail.reliability")}</h3><p>{guide.sensitivityNote}</p></div>
                </article>
              </div>
            ) : (
              <p className={styles.secondaryNote}>
                {tr("divisional.atlas.detail.secondaryNote")}
              </p>
            )}

            <div className={styles.snapshotGrid}>
              <article><span>{tr("divisional.atlas.snapshot.divisionalAscendant")}</span><strong>{ascendant?.divisional_sign ?? "—"}</strong></article>
              <article><span>{tr("divisional.atlas.snapshot.sun")}</span><strong>{sun?.divisional_sign ?? "—"}</strong></article>
              <article><span>{tr("divisional.atlas.snapshot.moon")}</span><strong>{moon?.divisional_sign ?? "—"}</strong></article>
              <article><span>{tr("divisional.atlas.snapshot.repeats")}</span><strong>{repeatedPositions.length}</strong></article>
            </div>
          </div>

          <div className={styles.positionCard}>
            <div className={styles.positionHeader}>
              <div>
                <p className={styles.kicker}>{tr("divisional.atlas.positions.kicker")}</p>
                <h2>{tr("divisional.atlas.positions.heading", { label: chart.label })}</h2>
              </div>
              <span>
                {tr("divisional.atlas.positions.count", {
                  count: String(chart.positions.length),
                })}
              </span>
            </div>

            <div
              className={styles.positionTable}
              role="table"
              aria-label={tr("divisional.atlas.positions.tableLabel", {
                label: chart.label,
              })}
            >
              <div className={`${styles.positionRow} ${styles.positionRowHeader}`} role="row">
                <span role="columnheader">{tr("divisional.atlas.positions.point")}</span>
                <span role="columnheader">{tr("divisional.atlas.positions.d1")}</span>
                <span role="columnheader">{chart.label}</span>
              </div>
              {chart.positions.map((position) => {
                const repeats = position.rashi_sign === position.divisional_sign;
                return (
                  <div
                    key={position.name}
                    className={`${styles.positionRow} ${repeats ? styles.positionRepeat : ""}`}
                    role="row"
                  >
                    <span className={styles.planet} role="cell">
                      <i aria-hidden="true">{PLANET_GLYPHS[position.name] ?? "•"}</i>
                      {position.name}
                    </span>
                    <span role="cell">{position.rashi_sign}</span>
                    <span role="cell">
                      {position.divisional_sign}
                      {repeats && <small>{tr("divisional.atlas.positions.repeats")}</small>}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className={styles.tableNote}>
              {tr("divisional.atlas.positions.note")}
            </p>
          </div>
        </section>

        <footer className={styles.footer}>
          <p>{tr("divisional.atlas.footer")}</p>
          <Link href={backHref} className={styles.backButtonBottom}>
            <FiArrowLeft aria-hidden="true" />
            {tr("divisional.atlas.returnToReading")}
          </Link>
        </footer>
      </div>
    </main>
  );
}
