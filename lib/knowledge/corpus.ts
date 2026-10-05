import { z } from "zod";

/**
 * The shape of a knowledge corpus file (`lib/knowledge/corpus/*.json`).
 *
 * A corpus file is the source of truth for its passages. It is built from a
 * book's OCR text by a script, checked in so every passage can be reviewed as
 * a diff, and only then loaded into the `knowledge_passages` table, which is an
 * index over it. Nothing writes passages to the database except from one of
 * these files.
 */

export const KNOWLEDGE_PLANETS = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
  "Rahu",
  "Ketu",
] as const;

/**
 * What a passage's results concern, in a reader's terms rather than a
 * section's. The sections map onto these when they retrieve: `relationships`
 * serves love_life, `status` serves influence, `travel` serves
 * travel_destinations, and so on.
 */
export const KNOWLEDGE_LIFE_AREAS = [
  "character",
  "wealth",
  "career",
  "status",
  "relationships",
  "family",
  "children",
  "learning",
  "health",
  "spirituality",
  "travel",
  "longevity",
] as const;

/**
 * Whose words a passage holds: the translated verse itself, or the
 * translator's note on it (a discussion, or results quoted from other
 * authorities). Citations need the difference.
 */
export const KNOWLEDGE_PASSAGE_KINDS = ["verse", "note"] as const;

export const knowledgePassageSchema = z
  .object({
    /** `<source>:<chapter>.<verse>.<part>`; see `passageId`. */
    id: z.string(),
    source: z.string(),
    chapter: z.number().int().positive(),
    verse: z.number().int().positive(),
    /**
     * A verse that lists several combinations (seven planet pairs, five named
     * yogas) is split into one part per combination, so each can be retrieved
     * for the chart that has it, and withheld on its own merits. A verse about
     * one combination is a single part.
     */
    part: z.number().int().positive(),
    kind: z.enum(KNOWLEDGE_PASSAGE_KINDS),
    chapterTitle: z.string().min(1),
    /**
     * The translator's words, with OCR damage repaired and nothing else changed.
     * A part that starts mid-sentence may open with the verse's shared opening
     * words in square brackets, copied from the verse, so that it reads alone.
     */
    text: z.string().min(1),
    /**
     * The words as the book prints them, when `text` carries a rewording the
     * owner chose, in square brackets, for a word too harsh to print (the
     * Strijataka's words for a prostitute, 2026-10-05). Kept for review and
     * for the scan check; never loaded into the table or shown.
     */
    printedText: z.string().min(1).nullable().optional(),
    /** The translator's footnotes to these words, when there are any. */
    notes: z.string().min(1).nullable(),
    /** Plain modern English: what the verse says, attributed to the text. */
    summary: z.string().min(1),
    /** Ids from the yoga engine's catalogue whose combination the verse states. */
    yogaIds: z.array(z.string()),
    /**
     * Every condition the passage's claim requires of a chart, as keys from
     * lib/knowledge/placements.ts; it applies to a chart only when all of them
     * hold. Empty when the condition cannot be stated in those keys, and for
     * the yoga chapters, which are reached through `yogaIds` instead.
     */
    placements: z.array(z.string()),
    /**
     * The claim's one either/or, when it has one ("Mars in Taurus or Libra"):
     * at least one of these must hold as well. Never a single key, which
     * belongs in `placements`.
     */
    placementsAny: z.array(z.string()).refine((keys) => keys.length !== 1, "a single alternative is a plain condition"),
    planets: z.array(z.enum(KNOWLEDGE_PLANETS)),
    lifeAreas: z.array(z.enum(KNOWLEDGE_LIFE_AREAS)),
    /**
     * The passage is about the hand: the palm, its lines, the fingers, the
     * nails, the wrist. Set only in the Brihat Samhita's chapters on the
     * features of men and women, whose hand passages the palm reading takes
     * whole (lib/palm-readings/classical-hand.ts). Not loaded into the table.
     */
    hand: z.literal(true).optional(),
    /**
     * Kept for completeness, never retrieved: the verse's main claim is about
     * death, illness, caste, crime, harm to family or sexual morality.
     */
    withheld: z.boolean(),
    withheldReason: z.string().min(1).nullable(),
    /**
     * How much of the passage reads, in order, like the raw scan; see
     * MIN_SCAN_AGREEMENT below. Repairing OCR damage costs a few points,
     * rewording costs most of them. The build refuses a passage below its floor.
     */
    ocrAgreement: z.number().min(0).max(1),
  })
  .strict();

export const knowledgeCorpusSchema = z
  .object({
    source: z.string(),
    build: z
      .object({
        model: z.string(),
        effort: z.string(),
        /** By chapter group: the prompt version each group's answers were written under. */
        promptVersions: z.record(z.string(), z.number().int().positive()),
      })
      .strict(),
    passages: z.array(knowledgePassageSchema),
  })
  .strict();

export type KnowledgePassage = z.infer<typeof knowledgePassageSchema>;
export type KnowledgeCorpus = z.infer<typeof knowledgeCorpusSchema>;

/*
 * How close to the scan a passage must stay. `ocrAgreement` is the share of
 * the passage's runs of consecutive words that also occur, in order, in the
 * raw OCR of its chapter, each word allowed an OCR-sized misspelling. Runs are
 * three words long, or two in a passage under LONG_PASSAGE_WORDS, where a few
 * repaired words would swing a three-word score.
 *
 * The floors were measured on 2026-10-04 against the 352 passages of the first
 * split build, using each passage's own plain-English summary as the
 * rewording to tell apart. Faithful passages: at least 0.60 on runs of three
 * and 0.80 on pairs, chapter medians 0.93 and up. Summaries: median 0.30 on
 * runs of three, and 1% of them reach 0.6. So a floor catches a passage that
 * was reworded, and the chapter median catches a whole run that drifted into
 * paraphrase, which no per-passage floor can do as reliably.
 *
 * The chapter floor was 0.85 until the life chapters (2026-10-04): chapter 10,
 * "On Avocations", is the worst-scanned in the book ("A poison gots wealth from
 * Lis fatliori molhotg" for "A person gets wealth from his father, mother"),
 * and its faithful transcription scored a median of 0.84. 0.75 still sits far
 * above any rewording measured.
 */
export const LONG_PASSAGE_WORDS = 15;
export const MIN_SCAN_AGREEMENT = { long: 0.5, short: 0.7 } as const;
export const MIN_CHAPTER_SCAN_AGREEMENT = 0.75;

/*
 * Books whose scan the word-run check cannot see past, held to a letter-level
 * measure instead: one minus the fewest letter edits that turn the passage
 * (square-bracketed words left out, letters only) into some run of its
 * chapter's scan, over the passage's length. Spaces and punctuation do not
 * count, so a word the OCR split or ran together costs nothing.
 *
 * The Strijataka (1931): its OCR reads "in" as "m" and "Sani" as "Sam", which
 * short list items ("Sani in 7 — widowhood") cannot survive word by word, so
 * 238 of 728 faithful passages failed the word floors. Measured on 2026-10-05
 * with each passage's summary, clipped to the passage's length, as the
 * rewording to tell apart: faithful passages scored at least 0.64 (0.71 at
 * 25 letters and up), summaries a median of 0.46, and 1-2% of them reach 0.7
 * at 25 letters and up. Under 25 letters any check is weak, as a short run of
 * letters turns up somewhere by chance.
 */
export const LETTER_CHECKED = {
  "strijataka-1931": { short: 0.6, long: 0.7, shortLetters: 25, chapter: 0.85 },
} as const satisfies Record<string, { short: number; long: number; shortLetters: number; chapter: number }>;

/** A passage's letters as the letter-level check compares them: bracketed words out, letters only, lower case. */
export function scanLetters(text: string): string {
  return rawLetters(text.replace(/\[[^\]]*\]/g, " "));
}

/**
 * The scan's letters, which the passages are compared against. No bracket is
 * removed here: the OCR has stray ones ("if the [soles be of the color"), and
 * one paired with a running head's "CH. 21.]" a page later would cut a page
 * out of the scan.
 */
export function rawLetters(text: string): string {
  return text.toLowerCase().replace(/[^a-z]/g, "");
}

/** The normalisation both sides of the comparison get: letters only, lower case, hyphens closed up. */
export function scanWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/-/g, "")
    .replace(/[^a-z]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** The words a passage is scored on: its text as printed and its footnotes. */
export function scoredText(passage: { text: string; printedText?: string | null; notes: string | null }): string {
  return `${passage.printedText ?? passage.text}\n${passage.notes ?? ""}`;
}

/**
 * Passages read against the scan by hand, where the scan defeats both checks.
 * The build and the tests skip the floor for these ids and no others, so the
 * list is the whole of what was let through, each with what was seen.
 */
export const CHECKED_BY_HAND: Record<string, string> = {
  "brihat-samhita-1884:68.88.1":
    "the OCR runs the words together ('Themouth, the eyes^the arras, the nose andthepavt'); the transcription is the scan's, word for word",
  "brihat-samhita-1884:68.83.2":
    "four words of the verse ('and if otherwise, happy') after a bracketed opening, whose join no scan run can match; both are the scan's",
};

export function scanAgreementFloor(passage: {
  id?: string;
  source?: string;
  text: string;
  printedText?: string | null;
  notes: string | null;
}): number {
  if (passage.id && passage.id in CHECKED_BY_HAND) return 0;
  const letterChecked = passage.source ? LETTER_CHECKED[passage.source as keyof typeof LETTER_CHECKED] : undefined;
  if (letterChecked) {
    return scanLetters(scoredText(passage)).length >= letterChecked.shortLetters ? letterChecked.long : letterChecked.short;
  }
  return scanWords(scoredText(passage)).length >= LONG_PASSAGE_WORDS
    ? MIN_SCAN_AGREEMENT.long
    : MIN_SCAN_AGREEMENT.short;
}

/** The median a whole chapter's passages must reach, by book. */
export function chapterScanAgreementFloor(source: string): number {
  return LETTER_CHECKED[source as keyof typeof LETTER_CHECKED]?.chapter ?? MIN_CHAPTER_SCAN_AGREEMENT;
}

export function passageId(source: string, chapter: number, verse: number, part: number): string {
  return `${source}:${chapter}.${verse}.${part}`;
}
