import type { LifeDomainKey } from "../astro-types";

/*
 * A classical note as the browser receives it: the reading in segments, each
 * carrying the numbers of the verses it rests on, and those verses as the 1885
 * translation prints them. Shared by every "From the classics" card -- the
 * yoga section's and the life areas' -- and safe to ship to the browser.
 */

/**
 * The strings a "From the classics" card shows. Each card keeps them in its
 * own route catalog, under its own prefix, with the same keys beneath it.
 */
export const CLASSICAL_NOTE_KEYS = [
  "kicker",
  "heading",
  "pending",
  "sourcesLabel",
  "sourceRef",
  "noteLabel",
  "credit",
] as const;

/**
 * The book on women's charts (lib/knowledge/sources.ts, STRIJATAKA_1931),
 * whose passages reach only the life areas' note, and only for a reader who
 * said she is a woman.
 */
export const WOMENS_BOOK_SLUG = "strijataka-1931";

/** The strings a card needs only when it can quote the women's book: the life areas' card. */
export const WOMENS_BOOK_NOTE_KEYS = ["sourceRefStrijataka", "creditStrijataka"] as const;

/** A passage the reading cites, numbered in the order the reading first cites it. */
export type ClassicalSource = {
  number: number;
  /** The book it is quoted from, by slug: the card names the book from it. */
  book: string;
  /** What a reader can look up: chapter and verse, e.g. "13.5", or a chapter alone for a prose book. */
  ref: string;
  /** "verse" for the book's own text, "note" for a translator's note on it. */
  kind: "verse" | "note";
  /** The book's words as printed, but for any rewording in square brackets. */
  text: string;
};

/** A run of the reading and the sources it rests on (often none, for joining text). */
export type ClassicalSegment = {
  text: string;
  sources: number[];
};

export type ClassicalReading = {
  segments: ClassicalSegment[];
  sources: ClassicalSource[];
};

/**
 * `reading` is null when the library has nothing that applies, which is an
 * answer rather than a failure: the card simply does not appear, and nothing
 * was paid for.
 */
export type ClassicalReadingResponse = {
  reading: ClassicalReading | null;
  cached: boolean;
};

/**
 * The life areas' notes, one call's worth, by area. An area the library has
 * nothing to say about for this chart is absent, and so is every area when
 * nothing applies; neither is a failure.
 */
export type AreaClassicsResponse = {
  readings: Partial<Record<LifeDomainKey, ClassicalReading>>;
  cached: boolean;
};

/**
 * The reading as paragraphs of cited pieces, for rendering.
 *
 * Citations arrive per text block, and a block can end mid-paragraph or carry
 * a paragraph break inside it. So paragraphs are cut at blank lines wherever
 * they fall, and a block's source numbers stay on the last piece of it, where
 * the marker belongs: after the words it supports.
 */
export function readingParagraphs(reading: ClassicalReading): ClassicalSegment[][] {
  const paragraphs: ClassicalSegment[][] = [[]];
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
