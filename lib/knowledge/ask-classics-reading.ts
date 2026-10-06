import type Anthropic from "@anthropic-ai/sdk";
import type { DashaInfo } from "../astro-types";
import type { BirthSex } from "../birth-sex";
import { DASHA_YEARS, NAKSHATRA_LORDS, YEAR_DAYS } from "../engines/nakshatra-engine";
import { YOGA_DEFINITIONS } from "../engines/yoga-engine";
import { ASK_QUESTION_IDS, ASK_QUESTIONS, type AskQuestion, type AskQuestionId } from "./ask-questions";
import { READER_LINES, countedByAnyArea, describePlacement, type AreaChart } from "./area-classics-reading";
import { heldPlacements, placementsHold } from "./placements";
import { BRIHAT_JATAKA_1885, KNOWLEDGE_SOURCES, STRIJATAKA_1931 } from "./sources";
import { CLASSICAL_NOTE_RULES, NOTE_PREFIX, speaksToChart, type PassageRow } from "./yoga-classics-reading";

/*
 * "Ask the classics" on the life-areas page: a reader picks a question, and
 * the answer is written from the passages of the books that apply to their
 * chart and bear on that question. The server half that touches neither the
 * database nor the network, so it can be tested directly.
 *
 * Retrieval is hybrid. The chart decides which passages may answer -- their
 * placement conditions hold, or the chart has a yoga they speak of, the same
 * test as the life areas' notes -- and the question's topics narrow them; the
 * question's embedding then orders what is left by meaning
 * (lib/knowledge/retrieve.ts, passagesNearQuestion). Without an embedding, the
 * route falls back to the chart's order and the answer is still grounded.
 */

/** Passages sent with a question: about 700 input tokens, enough for a five-sentence answer to cite. */
export const ASK_PASSAGE_LIMIT = 8;

/** Candidates the search returns before the selection here narrows them. */
export const ASK_CANDIDATE_LIMIT = 40;

/**
 * How much nearer a passage counts, for a year question, when it concerns a
 * planet whose period runs that year. Question-to-passage similarities sit
 * around 0.2-0.5 with this embedding model, so this lifts a period lord's
 * passage over a slightly nearer one without letting it outrank a clearly
 * better match.
 */
export const PERIOD_LORD_BOOST = 0.05;

/** A passage as the selection takes it: scored by the search, or unscored in the fallback. */
export type CandidatePassage = PassageRow & { similarity?: number };

const DEFINITIONS = new Map(YOGA_DEFINITIONS.map((definition) => [definition.id, definition]));

const LIFESPAN = "longevity";

function bookOrder(a: PassageRow, b: PassageRow): number {
  return a.chapter - b.chapter || a.verse - b.verse || a.part - b.part;
}

/**
 * The chart's yogas a passage speaks of, in the form the chart has them, and
 * that some life area counts as its own: as on the life areas' notes, a yoga
 * none of them counts (Kemadruma, whose verse is poverty) is quoted in the
 * yoga section and not brought into answers about a part of life.
 */
function yogasFor(passage: PassageRow, chart: AreaChart) {
  return chart.yogas.filter(
    (yoga) => passage.yogaIds.includes(yoga.id) && speaksToChart(passage, yoga) && countedByAnyArea(yoga.id),
  );
}

/** Whether a passage applies to the chart: its placement conditions hold, or it speaks of a yoga the chart has. */
export function appliesToReader(passage: PassageRow, chart: AreaChart): boolean {
  return placementsHold(passage, chart.keys) || yogasFor(passage, chart).length > 0;
}

/** Whether a passage may answer a question for this chart, before any ranking. */
export function answersQuestion(passage: PassageRow, question: AskQuestion, chart: AreaChart): boolean {
  if (passage.lifeAreas.includes(LIFESPAN)) return false;
  if (!passage.lifeAreas.some((topic) => (question.topics as readonly string[]).includes(topic))) return false;
  return appliesToReader(passage, chart);
}

/** Every topic some question reads, for the one query that tells which questions can be answered. */
export const ASK_TOPIC_LIST: string[] = [...new Set(ASK_QUESTION_IDS.flatMap((id) => ASK_QUESTIONS[id].topics))];

/** The questions the books can answer for this chart, in the catalogue's order: those with a passage that applies. */
export function answerableQuestions(rows: readonly PassageRow[], chart: AreaChart): AskQuestionId[] {
  return ASK_QUESTION_IDS.filter((id) => rows.some((passage) => answersQuestion(passage, ASK_QUESTIONS[id], chart)));
}

/* ── The year ahead ───────────────────────────────────────────────────────── */

/** A planetary period running in the next twelve months: its Maha Dasha lord, its Antardasha lord, and when it ends. */
export type YearPeriod = { maha: string; antar: string; until: string };

const DAY_MS = 86_400_000;
const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * The Antardashas that run between `now` and a year later, from the chart's
 * current period on. The chart names only the current one, so the rest are
 * counted on in the Vimshottari order: each Antardasha of a Maha Dasha lasts
 * (maha years x antar years / 120) years, they run in the lords' order starting
 * from the Maha Dasha's own lord, and after the last comes the next Maha
 * Dasha, which opens with its own lord.
 *
 * An empty list when the chart has no current period, which a year question
 * then answers without.
 */
export function yearPeriods(dasha: DashaInfo | null | undefined, now: number = Date.now()): YearPeriod[] {
  if (!dasha?.current_dasha || !dasha.current_antardasha || !dasha.current_antardasha_end) return [];
  const order = NAKSHATRA_LORDS;
  if (!order.includes(dasha.current_dasha) || !order.includes(dasha.current_antardasha)) return [];
  let untilMs = Date.parse(dasha.current_antardasha_end);
  if (!Number.isFinite(untilMs)) return [];

  const horizon = now + 365 * DAY_MS;
  let maha = dasha.current_dasha;
  let antar = dasha.current_antardasha;
  const periods: YearPeriod[] = [{ maha, antar, until: isoDate(untilMs) }];
  while (untilMs < horizon && periods.length < 6) {
    antar = order[(order.indexOf(antar) + 1) % order.length];
    if (antar === maha) {
      maha = order[(order.indexOf(maha) + 1) % order.length];
      antar = maha;
    }
    untilMs += ((DASHA_YEARS[maha] * DASHA_YEARS[antar]) / 120) * YEAR_DAYS * DAY_MS;
    periods.push({ maha, antar, until: isoDate(untilMs) });
  }
  /* A chart built a while ago can name a period that has since ended. */
  return periods.filter(({ until }) => Date.parse(until) >= now - DAY_MS);
}

/** The planets whose periods run in the year: every Maha Dasha and Antardasha lord among them. */
export function periodLords(periods: readonly YearPeriod[]): Set<string> {
  return new Set(periods.flatMap(({ maha, antar }) => [maha, antar]));
}

/** Whether a passage concerns one of these planets: it names one, or a condition it holds on is about one. */
function concernsAny(passage: PassageRow, lords: ReadonlySet<string>, chart: AreaChart): boolean {
  if (lords.size === 0) return false;
  if (passage.planets.some((planet) => lords.has(planet))) return true;
  return heldPlacements(passage, chart.keys).some((key) => lords.has(key.split(".")[0]));
}

/* ── Selection ────────────────────────────────────────────────────────────── */

/**
 * The passages a question gets for a chart, best first, then put in the
 * order they are sent: by book, then the book's order.
 *
 * Only passages that may answer (answersQuestion) are kept, so a search row
 * that slipped past the database's coarser test is still dropped. Ranked by
 * the search's similarity, lifted for a year question when the passage
 * concerns a planet whose period runs that year; then the verse before the
 * translator's note; then the book's order. Unscored candidates (the fallback)
 * rank by those tie-breaks alone.
 */
export function selectQuestionPassages(
  rows: readonly CandidatePassage[],
  question: AskQuestion,
  chart: AreaChart,
  lords: ReadonlySet<string> = new Set(),
  limit: number = ASK_PASSAGE_LIMIT,
): CandidatePassage[] {
  const score = (passage: CandidatePassage) =>
    (passage.similarity ?? 0) + (question.span === "year" && concernsAny(passage, lords, chart) ? PERIOD_LORD_BOOST : 0);
  return rows
    .filter((passage) => answersQuestion(passage, question, chart))
    .map((passage) => ({ passage, score: score(passage) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(a.passage.kind === "note") - Number(b.passage.kind === "note") ||
        bookOrder(a.passage, b.passage),
    )
    .slice(0, limit)
    .map(({ passage }) => passage)
    .sort((a, b) => bookRank(a.source) - bookRank(b.source) || bookOrder(a, b));
}

/** The books, in the order their documents are sent: the Brihat Jataka first, then the book on women's charts. */
const BOOK_ORDER = [BRIHAT_JATAKA_1885.slug, STRIJATAKA_1931.slug];
const bookRank = (slug: string) => (BOOK_ORDER.includes(slug) ? BOOK_ORDER.indexOf(slug) : BOOK_ORDER.length);

/** One document's worth: the chosen passages from one book, and the chart conditions they rest on. */
export type QuestionDocumentGroup = { source: string; passages: PassageRow[]; conditions: string[]; yogaNames: string[] };

/**
 * The chosen passages split by book, since a citation names a document and
 * the reader is owed the right book's name. The documents are sent in this
 * order, and citations are read back against it.
 */
export function questionDocumentGroups(passages: readonly PassageRow[], chart: AreaChart): QuestionDocumentGroup[] {
  const books = [...new Set(passages.map((passage) => passage.source))].sort((a, b) => bookRank(a) - bookRank(b));
  return books.map((source) => {
    const own = passages.filter((passage) => passage.source === source);
    const conditions = [...new Set(own.flatMap((passage) => heldPlacements(passage, chart.keys)))];
    const ids = new Set(own.flatMap((passage) => yogasFor(passage, chart).map((yoga) => yoga.id)));
    const yogaNames = [...ids].map((id) => DEFINITIONS.get(id)?.name ?? id);
    return { source, passages: own, conditions, yogaNames };
  });
}

/*
 * Phrases the model reads in other words than the book's. "Free from
 * diseases" is how the books promise good health, and a model shown it writes
 * it back, even when told not to (measured on Haiku and on the Opus retry
 * alike): the content line keeps illness out of every note, even as an
 * absence. So the copy the model reads says it as a note may, in square
 * brackets, which the prompt already reads as the app's words; the passage
 * printed under the answer keeps the book's.
 */
const MODEL_WORDING: readonly (readonly [RegExp, string])[] = [
  [/\bfree from (?:all |serious )?(?:diseases?|ailments?|sickness|illness(?:es)?)\b/gi, "[of robust health]"],
];

/** A passage as the model reads it: the book's words, but for MODEL_WORDING. */
export function modelText(text: string): string {
  return MODEL_WORDING.reduce((current, [pattern, wording]) => current.replace(pattern, wording), text);
}

/**
 * One citable document per book: each passage a content block, so a citation
 * names whole passages; the chart conditions they were chosen for go in
 * `context`, which the model reads but cannot cite. Every string here comes
 * from the corpus, the catalogue, the vocabulary or lib/knowledge/sources.ts,
 * never from the browser.
 */
export function questionDocuments(groups: readonly QuestionDocumentGroup[]): Anthropic.DocumentBlockParam[] {
  return groups.map(({ source, passages, conditions, yogaNames }) => {
    const book = KNOWLEDGE_SOURCES[source] ?? BRIHAT_JATAKA_1885;
    return {
      type: "document",
      title: book.title,
      context:
        "Each passage was chosen because its condition holds in the reader's chart and it bears on the question. " +
        (conditions.length > 0 ? `Conditions met by placement: ${conditions.map(describePlacement).join("; ")}. ` : "") +
        (yogaNames.length > 0 ? `Yogas the chart has that passages speak of: ${yogaNames.join(", ")}. ` : "") +
        `The passages are from ${book.described}.`,
      source: {
        type: "content",
        content: passages.map((passage) => ({
          type: "text",
          text: passage.kind === "note" ? `${NOTE_PREFIX}${modelText(passage.text)}` : modelText(passage.text),
        })),
      },
      citations: { enabled: true },
    };
  });
}

/* ── The prompt ───────────────────────────────────────────────────────────── */

/* Frozen, so it is the cacheable prefix; the documents, the question and the periods follow in the user turn. */
export const ASK_CLASSICS_SYSTEM_PROMPT = `You answer a reader's question about their Vedic birth chart from the classical books, in a card on their life-areas page.

You are given the question and documents of passages, each document from one book: ${BRIHAT_JATAKA_1885.described}; or, for a woman's chart, also ${STRIJATAKA_1931.described}. Each passage was chosen because its condition holds in the reader's chart and it bears on the question, and each document's context lists those conditions.

Answer the question from the passages.

- Three to five sentences, no more than 110 words, in one paragraph or two. The answer is shown in a card; a long answer is an answer that gets cut.
- Ground every statement in the passages and cite the passage it comes from. Say nothing the passages do not say. Where they do not answer part of the question, leave that part alone rather than guess.
- Every sentence rests on a cited passage, except one that names the year's periods. Stop when the passages are used: no closing summary, no interpretation of your own, and no remark about what the books leave out.
- Say which condition in the chart a statement rests on ("with Venus in your 7th house, ...").
- A passage that lists results of several kinds may be used only for its results that bear on the question.
- Words in square brackets inside a passage are the app's, not the book's: the opening words a passage needs to read alone, or a wording chosen in place of one too harsh to print. Follow them, and never restore what they replace.
- When the question asks about the year ahead: the books describe what a chart promises, not when it comes. The instruction names the planetary periods (Vimshottari dasha) that run over the next twelve months. Name them, if at all, in the one plain sentence the instruction gives, and where a passage concerns one of their planets you may say so ("... and the Brihat Jataka says of Saturn in Sagittarius ..."). Never say what a period itself does, supports, brings or strengthens, and never promise an event, a date or an outcome.
- When the question is about health: speak only of vitality, strength and constitution as the passages describe them. Where a passage promises freedom from disease, say "robust health" or "a strong constitution": never write disease, illness, sickness or ailment, even to say the reader is free of them. Never name an injury, a weak organ or a remedy.
${CLASSICAL_NOTE_RULES}`;

const monthYear = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** The periods in words, for the instruction: "Saturn–Mercury until March 2027, then Saturn–Ketu until April 2028". */
export function describePeriods(periods: readonly YearPeriod[]): string {
  return periods.map(({ maha, antar, until }) => `${maha}–${antar} until ${monthYear(until)}`).join(", then ");
}

/**
 * The year's periods as the one sentence the answer may say about them, for a
 * reader who knows no astrology: "This year runs under your Saturn period, in
 * its Saturn sub-period until September 2027, then its Mercury sub-period."
 * Written here rather than left to the model, which, handed "Saturn–Saturn",
 * wrote "your Saturn and Saturn periods". The last period's end is left out:
 * it falls after the year the reader asked about.
 */
export function periodSentence(periods: readonly YearPeriod[]): string {
  const parts = periods.map((period, index) => {
    const until = index === periods.length - 1 ? "" : ` until ${monthYear(period.until)}`;
    if (index > 0 && periods[index - 1].maha === period.maha) return `then its ${period.antar} sub-period${until}`;
    return `${index === 0 ? "" : "then "}under your ${period.maha} period, in its ${period.antar} sub-period${until}`;
  });
  return `This year runs ${parts.join(", ")}.`;
}

/** The user turn's closing instruction: the question, the language, the year's periods, and who the reader is. */
export function askClassicsInstruction(question: AskQuestion, periods: readonly YearPeriod[], sex?: BirthSex): string {
  const year =
    question.span === "year" && periods.length > 0
      ? ` Over the next twelve months the reader is in these planetary periods (Maha Dasha–Antardasha): ${describePeriods(periods)}.` +
        ` If you name them, use this sentence as written: "${periodSentence(periods)}"`
      : "";
  return (
    `The reader's question: "${question.text}" Write the answer in English.${year}${sex ? READER_LINES[sex] : ""}` +
    /* Said again last, where Haiku reads it: in the system prompt alone it
       closed answers with what the books leave out. */
    " Answer only from the passages: do not remark on what they leave out, and do not end with a summary." +
    ' Put a harsh verdict in one neutral phrase ("the book warns of lean years"), never as "you will be poor".'
  );
}
