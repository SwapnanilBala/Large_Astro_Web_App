import type { YogaDetectionResult } from "../astro-types";
import type {
  ClassicalReading,
  ClassicalReadingResponse,
  ClassicalSegment,
  ClassicalSource,
} from "./classical-reading";

export { readingParagraphs } from "./classical-reading";

/*
 * "From the classics" in the yoga section: what the Brihat Jataka says about
 * the yogas a chart has, written for the reader and cited verse by verse.
 *
 * This module is the part both sides need -- the order yogas are ranked in, what
 * the browser sends, what comes back -- and nothing else, so the client bundle
 * does not carry the prompt or the database code. The reading's own shape is
 * shared with the life areas' note, in classical-reading.ts.
 */

/** Yogas sent per request: every yoga a chart is likely to have, in rank order. */
export const YOGA_CLASSICS_MAX_REQUEST = 60;

/** One detected yoga as the route needs it: ids and closed sets only, no prose. */
export type YogaClassicsYoga = {
  id: string;
  planets: string[];
  strength: YogaDetectionResult["strength"];
};

export type YogaClassicsSource = ClassicalSource;
export type YogaClassicsSegment = ClassicalSegment;
export type YogaClassicsReading = ClassicalReading;
/** `reading` is null when none of the chart's yogas has a passage in the library. */
export type YogaClassicsResponse = ClassicalReadingResponse;

const STRENGTH_ORDER: Record<YogaDetectionResult["strength"], number> = {
  strong: 0,
  moderate: 1,
  weak: 2,
};

/**
 * The yoga panel's order: by `occurrence_chance`, then by strength. Shared so
 * that the classical note speaks first about the yogas the panel puts first.
 */
export function rankYogas(yogas: YogaDetectionResult[]): YogaDetectionResult[] {
  return [...yogas].sort((a, b) => {
    if (b.occurrence_chance !== a.occurrence_chance) {
      return b.occurrence_chance - a.occurrence_chance;
    }
    return STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength];
  });
}

/**
 * What the browser sends. Every ranked yoga rather than the panel's top ten:
 * the panel lists them all, and the route picks the first few that the
 * library has passages for, so a chart whose top yogas the Brihat Jataka never
 * names still gets a note about the ones it does. Nothing beyond ids, planets
 * and strengths, so no free text from the page can reach the prompt.
 */
export function yogaClassicsRequest(yogas: YogaDetectionResult[]): YogaClassicsYoga[] {
  return rankYogas(yogas)
    .slice(0, YOGA_CLASSICS_MAX_REQUEST)
    .map((yoga) => ({ id: yoga.yoga_id, planets: [...yoga.involved_planets], strength: yoga.strength }));
}
