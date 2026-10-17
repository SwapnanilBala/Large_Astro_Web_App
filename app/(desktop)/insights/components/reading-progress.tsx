"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n-context";
import { formatPercent } from "./dasha-format";
import styles from "./reading-progress.module.css";

/*
 * The wait for a written reading, as a bar and a percentage.
 *
 * Every section that asks a route to write for the reader -- the life shifts,
 * the current period, the classical notes, the varga notes, the life-area
 * briefs, palm reading -- used to show either nothing or its template text
 * while the reading was on its way, which ran 6 to 15 seconds (two minutes for
 * a palm). Readers took the template for the reading.
 *
 * None of those routes reports progress: each is one model call that answers
 * all at once. So the percentage is an estimate from the elapsed time against
 * how long the section usually takes, and is shaped to stay honest about that:
 * it climbs steadily to 90% at the usual time, then creeps toward 98% and
 * waits there, never claiming 100% before the reading has actually landed (at
 * which point the section unmounts this and shows it).
 */

/** The share done, 0 to 98, after `elapsedMs` of a wait that usually takes `expectedMs`. */
export function readingPercent(elapsedMs: number, expectedMs: number): number {
  const expected = Math.max(1, expectedMs);
  const elapsed = Math.max(0, elapsedMs);
  if (elapsed <= expected) return Math.floor((elapsed / expected) * 90);
  return Math.min(98, Math.floor(90 + 8 * (1 - Math.exp(-(elapsed - expected) / expected))));
}

const TICK_MS = 250;

type ReadingProgressProps = {
  /** What is being written, already translated: the section's own waiting line. */
  label: string;
  /** How long this section's reading usually takes. */
  expectedMs: number;
  className?: string;
  /** False where the section already prints what is happening above the bar: the label then names the bar only for assistive technology. */
  showLabel?: boolean;
};

export function ReadingProgress({ label, expectedMs, className, showLabel = true }: ReadingProgressProps) {
  const { language } = useTranslation();
  const [elapsedMs, setElapsedMs] = useState(0);

  /* Timed from when this mounts, which is when its section starts waiting. */
  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => setElapsedMs(Date.now() - startedAt), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const percent = readingPercent(elapsedMs, expectedMs);
  const shown = formatPercent(percent / 100, language);

  return (
    <div
      className={className ? `${styles.progress} ${className}` : styles.progress}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={shown}
    >
      <div className={styles.head}>
        {showLabel && <span className={styles.label}>{label}</span>}
        <span className={styles.percent}>{shown}</span>
      </div>
      <div className={styles.track} aria-hidden="true">
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
