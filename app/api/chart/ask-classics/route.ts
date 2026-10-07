import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import {
  chartParamsToBirthInput,
  getChartPayload,
  hasAllChartParams,
  readChartParams,
} from "@/lib/chart-params";
import type { ChartApiResponse } from "@/lib/astro-types";
import { parseBirthSex, type BirthSex } from "@/lib/birth-sex";
import type { AreaChart } from "@/lib/knowledge/area-classics-reading";
import {
  ASK_CANDIDATE_LIMIT,
  ASK_CLASSICS_SYSTEM_PROMPT,
  ASK_TOPIC_LIST,
  answerableQuestions,
  askClassicsInstruction,
  periodLords,
  questionDocumentGroups,
  questionDocuments,
  selectQuestionPassages,
  withoutHeadings,
  yearPeriods,
  type CandidatePassage,
  type QuestionDocumentGroup,
  type YearPeriod,
} from "@/lib/knowledge/ask-classics-reading";
import {
  ASK_QUESTIONS,
  ASK_TYPED_MAX_LENGTH,
  ASK_TYPED_MIN_LENGTH,
  isAskQuestionId,
  type AskClassicsAnswer,
  type AskClassicsAvailability,
  type AskQuestion,
  type AskTypedAnswer,
} from "@/lib/knowledge/ask-questions";
import {
  ASK_SCREEN_SCHEMA,
  ASK_SCREEN_SYSTEM_PROMPT,
  parseScreen,
  screenInput,
  screenMessage,
  type ScreenResult,
} from "@/lib/knowledge/ask-screen";
import { checkNote, type NoteFailure, type NoteProblem } from "@/lib/knowledge/classical-note-check";
import type { ClassicalReading } from "@/lib/knowledge/classical-reading";
import { chartPlacementKeys } from "@/lib/knowledge/placements";
import { embedQuestion } from "@/lib/knowledge/question-embedding";
import { passagesForChart, passagesNearQuestion } from "@/lib/knowledge/retrieve";
import { readingFrom } from "@/lib/knowledge/yoga-classics-reading";
import { consumeLlmBudget } from "@/lib/llm-budget";
import { CHART_EFFORT, CHART_MODEL } from "@/lib/llm-models";
import { COMMENTARY_LANGUAGES } from "@/lib/varga-commentary";

/*
 * "Ask the classics": a reader asks about their chart on the life-areas page,
 * and the answer is written from the books' passages that apply to their
 * chart and bear on the question, cited verse by verse, in the reader's
 * language.
 *
 * ── THREE ANSWERS FROM ONE ROUTE ───────────────────────────────────────────
 *
 * GET without `question` says which of the fixed questions the books can
 * answer for this chart, from one query and nothing paid for. GET with
 * `question` (an id from lib/knowledge/ask-questions.ts) answers that fixed
 * question; the browser sends only the id. POST answers a question the
 * reader typed.
 *
 * ── A TYPED QUESTION IS SCREENED FIRST ─────────────────────────────────────
 *
 * The reader's words go to one call only, the screen
 * (lib/knowledge/ask-screen.ts), which classifies them -- a question about
 * their chart, an attempt at instructions, a topic the readings never go into,
 * or something else -- and rewrites a question as one plain English question
 * about the reader's chart. Every typed question is screened, English ones
 * too. A refusal is answered as such and nothing more is spent. What is
 * searched and answered is the rewrite, cut to plain letters and
 * punctuation, so the answering model never sees what was typed. The screen
 * and the answer share one budget unit: a typed question costs the reader one
 * of the day's questions however far it gets.
 *
 * ── HYBRID RETRIEVAL ───────────────────────────────────────────────────────
 *
 * The chart decides which passages may answer: their placement conditions
 * hold or the chart has a yoga a life area counts, and they carry one of the
 * question's topics. The question, in English because the passages and their
 * summaries are, then orders them by meaning: it is embedded with the model
 * the passages were embedded with, and the candidates are ranked by cosine
 * similarity in Postgres (pgvector). For a question about the year ahead,
 * passages about the planets whose periods run that year are lifted, and the
 * periods go to the model. If the embedding cannot be had, the answer is still
 * written, from the same chart-chosen passages in the book's order.
 *
 * ── WRITTEN IN THE READER'S LANGUAGE, CITED, CHECKED ───────────────────────
 *
 * The answer is written straight in the reader's language, from English
 * passages, as the other classical notes are; translating an English answer
 * afterwards would cut the citations loose from the words they belong to. An
 * answer that cites nothing is not shipped, and the content line is checked in
 * code (lib/knowledge/classical-note-check.ts) in every language, Hindi and
 * Bengali for their script too. A failed answer is asked for once more on
 * Opus 5.5 at low effort inside the same budget unit, as on the other notes.
 */

/* Claude Haiku 5.5 at low effort, as on the other classical notes
   (lib/llm-models.ts); the screen too. */
const MODEL = CHART_MODEL;

type Ask = Pick<Anthropic.MessageCreateParamsNonStreaming, "model" | "output_config">;
const FIRST: Ask = { model: MODEL, output_config: { effort: CHART_EFFORT } };
const RETRY: Ask = { model: "claude-opus-5-5", output_config: { effort: "low" } };

export const maxDuration = 60;

const ROUTE = "/api/chart/ask-classics";
const REQUEST_TIMEOUT_MS = 45_000;
const SCREEN_TIMEOUT_MS = 15_000;
const DEADLINE_MS = 55_000;
const RETRY_MIN_MS = 15_000;
const CACHE_HEADER = "private, no-store";

const FAILED: Record<NoteFailure, string> = {
  refusal: "The answer was declined.",
  max_tokens: "The answer ran past its token ceiling.",
  uncited: "The answer came back without its sources.",
  check: "The answer came back in the wrong language or with words it may not use.",
};

/*
 * Bounded, process-lifetime. Answers are keyed by what was sent rather than
 * by the chart, so charts whose conditions pick the same passages for a
 * question share an answer; screens are keyed by the words typed, so a
 * question asked again is not screened again.
 */
const MAX_CACHE_ENTRIES = 500;
const cache = new Map<string, ClassicalReading>();
const inFlight = new Map<string, Promise<ClassicalReading>>();
const screens = new Map<string, ScreenResult>();

function remember<T>(map: Map<string, T>, key: string, value: T) {
  if (map.size >= MAX_CACHE_ENTRIES) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, value);
}

const log = (level: "info" | "warn", event: string, fields: Record<string, unknown>) =>
  console[level](JSON.stringify({ timestamp: new Date().toISOString(), route: ROUTE, event, ...fields }));

/** An unknown language is English, as on the other commentary routes. */
const languageOf = (value: unknown): string =>
  typeof value === "string" && Object.hasOwn(COMMENTARY_LANGUAGES, value) ? value : "en";

/** What the model is sent, canonically: the question, the passages and their conditions, the periods, the reader. */
function cacheKey(
  question: AskQuestion,
  groups: QuestionDocumentGroup[],
  periods: YearPeriod[],
  sex: BirthSex | undefined,
  language: string,
): string {
  const canonical = [
    question.text,
    groups
      .map(({ source, passages, conditions, yogaNames }) =>
        [source, passages.map((p) => p.id).join(","), [...conditions].sort().join(","), [...yogaNames].sort().join(",")].join("|"),
      )
      .join(";"),
    periods.map(({ maha, antar, until }) => `${maha}-${antar}-${until}`).join(","),
  ].join("#");
  return `${language}:${sex ?? "unsaid"}:${createHash("sha1").update(canonical).digest("hex")}`;
}

/* ── Paying ───────────────────────────────────────────────────────────────── */

/** Whether this request has spent its budget unit yet: a typed question spends it on the screen. */
type Spend = { spent: boolean };

function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ApiError(
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      "Answers from the classics are unavailable: ANTHROPIC_API_KEY is not configured.",
      { statusCode: 503 },
    );
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 });
}

/** One unit of the reader's daily allowance, once per request, just before the first paid call. */
async function spend(request: NextRequest, spending: Spend) {
  if (spending.spent) return;
  const budget = await consumeLlmBudget(ROUTE, request);
  if (!budget.allowed) {
    log("warn", "llm_budget_exhausted", { scope: budget.scope });
    throw new ApiError(
      ErrorCode.RATE_LIMITED,
      budget.scope === "anonymous"
        ? "Sign in to keep asking the classics today."
        : "Questions to the classics are rate limited for today.",
      { details: { retryAfterSeconds: budget.retryAfterSeconds, scope: budget.scope } },
    );
  }
  spending.spent = true;
}

/* ── The screen ───────────────────────────────────────────────────────────── */

/** What the screen makes of the reader's words: a question to answer, or why not. */
async function screen(request: NextRequest, spending: Spend, input: string): Promise<ScreenResult> {
  const known = screens.get(input);
  if (known) return known;

  const anthropic = client();
  await spend(request, spending);
  const startedAt = Date.now();
  const response = await anthropic.messages.create(
    {
      model: MODEL,
      /* Four short fields, and any thinking, which counts here too; headroom, not a target. */
      max_tokens: 2000,
      system: [{ type: "text", text: ASK_SCREEN_SYSTEM_PROMPT }],
      messages: [{ role: "user", content: screenMessage(input) }],
      output_config: {
        effort: CHART_EFFORT,
        format: { type: "json_schema", schema: ASK_SCREEN_SCHEMA as unknown as Record<string, unknown> },
      },
    },
    { timeout: SCREEN_TIMEOUT_MS },
  );

  /* A model that will not classify the words is not asked to answer them either. */
  const text = response.content.find((block) => block.type === "text")?.text ?? "";
  const result: ScreenResult | null =
    response.stop_reason === "refusal" ? { verdict: "not_about_chart" } : parseScreen(text);

  /* The verdict and its shape, never the reader's words: they are theirs. */
  log("info", "ask_screen", {
    model: MODEL,
    elapsedMs: Date.now() - startedAt,
    stopReason: response.stop_reason,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    length: input.length,
    verdict: result?.verdict ?? "unreadable",
    ...(result?.verdict === "answer" ? { topics: result.question.topics, span: result.question.span } : {}),
  });

  if (!result) throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "The question could not be read.");
  remember(screens, input, result);
  return result;
}

/* ── The answer ───────────────────────────────────────────────────────────── */

type Written = { reading: ClassicalReading } | { failure: NoteFailure };

type Asking = {
  /** For the logs: the fixed question's id, or "typed". */
  label: string;
  question: AskQuestion;
  groups: QuestionDocumentGroup[];
  periods: YearPeriod[];
  sex: BirthSex | undefined;
  language: string;
};

/** One paid call: the answer if it can ship, or why it cannot. */
async function writeAnswer(
  anthropic: Anthropic,
  ask: Ask,
  attempt: number,
  asking: Asking,
  options?: { timeout: number },
): Promise<Written> {
  const { label, question, groups, periods, sex, language } = asking;
  const startedAt = Date.now();
  const response = await anthropic.messages.create(
    {
      ...ask,
      /* Headroom for a five-sentence answer, and Opus's thinking on the retry, not a target. */
      max_tokens: 3000,
      system: [{ type: "text", text: ASK_CLASSICS_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: [
            ...questionDocuments(groups),
            { type: "text", text: askClassicsInstruction(question, periods, sex, language) },
          ],
        },
      ],
    },
    options,
  );

  log("info", "llm_usage", {
    model: ask.model,
    attempt,
    question: label,
    language,
    passages: groups.reduce((sum, { passages }) => sum + passages.length, 0),
    elapsedMs: Date.now() - startedAt,
    stopReason: response.stop_reason,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
  });

  if (response.stop_reason === "refusal") return { failure: "refusal" };
  if (response.stop_reason === "max_tokens") return { failure: "max_tokens" };

  const reading = withoutHeadings(readingFrom(response.content, groups));
  if (reading.sources.length === 0) return { failure: "uncited" };
  const check = checkNote(reading, language);
  if (check.problems.length > 0) {
    const problems: NoteProblem[] = check.problems;
    log("warn", "llm_note_check", { model: ask.model, attempt, question: label, language, problems, blocks: true });
    return { failure: "check" };
  }
  return { reading };
}

async function write(request: NextRequest, spending: Spend, asking: Asking, receivedAt: number): Promise<ClassicalReading> {
  const anthropic = client();
  await spend(request, spending);
  const first = await writeAnswer(anthropic, FIRST, 1, asking);
  if ("reading" in first) return first.reading;

  const leftMs = DEADLINE_MS - (Date.now() - receivedAt);
  const retrying = leftMs >= RETRY_MIN_MS;
  log("warn", "llm_note_retry", {
    question: asking.label,
    language: asking.language,
    failure: first.failure,
    model: RETRY.model,
    leftMs,
    retrying,
  });
  if (!retrying) throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, FAILED[first.failure]);

  const second = await writeAnswer(anthropic, RETRY, 2, asking, { timeout: Math.min(REQUEST_TIMEOUT_MS, leftMs) });
  if ("reading" in second) return second.reading;
  throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, FAILED[second.failure]);
}

/* ── The chart and the passages ───────────────────────────────────────────── */

type Reader = { payload: ChartApiResponse; chart: AreaChart; sex: BirthSex | undefined };

/** The reader's chart, rebuilt from the birth details in the query: the same cached chart the page was rendered from. */
function readerFrom(searchParams: URLSearchParams): Reader {
  const chartParams = readChartParams(Object.fromEntries(searchParams.entries()));
  if (!hasAllChartParams(chartParams)) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, "Complete birth details are required to ask the classics.");
  }
  try {
    chartParamsToBirthInput(chartParams);
  } catch (error) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, error instanceof Error ? error.message : "Invalid birth details.");
  }
  const payload = getChartPayload(chartParams);
  const sex = parseBirthSex(chartParams.birthSex);
  const chart: AreaChart = {
    keys: chartPlacementKeys({
      planets: payload.chart.planets,
      ascendantSign: payload.chart.ascendant.sign,
      navamsa: payload.chart.navamsa,
      moonNakshatra: payload.chart.nakshatra?.name,
      sex,
    }),
    yogas: (payload.chart.yogas ?? [])
      .filter((yoga) => yoga.present)
      .map((yoga) => ({ id: yoga.yoga_id, planets: yoga.involved_planets })),
  };
  return { payload, chart, sex };
}

/**
 * The candidates for a question: the search's, nearest first, or when the
 * question cannot be embedded, the chart's own passages for its topics.
 */
async function candidatesFor(
  label: string,
  question: AskQuestion,
  chart: AreaChart,
): Promise<{ rows: CandidatePassage[]; searched: boolean }> {
  const chartKeys = [...chart.keys];
  const yogaIds = chart.yogas.map((yoga) => yoga.id);
  try {
    const embedding = await embedQuestion(question.text);
    const rows = await passagesNearQuestion({
      embedding,
      topics: question.topics,
      chartKeys,
      yogaIds,
      limit: ASK_CANDIDATE_LIMIT,
    });
    return { rows, searched: true };
  } catch (error) {
    log("warn", "ask_search_fallback", {
      question: label,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
    return { rows: await passagesForChart({ topics: [...question.topics], chartKeys, yogaIds }), searched: false };
  }
}

/** The answer to an English question for this reader: searched, then written or read from cache. */
async function answerFor(
  request: NextRequest,
  spending: Spend,
  label: string,
  question: AskQuestion,
  reader: Reader,
  language: string,
  receivedAt: number,
): Promise<{ reading: ClassicalReading | null; cached: boolean }> {
  const periods = question.span === "year" ? yearPeriods(reader.payload.chart.dasha) : [];
  const { rows, searched } = await candidatesFor(label, question, reader.chart);
  const passages = selectQuestionPassages(rows, question, reader.chart, periodLords(periods));
  if (passages.length === 0) return { reading: null, cached: false };

  const groups = questionDocumentGroups(passages, reader.chart);
  const key = cacheKey(question, groups, periods, reader.sex, language);
  const cached = cache.get(key);
  if (cached) return { reading: cached, cached: true };

  log("info", "ask_retrieval", {
    question: label,
    searched,
    candidates: rows.length,
    chosen: passages.map((passage) => passage.id),
    similarity: passages.map((passage) => (passage.similarity === undefined ? null : Math.round(passage.similarity * 1000) / 1000)),
    periods: periods.length,
  });

  let writing = inFlight.get(key);
  if (!writing) {
    const asking: Asking = { label, question, groups, periods, sex: reader.sex, language };
    writing = write(request, spending, asking, receivedAt)
      .then((reading) => {
        remember(cache, key, reading);
        return reading;
      })
      .finally(() => {
        inFlight.delete(key);
      });
    inFlight.set(key, writing);
  }
  return { reading: await writing, cached: false };
}

/* ── Handlers ─────────────────────────────────────────────────────────────── */

function failure(error: unknown) {
  if (!(error instanceof ApiError)) {
    if (error instanceof Anthropic.BadRequestError) {
      console.error("ask-classics: bad request to Anthropic", error.message);
    } else if (error instanceof Anthropic.AuthenticationError) {
      console.error("ask-classics: ANTHROPIC_API_KEY rejected");
    } else if (error instanceof Anthropic.RateLimitError) {
      console.error("ask-classics: rate limited");
    } else if (error instanceof Anthropic.APIConnectionTimeoutError) {
      console.error("ask-classics: timed out");
    } else if (error instanceof Anthropic.APIError) {
      console.error("ask-classics: Anthropic error", error.status, error.message);
    } else {
      console.error("ask-classics: unexpected", error);
    }
  }
  return errorResponse(error, "The classics could not be asked.");
}

export async function GET(request: NextRequest) {
  const receivedAt = Date.now();
  try {
    const searchParams = request.nextUrl.searchParams;
    const requested = searchParams.get("question");
    if (requested !== null && !isAskQuestionId(requested)) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, "Unknown question.");
    }
    const reader = readerFrom(searchParams);

    if (requested === null) {
      const rows = await passagesForChart({
        topics: ASK_TOPIC_LIST,
        chartKeys: [...reader.chart.keys],
        yogaIds: reader.chart.yogas.map((yoga) => yoga.id),
      });
      const availability: AskClassicsAvailability = { available: answerableQuestions(rows, reader.chart) };
      return NextResponse.json(availability, { headers: { "Cache-Control": CACHE_HEADER } });
    }

    const language = languageOf(searchParams.get("language"));
    const answered = await answerFor(request, { spent: false }, requested, ASK_QUESTIONS[requested], reader, language, receivedAt);
    const body: AskClassicsAnswer = { question: requested, ...answered };
    return NextResponse.json(body, { headers: { "Cache-Control": CACHE_HEADER } });
  } catch (error) {
    return failure(error);
  }
}

/** A question the reader typed: `{ text, language }` in the body, the birth details in the query, as on GET. */
export async function POST(request: NextRequest) {
  const receivedAt = Date.now();
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, "The question must be sent as JSON.");
    }
    const { text, language: requestedLanguage } = (body ?? {}) as Record<string, unknown>;
    if (typeof text !== "string") throw new ApiError(ErrorCode.VALIDATION_FAILED, "A question is required.");
    if (text.length > ASK_TYPED_MAX_LENGTH * 2) throw new ApiError(ErrorCode.VALIDATION_FAILED, "The question is too long.");
    const input = screenInput(text);
    if (input.length < ASK_TYPED_MIN_LENGTH) throw new ApiError(ErrorCode.VALIDATION_FAILED, "The question is too short.");

    const reader = readerFrom(request.nextUrl.searchParams);
    const language = languageOf(requestedLanguage);
    const spending: Spend = { spent: false };

    const screened = await screen(request, spending, input);
    if (screened.verdict !== "answer") {
      const refused: AskTypedAnswer = { refused: screened.verdict, reading: null, cached: false };
      return NextResponse.json(refused, { headers: { "Cache-Control": CACHE_HEADER } });
    }

    const answered = await answerFor(request, spending, "typed", screened.question, reader, language, receivedAt);
    const reply: AskTypedAnswer = { refused: null, ...answered };
    return NextResponse.json(reply, { headers: { "Cache-Control": CACHE_HEADER } });
  } catch (error) {
    return failure(error);
  }
}
