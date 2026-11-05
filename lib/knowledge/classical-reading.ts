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

/*
 * Punctuation that never takes a space before it. French puts one before
 * ; : ! ? and », and those stay off the list so a French note keeps it.
 */
const CLOSING_PUNCTUATION = /^[.,…)\]।॥”’]/u;
/* Plain spaces and tabs: a no-break space was put there on purpose, so it stays. */
const PLAIN_SPACE = /^[ \t]+$/;

const trailingSpace = (text: string) => /\s*$/u.exec(text)![0];
const leadingSpace = (text: string) => /^\s*/u.exec(text)![0];

/**
 * The one stretch of whitespace to leave where two runs meet: a paragraph
 * break wins over a space, a doubled plain space is one, and a plain space
 * before closing punctuation goes.
 */
function seamSpace(leftSpace: string, rightSpace: string, tail: string): string {
  const both = leftSpace + rightSpace;
  let space: string;
  if (both.includes("\n")) space = leftSpace.includes("\n") ? leftSpace : rightSpace;
  else if (PLAIN_SPACE.test(both)) space = " ";
  else space = leftSpace || rightSpace;
  return CLOSING_PUNCTUATION.test(tail) && PLAIN_SPACE.test(space) ? "" : space;
}

/**
 * Tidies the seam between `previous` and the run that follows it: rewrites
 * `previous.text` in place and returns the following run's text. The space
 * stays on the side that had it (the left first), so a clean seam is
 * returned untouched.
 */
function seam(previous: ClassicalSegment, text: string): string {
  const leftSpace = trailingSpace(previous.text);
  const rightSpace = leadingSpace(text);
  const tail = text.slice(rightSpace.length);
  /* Nothing after the space yet: it waits for whatever comes next. */
  if ((!leftSpace && !rightSpace) || !tail) return text;
  const space = seamSpace(leftSpace, rightSpace, tail);
  if (!leftSpace) return space + tail;
  previous.text = previous.text.slice(0, previous.text.length - leftSpace.length) + space;
  return tail;
}

/** Two runs with nothing between them, as one. */
function joinRuns(left: string, right: string): string {
  const run = { text: left, sources: [] };
  const rest = seam(run, right);
  return run.text + rest;
}

/**
 * The reading's segments with the whitespace a mark leaves behind cleaned up.
 *
 * Wherever a mark is taken out of the model's text -- turned into a segment's
 * sources, dropped because it names a passage that was not sent, or a
 * citation the API returned that points at nothing -- the space the model
 * wrote before it is left at the seam. Unresolved, the seam printed "a
 * strained partnership ." or "unequal , and"; resolved, "partnership ¹.".
 * So:
 * - a cited segment ends on its words, and the whitespace after them moves
 *   on to the next segment, so the mark sits right after what it supports;
 * - a cited segment with no words of its own gives its numbers to the words
 *   before it (two marks in a row print as "1,2", not "12");
 * - two uncited segments in a row, which is what a dropped mark leaves, are
 *   one run;
 * - and at every seam ("unequal [9] , and slow [1]" puts one before a cited
 *   run) a doubled space is one and a plain space before closing punctuation
 *   goes.
 *
 * Idempotent, so a reading cached before this existed is cleaned up when it
 * is rendered, and a clean one passes through as it was.
 */
export function tidySegments(segments: readonly ClassicalSegment[]): ClassicalSegment[] {
  const out: ClassicalSegment[] = [];
  /* Whitespace taken off the end of a cited segment, waiting for the next run. */
  let carried = "";
  for (const segment of segments) {
    let text = carried + segment.text;
    carried = "";
    const previous = out.at(-1);
    if (previous && segment.sources.length === 0 && previous.sources.length === 0) {
      previous.text = joinRuns(previous.text, text);
      continue;
    }
    if (previous) text = seam(previous, text);
    if (segment.sources.length === 0) {
      out.push({ text, sources: [] });
      continue;
    }
    carried = trailingSpace(text);
    text = text.slice(0, text.length - carried.length);
    if (!text && previous) {
      /* A mark straight after the previous run's words: it belongs to them. */
      const before = trailingSpace(previous.text);
      previous.text = previous.text.slice(0, previous.text.length - before.length);
      carried = before + carried;
      for (const number of segment.sources) if (!previous.sources.includes(number)) previous.sources.push(number);
      continue;
    }
    out.push({ text, sources: [...segment.sources] });
  }
  /* Whitespace after the last mark ends the reading; there is nothing to carry it to. */
  return out.filter((segment) => segment.text.length > 0 || segment.sources.length > 0);
}

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
  /* Tidied here too, for readings cached before the routes tidied them. */
  for (const segment of tidySegments(reading.segments)) {
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
