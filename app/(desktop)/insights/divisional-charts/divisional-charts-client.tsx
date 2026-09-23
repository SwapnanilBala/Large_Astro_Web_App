"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiArrowRight,
  FiBookOpen,
  FiCheckCircle,
  FiClock,
  FiCompass,
  FiLayers,
} from "react-icons/fi";
import type { DivisionalChartInfo } from "@/lib/astro-types";
import {
  divisionalGuideKey,
  getImportantDivisionalChartGuide,
  type DivisionalChartSensitivity,
  type DivisionalGuideField,
} from "@/lib/divisional-chart-guide";
import { useRouteMessages, useTranslation } from "@/lib/i18n-context";
import divisionalMessages from "@/messages/en.divisional.json";
import { useVargaCommentary } from "./use-varga-commentary";
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

/**
 * The varga atlas.
 *
 * ── LAYOUT ─────────────────────────────────────────────────────────────────
 *
 * One DOM, two shapes. On a computer this is a board that fills the viewport
 * and does not scroll the page: a slim bar across the top, then three columns
 * -- the list of vargas, the reading for the selected one, and its position
 * table -- each scrolling inside itself if it needs to. Below 1100px the same
 * markup falls back to a normal stacked page, which is what a narrow window can
 * actually carry.
 *
 * It used to be one column, 3651px tall at 1440 wide: hero, reliability banner,
 * a ten-card grid, a tab strip, then the detail. Four viewports of scrolling to
 * reach a table, and the ten-card grid said in full what the rail now says in a
 * line, so it was also the longest part. Nothing was dropped -- every field
 * those cards carried is in the reading column when its varga is selected -- but
 * the page no longer prints all ten at once to make the point that there are
 * ten.
 *
 * The one real loss is the at-a-glance comparison the grid allowed. The rail
 * keeps what that was actually used for (which vargas are the key ones, and how
 * much each depends on an exact birth time) and the rest is a click away.
 */
export default function DivisionalChartsClient({
  clientName,
  engineLabel,
  charts,
  historyQs,
  birthTimeAccuracy,
  birthTimeFallback,
}: DivisionalChartsClientProps) {
  const tr = useRouteMessages(divisionalMessages);
  const { language } = useTranslation();
  const divisionNumbers = useMemo(
    () => Object.keys(charts).map(Number).sort((left, right) => left - right),
    [charts],
  );
  const [selectedDivision, setSelectedDivision] = useState(
    divisionNumbers.includes(9) ? 9 : (divisionNumbers[0] ?? 1),
  );

  /* Fired once on mount for all ten key vargas, in the reader's language;
     see the hook. */
  const commentary = useVargaCommentary(charts, language);

  const chart = charts[selectedDivision];
  const guide = getImportantDivisionalChartGuide(selectedDivision);
  /* The selected varga's own prose. Only meaningful where `guide` is set --
     the supporting charts have no catalog entry and fall back to the
     description the engine returned. */
  const guideText = (field: DivisionalGuideField) =>
    tr(divisionalGuideKey(selectedDivision, field));
  const reliability = reliabilityCopy(tr, birthTimeAccuracy, birthTimeFallback);
  const backHref = `/insights?${historyQs}#divisional-charts`;

  if (!chart) return null;

  const ascendant = positionFor(chart, "Ascendant");
  const sun = positionFor(chart, "Sun");
  const moon = positionFor(chart, "Moon");
  const repeatedPositions = chart.positions.filter(
    (position) => position.rashi_sign === position.divisional_sign,
  );
  const note = commentary.notes.get(selectedDivision);

  return (
    <div className={styles.page} /* the desktop layout owns <main> */>
      <div className={styles.ambientOne} aria-hidden="true" />
      <div className={styles.ambientTwo} aria-hidden="true" />

      <div className={styles.shell}>
        <header className={styles.topBar}>
          <Link href={backHref} className={styles.backButton}>
            <FiArrowLeft aria-hidden="true" />
            {tr("divisional.atlas.backToReading")}
          </Link>

          <div className={styles.topTitle}>
            <span className={styles.topIcon} aria-hidden="true"><FiLayers /></span>
            <div>
              <p className={styles.kicker}>{tr("divisional.atlas.hero.kicker")}</p>
              <h1>{tr("divisional.atlas.hero.heading", { name: clientName })}</h1>
            </div>
          </div>

          {/*
            Two chips, not three. `hero.exactTime` and `reliability.goodTitle`
            are the same sentence -- "Exact birth time recorded" -- so a bar
            that printed both said it twice whenever the news was good. The
            birth-time chip carries the reliability tone and the reliability
            body as its tooltip, and the separate warning appears only in the
            caution case, where its title is genuinely different information
            ("Use higher divisions as exploratory layers") rather than an echo.
          */}
          <div className={styles.topFacts}>
            <span><FiCompass aria-hidden="true" /> {engineLabel}</span>
            <span
              className={reliability.tone === "good" ? styles.factGood : styles.factCaution}
              title={reliability.body}
            >
              {reliability.tone === "good" ? (
                <FiCheckCircle aria-hidden="true" />
              ) : (
                <FiClock aria-hidden="true" />
              )}
              {birthTimeQualityLabel(tr, birthTimeAccuracy, birthTimeFallback)}
            </span>
            {reliability.tone === "caution" && (
              <span className={styles.factCaution} title={reliability.body}>
                <FiAlertCircle aria-hidden="true" />
                {reliability.title}
              </span>
            )}
          </div>
        </header>

        <div className={styles.board}>
          {/* ── Column 1: every calculated varga ── */}
          <nav
            className={styles.rail}
            role="tablist"
            aria-label={tr("divisional.atlas.complete.tablistLabel")}
          >
            <p className={styles.railLead}>{tr("divisional.atlas.complete.lead")}</p>
            {divisionNumbers.map((division) => {
              const item = charts[division];
              const isSelected = division === selectedDivision;
              const entry = getImportantDivisionalChartGuide(division);
              const sensitivity = entry ? SENSITIVITY_COPY[entry.sensitivity] : null;
              return (
                <button
                  key={division}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`${styles.railItem} ${isSelected ? styles.railItemActive : ""}`}
                  onClick={() => setSelectedDivision(division)}
                >
                  <span className={styles.railLabel}>
                    <strong>{item.label}</strong>
                    {entry && <span className={styles.railKey}>{tr("divisional.atlas.complete.keyBadge")}</span>}
                  </span>
                  {entry && (
                    <>
                      <span className={styles.railName}>
                        {tr(divisionalGuideKey(division, "name"))}
                      </span>
                      {sensitivity && (
                        <span className={styles[sensitivity.className]}>
                          {tr(sensitivity.labelKey)}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </nav>

          {/* ── Column 2: the reading for the selected varga ── */}
          <section className={styles.readingPane} aria-live="polite">
            <div className={styles.readingHead}>
              <span className={styles.detailBadge}>{chart.label}</span>
              <div>
                <p className={styles.kicker}>
                  {guide ? guideText("name") : tr("divisional.atlas.detail.fallbackName")}
                </p>
                <h2>{guide ? guideText("focus") : chart.description}</h2>
              </div>
              {guide && (
                <Link
                  href={detailHref(selectedDivision, historyQs)}
                  className={styles.detailPageLink}
                >
                  {tr("divisional.atlas.important.showMore")}
                  <FiArrowRight aria-hidden="true" />
                </Link>
              )}
            </div>

            {/* D5, D6, D8 and D11 are not among Parashara's sixteen. They sit in
                the same atlas as the classical vargas, so say which is which
                rather than letting the presentation imply equal authority. */}
            {chart.tradition === "extended" && (
              <p className={styles.traditionNote}>
                {tr("divisional.atlas.detail.traditionNote")}
              </p>
            )}

            <p className={styles.detailLead}>
              {guide ? guideText("summary") : chart.description}
            </p>

            {/*
              Claude's note on this chart's placements.
              Only the ten key vargas get one -- the route refuses any other
              division -- so a supporting chart shows nothing here rather than an
              empty frame. It is written in the reader's own language -- the
              model is told which -- so the label below it is provenance, not a
              warning that this one paragraph is in English.
            */}
            {guide && (
              <div className={styles.notePanel}>
                <p className={styles.noteKicker}>{tr("divisional.atlas.notes.kicker")}</p>
                {note ? (
                  <>
                    <p className={styles.noteBody}>{note}</p>
                    <p className={styles.noteAttribution}>
                      {tr("divisional.atlas.notes.attribution")}
                    </p>
                  </>
                ) : (
                  <p className={styles.noteStatus}>
                    {commentary.state === "pending"
                      ? tr("divisional.atlas.notes.pending")
                      : tr("divisional.atlas.notes.failed")}
                  </p>
                )}
              </div>
            )}

            {guide ? (
              <div className={styles.guidanceGrid}>
                <article>
                  <FiBookOpen aria-hidden="true" />
                  <div><h3>{tr("divisional.atlas.detail.readWith")}</h3><p>{guideText("readWith")}</p></div>
                </article>
                <article>
                  <FiCompass aria-hidden="true" />
                  <div><h3>{tr("divisional.atlas.detail.clientQuestion")}</h3><p>{guideText("clientQuestion")}</p></div>
                </article>
                <article>
                  <FiClock aria-hidden="true" />
                  <div><h3>{tr("divisional.atlas.detail.reliability")}</h3><p>{guideText("sensitivityNote")}</p></div>
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
          </section>

          {/* ── Column 3: the placements themselves ── */}
          <section className={styles.tablePane}>
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
            <p className={styles.tableNote}>{tr("divisional.atlas.positions.note")}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
