import type { YogaDetectionResult } from "../astro-types";

/*
 * "From the classics" in the yoga section: what the Brihat Jataka says about
 * the yogas a chart has, written for the reader and cited verse by verse.
 *
 * This module is the part both sides need -- the order yogas are ranked in, what
 * the browser sends, what comes back -- and nothing else, so the client bundle
 * does not carry the prompt or the database code.
 */

/** Yogas sent per request: every yoga a chart is likely to have, in rank order. */
export const YOGA_CLASSICS_MAX_REQUEST = 60;

/** One detected yoga as the route needs it: ids and closed sets only, no prose. */
export type YogaClassicsYoga = {
  id: string;
  planets: string[];
  strength: YogaDetectionResult["strength"];
};

/** A verse the reading cites, numbered in the order the reading first cites it. */
export type YogaClassicsSource = {
  number: number;
  /** Chapter and verse as printed, e.g. "13.5". */
  ref: string;
  /** "verse" for Varahamihira's text, "note" for the translator's note on it. */
  kind: "verse" | "note";
  /** The 1885 translation's own words. */
  text: string;
};

/** A run of the reading and the sources it rests on (often none, for joining text). */
export type YogaClassicsSegment = {
  text: string;
  sources: number[];
};

export type YogaClassicsReading = {
  segments: YogaClassicsSegment[];
  sources: YogaClassicsSource[];
};

/**
 * `reading` is null when none of the chart's yogas has a passage in the
 * library. That is an answer, not a failure: the section simply has no
 * classical note for this chart, and nothing was paid for.
 */
export type YogaClassicsResponse = {
  reading: YogaClassicsReading | null;
  cached: boolean;
};

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
 * The reading as paragraphs of cited pieces, for rendering.
 *
 * Citations arrive per text block, and a block can end mid-paragraph or carry
 * a paragraph break inside it. So paragraphs are cut at blank lines wherever
 * they fall, and a block's source numbers stay on the last piece of it, where
 * the marker belongs: after the words it supports.
 */
export function readingParagraphs(reading: YogaClassicsReading): YogaClassicsSegment[][] {
  const paragraphs: YogaClassicsSegment[][] = [[]];
  for (const segment of reading.segments) {
    const parts = segment.text.split(/\n\s*\n/);
    parts.forEach((part, index) => {
      if (index > 0) paragraphs.push([]);
      const last = index === parts.length - 1;
      paragraphs[paragraphs.length - 1].push({ text: part, sources: last ? segment.sources : [] });
    });
  }
  return paragraphs
    .map((pieces) => {
      const trimmed = pieces.map((piece) => ({ ...piece }));
      if (trimmed.length > 0) {
        trimmed[0].text = trimmed[0].text.trimStart();
        trimmed[trimmed.length - 1].text = trimmed[trimmed.length - 1].text.trimEnd();
      }
      return trimmed.filter((piece) => piece.text.length > 0 || piece.sources.length > 0);
    })
    .filter((pieces) => pieces.some((piece) => piece.text.trim().length > 0));
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
