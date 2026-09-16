import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import { consumeLlmBudget } from "@/lib/llm-budget";
import { stripInlineMarkdown } from "@/lib/prompt-input";
import {
  MAX_LIFE_SHIFTS,
  renderLifeShiftFacts,
  type LifeShiftFacts,
  type LifeShiftReading,
} from "@/lib/life-shift-reading";

/*
 * The written reading for the major life shifts section.
 *
 * What the section already had: lib/engines/major-shifts-engine.ts, which
 * works out *which* chapters matter for a chart -- the mahadasha openings and
 * the Saturn, Jupiter and nodal returns nearest to now -- and then writes each
 * one up from a template. The templates are the problem this route exists for.
 * There are nine planet tones and three return shapes, so two charts whose
 * Saturn returns fall a decade apart get the same three sentences with the age
 * swapped, and a reader who opens both the results page and /insights/life-shifts
 * sees the same paragraph twice.
 *
 * The division of labour is the house one: the engine decides *what is true*
 * -- which chapters, which planets, which dates, which natal placements -- and
 * the model is only allowed to phrase it. Everything in the user turn is a
 * fact the engine computed; nothing in the system prompt invites the model to
 * add a placement, an aspect or a date of its own.
 *
 * Failure is quiet by design. The panel keeps the engine's own narrative for
 * any chapter this route does not return, so no key, a spent budget, a refusal
 * or a timeout all leave the section exactly as complete as it was before this
 * existed -- a little more generic, and never blank.
 */

/*
 * ── EFFORT -- medium, by analogy rather than by measurement ────────────────
 *
 * Not measured here: this worktree has no .env.local, so there is no
 * ANTHROPIC_API_KEY to sweep with and any numbers in this comment would be
 * invented. Saying so is the point -- the file's neighbours carry real
 * per-effort token counts and costs, and a fabricated table next to them would
 * be worse than an empty one.
 *
 * Medium is taken from /api/chart/varga-commentary, which is the same shape of
 * job: a handful of short notes returned together under an output schema.
 * There, medium was the highest setting that fit inside the request timeout,
 * and the schema itself cut output tokens by doing the structuring the model
 * would otherwise spend tokens inventing. This route asks for at most five
 * notes against varga's ten, so it should sit comfortably inside the same
 * envelope.
 *
 * Settle it with the repo's script, which reads the SYSTEM_PROMPT below out of
 * this file so the sweep cannot drift from what ships:
 *
 *     ANTHROPIC_API_KEY=… node scripts/effort-compare.mjs --route life-shifts \
 *       --efforts low,medium,high
 *
 * The question worth asking of the numbers is the one the dasha route asked:
 * not whether the prose is nicer, but whether a cheaper setting drops a fact
 * it was handed. Here that is the window -- a reading that never names the
 * planning window is a reading the card above it already gave.
 */
const EFFORT = "medium" as const;

export const maxDuration = 60;

/*
 * Comfortably inside maxDuration, so a stuck request fails as a timeout this
 * file can log rather than as a platform kill mid-flight.
 */
const REQUEST_TIMEOUT_MS = 40_000;

/*
 * The chapters for a given chart do not change, and the panel mounts on two
 * different pages -- the results page renders the brief variant and
 * /insights/life-shifts the full one. Without this, opening both would bill
 * twice for overlapping chapters. Bounded so a long-lived server cannot grow
 * it without limit.
 */
const MAX_CACHE_ENTRIES = 300;
const cache = new Map<string, LifeShiftReading[]>();

function remember(key: string, value: LifeShiftReading[]) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

/*
 * Frozen, so it is the cacheable prefix. Everything that varies per chart --
 * the chapters -- goes in the user turn, after the breakpoint.
 */
const SYSTEM_PROMPT = `You write the chapter readings for the "major life shifts" section of a Vedic astrology report.

You are given the handful of chapters that matter most for one birth chart, each with the planet that rules it, its standing theme, the age and month it pivots on, the planning window around that pivot, and the evidence the engine used. That is the whole of your evidence.

Return exactly one reading for every chapter you are given -- no more, no fewer -- and set the "id" field on each to that chapter's id exactly as given. The user turn names the count and lists the ids; check your output against that list before you finish.

Rules for each reading:
- Three sentences, 70 words at the outside. No heading, no preamble, no list, no markdown, no chapter label and no date heading -- the card prints the label, the pivot and the window itself.
- Name the planning window or the pivot month once, in words, as part of a sentence. A reading that never touches the timing is a reading the card above it already gave.
- Say what this chapter asks of this reader: what it makes heavier, what it makes possible, what it is a poor time to force. Address the reader as "you".
- Use the natal placement in the evidence where there is one. That is the single most chart-specific fact you have, and a reading that ignores it would read the same for anyone with the same planet.
- State nothing you were not given. No degrees, no aspects, no nakshatras, no other planets, no houses beyond the one in the evidence, and no dates outside the window supplied.
- No predictions of specific events, no health, legal or financial advice, and nothing fatalistic. A chapter describes conditions, not outcomes.

Rules across the set:
- Match the tense to where the chapter sits. "past" is a chapter the reader has already lived -- write it as something to recognise, not to prepare for. "active" is running now. "upcoming" has not started.
- These readings sit on one page and have read each other. Do not repeat an observation, an image or an opening construction across two of them.
- Where two chapters overlap in time or pull against each other, say so in one of them rather than in both.`;

const ReadingsSchema = z.object({
  readings: z.array(
    z.object({
      id: z.string(),
      reading: z.string(),
    }),
  ),
});

const STATUSES = new Set(["past", "active", "upcoming"]);
const MAX_FIELD_LENGTH = 400;

function text(row: Record<string, unknown>, field: string, required = true): string {
  const value = typeof row[field] === "string" ? (row[field] as string).trim() : "";
  if (!value && required) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, `Each shift needs a \`${field}\`.`);
  }
  if (value.length > MAX_FIELD_LENGTH) {
    throw new ApiError(
      ErrorCode.VALIDATION_FAILED,
      `\`${field}\` may be at most ${MAX_FIELD_LENGTH} characters.`,
    );
  }
  return value;
}

function parseShifts(value: unknown): LifeShiftFacts[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, "`shifts` must be a non-empty array.");
  }
  if (value.length > MAX_LIFE_SHIFTS) {
    throw new ApiError(
      ErrorCode.VALIDATION_FAILED,
      `\`shifts\` may hold at most ${MAX_LIFE_SHIFTS} entries.`,
    );
  }

  const seen = new Set<string>();
  return value.map((entry) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    const id = text(row, "id");
    if (seen.has(id)) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, `Duplicate shift id: ${id}.`);
    }
    seen.add(id);

    const status = String(row.status ?? "");
    if (!STATUSES.has(status)) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        "`status` must be one of past, active, upcoming.",
      );
    }

    const ageAtPivot = Number(row.ageAtPivot);
    if (!Number.isFinite(ageAtPivot) || ageAtPivot < 0 || ageAtPivot > 150) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, "`ageAtPivot` must be an age in years.");
    }

    return {
      id,
      label: text(row, "label"),
      planet: text(row, "planet"),
      theme: text(row, "theme"),
      status: status as LifeShiftFacts["status"],
      ageAtPivot: Math.round(ageAtPivot),
      pivot: text(row, "pivot"),
      window: text(row, "window"),
      evidence: text(row, "evidence", false),
    };
  });
}

export async function POST(request: NextRequest) {
  try {
    let body: { shifts?: unknown };
    try {
      body = (await request.json()) as { shifts?: unknown };
    } catch {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, "Request body must be JSON.");
    }

    const facts = parseShifts(body.shifts);

    /* Hashed rather than concatenated: the facts carry free text, and a key
       built by joining them would collide on any value containing the
       separator. */
    const key = createHash("sha256").update(JSON.stringify(facts)).digest("hex");
    const cached = cache.get(key);
    if (cached) {
      return NextResponse.json({ readings: cached, cached: true });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      /* The panel keeps the engine's narrative on any non-OK response, so this
         is a degraded section rather than a broken page. */
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "Life shift readings are unavailable: ANTHROPIC_API_KEY is not configured.",
        { statusCode: 503 },
      );
    }

    /* Past the cache, so this request is about to cost money. The per-minute
       limit in the proxy has already run; this is the daily ceiling, and it is
       checked here precisely because the proxy cannot see that the cache above
       served the last four requests for free. */
    const budget = await consumeLlmBudget("/api/chart/life-shifts", request);
    if (!budget.allowed) {
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        route: "/api/chart/life-shifts",
        event: "llm_budget_exhausted",
        scope: budget.scope,
      }));
      throw new ApiError(
        ErrorCode.RATE_LIMITED,
        budget.scope === "anonymous"
          ? "Sign in to keep reading life shift chapters today."
          : "Life shift readings are rate limited for today.",
        { details: { retryAfterSeconds: budget.retryAfterSeconds, scope: budget.scope } },
      );
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: REQUEST_TIMEOUT_MS,
    });

    /*
     * Structured output rather than prose this file then has to cut apart.
     * Several readings in one response need a boundary, and every boundary
     * invented in a prompt -- a label, a blank line, a delimiter -- is one the
     * model is free to use inside the prose as well. A schema moves that
     * problem to the API, which is where it is actually solved.
     */
    const response = await client.messages.parse({
      model: "claude-opus-5",
      /* Headroom for thinking plus five short paragraphs, not a target. */
      max_tokens: 12000,
      /* thinking is omitted, which on this model runs adaptive by default. */
      output_config: {
        effort: EFFORT,
        format: zodOutputFormat(ReadingsSchema),
      },
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role: "user",
          content:
            `Write exactly ${facts.length} reading${facts.length === 1 ? "" : "s"}, ` +
            `one for each of these chapter ids: ${facts.map((fact) => fact.id).join(", ")}.\n\n` +
            renderLifeShiftFacts(facts),
        },
      ],
    });

    /*
     * One line per uncached call, so the effort question can be settled from
     * logs rather than from arithmetic. Estimating spend from prompt sizes
     * gets the input side roughly right and says nothing about the output
     * side, which is where the money is -- thinking bills at the output rate.
     */
    console.info(JSON.stringify({
      timestamp: new Date().toISOString(),
      route: "/api/chart/life-shifts",
      event: "llm_usage",
      effort: EFFORT,
      shifts: facts.length,
      stopReason: response.stop_reason,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
    }));

    if (response.stop_reason === "refusal") {
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "The life shift readings were declined.",
        { details: { category: response.stop_details?.category ?? null } },
      );
    }

    /*
     * Truncation is a failure, not a short answer. Thinking counts against
     * max_tokens, so a run that reasons past the ceiling returns whatever it
     * had reached -- with a schema that is usually unparseable, but a run that
     * stopped after three readings would parse fine and quietly ship two
     * chapters with nothing new to say.
     */
    if (response.stop_reason === "max_tokens") {
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        route: "/api/chart/life-shifts",
        event: "llm_output_truncated",
        effort: EFFORT,
        outputTokens: response.usage.output_tokens,
      }));
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "The life shift readings ran past their token ceiling.",
      );
    }

    const parsed = response.parsed_output;
    if (!parsed) {
      throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "No life shift readings were returned.");
    }

    /* Keyed by id rather than taken in order: the schema does not promise the
       array came back in the order it was asked for, and a reading printed
       under the wrong chapter is worse than a missing one. */
    const byId = new Map<string, string>();
    const requested = new Set(facts.map((fact) => fact.id));
    for (const entry of parsed.readings) {
      const reading = stripInlineMarkdown(entry.reading).trim();
      if (reading && requested.has(entry.id)) byId.set(entry.id, reading);
    }

    const readings: LifeShiftReading[] = facts
      .map((fact) => ({ id: fact.id, reading: byId.get(fact.id) ?? "" }))
      .filter((entry) => entry.reading.length > 0);

    if (readings.length === 0) {
      throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "No life shift readings were returned.");
    }

    /*
     * A short set is the failure mode this shape of route actually has.
     *
     * /api/chart/varga-commentary asked for ten notes and got nine with
     * `end_turn` -- not truncated, the model simply wrote one fewer, and that
     * varga shipped with no note. Nothing upstream catches it: a schema cannot
     * require one entry per requested id, and nine well-formed notes parse as
     * cleanly as ten. Logged rather than thrown, because here the chapters
     * that did come back are worth showing and the rest keep the engine's own
     * narrative -- but a set that is short every time is a prompt problem, and
     * it should be visible in the logs before it is visible on the page.
     */
    if (readings.length < facts.length) {
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        route: "/api/chart/life-shifts",
        event: "llm_short_set",
        effort: EFFORT,
        asked: facts.length,
        returned: readings.length,
        missing: facts.filter((fact) => !byId.has(fact.id)).map((fact) => fact.id),
        stopReason: response.stop_reason,
      }));
    }

    remember(key, readings);
    return NextResponse.json({ readings, cached: false });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      /* Most specific first: a 400 from us is a bug, a 429 is worth retrying,
         a connection error is the network. Collapsing them into one branch
         loses the distinction the caller needs. */
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
    return errorResponse(error, "The life shift readings could not be prepared.");
  }
}
