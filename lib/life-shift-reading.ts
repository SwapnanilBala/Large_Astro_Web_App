import type { MajorLifeShift } from "./engines/major-shifts-engine";
import type { ClassicalReading } from "./knowledge/classical-reading";

/*
 * What the life-shifts panel and its route share: the chapter ids, the depth,
 * the response, and the date wording both the card and the prompt use. The
 * facts, the passages and the prompt are the server's
 * (lib/knowledge/life-shift-classics.ts); this module is bundled for the
 * browser.
 */

/** One chapter's reading, as written for this chart: cited segments and the passages they rest on. */
export type LifeShiftReading = {
  id: string;
  reading: ClassicalReading;
};

export type LifeShiftReadingResponse = {
  readings: LifeShiftReading[];
  cached: boolean;
};

/**
 * How much room a reading gets, which is a property of the page rather than
 * of the chapter.
 *
 * "headline" is the results page: one chapter, alone, the only reading most
 * visitors will ever see from this section. It gets the long form.
 * "compact" is /insights/life-shifts, where up to five sit in a row and five
 * long readings would be a wall rather than a page.
 */
export type LifeShiftDepth = "headline" | "compact";

/** The most chapters the engine ever produces, and so the most one call takes. */
export const MAX_LIFE_SHIFTS = 5;

/*
 * Formatting lives here rather than in the panel because both the card and the
 * prompt need the identical words. When these drifted apart during development
 * the model wrote "late 2028" under a card headed "March 2029", which reads as
 * a contradiction rather than as two roundings of one date.
 */
export function formatShiftPivot(pivotIso: string, locale = "en-US"): string {
  return new Date(pivotIso).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

export function formatShiftWindow(startIso: string, endIso: string, locale = "en-US"): string {
  const fmt = (value: string) =>
    new Date(value).toLocaleDateString(locale, { month: "short", year: "numeric" });
  return `${fmt(startIso)} → ${fmt(endIso)}`;
}

/** The key the panel renders this chapter under, and the id the reading comes back on. */
export function lifeShiftId(shift: Pick<MajorLifeShift, "kind" | "pivotIso">): string {
  return `${shift.kind}-${shift.pivotIso}`;
}
