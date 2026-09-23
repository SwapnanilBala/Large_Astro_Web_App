
import type { MajorLifeShift, MajorShiftStatus } from "./engines/major-shifts-engine";

/**
 * The facts one life chapter contributes to its written reading.
 *
 * Deliberately thin, for the same reason lib/varga-commentary.ts is: the
 * engine has already decided every date, every planet and every placement in
 * here. The model's job is to say what the chapter asks of the reader, not to
 * work out when it is. Anything the model would have to *derive* -- an aspect,
 * a house lord, a strength -- is left out rather than half-supplied, because a
 * prompt that hands over two thirds of a calculation invites the model to
 * finish it.
 *
 * Dates arrive already worded, not as ISO. The page prints "March 2029" and
 * "Jun 2028 → Dec 2029"; handing the model the same strings is what stops a
 * reading from naming a month the card above it does not.
 */
export type LifeShiftFacts = {
  /** Matches the React key the panel already files this chapter under. */
  id: string;
  label: string;
  planet: string;
  theme: string;
  status: MajorShiftStatus;
  ageAtPivot: number;
  /** "March 2029" */
  pivot: string;
  /** "Jun 2028 → Dec 2029" */
  window: string;
  /** The engine's own one-line justification, e.g. "Cycle: ~29.5 years | Natal Saturn: Leo / H10". */
  evidence: string;
};

/** One chapter's reading, as written for this chart. */
export type LifeShiftReading = {
  id: string;
  reading: string;
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
export function formatShiftPivot(pivotIso: string): string {
  return new Date(pivotIso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function formatShiftWindow(startIso: string, endIso: string): string {
  const fmt = (value: string) =>
    new Date(value).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return `${fmt(startIso)} → ${fmt(endIso)}`;
}

/** The key the panel renders this chapter under, and the id the reading comes back on. */
export function lifeShiftId(shift: Pick<MajorLifeShift, "kind" | "pivotIso">): string {
  return `${shift.kind}-${shift.pivotIso}`;
}

export function buildLifeShiftFacts(shifts: MajorLifeShift[]): LifeShiftFacts[] {
  return shifts.slice(0, MAX_LIFE_SHIFTS).map((shift) => ({
    id: lifeShiftId(shift),
    label: shift.label,
    planet: shift.planet,
    theme: shift.theme,
    status: shift.status,
    ageAtPivot: shift.ageAtPivot,
    pivot: formatShiftPivot(shift.pivotIso),
    window: formatShiftWindow(shift.windowStartIso, shift.windowEndIso),
    evidence: shift.evidence,
  }));
}

/* lifeShiftCacheKey lives in ./life-shift-reading-server: it needs node:crypto,
   and this module is also bundled for the browser. */

/** How the facts are laid out for the model, shared with scripts/effort-compare.mjs. */
export function renderLifeShiftFacts(facts: LifeShiftFacts[]): string {
  return facts
    .map((fact) =>
      [
        `id: ${fact.id}`,
        `chapter: ${fact.label}`,
        `planet: ${fact.planet}`,
        `standing theme: ${fact.theme}`,
        `where it sits: ${fact.status}`,
        `pivot: ${fact.pivot} (age ${fact.ageAtPivot})`,
        `window: ${fact.window}`,
        fact.evidence ? `evidence: ${fact.evidence}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}
