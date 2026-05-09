"use client";

import { useMemo } from "react";
import type { ChartApiResponse } from "@/lib/astro-types";
import {
  computeMajorLifeShifts,
  type MajorLifeShift,
  type MajorShiftStatus,
} from "@/lib/engines/major-shifts-engine";
import styles from "../insights.module.css";

const STATUS_LABEL: Record<MajorShiftStatus, string> = {
  past: "Past chapter",
  active: "Active now",
  upcoming: "Upcoming",
};

function formatRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const fmt = (date: Date) =>
    date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return `${fmt(start)} → ${fmt(end)}`;
}

function formatPivot(pivotIso: string): string {
  const date = new Date(pivotIso);
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function statusClass(status: MajorShiftStatus): string {
  if (status === "past") return styles.lifeShiftCardPast;
  if (status === "active") return styles.lifeShiftCardActive;
  return styles.lifeShiftCardUpcoming;
}

export default function MajorShiftsPanel({
  payload,
}: {
  payload: ChartApiResponse;
}) {
  const shifts: MajorLifeShift[] = useMemo(
    () => computeMajorLifeShifts(payload),
    [payload],
  );

  if (shifts.length === 0) {
    return (
      <div className={styles.lifeShiftsPanel}>
        <p className={styles.sectionIntro}>
          Not enough birth-data context on this chart to estimate major life
          shift windows. Re-run with a confirmed birth time to unlock this
          section.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.lifeShiftsPanel}>
      <p className={styles.sectionIntro}>
        Five approximate windows where your chart sets up a major life shift —
        drawn from your mahadasha transitions and the Saturn, Jupiter, and
        nodal return cycles. Dates are pivots, not deadlines: treat each as a
        9 to 18 month doorway around the listed month.
      </p>

      <div className={styles.lifeShiftsTimeline}>
        {shifts.map((shift) => (
          <article
            key={`${shift.kind}-${shift.pivotIso}`}
            className={`${styles.lifeShiftCard} ${statusClass(shift.status)}`}
          >
            <header className={styles.lifeShiftHeader}>
              <span className={styles.lifeShiftIndex}>#{shift.index}</span>
              <span className={styles.lifeShiftStatus}>
                {STATUS_LABEL[shift.status]}
              </span>
            </header>
            <p className={styles.lifeShiftLabel}>{shift.label}</p>
            <h3>{shift.theme}</h3>
            <p className={styles.lifeShiftWindow}>
              <strong>Pivot:</strong> {formatPivot(shift.pivotIso)} · age{" "}
              {shift.ageAtPivot}
              <br />
              <strong>Window:</strong> {formatRange(shift.windowStartIso, shift.windowEndIso)}
            </p>
            <p>{shift.narrative}</p>
            {shift.evidence && (
              <small>{shift.evidence}</small>
            )}
          </article>
        ))}
      </div>

      <p className={styles.lifeShiftsNote}>
        These windows compound: when a mahadasha change overlaps a Saturn or
        Jupiter return, the shift hits harder. Use them as planning anchors —
        for commitments, exits, study, or recovery — rather than predictions
        of specific events.
      </p>
    </div>
  );
}
