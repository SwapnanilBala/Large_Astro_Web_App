"use client";

import { useMemo } from "react";
import type { ChartApiResponse } from "@/lib/astro-types";
import {
  computeMajorLifeShifts,
  type MajorLifeShift,
  type MajorShiftKind,
  type MajorShiftStatus,
} from "@/lib/engines/major-shifts-engine";
import { planetName } from "@/lib/chart-labels";
import {
  formatShiftPivot,
  formatShiftWindow,
  lifeShiftId,
} from "@/lib/life-shift-reading";
import { useLifeShiftReadings } from "./use-life-shift-readings";
import { LOCALE_TAGS, useTranslation } from "@/lib/i18n-context";
import styles from "../insights.module.css";

const STATUS_LABEL_KEY: Record<MajorShiftStatus, string> = {
  past: "insights.shifts.past",
  active: "insights.shifts.active",
  upcoming: "insights.shifts.upcoming",
};

/* formatShiftPivot and formatShiftWindow live in lib/life-shift-reading.ts
   because the prompt needs the identical words: a reading that says "late
   2028" under a card headed "March 2029" reads as a contradiction rather
   than as two roundings of one date. The card names the same month in the
   reader's language; the prompt keeps en-US. */

function statusClass(status: MajorShiftStatus): string {
  if (status === "past") return styles.lifeShiftCardPast;
  if (status === "active") return styles.lifeShiftCardActive;
  return styles.lifeShiftCardUpcoming;
}

/*
 * `reading` is what /api/chart/life-shifts wrote for this chapter, and the
 * engine's own `narrative` is what shows until it lands -- and instead of it
 * if the route is unavailable, out of budget, or declines. The template is
 * never removed from the page, only covered: nine planet tones and three
 * return shapes is thin enough that two charts get the same paragraph, which
 * is what the route is for, but it is a complete answer and a blank card is
 * not.
 */
type Translate = (key: string, params?: Record<string, string>) => string;

/*
 * The engine's chapter names and themes are a closed set: a mahadasha for each
 * planet and three returns. They print through insights.shifts.labels and
 * .themes; anything else prints as the engine wrote it. The narrative and the
 * evidence line stay the engine's English, as its reading prose does.
 */
export const RETURN_KEYS: Partial<Record<MajorShiftKind, string>> = {
  "saturn-return": "saturnReturn",
  "jupiter-return": "jupiterReturn",
  "nodal-return": "nodalReturn",
};

/* The engine names a return's occurrence in words, then falls back to "5th". */
export const SHIFT_ORDINALS = ["first", "second", "third", "fourth"] as const;

function worded(t: Translate, key: string, fallback: string, params?: Record<string, string>): string {
  const text = t(key, params);
  return text === key ? fallback : text;
}

function shiftLabel(shift: MajorLifeShift, t: Translate): string {
  if (shift.kind === "mahadasha") {
    return worded(t, "insights.shifts.labels.mahadasha", shift.label, { planet: planetName(shift.planet, t) });
  }
  const kind = RETURN_KEYS[shift.kind];
  const ordinal = /\((\w+)\)$/.exec(shift.label)?.[1] as (typeof SHIFT_ORDINALS)[number] | undefined;
  if (!kind || !ordinal || !SHIFT_ORDINALS.includes(ordinal)) return shift.label;
  return worded(t, `insights.shifts.labels.${kind}`, shift.label, {
    ordinal: worded(t, `insights.shifts.ordinals.${ordinal}`, ordinal),
  });
}

function shiftTheme(shift: MajorLifeShift, t: Translate): string {
  const id = shift.kind === "mahadasha" ? shift.planet.toLowerCase() : RETURN_KEYS[shift.kind];
  return id ? worded(t, `insights.shifts.themes.${id}`, shift.theme) : shift.theme;
}

function ShiftCard({
  shift,
  reading,
  headingLevel,
}: {
  shift: MajorLifeShift;
  reading?: string;
  /* 3 inside an /insights section, which supplies the h2; 2 on the life-shifts
     page, where the cards sit directly under the h1. */
  headingLevel: 2 | 3;
}) {
  const { t, language } = useTranslation();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className={`${styles.lifeShiftCard} ${statusClass(shift.status)}`}>
      <header className={styles.lifeShiftHeader}>
        <span className={styles.lifeShiftIndex}>#{shift.index}</span>
        <span className={styles.lifeShiftStatus}>{t(STATUS_LABEL_KEY[shift.status])}</span>
      </header>
      <p className={styles.lifeShiftLabel}>{shiftLabel(shift, t)}</p>
      <Heading>{shiftTheme(shift, t)}</Heading>
      <p className={styles.lifeShiftWindow}>
        <strong>{t("insights.shifts.pivot")}</strong> {formatShiftPivot(shift.pivotIso, LOCALE_TAGS[language])} ·{" "}
        {t("insights.shifts.age", { age: String(shift.ageAtPivot) })}
        <br />
        <strong>{t("insights.shifts.window")}</strong>{" "}
        {formatShiftWindow(shift.windowStartIso, shift.windowEndIso, LOCALE_TAGS[language])}
      </p>
      <p>{reading ?? shift.narrative}</p>
      {shift.evidence && <small>{shift.evidence}</small>}
    </article>
  );
}

/*
 * `brief` is the results page: the one chapter that is actually live, and
 * nothing else. `full` is /insights/life-shifts, which carries the next
 * transition and every past chapter.
 *
 * A variant rather than two components, because the featured/past split below
 * is the only thing deciding which chapter counts as "now" -- forking it would
 * let the two pages disagree about that.
 */
export default function MajorShiftsPanel({
  payload,
  historyQs,
  variant = "full",
}: {
  payload: ChartApiResponse;
  /** The chart's query string, which the readings' route rebuilds the chapters from. */
  historyQs: string;
  variant?: "brief" | "full";
}) {
  const { t } = useTranslation();
  const isBrief = variant === "brief";
  const shifts: MajorLifeShift[] = useMemo(
    () => computeMajorLifeShifts(payload),
    [payload],
  );

  const forwardShifts = shifts
    .filter((shift) => shift.status === "active" || shift.status === "upcoming")
    .slice(0, isBrief ? 1 : 2);
  const featuredShifts = forwardShifts.length > 0 ? forwardShifts : shifts.slice(-1);
  const featuredKeys = new Set(featuredShifts.map(lifeShiftId));
  const pastShifts = shifts.filter(
    (shift) => shift.status === "past" && !featuredKeys.has(lifeShiftId(shift)),
  );

  /* Only the chapters actually on the page are asked for, which is what
     keeps the results page cheap: the brief variant renders one chapter and
     buys one reading, where the full page renders up to five.

     This selection sits above the empty-chart return because the hook below
     it cannot be conditional -- and it has to be above the hook rather than
     after it, because the hook is the thing that spends money. Handing it
     `shifts` instead was a five-chapter call on the most visited page in
     the app, four fifths of it for cards that page never draws. */
  const renderedShifts = isBrief ? featuredShifts : [...featuredShifts, ...pastShifts];
  const { readings } = useLifeShiftReadings(
    renderedShifts,
    isBrief ? "headline" : "compact",
    historyQs,
  );

  if (shifts.length === 0) {
    return (
      <div className={styles.lifeShiftsPanel}>
        <p className={styles.sectionIntro}>{t("insights.shifts.empty")}</p>
      </div>
    );
  }

  return (
    <div className={styles.lifeShiftsPanel}>
      <p className={styles.sectionIntro}>
        {isBrief ? t("insights.shifts.introBrief") : t("insights.shifts.introFull")}
      </p>

      <div className={styles.lifeShiftsTimeline}>
        {featuredShifts.map((shift) => (
          <ShiftCard
            key={lifeShiftId(shift)}
            shift={shift}
            reading={readings.get(lifeShiftId(shift))}
            headingLevel={isBrief ? 3 : 2}
          />
        ))}
      </div>

      {/* Past chapters are already behind a disclosure, but on the results
          page they are still markup, still measured, and still one click from
          a wall of text under a section that opens by default. */}
      {!isBrief && pastShifts.length > 0 && (
        <details className={styles.lifeShiftsArchive}>
          <summary>
            {pastShifts.length === 1
              ? t("insights.shifts.viewPastOne")
              : t("insights.shifts.viewPastOther", { count: String(pastShifts.length) })}
          </summary>
          <div className={styles.lifeShiftsTimeline}>
            {pastShifts.map((shift) => (
              <ShiftCard
                key={lifeShiftId(shift)}
                shift={shift}
                reading={readings.get(lifeShiftId(shift))}
                headingLevel={isBrief ? 3 : 2}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
