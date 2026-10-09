import type { DashaInfo } from "./astro-types";
import { NAKSHATRA_LORDS, computeSubPeriods } from "./engines/nakshatra-engine";

/*
 * The Vimshottari periods as the dasha panel walks them, four levels deep: the
 * Maha Dasha, its Antardashas, their Pratyantardashas and their Sookshma
 * dashas.
 *
 * Pure date arithmetic over the chart's Maha Dasha list, with the engine's own
 * sub-period rule (computeSubPeriods), so the panel can open on the present
 * moment four levels down without a request, and the reading route can walk
 * the same periods to check that the one it is asked about exists. Both sides
 * compute from the same day-precision dates, so they agree to the day.
 *
 * Four levels, not five: the readings stop at Sookshma, and a Prana period
 * lasts hours to days -- too short to read, or to tell apart on a timeline.
 */

export const DASHA_LEVELS = [1, 2, 3, 4] as const;
export type DashaLevel = (typeof DASHA_LEVELS)[number];
export const DEEPEST_DASHA_LEVEL: DashaLevel = 4;

/** One period at one level. */
export type DashaSpan = {
  level: DashaLevel;
  planet: string;
  /** The chain from the Maha Dasha lord down to this period's own lord. */
  lords: string[];
  /** The period as it falls in the reader's life, clipped to birth and to the 120-year horizon. */
  start: string;
  end: string;
  /** The whole period before clipping, which its sub-periods are proportioned from. */
  sequenceStart: string;
  sequenceEnd: string;
};

export type DashaStatus = "past" | "now" | "upcoming";

const DAY_MS = 86_400_000;

/** Midnight UTC of an ISO day, as the engine reads its dates; NaN for anything else. */
export function dayMs(iso: string): number {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? Date.parse(`${iso}T00:00:00Z`) : Number.NaN;
}

/** The Maha Dasha periods of a life, in order. */
export function mahaSpans(dasha: Pick<DashaInfo, "periods">): DashaSpan[] {
  return (dasha.periods ?? [])
    .filter((period) => NAKSHATRA_LORDS.includes(period.planet))
    .map((period): DashaSpan => ({
      level: 1,
      planet: period.planet,
      lords: [period.planet],
      start: period.start_date,
      end: period.end_date,
      sequenceStart: period.sequence_start_date ?? period.start_date,
      sequenceEnd: period.sequence_end_date ?? period.end_date,
    }));
}

/** A period's sub-periods, one level down; none below Sookshma. */
export function childSpans(parent: DashaSpan): DashaSpan[] {
  if (parent.level >= DEEPEST_DASHA_LEVEL) return [];
  const level = (parent.level + 1) as DashaLevel;
  return computeSubPeriods(
    parent.planet,
    parent.start,
    parent.end,
    level,
    parent.lords,
    parent.sequenceStart,
    parent.sequenceEnd,
  ).map((sub): DashaSpan => ({
    level,
    planet: sub.planet,
    lords: sub.lords,
    start: sub.start_date,
    end: sub.end_date,
    sequenceStart: sub.sequence_start_date ?? sub.start_date,
    sequenceEnd: sub.sequence_end_date ?? sub.end_date,
  }));
}

/** The period running at an instant, if any: its start counts, its end belongs to the next. */
export function spanAt(spans: readonly DashaSpan[], at: number): DashaSpan | undefined {
  return spans.find((span) => dayMs(span.start) <= at && at < dayMs(span.end));
}

/** The periods running at an instant, from the Maha Dasha down, as deep as `depth`. */
export function pathAt(dasha: Pick<DashaInfo, "periods">, at: number, depth: number = DEEPEST_DASHA_LEVEL): DashaSpan[] {
  const path: DashaSpan[] = [];
  let level = mahaSpans(dasha);
  while (path.length < Math.min(depth, DEEPEST_DASHA_LEVEL)) {
    const span = spanAt(level, at);
    if (!span) break;
    path.push(span);
    level = childSpans(span);
  }
  return path;
}

/**
 * The period a chain of lords names, found by the start of its deepest
 * period: the Maha Dasha down to it, or null when the chart has no such
 * period. Each level above the deepest is the one of that lord running on the
 * deepest period's first day, which also tells apart a lord whose Maha Dasha
 * comes round twice in 120 years.
 */
export function findChain(
  dasha: Pick<DashaInfo, "periods">,
  lords: readonly string[],
  start: string,
): DashaSpan[] | null {
  if (lords.length < 1 || lords.length > DEEPEST_DASHA_LEVEL) return null;
  const at = dayMs(start);
  if (!Number.isFinite(at)) return null;
  const path: DashaSpan[] = [];
  let level = mahaSpans(dasha);
  for (let index = 0; index < lords.length; index++) {
    const deepest = index === lords.length - 1;
    const span = level.find(
      (candidate) =>
        candidate.planet === lords[index] &&
        (deepest ? candidate.start === start : dayMs(candidate.start) <= at && at < dayMs(candidate.end)),
    );
    if (!span) return null;
    path.push(span);
    level = childSpans(span);
  }
  return path;
}

/** Where an instant falls against a period. */
export function statusAt(span: Pick<DashaSpan, "start" | "end">, at: number): DashaStatus {
  if (at < dayMs(span.start)) return "upcoming";
  return at < dayMs(span.end) ? "now" : "past";
}

/** How far through the whole period an instant is, 0 to 1: a Maha Dasha begun before birth counts from its true start. */
export function progressAt(span: Pick<DashaSpan, "sequenceStart" | "sequenceEnd">, at: number): number {
  const start = dayMs(span.sequenceStart);
  const end = dayMs(span.sequenceEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.min(1, Math.max(0, (at - start) / (end - start)));
}

/** Whole days from an instant to the end of a period, never below zero. */
export function daysLeftAt(span: Pick<DashaSpan, "end">, at: number): number {
  const end = dayMs(span.end);
  return Number.isFinite(end) ? Math.max(0, Math.ceil((end - at) / DAY_MS)) : 0;
}

/** A period's length in days, at least one. */
export function spanDays(span: Pick<DashaSpan, "start" | "end">): number {
  return Math.max(1, Math.round((dayMs(span.end) - dayMs(span.start)) / DAY_MS));
}

/** What identifies a period for a reading, whatever language it is read in. */
export function chainKey(path: readonly Pick<DashaSpan, "planet" | "start">[]): string {
  return path.length === 0 ? "" : `${path.map((span) => span.planet).join(">")}@${path[path.length - 1].start}`;
}
