import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import { computeMajorLifeShifts } from "@/lib/engines/major-shifts-engine";
import { withoutHeadings } from "@/lib/knowledge/ask-classics-reading";
import { readerFrom, type Reader } from "@/lib/knowledge/chart-reader";
import { checkNote, type NoteFailure } from "@/lib/knowledge/classical-note-check";
import type { ClassicalReading } from "@/lib/knowledge/classical-reading";
import { copiedPassages, endsMidSentence, readingFromMarkers, type PeriodCandidate } from "@/lib/knowledge/dasha-reading";
import {
  LIFE_SHIFTS_SYSTEM_PROMPT,
  allGroups,
  chapterPassages,
  chapterQueryText,
  lifeShiftsInstruction,
  shiftChapters,
  shiftBatches,
  shiftPassageListing,
  shiftsCanonical,
  type ShiftChapter,
  type ShiftChapterPassages,
} from "@/lib/knowledge/life-shift-classics";
import { embedQuestion } from "@/lib/knowledge/question-embedding";
import { passagesForPeriod } from "@/lib/knowledge/retrieve";
import { consumeLlmBudget } from "@/lib/llm-budget";
import { LIFE_SHIFTS_EFFORT, LIFE_SHIFTS_MODEL } from "@/lib/llm-models";
import {
  LIFE_SHIFTS_STREAM_TYPE,
  MAX_LIFE_SHIFTS,
  lifeShiftId,
  type LifeShiftDepth,
  type LifeShiftReading,
  type LifeShiftReadingResponse,
  type LifeShiftStreamLine,
} from "@/lib/life-shift-reading";
import { COMMENTARY_LANGUAGES } from "@/lib/varga-commentary";

/*
 * The written readings for the major life shifts section.
 *
 * The engine (lib/engines/major-shifts-engine.ts) decides which chapters
 * matter for a chart -- the Maha Dasha openings and the Saturn, Jupiter and
 * nodal returns nearest to now -- and writes each up from a template, the
 * fallback the panel shows until a reading lands and whenever none does.
 *
 * ── WHAT IT IS WRITTEN FROM, SINCE 2026-10-16 ──────────────────────────────
 *
 * Until then the model had the engine's line about each chapter and little
 * else -- its planet, a stock theme, "Natal Saturn: Scorpio / H2" -- and wrote
 * the same Saturn return for every reader. Now, all rebuilt here from the
 * birth details in the query (nothing the browser says about the chart
 * reaches the model), each chapter carries:
 *
 *   where its planets stand in the chart, the houses they sit in and rule,
 *   what those stand for and how they show up in ordinary life, and the Maha
 *   Dasha it takes over from or falls in, with how the two planets stand
 *   (lib/knowledge/life-shift-classics.ts, on lib/dasha-reading-facts.ts);
 *
 *   the books' passages that apply to this chart and concern its planet,
 *   found by hybrid retrieval as for a dasha period: the chart and the planet
 *   choose, an embedding of the chapter's description orders by meaning
 *   (pgvector). Numbered across the set, cited with [n] marks, printed under
 *   the reading. If the library cannot be reached, the readings are still
 *   written, from the chart alone.
 *
 * Written straight in the reader's language, the content line checked in
 * code in every language, a copied verse or a reading cut short sent back
 * once for just the chapters that failed.
 *
 * ── MODEL -- Opus 5.5 at low effort ───────────────────────────────────────
 *
 * The owner's call (lib/llm-models.ts). The readings are short, so the
 * output side that makes Opus dear stays small; the input is the facts and a
 * few passages per chapter. The panel asks only for the chapters it draws,
 * and answers are cached by what the model is sent, so a chart costs one call
 * however often its pages are opened.
 *
 * Failure is quiet by design: the panel keeps the engine's narrative for any
 * chapter this route does not return.
 */

const ROUTE = "/api/chart/life-shifts";


export const maxDuration = 60;

/* Comfortably inside maxDuration, so a stuck request fails as a timeout this file can log. */
const REQUEST_TIMEOUT_MS = 40_000;
const DEADLINE_MS = 55_000;
const RETRY_MIN_MS = 12_000;

/** Candidates fetched per chapter: every passage that applies to the chart, which is a few dozen. */
const CANDIDATE_LIMIT = 200;

/* Bounded, process-lifetime, keyed by what the model is sent. */
const MAX_CACHE_ENTRIES = 300;
const cache = new Map<string, LifeShiftReading[]>();
const inFlight = new Map<string, Promise<LifeShiftReading[]>>();

function remember(key: string, value: LifeShiftReading[]) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

const log = (level: "info" | "warn", event: string, fields: Record<string, unknown>) =>
  console[level](JSON.stringify({ timestamp: new Date().toISOString(), route: ROUTE, event, ...fields }));

const ReadingsSchema = z.object({
  readings: z.array(z.object({ id: z.string(), reading: z.string() })),
});

/* Longer than any id the engine writes ("jupiter-return-" and an ISO instant is 39). */
const MAX_ID_LENGTH = 64;

/** An unknown language is English, as on the other commentary routes. */
const languageOf = (value: unknown): string =>
  typeof value === "string" && Object.hasOwn(COMMENTARY_LANGUAGES, value) ? value : "en";

function parseDepth(value: unknown): LifeShiftDepth {
  if (value === undefined || value === null) return "compact";
  if (value !== "headline" && value !== "compact") {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, "`depth` must be either headline or compact.");
  }
  return value;
}

function parseIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, "`ids` must be a non-empty array.");
  }
  if (value.length > MAX_LIFE_SHIFTS) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, `\`ids\` may hold at most ${MAX_LIFE_SHIFTS} entries.`);
  }
  const ids = value.map((id) => (typeof id === "string" ? id : ""));
  if (ids.some((id) => id.length === 0 || id.length > MAX_ID_LENGTH)) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, "Each of `ids` must be a chapter id.");
  }
  return [...new Set(ids)];
}

/** The chapters asked for, in the order asked, from the chart this route built: an id the chart has no chapter for is dropped. */
function chaptersFor(reader: Reader, ids: string[]): ShiftChapter[] {
  const byId = new Map(computeMajorLifeShifts(reader.payload).map((shift) => [lifeShiftId(shift), shift]));
  const shifts = ids.flatMap((id) => {
    const shift = byId.get(id);
    return shift ? [shift] : [];
  });
  return shiftChapters(shifts, reader.payload);
}

/* ── The passages ─────────────────────────────────────────────────────────── */

/**
 * Each chapter's candidates: searched against its description, unscored when
 * that cannot be embedded, and none when the library cannot be reached -- the
 * readings are then written from the chart alone rather than not at all.
 */
async function candidatesFor(reader: Reader, chapters: readonly ShiftChapter[]): Promise<PeriodCandidate[][]> {
  const chartKeys = [...reader.chart.keys];
  const yogaIds = reader.chart.yogas.map((yoga) => yoga.id);
  try {
    let embeddings: (number[] | null)[];
    try {
      embeddings = await Promise.all(chapters.map((chapter) => embedQuestion(chapterQueryText(chapter))));
    } catch (error) {
      log("warn", "shift_search_fallback", { error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) });
      embeddings = chapters.map(() => null);
    }
    if (embeddings.every((embedding) => embedding === null)) {
      const rows = await passagesForPeriod({ chartKeys, yogaIds, limit: CANDIDATE_LIMIT });
      return chapters.map(() => rows);
    }
    return await Promise.all(
      embeddings.map((embedding) => passagesForPeriod({ chartKeys, yogaIds, embedding, limit: CANDIDATE_LIMIT })),
    );
  } catch (error) {
    log("warn", "shift_passages_unavailable", { error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) });
    return chapters.map(() => []);
  }
}

/* ── Paying ───────────────────────────────────────────────────────────────── */

function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    /* The panel keeps the engine's narrative on any non-OK response. */
    throw new ApiError(
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      "Life shift readings are unavailable: ANTHROPIC_API_KEY is not configured.",
      { statusCode: 503 },
    );
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 });
}

/* The daily ceiling, checked past the cache because the proxy cannot see that the cache served the last few requests for free. */
async function spend(request: NextRequest) {
  const budget = await consumeLlmBudget(ROUTE, request);
  if (!budget.allowed) {
    log("warn", "llm_budget_exhausted", { scope: budget.scope });
    throw new ApiError(
      ErrorCode.RATE_LIMITED,
      budget.scope === "anonymous"
        ? "Sign in to keep reading life shift chapters today."
        : "Life shift readings are rate limited for today.",
      { details: { retryAfterSeconds: budget.retryAfterSeconds, scope: budget.scope } },
    );
  }
}

/* "copied": a passage pasted in rather than put in the reading's own words; "cut": it stopped mid-sentence; "missing": not written at all. */
type Failure = Exclude<NoteFailure, "refusal" | "max_tokens"> | "copied" | "cut" | "missing";

type Writing = { depth: LifeShiftDepth; language: string; sex: Reader["sex"] };

/** Whether one chapter's reading can ship, or why not. */
function judge(
  set: ShiftChapterPassages,
  text: string | undefined,
  groups: ReturnType<typeof allGroups>,
  language: string,
  attempt: number,
): { reading: ClassicalReading } | { failure: Failure } {
  if (!text?.trim()) return { failure: "missing" };
  const { reading: marked, strayMarks } = readingFromMarkers(text.trim(), groups);
  const reading = withoutHeadings(marked);
  const id = set.chapter.id;
  if (strayMarks > 0) log("warn", "llm_note_stray_marks", { attempt, id, strayMarks });
  if (set.groups.length > 0 && reading.sources.length === 0) return { failure: "uncited" };
  if (endsMidSentence(reading)) {
    log("warn", "llm_note_cut", { attempt, id, language });
    return { failure: "cut" };
  }
  const check = checkNote(reading, language);
  if (check.problems.length > 0) {
    log("warn", "llm_note_check", { attempt, id, language, problems: check.problems });
    return { failure: "check" };
  }
  const copied = copiedPassages(reading, groups.flatMap((group) => group.passages));
  if (copied.length > 0) {
    log("warn", "llm_note_copied", { attempt, id, language, runs: copied.length });
    return { failure: "copied" };
  }
  return { reading };
}

/** One paid call for some chapters: the readings that can ship, and why the others cannot. */
async function writeReadings(
  anthropic: Anthropic,
  attempt: number,
  sets: readonly ShiftChapterPassages[],
  writing: Writing,
  options?: { timeout: number },
): Promise<{ readings: Map<string, ClassicalReading>; failed: Map<string, Failure> }> {
  const { depth, language, sex } = writing;
  const groups = allGroups(sets);
  const listing = shiftPassageListing(sets);
  const startedAt = Date.now();
  const response = await anthropic.messages.parse(
    {
      model: LIFE_SHIFTS_MODEL,
      output_config: { effort: LIFE_SHIFTS_EFFORT, format: zodOutputFormat(ReadingsSchema) },
      /* Headroom for five short readings and the thinking before them, not a target. */
      max_tokens: 8000,
      system: [{ type: "text", text: LIFE_SHIFTS_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: listing ? `The passages:\n${listing}` : "The books have no passages for these chapters in this chart." },
            { type: "text", text: lifeShiftsInstruction(sets, depth, sex, language) },
          ],
        },
      ],
    },
    options,
  );

  log("info", "llm_usage", {
    model: LIFE_SHIFTS_MODEL,
    attempt,
    depth,
    language,
    shifts: sets.length,
    passages: groups.reduce((sum, group) => sum + group.passages.length, 0),
    elapsedMs: Date.now() - startedAt,
    stopReason: response.stop_reason,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
  });

  if (response.stop_reason === "refusal") {
    throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "The life shift readings were declined.", {
      details: { category: response.stop_details?.category ?? null },
    });
  }
  /* Truncation is a failure, not a short answer: a run that stopped after three readings would parse fine. */
  if (response.stop_reason === "max_tokens") {
    log("warn", "llm_output_truncated", { model: LIFE_SHIFTS_MODEL, depth, outputTokens: response.usage.output_tokens });
    throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "The life shift readings ran past their token ceiling.");
  }

  /* Keyed by id rather than taken in order: a reading printed under the wrong chapter is worse than a missing one. */
  const written = new Map((response.parsed_output?.readings ?? []).map((entry) => [entry.id, entry.reading]));
  const readings = new Map<string, ClassicalReading>();
  const failed = new Map<string, Failure>();
  for (const set of sets) {
    const verdict = judge(set, written.get(set.chapter.id), groups, language, attempt);
    if ("reading" in verdict) readings.set(set.chapter.id, verdict.reading);
    else failed.set(set.chapter.id, verdict.failure);
  }
  return { readings, failed };
}

/**
 * The readings for every chapter of a batch that can have one: one call for
 * the batch, then, while there is time, one more for just the chapters whose
 * reading failed its check or never came. A batch that is still short ships
 * short, maybe empty; the rest keep the engine's words.
 */
async function writeBatch(
  anthropic: Anthropic,
  sets: readonly ShiftChapterPassages[],
  writing: Writing,
  receivedAt: number,
): Promise<LifeShiftReading[]> {
  const first = await writeReadings(anthropic, 1, sets, writing);
  const readings = new Map(first.readings);
  if (first.failed.size > 0) {
    const leftMs = DEADLINE_MS - (Date.now() - receivedAt);
    const retrying = leftMs >= RETRY_MIN_MS;
    log("warn", "llm_note_retry", {
      depth: writing.depth,
      language: writing.language,
      failures: Object.fromEntries(first.failed),
      leftMs,
      retrying,
    });
    if (retrying) {
      const again = sets.filter((set) => first.failed.has(set.chapter.id));
      try {
        const second = await writeReadings(anthropic, 2, again, writing, { timeout: Math.min(REQUEST_TIMEOUT_MS, leftMs) });
        for (const [id, reading] of second.readings) readings.set(id, reading);
        if (second.failed.size > 0) {
          log("warn", "llm_short_set", { depth: writing.depth, asked: sets.length, failures: Object.fromEntries(second.failed) });
        }
      } catch (error) {
        /* The first call's readings still ship. */
        log("warn", "llm_retry_failed", { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  return sets.flatMap(({ chapter }) => {
    const reading = readings.get(chapter.id);
    return reading ? [{ id: chapter.id, reading }] : [];
  });
}

const NOTHING_WRITTEN = "No life shift readings could be written.";

/** The whole set in one call, as JSON: the results page's one chapter, or any set with nothing to split. */
async function write(request: NextRequest, sets: ShiftChapterPassages[], writing: Writing, receivedAt: number) {
  const anthropic = client();
  await spend(request);
  const shipped = await writeBatch(anthropic, sets, writing, receivedAt);
  if (shipped.length === 0) throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, NOTHING_WRITTEN);
  return shipped;
}

/*
 * ── THE CHAPTERS AHEAD, IN A CALL OF THEIR OWN ─────────────────────────────
 *
 * /insights/life-shifts shows the active and the next chapter at the top and
 * folds the past ones away, but asked for all of them in one call it waited
 * 13-15s for the lot. A set holding both is now written as two calls side by
 * side -- the chapters ahead, and the past -- each with its own retry, and,
 * when the client asks for the stream, each batch goes out as it lands. Still
 * one unit of the reader's allowance, spent once before either call, and
 * cached as one set when both are done. The passages are chosen across the
 * whole set first, so the two calls never cite the same verse. They cannot
 * see each other's readings, so the rule against repeating an observation
 * holds within a batch only; chapters ahead and past rarely overlap.
 */

/** The set as batches written side by side, each sent down the stream as it is written; `settle` gets the whole set at the end. */
function streamedResponse(
  setsFor: () => Promise<ShiftChapterPassages[]>,
  batches: string[][],
  writing: Writing,
  receivedAt: number,
  settle: (readings: LifeShiftReading[]) => void,
): Response {
  const anthropic = client();
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      /* A reader who left has cancelled the stream; writing to it then throws, and nothing is owed. */
      const send = (line: LifeShiftStreamLine) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
        } catch {
          /* gone */
        }
      };
      const written: LifeShiftReading[] = [];
      try {
        const sets = await setsFor();
        await Promise.all(
          batches.map(async (ids) => {
            const batch = sets.filter((set) => ids.includes(set.chapter.id));
            try {
              const readings = await writeBatch(anthropic, batch, writing, receivedAt);
              if (readings.length === 0) return;
              written.push(...readings);
              send({ type: "readings", readings });
            } catch (error) {
              /* The other batch may still land. */
              logFailure(error);
            }
          }),
        );
      } catch (error) {
        logFailure(error);
      }
      const order = batches.flat();
      written.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      settle(written);
      send(written.length > 0 ? { type: "done", cached: false } : { type: "error", message: NOTHING_WRITTEN });
      try {
        controller.close();
      } catch {
        /* already cancelled */
      }
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": `${LIFE_SHIFTS_STREAM_TYPE}; charset=utf-8`,
      "Cache-Control": "no-store",
      /* Lines go out as written rather than when a proxy's buffer fills. */
      "X-Accel-Buffering": "no",
    },
  });
}

function logFailure(error: unknown) {
  if (!(error instanceof ApiError)) {
    if (error instanceof Anthropic.BadRequestError) {
      console.error("life-shifts: bad request to Anthropic", error.message);
    } else if (error instanceof Anthropic.AuthenticationError) {
      console.error("life-shifts: ANTHROPIC_API_KEY rejected");
    } else if (error instanceof Anthropic.RateLimitError) {
      console.error("life-shifts: rate limited");
    } else if (error instanceof Anthropic.APIConnectionTimeoutError) {
      console.error("life-shifts: timed out after", REQUEST_TIMEOUT_MS, "ms");
    } else if (error instanceof Anthropic.APIError) {
      console.error("life-shifts: Anthropic error", error.status, error.message);
    } else {
      console.error("life-shifts: unexpected", error);
    }
  }
}

function failure(error: unknown) {
  logFailure(error);
  return errorResponse(error, "The life shift readings could not be prepared.");
}

/** `{ ids, depth, language }` in the body, the birth details in the query. */
export async function POST(request: NextRequest) {
  const receivedAt = Date.now();
  try {
    let body: Record<string, unknown>;
    try {
      body = ((await request.json()) ?? {}) as Record<string, unknown>;
    } catch {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, "Request body must be JSON.");
    }
    const depth = parseDepth(body.depth);
    const ids = parseIds(body.ids);
    const language = languageOf(body.language);
    const reader = readerFrom(request.nextUrl.searchParams, "for the life shift readings");

    const chapters = chaptersFor(reader, ids);
    if (chapters.length === 0) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, "None of those chapters is in this chart.");
    }

    /* Before any passage is fetched, so a cached chart costs neither an embedding nor a query. */
    const key =
      `${language}:${reader.sex ?? "unsaid"}:` +
      createHash("sha1").update(shiftsCanonical(chapters, reader.chart, depth)).digest("hex");
    const cached = cache.get(key);
    if (cached) {
      const hit: LifeShiftReadingResponse = { readings: cached, cached: true };
      return NextResponse.json(hit);
    }

    const setsFor = async () => {
      const sets = chapterPassages(chapters, await candidatesFor(reader, chapters), reader.chart, depth);
      log("info", "shift_retrieval", {
        depth,
        chosen: sets.map(({ chapter, groups }) => ({
          id: chapter.id,
          passages: groups.flatMap((group) => group.passages.map((passage) => `${group.lord}:${passage.id}`)),
        })),
      });
      return sets;
    };
    const writing: Writing = { depth, language, sex: reader.sex };

    /* Two batches down a stream when the client asks for it and the set holds
       both chapters ahead and past; a request arriving while the same set is
       being written waits for it below, as JSON. */
    const batches = shiftBatches(chapters, depth);
    const wantsStream = (request.headers.get("accept") ?? "").includes(LIFE_SHIFTS_STREAM_TYPE);
    if (wantsStream && batches.length > 1 && !inFlight.has(key)) {
      client();
      await spend(request);
      let settle: (readings: LifeShiftReading[]) => void = () => {};
      const settled = new Promise<LifeShiftReading[]>((resolve) => {
        settle = resolve;
      })
        .then((readings) => {
          if (readings.length === 0) throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, NOTHING_WRITTEN);
          remember(key, readings);
          return readings;
        })
        .finally(() => {
          inFlight.delete(key);
        });
      /* Nobody may be waiting on it, and a set that failed must not surface as unhandled. */
      settled.catch(() => {});
      inFlight.set(key, settled);
      return streamedResponse(setsFor, batches, writing, receivedAt, settle);
    }

    let pending = inFlight.get(key);
    if (!pending) {
      client();
      pending = (async () => write(request, await setsFor(), writing, receivedAt))()
        .then((readings) => {
          remember(key, readings);
          return readings;
        })
        .finally(() => {
          inFlight.delete(key);
        });
      inFlight.set(key, pending);
    }
    const written: LifeShiftReadingResponse = { readings: await pending, cached: false };
    return NextResponse.json(written);
  } catch (error) {
    return failure(error);
  }
}
