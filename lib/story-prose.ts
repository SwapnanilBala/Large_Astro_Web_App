import type {
  PersonalStory,
  PersonalStoryChapterId,
  StorySupportLevel,
} from "@/lib/story-engine";

/**
 * The Opus pass over the PDF report's prose.
 *
 * What the deterministic engine produces is correct and thin. Measured on the
 * sample chart: nine chapters, each an opening sentence plus a single paragraph
 * of 40-100 words, 1,100 words for the whole report. That is why a chapter page
 * in the rendered PDF is about forty per cent blank, and why the reading feels
 * like a filled-in form rather than something written for the person holding it.
 *
 * So this module is the shape of a rewrite, not a generator. The engine still
 * decides every fact; the model is given those facts and the draft sentence
 * built from them, and is asked for the paragraphs a writer would have written
 * from the same notes.
 *
 * ── WHAT IT MAY AND MAY NOT TOUCH ──────────────────────────────────────────
 *
 * Rewritten: `introduction`, `preface`, and per chapter `opening` and
 * `narrative`. That is the running prose -- the part a reader reads straight
 * through.
 *
 * Left alone: `title`, `eyebrow`, `support`, `supportNote`, `signals`,
 * `practices`, `reflectionPrompt`, `atAGlance`, `timeline`, `centralThemes`,
 * `verification`. Those are either structured data the engine derived or short
 * lists keyed to a signal, and handing them to a model would put a generated
 * sentence where a computed one belongs. The support pill in particular is a
 * claim about evidence strength; it must keep coming from the checker.
 *
 * This split is also what keeps the grounding contract enforceable. Everything
 * the model is allowed to write is prose *about* facts printed elsewhere on the
 * same page, so a reader can see the signals the paragraph is drawn from.
 */

export type StoryProseChapterFacts = {
  id: PersonalStoryChapterId;
  title: string;
  eyebrow: string;
  support: StorySupportLevel;
  /** The placements this chapter was built from, as printed in the PDF. */
  signals: Array<{ label: string; value: string }>;
  /** What the engine wrote. The model's floor, not its ceiling. */
  draft: string;
};

export type StoryProseFacts = {
  clientName?: string;
  headline: string;
  subtitle: string;
  atAGlance: Array<{ label: string; value: string; context: string }>;
  centralThemes: string[];
  chapters: StoryProseChapterFacts[];
};

export type StoryProse = {
  introduction: string;
  preface: string[];
  chapters: Array<{ id: string; opening: string; narrative: string[] }>;
};

/**
 * How many paragraphs each chapter is asked for, and roughly how long.
 *
 * Three of 85-110 was the first draft, and it measured badly: with the larger
 * type the chapter page filled exactly, which pushed "Carry this forward", the
 * reflection and the evidence table onto a second page that was then 65% blank
 * -- once per chapter, nine times. Two longer paragraphs carry nearly the same
 * word count with one less paragraph break and leave the apparatus room to sit
 * under the prose where it belongs.
 */
export const PARAGRAPHS_PER_CHAPTER = 2;
export const WORDS_PER_PARAGRAPH = "110 to 140";

/**
 * The facts worth sending, from a built story.
 *
 * `draft` folds the opening and the narrative back into one blob on purpose:
 * the engine's `narrative[0]` is usually its `opening` repeated, which the PDF
 * filters out at render time, and sending the same sentence twice invites the
 * model to treat the duplication as emphasis.
 */
export function buildStoryProseFacts(
  story: PersonalStory,
  clientName?: string,
): StoryProseFacts {
  return {
    clientName,
    headline: story.title,
    subtitle: story.subtitle,
    atAGlance: story.atAGlance,
    centralThemes: story.centralThemes,
    chapters: story.chapters.map((chapter) => {
      const paragraphs = chapter.narrative?.length ? chapter.narrative : [chapter.body];
      const opening = chapter.opening?.trim();
      const rest = paragraphs
        .map((paragraph) => paragraph.trim())
        .filter((paragraph) => paragraph && paragraph !== opening);
      return {
        id: chapter.id,
        title: chapter.title,
        eyebrow: chapter.eyebrow,
        support: chapter.support ?? "supported",
        signals: chapter.signals,
        draft: [opening, ...rest].filter(Boolean).join(" "),
      };
    }),
  };
}

/** The user turn. Also used by scripts/effort-compare.mjs's mirror of it. */
export function renderStoryProseFacts(facts: StoryProseFacts): string {
  const glance = facts.atAGlance
    .map((item) => `  ${item.label}: ${item.value} -- ${item.context}`)
    .join("\n");
  const themes = facts.centralThemes.map((theme) => `  - ${theme}`).join("\n");
  const chapters = facts.chapters
    .map((chapter) => {
      const signals = chapter.signals
        .map((signal) => `    ${signal.label}: ${signal.value}`)
        .join("\n");
      return [
        `id: ${chapter.id}`,
        `chapter title (already set, do not rewrite): ${chapter.title}`,
        `section: ${chapter.eyebrow}`,
        `evidence strength: ${chapter.support}`,
        `placements this chapter rests on:\n${signals}`,
        `the draft to replace:\n    ${chapter.draft}`,
      ].join("\n");
    })
    .join("\n\n");

  return [
    facts.clientName ? `Reader: ${facts.clientName}` : "Reader: unnamed",
    `Report title: ${facts.headline}`,
    `Report subtitle: ${facts.subtitle}`,
    "",
    `At a glance (printed on its own page; do not restate these as a list):\n${glance}`,
    "",
    `The three threads the report already names:\n${themes}`,
    "",
    `Write ${facts.chapters.length} chapters, in this order:`,
    "",
    chapters,
  ].join("\n");
}

/**
 * The output schema.
 *
 * Written by hand rather than through zodOutputFormat because this route
 * streams -- `messages.parse()` is non-streaming, and a generation this size
 * needs the stream to avoid an HTTP timeout. The shape is checked again after
 * parsing; a schema constrains the model, it does not make the response
 * trustworthy.
 */
export const STORY_PROSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["introduction", "preface", "chapters"],
  properties: {
    introduction: { type: "string" },
    preface: { type: "array", items: { type: "string" } },
    chapters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "opening", "narrative"],
        properties: {
          id: { type: "string" },
          opening: { type: "string" },
          narrative: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

/** Runtime check. The schema constrains generation; this guards consumption. */
export function parseStoryProse(value: unknown): StoryProse | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.introduction !== "string") return null;
  if (!Array.isArray(raw.preface) || !Array.isArray(raw.chapters)) return null;

  const preface = raw.preface.filter((entry): entry is string => typeof entry === "string");
  const chapters: StoryProse["chapters"] = [];
  for (const entry of raw.chapters) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.opening !== "string") continue;
    if (!Array.isArray(row.narrative)) continue;
    const narrative = row.narrative.filter(
      (paragraph): paragraph is string => typeof paragraph === "string" && paragraph.trim().length > 0,
    );
    if (narrative.length === 0) continue;
    chapters.push({ id: row.id, opening: row.opening, narrative });
  }
  if (chapters.length === 0) return null;
  return { introduction: raw.introduction, preface, chapters };
}

/**
 * Merge written prose back into a story, chapter by chapter.
 *
 * Per chapter rather than wholesale, so a short response degrades to a mixed
 * report rather than to no report: a chapter the model skipped keeps the
 * engine's draft and nothing downstream can tell the difference except that it
 * reads more plainly. Same reasoning as the varga route's coverage check -- a
 * partial answer is worth shipping, it is just worth logging too.
 */
export function applyStoryProse(story: PersonalStory, prose: StoryProse): PersonalStory {
  const byId = new Map(prose.chapters.map((chapter) => [chapter.id, chapter]));
  return {
    ...story,
    introduction: prose.introduction.trim() || story.introduction,
    preface: prose.preface.length > 0 ? prose.preface : story.preface,
    chapters: story.chapters.map((chapter) => {
      const written = byId.get(chapter.id);
      if (!written) return chapter;
      return {
        ...chapter,
        opening: written.opening.trim() || chapter.opening,
        /* The engine repeats `opening` as narrative[0] and the PDF filters it
           out. The written set does not, so it is passed through as given. */
        narrative: written.narrative,
      };
    }),
  };
}

/** Which chapters the model did not write, for the route's log line. */
export function missingProseChapters(
  facts: StoryProseFacts,
  prose: StoryProse,
): string[] {
  const written = new Set(prose.chapters.map((chapter) => chapter.id));
  return facts.chapters.map((chapter) => chapter.id).filter((id) => !written.has(id));
}
