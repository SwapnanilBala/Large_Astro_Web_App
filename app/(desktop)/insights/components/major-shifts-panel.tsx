"use client";

import { useMemo } from "react";
import type { ChartApiResponse } from "@/lib/astro-types";
import {
  computeMajorLifeShifts,
  type MajorLifeShift,
  type MajorShiftStatus,
} from "@/lib/engines/major-shifts-engine";
import {
  formatShiftPivot,
  formatShiftWindow,
  lifeShiftId,
} from "@/lib/life-shift-reading";
import { useLifeShiftReadings } from "./use-life-shift-readings";
import styles from "../insights.module.css";

const STATUS_LABEL: Record<MajorShiftStatus, string> = {
  past: "Past chapter",
  active: "Active now",
  upcoming: "Upcoming",
};

/* formatShiftPivot and formatShiftWindow live in lib/life-shift-reading.ts
   because the prompt needs the identical words: a reading that says "late
   2028" under a card headed "March 2029" reads as a contradiction rather
   than as two roundings of one date. */

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
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className={`${styles.lifeShiftCard} ${statusClass(shift.status)}`}>
      <header className={styles.lifeShiftHeader}>
        <span className={styles.lifeShiftIndex}>#{shift.index}</span>
        <span className={styles.lifeShiftStatus}>{STATUS_LABEL[shift.status]}</span>
      </header>
      <p className={styles.lifeShiftLabel}>{shift.label}</p>
      <Heading>{shift.theme}</Heading>
      <p className={styles.lifeShiftWindow}>
        <strong>Pivot:</strong> {formatShiftPivot(shift.pivotIso)} · age {shift.ageAtPivot}
        <br />
        <strong>Window:</strong>{" "}
        {formatShiftWindow(shift.windowStartIso, shift.windowEndIso)}
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
  variant = "full",
}: {
  payload: ChartApiResponse;
  variant?: "brief" | "full";
}) {
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
  );

  if (shifts.length === 0) {
    return (
      <div className={styles.lifeShiftsPanel}>
        <p className={styles.sectionIntro}>
          Not enough birth-data context on this chart to estimate major life
          shift windows. Re-run with a confirmed birth time to unlock this section.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.lifeShiftsPanel}>
      <p className={styles.sectionIntro}>
        {isBrief
          ? "The chapter you are in now. Dates are planning windows, not deadlines."
          : "Focus on the chapter that is active now and the next major transition. Dates are planning windows, not deadlines."}
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
            View {pastShifts.length} past chapter{pastShifts.length === 1 ? "" : "s"}
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
