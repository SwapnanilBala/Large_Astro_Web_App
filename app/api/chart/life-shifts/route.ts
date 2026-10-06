import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import {
  chartParamsToBirthInput,
  getChartPayload,
  hasAllChartParams,
  readChartParams,
  type ChartParams,
} from "@/lib/chart-params";
import { computeMajorLifeShifts } from "@/lib/engines/major-shifts-engine";
import { consumeLlmBudget } from "@/lib/llm-budget";
import { stripInlineMarkdown } from "@/lib/prompt-input";
import { lifeShiftCacheKey } from "@/lib/life-shift-reading-server";
import {
  MAX_LIFE_SHIFTS,
  buildLifeShiftFacts,
  lifeShiftId,
  renderLifeShiftFacts,
  type LifeShiftDepth,
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
 * ── REBUILT HERE, NOT TAKEN FROM THE BROWSER ───────────────────────────────
 *
 * The route takes the birth details in the query, as the life-areas notes
 * do, and the ids of the chapters the panel draws in the body -- nothing
 * else. It rebuilds the chart and the chapters itself and writes the facts
 * from them. Until 2026-10-06 the browser sent the facts, seven free-text
 * fields a chapter, and anything typed into them went to the model: a free
 * general-purpose model for whoever asked. An id is now only a key to look
 * a chapter up by, and one this chart does not have is dropped.
 *
 * Failure is quiet by design. The panel keeps the engine's own narrative for
 * any chapter this route does not return, so no key, a spent budget, a refusal
 * or a timeout all leave the section exactly as complete as it was before this
 * existed -- a little more generic, and never blank.
 */

/*
 * ── MODEL -- Claude Haiku 4.5, since 2026-10-06 ──────────────────────────
 *
 * Every route but palm reading moved to Haiku 4.5 that day, by the owner's
 * call, to hold the bill down further: $1/$5 per million tokens against Opus
 * 5.5's $4/$20. Haiku takes no effort setting -- `output_config.effort` is a
 * 400 on it -- and with `thinking` omitted it does not reason first. The sweep
 * below found the length instruction doing the work rather than the effort
 * dial, and that instruction is the part that carries over to a model without
 * one. Re-measure from the llm_usage lines once the account's monthly limit
 * allows. The history, from when this was an effort question:
 *
 * ── EFFORT -- low on Opus 5.5, the same at both lengths ──────────────────
 *
 * Low since 2026-10-04, when every chart route moved to Claude Opus 5.5 at
 * low effort by the owner's call, to hold costs down. The sweep below, on
 * Opus 5, had already found low within noise of medium on cost, time and
 * every fact it was handed; it stayed at medium only to match its siblings,
 * and they have all come down too. Re-measure once the account's monthly
 * limit allows. The history:
 *
 * This started as two dials -- high for the single headline reading, medium
 * for the row of five -- on the reasoning that one chapter is cheap enough to
 * lavish effort on. Measurement said no, so there is one dial again.
 *
 * The sweep, both shapes, no output schema
 * (scripts/effort-compare.mjs --route life-shifts --efforts low,medium,high):
 *
 *     one chapter, headline     low  7.8s  351 out  $0.0144
 *                               med  7.8s  407 out  $0.0158
 *                               high 12.5s 627 out  $0.0213
 *     five chapters, compact    low  13.1s 778 out  $0.0285
 *                               med  14.6s 801 out  $0.0291
 *                               high 20.5s 1206 out $0.0392
 *
 * And the headline shape again through the shipped path, schema included,
 * which is what the numbers above do not cover:
 *
 *     low   9.8s  397 out  $0.0110  195 words  ~7 sentences
 *     med   8.5s  381 out  $0.0106  197 words  ~7 sentences
 *     high  9.0s  462 out  $0.0126  197 words  ~7 sentences
 *
 * Two things in there settled it. Latency is flat across the dial on a
 * single chapter -- 8.5s to 9.8s, with high not the slowest -- so the timeout
 * argument that would have justified caution, and the one that would have
 * justified spending, both evaporate. And the discriminator the dasha route
 * used, whether a cheaper setting drops a fact it was handed, finds nothing
 * here: every level named the window, named Venus in Aquarius in the tenth,
 * and covered what the chapter asks, eases, hardens and is a poor time to
 * force. There was no fact left on the floor at low, so there was nothing for
 * high to buy, and it wanted about 19% more to not buy it.
 *
 * The corollary is the useful part: the length instruction is doing the work,
 * not the effort dial. The same chapter at the same effort came back at 197
 * words for "headline" and 79 for "compact". If a future reading feels thin,
 * the lever is the LENGTH block in the system prompt below, not this constant.
 *
 * Medium over low is a narrower call than usual, since low was within noise on
 * both cost and time. It stays at medium to match the other chart routes
 * rather than on evidence from this sweep; low is a defensible saving if the
 * route total ever comes under pressure.
 */
const MODEL = "claude-haiku-4-5";

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

The user turn also names a length, and it is the one rule here you must not round off:

LENGTH "headline" -- six to eight sentences, 190 words at the outside. This is the single chapter on the reader's results page and the only reading most of them will ever see from this section, so it is the long form. The extra room is for substance and not for adjectives or throat-clearing. Use it to cover, in whatever order reads best: what this chapter asks of the reader in practice; what it makes easier and what it makes harder; what it is a poor time to force; and how the natal placement in the evidence colours all of that for this chart specifically. A longer reading that says the same thing three ways is worse than a short one.

LENGTH "compact" -- three sentences, 70 words at the outside. This chapter sits in a row with several others, and five long readings is a wall rather than a page.

Rules for each reading, at either length:
- No heading, no preamble, no list, no markdown, no chapter label and no date heading -- the card prints the label, the pivot and the window itself.
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

/* Longer than any id the engine writes ("jupiter-return-" and an ISO instant
   is 39), and only ever used to look a chapter up. */
const MAX_ID_LENGTH = 64;

function parseDepth(value: unknown): LifeShiftDepth {
  /* Defaulted rather than required, so a caller written before this split
     keeps working and gets the shape the section had then. */
  if (value === undefined || value === null) return "compact";
  if (value !== "headline" && value !== "compact") {
    throw new ApiError(
      ErrorCode.VALIDATION_FAILED,
      "`depth` must be either headline or compact.",
    );
  }
  return value;
}

function parseIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, "`ids` must be a non-empty array.");
  }
  if (value.length > MAX_LIFE_SHIFTS) {
    throw new ApiError(
      ErrorCode.VALIDATION_FAILED,
      `\`ids\` may hold at most ${MAX_LIFE_SHIFTS} entries.`,
    );
  }
  const ids = value.map((id) => (typeof id === "string" ? id : ""));
  if (ids.some((id) => id.length === 0 || id.length > MAX_ID_LENGTH)) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, "Each of `ids` must be a chapter id.");
  }
  return [...new Set(ids)];
}

/**
 * The facts for the chapters asked for, in the order asked, from the chart
 * this route built: an id the chart has no chapter for is dropped.
 */
function chapterFacts(chartParams: ChartParams, ids: string[]): LifeShiftFacts[] {
  const byId = new Map(
    computeMajorLifeShifts(getChartPayload(chartParams)).map((shift) => [lifeShiftId(shift), shift]),
  );
  const shifts = ids.flatMap((id) => {
    const shift = byId.get(id);
    return shift ? [shift] : [];
  });
  return buildLifeShiftFacts(shifts);
}

export async function POST(request: NextRequest) {
  try {
    const chartParams = readChartParams(Object.fromEntries(request.nextUrl.searchParams.entries()));
    if (!hasAllChartParams(chartParams)) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, "Complete birth details are required for the life shift readings.");
    }
    try {
      chartParamsToBirthInput(chartParams);
    } catch (error) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, error instanceof Error ? error.message : "Invalid birth details.");
    }

    let body: { ids?: unknown; depth?: unknown };
    try {
      body = (await request.json()) as { ids?: unknown; depth?: unknown };
    } catch {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, "Request body must be JSON.");
    }

    const depth = parseDepth(body.depth);
    const facts = chapterFacts(chartParams, parseIds(body.ids));
    if (facts.length === 0) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, "None of those chapters is in this chart.");
    }

    /* Depth included; see lifeShiftCacheKey for why that matters. */
    const key = lifeShiftCacheKey(depth, facts);
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
      model: MODEL,
      /* Headroom for five short paragraphs, not a target. */
      max_tokens: 12000,
      /* No `thinking` and no effort; see the note on MODEL above. */
      output_config: {
        format: zodOutputFormat(ReadingsSchema),
      },
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role: "user",
          content:
            `Write exactly ${facts.length} reading${facts.length === 1 ? "" : "s"} at ` +
            `LENGTH "${depth}", one for each of these chapter ids: ` +
            `${facts.map((fact) => fact.id).join(", ")}.\n\n` +
            renderLifeShiftFacts(facts),
        },
      ],
    });

    /*
     * One line per uncached call, with the model on it, so the model question
     * can be settled from logs rather than from arithmetic. Estimating spend
     * from prompt sizes gets the input side roughly right and says nothing
     * about the output side.
     */
    console.info(JSON.stringify({
      timestamp: new Date().toISOString(),
      route: "/api/chart/life-shifts",
      event: "llm_usage",
      model: MODEL,
      depth,
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
     * Truncation is a failure, not a short answer. A run that reaches the
     * ceiling returns whatever it had reached -- with a schema that is usually
     * unparseable, but a run that stopped after three readings would parse
     * fine and quietly ship two chapters with nothing new to say.
     */
    if (response.stop_reason === "max_tokens") {
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        route: "/api/chart/life-shifts",
        event: "llm_output_truncated",
        model: MODEL,
        depth,
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
        model: MODEL,
        depth,
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
