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

export const knowledgePassageSchema = z
  .object({
    /** `<source>:<chapter>.<verse>`; see `passageId`. */
    id: z.string(),
    source: z.string(),
    chapter: z.number().int().positive(),
    verse: z.number().int().positive(),
    chapterTitle: z.string().min(1),
    /** The translator's words, with OCR damage repaired and nothing else changed. */
    text: z.string().min(1),
    /** The translator's footnotes to the verse, when it has any. */
    notes: z.string().min(1).nullable(),
    /** Plain modern English: what the verse says, attributed to the text. */
    summary: z.string().min(1),
    /** Ids from the yoga engine's catalogue whose combination the verse states. */
    yogaIds: z.array(z.string()),
    planets: z.array(z.enum(KNOWLEDGE_PLANETS)),
    lifeAreas: z.array(z.enum(KNOWLEDGE_LIFE_AREAS)),
    /**
     * Kept for completeness, never retrieved: the verse's main claim is about
     * death, illness, caste, crime, harm to family or sexual morality.
     */
    withheld: z.boolean(),
    withheldReason: z.string().min(1).nullable(),
    /**
     * The share of the cleaned verse's word pairs that also occur, as printed,
     * in the chapter's raw OCR text. Repairing OCR damage costs a few points;
     * rewording costs most of them. The build refuses a verse below its floor.
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
        promptVersion: z.number().int().positive(),
      })
      .strict(),
    passages: z.array(knowledgePassageSchema),
  })
  .strict();

export type KnowledgePassage = z.infer<typeof knowledgePassageSchema>;
export type KnowledgeCorpus = z.infer<typeof knowledgeCorpusSchema>;

export function passageId(source: string, chapter: number, verse: number): string {
  return `${source}:${chapter}.${verse}`;
}
