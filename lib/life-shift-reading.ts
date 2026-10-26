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

/*
 * Asked with `Accept: application/x-ndjson`, the route answers a set that
 * holds both chapters still ahead (active or upcoming) and past ones as a
 * stream of one-line JSON objects: a `readings` line for each batch as it is
 * written -- the chapters ahead in a call of their own, beside the past ones,
 * so the cards the reader is looking at usually fill in a few seconds sooner
 * -- then `done`, or
 * `error` if nothing could be written. Everything that can fail before the
 * paid call still fails as an ordinary JSON error with its status, and a
 * cache hit, or a set with nothing to split, answers with plain JSON, so a
 * client that asks for the stream reads either.
 */
export const LIFE_SHIFTS_STREAM_TYPE = "application/x-ndjson";

export type LifeShiftStreamLine =
  | { type: "readings"; readings: LifeShiftReading[] }
  | { type: "done"; cached: false }
  | { type: "error"; message: string };

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
/* In UTC, as the engine counts: in the viewer's own zone a pivot late on the
   last day of a month printed as the next month on the card, against the
   month the prompt named on the server. */
export function formatShiftPivot(pivotIso: string, locale = "en-US"): string {
  return new Date(pivotIso).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatShiftWindow(startIso: string, endIso: string, locale = "en-US"): string {
  const fmt = (value: string) =>
    new Date(value).toLocaleDateString(locale, { month: "short", year: "numeric", timeZone: "UTC" });
  return `${fmt(startIso)} → ${fmt(endIso)}`;
}

/**
 * The chapter's anchor on /insights/life-shifts, for the results page's
 * chapter row to link to: the kind and the pivot's day, which the engine
 * already keeps unique, without the instant's colons and dots.
 */
export function lifeShiftAnchor(shift: Pick<MajorLifeShift, "kind" | "pivotIso">): string {
  return `chapter-${shift.kind}-${shift.pivotIso.slice(0, 10)}`;
}

/** The key the panel renders this chapter under, and the id the reading comes back on. */
export function lifeShiftId(shift: Pick<MajorLifeShift, "kind" | "pivotIso">): string {
  return `${shift.kind}-${shift.pivotIso}`;
}
