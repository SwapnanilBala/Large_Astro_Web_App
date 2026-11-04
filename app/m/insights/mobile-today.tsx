"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ChartApiResponse, DashaInfo, NakshatraInfo, PlanetPosition } from "@/lib/astro-types";
import { computeMajorLifeShifts } from "@/lib/engines/major-shifts-engine";
import { LOCALE_TAGS, useTranslation } from "@/lib/i18n-context";
import { formatShiftPivot, lifeShiftId } from "@/lib/life-shift-reading";
import {
  featuredShifts,
  shiftLabel,
  shiftTheme,
  statusLabelKey,
} from "@/app/(desktop)/insights/components/life-shift-labels";
import { ReadingProgress } from "@/app/(desktop)/insights/components/reading-progress";
import { useCurrentPeriodReading } from "@/app/(desktop)/insights/components/use-current-period-reading";
import { useLifeShiftReadings } from "@/app/(desktop)/insights/components/use-life-shift-readings";
import { MobileCitedReading } from "./mobile-cited-reading";
import styles from "./mobile-tabs.module.css";

type Translate = (key: string, params?: Record<string, string>) => string;

/* The phone's copies of the life shift strings; see life-shift-labels.ts. */
const SHIFT_STRINGS = "mobileInsights.shifts";

/* How long each reading usually takes, as on the desktop (8s and 9s measured). */
const MEANING_EXPECTED_MS = 8_000;
const TURNING_EXPECTED_MS = 9_000;

/**
 * "What this means for you": the current periods' reading, written for this
 * chart by the route the desktop's dasha panel uses. Mounted only when the
 * Today tab is first shown, since it is a written reading out of the reader's
 * daily allowance; and gone if it cannot be written, as the now section above
 * already says which periods are running.
 */
export function MobileMeaning({
  dasha,
  nakshatra,
  planets,
  ascendantSign,
  antardashaPercent,
  tr,
}: {
  dasha: DashaInfo;
  nakshatra: NakshatraInfo;
  planets: PlanetPosition[];
  ascendantSign: string;
  antardashaPercent: number;
  tr: Translate;
}) {
  const meaning = useCurrentPeriodReading(dasha, nakshatra, planets, antardashaPercent, ascendantSign);
  if (meaning.state === "failed" && !meaning.reading) return null;

  return (
    <section className={styles.card} aria-labelledby="m-meaning-heading">
      <h2 id="m-meaning-heading" className={styles.cardKicker}>
        {tr("mobileInsights.meaningLabel")}
      </h2>
      {meaning.reading ? (
        <p className={styles.prose}>{meaning.reading}</p>
      ) : (
        <div className={styles.progressHost}>
          <ReadingProgress label={tr("mobileInsights.meaningPending")} expectedMs={MEANING_EXPECTED_MS} />
        </div>
      )}
    </section>
  );
}

/**
 * The life chapter running now, or the next one: what the desktop results
 * page shows under "Major life shifts", with its reading from the classics,
 * and the way on to every chapter.
 */
export function MobileTurningPoint({
  payload,
  historyQs,
  tr,
}: {
  payload: ChartApiResponse;
  historyQs: string;
  tr: Translate;
}) {
  const { language } = useTranslation();
  const shifts = useMemo(() => computeMajorLifeShifts(payload), [payload]);
  const shown = useMemo(() => featuredShifts(shifts, 1), [shifts]);
  const { state, readings } = useLifeShiftReadings(shown, "headline", historyQs, language);
  const shift = shown[0];
  if (!shift) return null;
  const reading = readings.get(lifeShiftId(shift));

  return (
    <section className={styles.card} data-status={shift.status} aria-labelledby="m-turning-heading">
      <p className={styles.turningStatus}>
        <span className={styles.dot} aria-hidden="true" />
        {tr("mobileInsights.shiftsKicker")} · {tr(statusLabelKey(shift.status, SHIFT_STRINGS))}
      </p>
      <h2 id="m-turning-heading" className={styles.cardTitle}>
        {shiftLabel(shift, tr, SHIFT_STRINGS)}
      </h2>
      <p className={styles.cardTheme}>{shiftTheme(shift, tr, SHIFT_STRINGS)}</p>
      <p className={styles.cardMeta}>
        {tr("mobileInsights.shifts.pivot")} {formatShiftPivot(shift.pivotIso, LOCALE_TAGS[language])} ·{" "}
        {tr("mobileInsights.shifts.age", { age: String(shift.ageAtPivot) })}
      </p>

      {reading ? (
        <MobileCitedReading reading={reading} tr={tr} />
      ) : state === "pending" ? (
        <>
          <div className={styles.progressHost}>
            <ReadingProgress label={tr("mobileInsights.writing")} expectedMs={TURNING_EXPECTED_MS} />
          </div>
          {/* The engine's own words, dimmed, until the written reading lands. */}
          <p className={`${styles.prose} ${styles.waiting}`}>{shift.narrative}</p>
        </>
      ) : (
        <p className={styles.prose}>{shift.narrative}</p>
      )}

      <Link href={`/insights/life-shifts?${historyQs}`} className={styles.onward} prefetch={false}>
        <span>{tr("mobileInsights.shiftsLink")}</span>
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
