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
  yearPeriods,
  type CandidatePassage,
  type QuestionDocumentGroup,
  type YearPeriod,
} from "@/lib/knowledge/ask-classics-reading";
import {
  ASK_QUESTIONS,
  isAskQuestionId,
  type AskClassicsAnswer,
  type AskClassicsAvailability,
  type AskQuestionId,
} from "@/lib/knowledge/ask-questions";
import { checkNote, type NoteFailure, type NoteProblem } from "@/lib/knowledge/classical-note-check";
import type { ClassicalReading } from "@/lib/knowledge/classical-reading";
import { chartPlacementKeys } from "@/lib/knowledge/placements";
import { embedQuestion } from "@/lib/knowledge/question-embedding";
import { passagesForChart, passagesNearQuestion } from "@/lib/knowledge/retrieve";
import { readingFrom } from "@/lib/knowledge/yoga-classics-reading";
import { consumeLlmBudget } from "@/lib/llm-budget";

/*
 * "Ask the classics": a reader picks one of a fixed set of questions on the
 * life-areas page, and the answer is written from the books' passages that
 * apply to their chart and bear on the question, cited verse by verse.
 * English only for now.
 *
 * ── TWO ANSWERS FROM ONE ROUTE ─────────────────────────────────────────────
 *
 * Without `question`, the route says which questions the books can answer
 * for this chart, from one query and nothing paid for, so the panel offers
 * only those. With `question` (an id from lib/knowledge/ask-questions.ts), it
 * answers it. The browser never sends the question's words: the id picks a
 * question written here, so nothing the browser wrote reaches the model.
 *
 * ── HYBRID RETRIEVAL ───────────────────────────────────────────────────────
 *
 * The chart decides which passages may answer: their placement conditions
 * hold or the chart has a yoga they speak of, and they carry one of the
 * question's topics. The question then orders them by meaning: it is embedded
 * with the model the passages were embedded with, and the candidates are
 * ranked by cosine similarity in Postgres (pgvector). For a question about the
 * year ahead, passages about the planets whose periods run that year are
 * lifted, and the periods go to the model. If the embedding cannot be had,
 * the answer is still written, from the same chart-chosen passages in the
 * book's order, and the fallback is logged.
 *
 * ── CITED, CHECKED, THEN RETRIED ONCE ──────────────────────────────────────
 *
 * As on the other classical notes: citations rather than a schema, an answer
 * that cites nothing is not shipped, and the content line is checked in code
 * (lib/knowledge/classical-note-check.ts). Here the check blocks in English
 * too, because a question about health invites exactly the words the content
 * line keeps out. A failed answer is asked for once more on Opus 5.5 at low
 * effort inside the same budget unit, as on the other notes.
 */

/* Claude Haiku 4.5, as on the other classical notes since 2026-10-06. */
const MODEL = "claude-haiku-4-5";

type Ask = Pick<Anthropic.MessageCreateParamsNonStreaming, "model" | "output_config">;
const FIRST: Ask = { model: MODEL };
const RETRY: Ask = { model: "claude-opus-5-5", output_config: { effort: "low" } };

export const maxDuration = 60;

const ROUTE = "/api/chart/ask-classics";
const REQUEST_TIMEOUT_MS = 45_000;
const DEADLINE_MS = 55_000;
const RETRY_MIN_MS = 15_000;
const CACHE_HEADER = "private, no-store";

const FAILED: Record<NoteFailure, string> = {
  refusal: "The answer was declined.",
  max_tokens: "The answer ran past its token ceiling.",
  uncited: "The answer came back without its sources.",
  check: "The answer came back with words it may not use.",
};

/*
 * Bounded, process-lifetime, keyed by what was sent rather than by the chart:
 * charts whose conditions pick the same passages for a question share an
 * answer.
 */
const MAX_CACHE_ENTRIES = 500;
const cache = new Map<string, ClassicalReading>();
const inFlight = new Map<string, Promise<ClassicalReading>>();

function remember(key: string, value: ClassicalReading) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

/** What the model is sent, canonically: the question, the passages and their conditions, the periods, the reader's sex. */
function cacheKey(
  id: AskQuestionId,
  groups: QuestionDocumentGroup[],
  periods: YearPeriod[],
  sex: BirthSex | undefined,
): string {
  const canonical = [
    groups
      .map(({ source, passages, conditions, yogaNames }) =>
        [source, passages.map((p) => p.id).join(","), [...conditions].sort().join(","), [...yogaNames].sort().join(",")].join("|"),
      )
      .join(";"),
    periods.map(({ maha, antar, until }) => `${maha}-${antar}-${until}`).join(","),
  ].join("#");
  return `${id}:${sex ?? "unsaid"}:${createHash("sha1").update(canonical).digest("hex")}`;
}

type Written = { reading: ClassicalReading } | { failure: NoteFailure };

/** One paid call: the answer if it can ship, or why it cannot. */
async function writeAnswer(
  client: Anthropic,
  ask: Ask,
  attempt: number,
  id: AskQuestionId,
  groups: QuestionDocumentGroup[],
  periods: YearPeriod[],
  sex: BirthSex | undefined,
  options?: { timeout: number },
): Promise<Written> {
  const startedAt = Date.now();
  const response = await client.messages.create(
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
            { type: "text", text: askClassicsInstruction(ASK_QUESTIONS[id], periods, sex) },
          ],
        },
      ],
    },
    options,
  );

  console.info(JSON.stringify({
    timestamp: new Date().toISOString(),
    route: ROUTE,
    event: "llm_usage",
    model: ask.model,
    attempt,
    question: id,
    passages: groups.reduce((sum, { passages }) => sum + passages.length, 0),
    elapsedMs: Date.now() - startedAt,
    stopReason: response.stop_reason,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
  }));

  if (response.stop_reason === "refusal") return { failure: "refusal" };
  if (response.stop_reason === "max_tokens") return { failure: "max_tokens" };

  const reading = readingFrom(response.content, groups);
  if (reading.sources.length === 0) return { failure: "uncited" };
  const check = checkNote(reading, "en");
  if (check.problems.length > 0) {
    const problems: NoteProblem[] = check.problems;
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      route: ROUTE,
      event: "llm_note_check",
      model: ask.model,
      attempt,
      question: id,
      problems,
      blocks: true,
    }));
    return { failure: "check" };
  }
  return { reading };
}

async function answer(
  request: NextRequest,
  id: AskQuestionId,
  groups: QuestionDocumentGroup[],
  periods: YearPeriod[],
  sex: BirthSex | undefined,
  receivedAt: number,
): Promise<ClassicalReading> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ApiError(
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      "Answers from the classics are unavailable: ANTHROPIC_API_KEY is not configured.",
      { statusCode: 503 },
    );
  }

  /* Past the cache and past the empty case, so this request is about to cost money. */
  const budget = await consumeLlmBudget(ROUTE, request);
  if (!budget.allowed) {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      route: ROUTE,
      event: "llm_budget_exhausted",
      scope: budget.scope,
    }));
    throw new ApiError(
      ErrorCode.RATE_LIMITED,
      budget.scope === "anonymous"
        ? "Sign in to keep asking the classics today."
        : "Questions to the classics are rate limited for today.",
      { details: { retryAfterSeconds: budget.retryAfterSeconds, scope: budget.scope } },
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 });
  const first = await writeAnswer(client, FIRST, 1, id, groups, periods, sex);
  if ("reading" in first) return first.reading;

  const leftMs = DEADLINE_MS - (Date.now() - receivedAt);
  const retrying = leftMs >= RETRY_MIN_MS;
  console.warn(JSON.stringify({
    timestamp: new Date().toISOString(),
    route: ROUTE,
    event: "llm_note_retry",
    question: id,
    failure: first.failure,
    model: RETRY.model,
    leftMs,
    retrying,
  }));
  if (!retrying) throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, FAILED[first.failure]);

  const second = await writeAnswer(client, RETRY, 2, id, groups, periods, sex, {
    timeout: Math.min(REQUEST_TIMEOUT_MS, leftMs),
  });
  if ("reading" in second) return second.reading;
  throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, FAILED[second.failure]);
}

/**
 * The candidates for a question: the search's, nearest first, or when the
 * question cannot be embedded, the chart's own passages for its topics.
 */
async function candidatesFor(
  id: AskQuestionId,
  chart: AreaChart,
): Promise<{ rows: CandidatePassage[]; searched: boolean }> {
  const question = ASK_QUESTIONS[id];
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
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      route: ROUTE,
      event: "ask_search_fallback",
      question: id,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    }));
    return { rows: await passagesForChart({ topics: [...question.topics], chartKeys, yogaIds }), searched: false };
  }
}

export async function GET(request: NextRequest) {
  const receivedAt = Date.now();
  try {
    const searchParams = request.nextUrl.searchParams;
    const chartParams = readChartParams(Object.fromEntries(searchParams.entries()));
    if (!hasAllChartParams(chartParams)) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, "Complete birth details are required to ask the classics.");
    }
    try {
      chartParamsToBirthInput(chartParams);
    } catch (error) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, error instanceof Error ? error.message : "Invalid birth details.");
    }

    const requested = searchParams.get("question");
    if (requested !== null && !isAskQuestionId(requested)) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, "Unknown question.");
    }

    /* The same cached chart the page was rendered from. */
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

    if (requested === null) {
      const rows = await passagesForChart({
        topics: ASK_TOPIC_LIST,
        chartKeys: [...chart.keys],
        yogaIds: chart.yogas.map((yoga) => yoga.id),
      });
      const availability: AskClassicsAvailability = { available: answerableQuestions(rows, chart) };
      return NextResponse.json(availability, { headers: { "Cache-Control": CACHE_HEADER } });
    }

    const id = requested;
    const question = ASK_QUESTIONS[id];
    const periods = question.span === "year" ? yearPeriods(payload.chart.dasha) : [];
    const { rows, searched } = await candidatesFor(id, chart);
    const passages = selectQuestionPassages(rows, question, chart, periodLords(periods));
    if (passages.length === 0) {
      const empty: AskClassicsAnswer = { question: id, reading: null, cached: false };
      return NextResponse.json(empty, { headers: { "Cache-Control": CACHE_HEADER } });
    }

    const groups = questionDocumentGroups(passages, chart);
    const key = cacheKey(id, groups, periods, sex);
    const cached = cache.get(key);
    if (cached) {
      const hit: AskClassicsAnswer = { question: id, reading: cached, cached: true };
      return NextResponse.json(hit, { headers: { "Cache-Control": CACHE_HEADER } });
    }

    console.info(JSON.stringify({
      timestamp: new Date().toISOString(),
      route: ROUTE,
      event: "ask_retrieval",
      question: id,
      searched,
      candidates: rows.length,
      chosen: passages.map((passage) => passage.id),
      similarity: passages.map((passage) => (passage.similarity === undefined ? null : Math.round(passage.similarity * 1000) / 1000)),
      periods: periods.length,
    }));

    let writing = inFlight.get(key);
    if (!writing) {
      writing = answer(request, id, groups, periods, sex, receivedAt)
        .then((reading) => {
          remember(key, reading);
          return reading;
        })
        .finally(() => {
          inFlight.delete(key);
        });
      inFlight.set(key, writing);
    }
    const fresh: AskClassicsAnswer = { question: id, reading: await writing, cached: false };
    return NextResponse.json(fresh, { headers: { "Cache-Control": CACHE_HEADER } });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      if (error instanceof Anthropic.BadRequestError) {
        console.error("ask-classics: bad request to Anthropic", error.message);
      } else if (error instanceof Anthropic.AuthenticationError) {
        console.error("ask-classics: ANTHROPIC_API_KEY rejected");
      } else if (error instanceof Anthropic.RateLimitError) {
        console.error("ask-classics: rate limited");
      } else if (error instanceof Anthropic.APIConnectionTimeoutError) {
        console.error("ask-classics: timed out after", REQUEST_TIMEOUT_MS, "ms");
      } else if (error instanceof Anthropic.APIError) {
        console.error("ask-classics: Anthropic error", error.status, error.message);
      } else {
        console.error("ask-classics: unexpected", error);
      }
    }
    return errorResponse(error, "The classics could not be asked.");
  }
}
