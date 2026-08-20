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

function ShiftCard({ shift }: { shift: MajorLifeShift }) {
  return (
    <article className={`${styles.lifeShiftCard} ${statusClass(shift.status)}`}>
      <header className={styles.lifeShiftHeader}>
        <span className={styles.lifeShiftIndex}>#{shift.index}</span>
        <span className={styles.lifeShiftStatus}>{STATUS_LABEL[shift.status]}</span>
      </header>
      <p className={styles.lifeShiftLabel}>{shift.label}</p>
      <h3>{shift.theme}</h3>
      <p className={styles.lifeShiftWindow}>
        <strong>Pivot:</strong> {formatPivot(shift.pivotIso)} · age {shift.ageAtPivot}
        <br />
        <strong>Window:</strong> {formatRange(shift.windowStartIso, shift.windowEndIso)}
      </p>
      <p>{shift.narrative}</p>
      {shift.evidence && <small>{shift.evidence}</small>}
    </article>
  );
}

export default function MajorShiftsPanel({ payload }: { payload: ChartApiResponse }) {
  const shifts: MajorLifeShift[] = useMemo(
    () => computeMajorLifeShifts(payload),
    [payload],
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

  const forwardShifts = shifts
    .filter((shift) => shift.status === "active" || shift.status === "upcoming")
    .slice(0, 2);
  const featuredShifts = forwardShifts.length > 0 ? forwardShifts : shifts.slice(-1);
  const featuredKeys = new Set(
    featuredShifts.map((shift) => `${shift.kind}-${shift.pivotIso}`),
  );
  const pastShifts = shifts.filter(
    (shift) =>
      shift.status === "past" &&
      !featuredKeys.has(`${shift.kind}-${shift.pivotIso}`),
  );

  return (
    <div className={styles.lifeShiftsPanel}>
      <p className={styles.sectionIntro}>
        Focus on the chapter that is active now and the next major transition.
        Dates are planning windows, not deadlines.
      </p>

      <div className={styles.lifeShiftsTimeline}>
        {featuredShifts.map((shift) => (
          <ShiftCard key={`${shift.kind}-${shift.pivotIso}`} shift={shift} />
        ))}
      </div>

      {pastShifts.length > 0 && (
        <details className={styles.lifeShiftsArchive}>
          <summary>
            View {pastShifts.length} past chapter{pastShifts.length === 1 ? "" : "s"}
          </summary>
          <div className={styles.lifeShiftsTimeline}>
            {pastShifts.map((shift) => (
              <ShiftCard key={`${shift.kind}-${shift.pivotIso}`} shift={shift} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
