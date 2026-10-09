import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import type { BirthSex } from "@/lib/birth-sex";
import { DEEPEST_DASHA_LEVEL, findChain, statusAt, type DashaSpan, type DashaStatus } from "@/lib/dasha-periods";
import { PERIOD_PLANETS, periodFacts, type PeriodFacts } from "@/lib/dasha-reading-facts";
import { readerFrom, type Reader } from "@/lib/knowledge/chart-reader";
import { checkNote, type NoteFailure, type NoteProblem } from "@/lib/knowledge/classical-note-check";
import type { ClassicalReading, ClassicalReadingResponse } from "@/lib/knowledge/classical-reading";
import {
  DASHA_READING_SYSTEM_PROMPT,
  dashaReadingInstruction,
  periodCanonical,
  periodDocumentGroups,
  periodDocuments,
  periodQueryText,
  selectPeriodPassages,
  type PeriodDocumentGroup,
} from "@/lib/knowledge/dasha-reading";
import { withoutHeadings } from "@/lib/knowledge/ask-classics-reading";
import { embedQuestion } from "@/lib/knowledge/question-embedding";
import { passagesForPeriod } from "@/lib/knowledge/retrieve";
import { readingFrom } from "@/lib/knowledge/yoga-classics-reading";
import { consumeLlmBudget } from "@/lib/llm-budget";
import { CHART_EFFORT, CHART_MODEL } from "@/lib/llm-models";
import { COMMENTARY_LANGUAGES } from "@/lib/varga-commentary";

/*
 * The reading for one Vimshottari period the reader picks on the dasha
 * timeline, from a Maha Dasha down to a Sookshma, written for their chart.
 *
 * ── WHAT IT IS WRITTEN FROM ────────────────────────────────────────────────
 *
 * Three things, all rebuilt here from the birth details in the query, so
 * nothing the browser says about the chart reaches the model:
 *
 *   the period itself, found by walking the chart's own Vimshottari periods
 *   (lib/dasha-periods.ts) to the chain of lords and start date the browser
 *   names -- a period the chart does not have is refused, so the browser
 *   chooses which period, never what it is;
 *
 *   where its planets stand in the chart (lib/dasha-reading-facts.ts): sign,
 *   whole-sign house, dignity, the houses they rule, the planets with them,
 *   how each stands to the planet of the period above it, and for Rahu and
 *   Ketu the planet whose results they give -- the facts the panel prints
 *   under the period before anything is paid for;
 *
 *   the books' passages that apply to the chart and concern those planets,
 *   found by hybrid retrieval: the chart and the planets choose, and an
 *   embedding of the period's description orders each planet's share by
 *   meaning (pgvector). If the embedding cannot be had, the reading is still
 *   written, from the same passages in the book's order.
 *
 * ── WRITTEN IN THE READER'S LANGUAGE, CITED, CHECKED ───────────────────────
 *
 * As on the other classical notes: written straight in the reader's
 * language, every classical result cited to its passage, an uncited reading
 * not shipped, and the content line checked in code in every language. A
 * failed reading is asked for once more on Opus 5.5 at low effort inside the
 * same budget unit.
 *
 * ── PAID FOR BY A CLICK ────────────────────────────────────────────────────
 *
 * The panel asks only when the reader presses "Read this period", never on
 * mount or on a drill: a reader walking the timeline four levels deep should
 * not spend four readings doing it. Answers are cached by what the model is
 * sent, so charts whose periods share their planets' placements and passages
 * share a reading.
 */

/* Claude Haiku 5.5 at low effort, as on the other classical notes (lib/llm-models.ts). */
const MODEL = CHART_MODEL;

type Ask = Pick<Anthropic.MessageCreateParamsNonStreaming, "model" | "output_config">;
const FIRST: Ask = { model: MODEL, output_config: { effort: CHART_EFFORT } };
const RETRY: Ask = { model: "claude-opus-5-5", output_config: { effort: "low" } };

export const maxDuration = 60;

const ROUTE = "/api/chart/dasha-reading";
const REQUEST_TIMEOUT_MS = 45_000;
const DEADLINE_MS = 55_000;
const RETRY_MIN_MS = 15_000;
const CACHE_HEADER = "private, no-store";

/** Candidates fetched for a chart: every passage that applies, which is a few dozen. */
const CANDIDATE_LIMIT = 200;

const FAILED: Record<NoteFailure, string> = {
  refusal: "The reading was declined.",
  max_tokens: "The reading ran past its token ceiling.",
  uncited: "The reading came back without its sources.",
  check: "The reading came back in the wrong language or with words it may not use.",
};

/* Bounded, process-lifetime, keyed by what the model is sent. */
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

const log = (level: "info" | "warn", event: string, fields: Record<string, unknown>) =>
  console[level](JSON.stringify({ timestamp: new Date().toISOString(), route: ROUTE, event, ...fields }));

/** An unknown language is English, as on the other commentary routes. */
const languageOf = (value: unknown): string =>
  typeof value === "string" && Object.hasOwn(COMMENTARY_LANGUAGES, value) ? value : "en";

const LORDS: ReadonlySet<string> = new Set(PERIOD_PLANETS);

/** The period the browser names: one to four lords from the closed set, and the deepest period's first day. */
function periodRequest(body: unknown): { lords: string[]; start: string } {
  const { lords, start } = (body ?? {}) as Record<string, unknown>;
  if (
    !Array.isArray(lords) ||
    lords.length < 1 ||
    lords.length > DEEPEST_DASHA_LEVEL ||
    !lords.every((lord) => typeof lord === "string" && LORDS.has(lord))
  ) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, "A chain of one to four period lords is required.");
  }
  if (typeof start !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, "The period's start date is required.");
  }
  return { lords: lords as string[], start };
}

/* ── Paying ───────────────────────────────────────────────────────────────── */

function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ApiError(
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      "Period readings are unavailable: ANTHROPIC_API_KEY is not configured.",
      { statusCode: 503 },
    );
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 });
}

/** One unit of the reader's daily allowance, just before the first paid call. */
async function spend(request: NextRequest) {
  const budget = await consumeLlmBudget(ROUTE, request);
  if (!budget.allowed) {
    log("warn", "llm_budget_exhausted", { scope: budget.scope });
    throw new ApiError(
      ErrorCode.RATE_LIMITED,
      budget.scope === "anonymous"
        ? "Sign in to read more periods today."
        : "Period readings are rate limited for today.",
      { details: { retryAfterSeconds: budget.retryAfterSeconds, scope: budget.scope } },
    );
  }
}

type Written = { reading: ClassicalReading } | { failure: NoteFailure };

type Writing = {
  path: DashaSpan[];
  facts: PeriodFacts;
  status: DashaStatus;
  groups: PeriodDocumentGroup[];
  sex: BirthSex | undefined;
  language: string;
};

/** One paid call: the reading if it can ship, or why it cannot. */
async function writeReading(
  anthropic: Anthropic,
  ask: Ask,
  attempt: number,
  writing: Writing,
  options?: { timeout: number },
): Promise<Written> {
  const { path, facts, status, groups, sex, language } = writing;
  const startedAt = Date.now();
  const response = await anthropic.messages.create(
    {
      ...ask,
      /* Headroom for two short paragraphs, and Opus's thinking on the retry, not a target. */
      max_tokens: 3000,
      system: [{ type: "text", text: DASHA_READING_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: [
            ...periodDocuments(groups, facts),
            { type: "text", text: dashaReadingInstruction(path, facts, status, sex, language) },
          ],
        },
      ],
    },
    options,
  );

  log("info", "llm_usage", {
    model: ask.model,
    attempt,
    depth: path.length,
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
    log("warn", "llm_note_check", { model: ask.model, attempt, depth: path.length, language, problems, blocks: true });
    return { failure: "check" };
  }
  return { reading };
}

async function write(request: NextRequest, writing: Writing, receivedAt: number): Promise<ClassicalReading> {
  const anthropic = client();
  await spend(request);
  const first = await writeReading(anthropic, FIRST, 1, writing);
  if ("reading" in first) return first.reading;

  const leftMs = DEADLINE_MS - (Date.now() - receivedAt);
  const retrying = leftMs >= RETRY_MIN_MS;
  log("warn", "llm_note_retry", {
    depth: writing.path.length,
    language: writing.language,
    failure: first.failure,
    model: RETRY.model,
    leftMs,
    retrying,
  });
  if (!retrying) throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, FAILED[first.failure]);

  const second = await writeReading(anthropic, RETRY, 2, writing, { timeout: Math.min(REQUEST_TIMEOUT_MS, leftMs) });
  if ("reading" in second) return second.reading;
  throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, FAILED[second.failure]);
}

/* ── The period and its passages ──────────────────────────────────────────── */

/** The passages that may be read into the period: searched against its description, or unscored when that cannot be embedded. */
async function candidatesFor(reader: Reader, facts: PeriodFacts) {
  const chartKeys = [...reader.chart.keys];
  const yogaIds = reader.chart.yogas.map((yoga) => yoga.id);
  try {
    const embedding = await embedQuestion(periodQueryText(facts));
    return { rows: await passagesForPeriod({ chartKeys, yogaIds, embedding, limit: CANDIDATE_LIMIT }), searched: true };
  } catch (error) {
    log("warn", "period_search_fallback", {
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
    return { rows: await passagesForPeriod({ chartKeys, yogaIds, limit: CANDIDATE_LIMIT }), searched: false };
  }
}

function failure(error: unknown) {
  if (!(error instanceof ApiError)) {
    if (error instanceof Anthropic.BadRequestError) {
      console.error("dasha-reading: bad request to Anthropic", error.message);
    } else if (error instanceof Anthropic.AuthenticationError) {
      console.error("dasha-reading: ANTHROPIC_API_KEY rejected");
    } else if (error instanceof Anthropic.RateLimitError) {
      console.error("dasha-reading: rate limited");
    } else if (error instanceof Anthropic.APIConnectionTimeoutError) {
      console.error("dasha-reading: timed out");
    } else if (error instanceof Anthropic.APIError) {
      console.error("dasha-reading: Anthropic error", error.status, error.message);
    } else {
      console.error("dasha-reading: unexpected", error);
    }
  }
  return errorResponse(error, "The period could not be read.");
}

/** `{ lords, start, language }` in the body, the birth details in the query. */
export async function POST(request: NextRequest) {
  const receivedAt = Date.now();
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, "The period must be sent as JSON.");
    }
    const { lords, start } = periodRequest(body);
    const language = languageOf((body as Record<string, unknown>).language);
    const reader = readerFrom(request.nextUrl.searchParams, "to read a period");

    const dasha = reader.payload.chart.dasha;
    const path = dasha ? findChain(dasha, lords, start) : null;
    if (!path) throw new ApiError(ErrorCode.VALIDATION_FAILED, "This chart has no such period.");
    const facts = periodFacts(
      { ascendantSign: reader.payload.chart.ascendant.sign, planets: reader.payload.chart.planets },
      lords,
    );
    if (!facts) throw new ApiError(ErrorCode.VALIDATION_FAILED, "The chart does not place this period's planets.");
    const status = statusAt(path[path.length - 1], receivedAt);

    const { rows, searched } = await candidatesFor(reader, facts);
    const chosen = selectPeriodPassages(rows, reader.chart, facts);
    if (chosen.length === 0) {
      const empty: ClassicalReadingResponse = { reading: null, cached: false };
      return NextResponse.json(empty, { headers: { "Cache-Control": CACHE_HEADER } });
    }

    const groups = periodDocumentGroups(chosen, reader.chart, facts);
    const key =
      `${language}:${reader.sex ?? "unsaid"}:` +
      createHash("sha1").update(periodCanonical(path, facts, status, groups)).digest("hex");
    const cached = cache.get(key);
    if (cached) {
      const hit: ClassicalReadingResponse = { reading: cached, cached: true };
      return NextResponse.json(hit, { headers: { "Cache-Control": CACHE_HEADER } });
    }

    log("info", "period_retrieval", {
      depth: path.length,
      searched,
      candidates: rows.length,
      chosen: chosen.map(({ passage, lord, concern }) => `${lord}:${concern}:${passage.id}`),
      similarity: chosen.map(({ passage }) =>
        passage.similarity === undefined ? null : Math.round(passage.similarity * 1000) / 1000,
      ),
    });

    let writing = inFlight.get(key);
    if (!writing) {
      writing = write(request, { path, facts, status, groups, sex: reader.sex, language }, receivedAt)
        .then((reading) => {
          remember(key, reading);
          return reading;
        })
        .finally(() => {
          inFlight.delete(key);
        });
      inFlight.set(key, writing);
    }
    const written: ClassicalReadingResponse = { reading: await writing, cached: false };
    return NextResponse.json(written, { headers: { "Cache-Control": CACHE_HEADER } });
  } catch (error) {
    return failure(error);
  }
}
