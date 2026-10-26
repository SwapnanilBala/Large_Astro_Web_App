"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
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
  lifeShiftAnchor,
  lifeShiftId,
} from "@/lib/life-shift-reading";
import type { ClassicalReading } from "@/lib/knowledge/classical-reading";
import { ClassicalParagraphs, ClassicalSources } from "./classical-note";
import { ReadingProgress } from "./reading-progress";
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
 * `reading` is what /api/chart/life-shifts wrote for this chapter, from the
 * chart and the classics, with the passages it cites; the engine's own
 * `narrative` is what shows until it lands -- and instead of it if the route
 * is unavailable, out of budget, or declines. The template is never removed
 * from the page, only covered: nine planet tones and three return shapes is
 * thin enough that two charts get the same paragraph, which is what the route
 * is for, but it is a complete answer and a blank card is not.
 *
 * The passages' strings (the count, "Brihat Jataka 18.13", the credits) are
 * the dasha period reading's, which cites the same books the same way.
 */
const SOURCE_STRINGS = "dasha.reading.note";

/*
 * How long the readings usually take to arrive, for the progress bar shown
 * while they are written (Opus 5.5 low, measured 2026-10-16/17, the passage
 * search included): the results page's one long chapter in 6-10s; on the
 * life chapters page the chapters still ahead, written in a call of their own
 * and streamed, in 6.5-11s, and the past ones beside them in 9.5-14.5s.
 */
const EXPECTED_MS = { headline: 9_000, ahead: 9_000, past: 13_000 } as const;
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
  waitingMs,
  headingLevel,
  wide = false,
}: {
  shift: MajorLifeShift;
  reading?: ClassicalReading;
  /** The results page's one chapter, alone across the section: its facts beside the reading rather than above it. */
  wide?: boolean;
  /** While this chapter's reading is being written: how long it usually takes. Its template shows dimmed under the bar. */
  waitingMs?: number;
  /* 3 inside an /insights section, which supplies the h2; 2 on the life-shifts
     page, where the cards sit directly under the h1. */
  headingLevel: 2 | 3;
}) {
  const { t, language } = useTranslation();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article
      id={lifeShiftAnchor(shift)}
      className={`${styles.lifeShiftCard} ${styles.anchorTarget} ${statusClass(shift.status)}${wide ? ` ${styles.lifeShiftCardWide}` : ""}`}
    >
      <div className={styles.lifeShiftMeta}>
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
      </div>
      <div className={styles.lifeShiftBody}>
        {reading ? (
          <>
            <div className={styles.lifeShiftReading}>
              <ClassicalParagraphs reading={reading} />
            </div>
            <ClassicalSources reading={reading} tr={t} prefix={SOURCE_STRINGS} />
          </>
        ) : waitingMs ? (
          <>
            <ReadingProgress label={t("insights.story.stages.writing")} expectedMs={waitingMs} />
            <p className={styles.lifeShiftWaiting}>{shift.narrative}</p>
          </>
        ) : (
          <p>{shift.narrative}</p>
        )}
      </div>
      {shift.evidence && <small>{shift.evidence}</small>}
    </article>
  );
}

/*
 * Every chapter the engine found, in date order, as a row of small steps under
 * the results page's one card: where the chapter on show sits among the
 * others, past and ahead. Each opens that chapter on /insights/life-shifts.
 */
function ChapterStrip({
  shifts,
  current,
  historyQs,
}: {
  shifts: MajorLifeShift[];
  current: Set<string>;
  historyQs: string;
}) {
  const { t, language } = useTranslation();
  return (
    <ol className={styles.lifeShiftStrip} aria-label={t("insights.page.lifeShifts.link")}>
      {shifts.map((shift) => {
        const id = lifeShiftId(shift);
        const here = current.has(id);
        return (
          <li key={id}>
            <Link
              href={`/insights/life-shifts?${historyQs}#${lifeShiftAnchor(shift)}`}
              className={`${styles.lifeShiftStep} ${statusClass(shift.status)}${here ? ` ${styles.lifeShiftStepCurrent}` : ""}`}
              aria-current={here ? "step" : undefined}
              prefetch={false}
            >
              <span className={styles.lifeShiftStepStatus}>{t(STATUS_LABEL_KEY[shift.status])}</span>
              <span className={styles.lifeShiftStepLabel}>{shiftLabel(shift, t)}</span>
              <span className={styles.lifeShiftStepDate}>{formatShiftPivot(shift.pivotIso, LOCALE_TAGS[language])}</span>
            </Link>
          </li>
        );
      })}
    </ol>
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
  const { t, language } = useTranslation();
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
  const { state: readingState, readings } = useLifeShiftReadings(
    renderedShifts,
    isBrief ? "headline" : "compact",
    historyQs,
    language,
  );

  /* The results page's chapter row links to each chapter here by its anchor.
     A past chapter sits inside the closed archive, where the browser cannot
     scroll to it, so a link to one opens the archive and then goes to it. */
  const archiveRef = useRef<HTMLDetailsElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isBrief) return;
    /* The readings land after the jump and grow the cards above the one
       linked to, which pushed it down the page; so the chapter is kept in
       place while the panel settles, until the reader does anything at all. */
    let follow: ResizeObserver | null = null;
    const stopFollowing = () => {
      follow?.disconnect();
      follow = null;
    };
    const reveal = () => {
      stopFollowing();
      const anchor = decodeURIComponent(window.location.hash.slice(1));
      const target = anchor ? document.getElementById(anchor) : null;
      const panel = panelRef.current;
      if (!target || !panel || !panel.contains(target)) return;
      const archive = archiveRef.current;
      if (archive && archive.contains(target)) archive.open = true;
      const align = () => target.scrollIntoView({ block: "start" });
      requestAnimationFrame(align);
      follow = new ResizeObserver(align);
      follow.observe(panel);
    };
    const READER_INPUT = ["wheel", "touchstart", "keydown", "mousedown"] as const;
    reveal();
    window.addEventListener("hashchange", reveal);
    for (const type of READER_INPUT) window.addEventListener(type, stopFollowing, { passive: true });
    /* And not forever: by then the readings have landed or failed. */
    const timer = window.setTimeout(stopFollowing, 20_000);
    return () => {
      stopFollowing();
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", reveal);
      for (const type of READER_INPUT) window.removeEventListener(type, stopFollowing);
    };
  }, [isBrief]);

  if (shifts.length === 0) {
    return (
      <div className={styles.lifeShiftsPanel}>
        <p className={styles.sectionIntro}>{t("insights.shifts.empty")}</p>
      </div>
    );
  }

  return (
    <div ref={panelRef} className={styles.lifeShiftsPanel}>
      <p className={styles.sectionIntro}>
        {isBrief ? t("insights.shifts.introBrief") : t("insights.shifts.introFull")}
      </p>

      <div className={styles.lifeShiftsTimeline}>
        {featuredShifts.map((shift) => (
          <ShiftCard
            key={lifeShiftId(shift)}
            shift={shift}
            reading={readings.get(lifeShiftId(shift))}
            waitingMs={readingState === "pending" ? EXPECTED_MS[isBrief ? "headline" : "ahead"] : undefined}
            headingLevel={isBrief ? 3 : 2}
            wide={isBrief}
          />
        ))}
      </div>

      {isBrief && shifts.length > 1 && <ChapterStrip shifts={shifts} current={featuredKeys} historyQs={historyQs} />}

      {/* Past chapters are already behind a disclosure, but on the results
          page they are still markup, still measured, and still one click from
          a wall of text under a section that opens by default. */}
      {!isBrief && pastShifts.length > 0 && (
        /* suppressHydrationWarning: a link to a chapter in here has Chrome open
           the archive itself before hydration, so its `open` differs from the
           server's; the effect above then agrees with it. */
        <details ref={archiveRef} className={styles.lifeShiftsArchive} suppressHydrationWarning>
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
                waitingMs={readingState === "pending" ? EXPECTED_MS.past : undefined}
                headingLevel={isBrief ? 3 : 2}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
