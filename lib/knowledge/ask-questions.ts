import type { ClassicalReading } from "./classical-reading";
import type { KNOWLEDGE_LIFE_AREAS } from "./corpus";

/*
 * The questions a reader can put to the classics on the life-areas page, and
 * the shapes the route answers in. Safe to ship to the browser: the panel
 * reads the ids from here, and its labels from the route catalog.
 *
 * Two kinds. A fixed question is written here, and the browser sends only its
 * id. A typed question is the reader's own words, which reach one model only,
 * the screen (lib/knowledge/ask-screen.ts); what is searched and answered is
 * the screen's English rewrite of it. Either way the question is English by
 * the time it is embedded and asked, because the passages and their summaries
 * are English; the answer is written in the reader's language.
 */

type Topic = (typeof KNOWLEDGE_LIFE_AREAS)[number];

/** The longest question a reader may type, in characters. */
export const ASK_TYPED_MAX_LENGTH = 200;
/** The shortest: anything less is not a question. */
export const ASK_TYPED_MIN_LENGTH = 3;

/** Why a typed question is not answered, as the screen judged it. */
export const ASK_REFUSALS = ["instructions", "forbidden_topic", "not_about_chart"] as const;
export type AskRefusal = (typeof ASK_REFUSALS)[number];

export const ASK_QUESTION_IDS = [
  "career_year",
  "love_year",
  "money_year",
  "health",
  "marriage",
  "strengths",
  "children",
  "standing",
] as const;

export type AskQuestionId = (typeof ASK_QUESTION_IDS)[number];

export type AskQuestion = {
  /** Embedded for the search and put to the model as the reader's question. */
  text: string;
  /** The corpus topics a passage must carry to be considered for it. */
  topics: readonly Topic[];
  /**
   * "year" asks about the next twelve months. The books describe what a chart
   * promises rather than when, so a year question is answered with the
   * planetary periods (Vimshottari dasha) that run in that time, and passages
   * about those periods' planets are preferred.
   */
  span: "year" | "life";
};

export const ASK_QUESTIONS: Record<AskQuestionId, AskQuestion> = {
  career_year: {
    text: "What does the year ahead hold for my work and career?",
    topics: ["career", "status"],
    span: "year",
  },
  love_year: {
    text: "What does the year ahead hold for my love life and relationships?",
    topics: ["relationships"],
    span: "year",
  },
  money_year: {
    text: "What does the year ahead hold for my money and finances?",
    topics: ["wealth"],
    span: "year",
  },
  health: {
    text: "What do the classics say about my health, vitality and physical constitution?",
    topics: ["health"],
    span: "life",
  },
  marriage: {
    text: "What kind of partner and marriage do the classics see for me?",
    topics: ["relationships"],
    span: "life",
  },
  strengths: {
    text: "What are my natural strengths, talents and character?",
    topics: ["character", "learning"],
    span: "life",
  },
  children: {
    text: "What do the classics say about children in my life?",
    topics: ["children"],
    span: "life",
  },
  standing: {
    text: "What do the classics say about my reputation, recognition and standing?",
    topics: ["status"],
    span: "life",
  },
};

export function isAskQuestionId(value: unknown): value is AskQuestionId {
  return typeof value === "string" && (ASK_QUESTION_IDS as readonly string[]).includes(value);
}

/** Without a question: which questions the books can answer for this chart. Nothing is paid for. */
export type AskClassicsAvailability = {
  available: AskQuestionId[];
};

/**
 * With a question: the answer. `reading` is null when no passage applies,
 * which is an answer rather than a failure.
 */
export type AskClassicsAnswer = {
  question: AskQuestionId;
  reading: ClassicalReading | null;
  cached: boolean;
};

/**
 * A typed question's answer. `refused` says why the screen would not let it
 * through, and then there is no reading; otherwise `reading` is as above.
 */
export type AskTypedAnswer = {
  refused: AskRefusal | null;
  reading: ClassicalReading | null;
  cached: boolean;
};
