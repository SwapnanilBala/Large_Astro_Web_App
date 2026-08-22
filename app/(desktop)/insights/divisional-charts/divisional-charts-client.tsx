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
import styles from "./divisional-charts.module.css";

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
  { label: string; className: "steady" | "careful" | "strict" }
> = {
  foundation: { label: "Foundation layer", className: "steady" },
  "exact-time": { label: "Exact time advised", className: "careful" },
  "rectified-time": { label: "Rectified time advised", className: "strict" },
};

function birthTimeQualityLabel(accuracy: string, fallback: boolean) {
  if (fallback || !accuracy || accuracy === "unknown") return "Exploratory birth time";
  if (accuracy === "exact") return "Exact birth time recorded";
  return `${accuracy[0].toUpperCase()}${accuracy.slice(1)} time window`;
}

function reliabilityCopy(accuracy: string, fallback: boolean) {
  if (accuracy === "exact" && !fallback) {
    return {
      title: "Exact birth time recorded",
      body: "The atlas can display every supported varga. D30 and D60 still deserve boundary checks because their divisions are exceptionally fine.",
      tone: "good" as const,
    };
  }

  return {
    title: "Use higher divisions as exploratory layers",
    body: "The recorded time is approximate or a fallback. Planetary sign subdivisions are shown, but ascendant- and house-based conclusions in higher vargas should not be promoted until the birth time is rectified.",
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
  const reliability = reliabilityCopy(birthTimeAccuracy, birthTimeFallback);
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
          Back to your reading
        </Link>

        <header className={styles.hero}>
          <div className={styles.heroIcon} aria-hidden="true">
            <FiLayers />
          </div>
          <p className={styles.kicker}>D1–D60 · Varga atlas</p>
          <h1>{clientName}&apos;s divisional chart layers</h1>
          <p className={styles.lead}>
            The D1 is the foundation. Each higher varga magnifies one life area,
            helping the reading confirm, qualify, or narrow a theme already
            present in the main chart.
          </p>
          <div className={styles.heroFacts}>
            <span><FiGrid aria-hidden="true" /> {divisionNumbers.length} supported charts</span>
            <span><FiCompass aria-hidden="true" /> {engineLabel}</span>
            <span><FiClock aria-hidden="true" /> {birthTimeQualityLabel(birthTimeAccuracy, birthTimeFallback)}</span>
          </div>
        </header>

        <section
          className={`${styles.reliability} ${reliability.tone === "good" ? styles.reliabilityGood : styles.reliabilityCaution}`}
          aria-label="Birth time reliability"
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
            <p className={styles.kicker}>The ten key layers</p>
            <h2 id="important-vargas-title">Start with the charts that answer a clear question</h2>
            <p>
              These ten receive fuller guidance because they add the most useful
              context to a client-focused reading. They are not ten competing natal charts.
            </p>
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
                    aria-label={`Preview ${item.label} ${item.name} in the atlas`}
                  >
                    <span className={styles.cardTopline}>
                      <strong>{item.label}</strong>
                      <small className={styles[sensitivity.className]}>{sensitivity.label}</small>
                    </span>
                    <span className={styles.cardName}>{item.name}</span>
                    <span className={styles.cardFocus}>{item.focus}</span>
                    <span className={styles.cardSummary}>{item.summary}</span>
                  </button>
                  <Link
                    href={detailHref(item.division, historyQs)}
                    className={styles.importantCardLink}
                    aria-label={`Open full ${item.label} details`}
                  >
                    Show more details
                    <FiArrowRight aria-hidden="true" />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        <section className={styles.atlasSection} aria-labelledby="complete-atlas-title">
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>Complete supported atlas</p>
            <h2 id="complete-atlas-title">All calculated vargas</h2>
            <p>
              Select any chart to inspect the client&apos;s placements. The ten key
              charts include additional interpretation guidance below.
            </p>
          </div>

          <div className={styles.chartTabs} role="tablist" aria-label="Divisional charts">
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
                  {isImportant && <span>Key</span>}
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
                <p className={styles.kicker}>{guide?.name ?? "Divisional chart"}</p>
                <h2>{guide?.focus ?? chart.description}</h2>
                {/* D5, D6, D8 and D11 are not among Parashara's sixteen. They
                    sit in the same atlas as the classical vargas, so say which
                    is which rather than letting the presentation imply equal
                    authority. */}
                {chart.tradition === "extended" && (
                  <p className={styles.traditionNote}>
                    Outside Parashara&rsquo;s sixteen vargas — read as a
                    supplementary layer, not a classical authority.
                  </p>
                )}
                {guide && (
                  <Link
                    href={detailHref(selectedDivision, historyQs)}
                    className={styles.detailPageLink}
                  >
                    Open full {chart.label} details
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
                  <div><h3>Read it with</h3><p>{guide.readWith}</p></div>
                </article>
                <article>
                  <FiCompass aria-hidden="true" />
                  <div><h3>Client question</h3><p>{guide.clientQuestion}</p></div>
                </article>
                <article>
                  <FiClock aria-hidden="true" />
                  <div><h3>Reliability</h3><p>{guide.sensitivityNote}</p></div>
                </article>
              </div>
            ) : (
              <p className={styles.secondaryNote}>
                This is a supporting chart in the complete atlas. It can add
                context, but the report should promote it only when the D1 and a
                relevant key varga already support the same conclusion.
              </p>
            )}

            <div className={styles.snapshotGrid}>
              <article><span>Divisional ascendant</span><strong>{ascendant?.divisional_sign ?? "—"}</strong></article>
              <article><span>Sun</span><strong>{sun?.divisional_sign ?? "—"}</strong></article>
              <article><span>Moon</span><strong>{moon?.divisional_sign ?? "—"}</strong></article>
              <article><span>D1 sign repeats</span><strong>{repeatedPositions.length}</strong></article>
            </div>
          </div>

          <div className={styles.positionCard}>
            <div className={styles.positionHeader}>
              <div>
                <p className={styles.kicker}>Your placements</p>
                <h2>{chart.label} position map</h2>
              </div>
              <span>{chart.positions.length} points</span>
            </div>

            <div className={styles.positionTable} role="table" aria-label={`${chart.label} placements`}>
              <div className={`${styles.positionRow} ${styles.positionRowHeader}`} role="row">
                <span role="columnheader">Point</span>
                <span role="columnheader">D1</span>
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
                      {repeats && <small>Repeats</small>}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className={styles.tableNote}>
              “Repeats” means the point remains in the same sign as D1. It is a
              consistency signal, not automatically positive or negative.
            </p>
          </div>
        </section>

        <footer className={styles.footer}>
          <p>
            Divisional charts increase specificity only when they confirm the
            natal promise, use reliable birth data, and agree with independent
            strength and timing factors.
          </p>
          <Link href={backHref} className={styles.backButtonBottom}>
            <FiArrowLeft aria-hidden="true" />
            Return to your reading
          </Link>
        </footer>
      </div>
    </main>
  );
}
