"use client";

import type { CSSProperties } from "react";
import { daysLeftAt, progressAt, type DashaSpan } from "@/lib/dasha-periods";
import type { NakshatraInfo } from "@/lib/astro-types";
import { nakshatraName, planetName } from "@/lib/chart-labels";
import { PLANET_COLORS, PLANET_INK } from "@/lib/constellation-geometry";
import { useTranslation } from "@/lib/i18n-context";
import { formatLeft, formatPercent, formatSpan, formatToday } from "./dasha-format";
import styles from "./nakshatra-dasha-panel.module.css";

/*
 * Where the reader is now: the four periods running today, Maha Dasha down to
 * Sookshma, as rings of a dial -- outermost the Maha Dasha -- each drawn as
 * far round as that period has gone, and as rows beside it with their dates
 * and what is left. A row opens that level on the timeline below and puts it
 * in the reading card.
 */

export const LEVEL_LABEL_KEYS: Record<number, string> = {
  1: "dasha.mahaDasha",
  2: "dasha.antardasha",
  3: "dasha.pratyantardasha",
  4: "dasha.sookshmaDasha",
};

export const planetStyle = (planet: string) =>
  ({
    "--planet": PLANET_COLORS[planet] ?? "#6ce1d4",
    "--planet-ink": PLANET_INK[planet] ?? "var(--accent-aqua)",
  }) as CSSProperties;

const SIZE = 240;
const CENTRE = SIZE / 2;
const STROKE = 12;
/* Outermost first: the Maha Dasha's ring, then each level inside the last. */
const RADII = [108, 88, 68, 48];

type DashaNowProps = {
  path: DashaSpan[];
  now: number;
  /** How deep the reading card's period goes along today's periods; 0 when it is elsewhere. */
  focusedDepth: number;
  onFocus: (depth: number) => void;
  nakshatra: NakshatraInfo;
  /** The written reading of today's periods, or its template while it is on its way. */
  meaning: { text: string | null; pending: boolean };
};

export function DashaNow({ path, now, focusedDepth, onFocus, nakshatra, meaning }: DashaNowProps) {
  const { t, language } = useTranslation();
  const levelLabel = (level: number) => t(LEVEL_LABEL_KEYS[level] ?? "dasha.mahaDasha");

  return (
    <section className={styles.now} aria-labelledby="dasha-now-title">
      <div className={styles.dialWrap}>
        <svg className={styles.dial} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          {path.map((span, index) => {
            const radius = RADII[index];
            const circumference = 2 * Math.PI * radius;
            const progress = progressAt(span, now);
            const angle = progress * 2 * Math.PI - Math.PI / 2;
            return (
              <g key={`${span.level}-${span.planet}-${span.start}`} style={planetStyle(span.planet)}>
                <circle className={styles.dialTrack} cx={CENTRE} cy={CENTRE} r={radius} strokeWidth={STROKE} />
                <circle
                  className={`${styles.dialArc}${focusedDepth === index + 1 ? ` ${styles.dialArcFocused}` : ""}`}
                  cx={CENTRE}
                  cy={CENTRE}
                  r={radius}
                  strokeWidth={STROKE}
                  strokeDasharray={`${Math.max(0.001, progress * circumference)} ${circumference}`}
                  transform={`rotate(-90 ${CENTRE} ${CENTRE})`}
                />
                <circle
                  className={styles.dialDot}
                  cx={CENTRE + radius * Math.cos(angle)}
                  cy={CENTRE + radius * Math.sin(angle)}
                  r={4.5}
                />
              </g>
            );
          })}
        </svg>
        <div className={styles.dialCenter}>
          <strong>{formatToday(now, language)}</strong>
          <span>{t("dasha.panel.today")}</span>
        </div>
      </div>

      <div className={styles.nowBody}>
        <p className={styles.kicker}>{t("dasha.panel.chapterKicker")}</p>
        <h3 id="dasha-now-title" className={styles.chainTitle}>
          {path.map((span, index) => (
            <span key={`${span.level}-${span.planet}`} style={planetStyle(span.planet)}>
              {index > 0 && <em className={styles.chainSep} aria-hidden="true">› </em>}
              {planetName(span.planet, t)}
            </span>
          ))}
        </h3>

        <ol className={styles.levels} aria-label={t("dasha.panel.stackAria")}>
          {path.map((span, index) => {
            const progress = progressAt(span, now);
            return (
              <li key={`${span.level}-${span.planet}-${span.start}`}>
                <button
                  type="button"
                  className={`${styles.level}${focusedDepth === index + 1 ? ` ${styles.levelFocused}` : ""}`}
                  style={planetStyle(span.planet)}
                  aria-pressed={focusedDepth === index + 1}
                  onClick={() => onFocus(index + 1)}
                >
                  <span className={styles.levelName}>{levelLabel(span.level)}</span>
                  <span className={styles.levelLord}>{planetName(span.planet, t)}</span>
                  <span className={styles.levelDates}>{formatSpan(span, language)}</span>
                  <span className={styles.levelBar} aria-hidden="true">
                    <span className={styles.levelFill} style={{ width: `${progress * 100}%` }} />
                  </span>
                  <span className={styles.levelFigures}>
                    {t("dasha.now.through", { percent: formatPercent(progress, language) })} ·{" "}
                    {formatLeft(daysLeftAt(span, now), t, language)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <p className={styles.seed}>
          {t("dasha.now.seed", {
            nakshatra: nakshatraName(nakshatra.name, t),
            pada: String(nakshatra.pada),
            planet: planetName(nakshatra.lord, t),
          })}
        </p>
      </div>

      {meaning.text && (
        <div className={styles.meaning}>
          <h4>{t("dasha.currentSummaryLabel")}</h4>
          <p>
            {meaning.text}
            {/* Quiet, and only while the template is what is showing. */}
            {meaning.pending && <span className={styles.pending}> {t("dasha.currentReadingPending")}</span>}
          </p>
        </div>
      )}
    </section>
  );
}
