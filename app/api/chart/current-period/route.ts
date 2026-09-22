import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import { consumeLlmBudget } from "@/lib/llm-budget";
import { stripInlineMarkdown } from "@/lib/prompt-input";
import {
  CURRENT_PERIOD_LEVELS,
  LORD_SET,
  MAX_CURRENT_PERIOD_STEPS,
  MIN_CURRENT_PERIOD_STEPS,
  NAKSHATRA_SET,
  SIGN_SET,
  currentPeriodCacheKey,
  renderCurrentPeriodFacts,
  type CurrentPeriodFacts,
  type CurrentPeriodStep,
} from "@/lib/current-period-reading";

/*
 * The "what this means for you" reading on the current-period card.
 *
 * That card carried a template until now: theme names for the two lords, glued
 * into a fixed sentence with their first three keywords after it. It is the
 * headline of the Vedic timing section and it read like a lookup, because it
 * was one -- the same sentence for every reader whose maha and antar lords
 * happened to match, regardless of where those lords sit in their chart.
 *
 * What this route has that the template could not use: each lord's natal sign
 * and house, the birth nakshatra the Vimshottari sequence is counted from, and
 * the pratyantardasha when the chart supplies one. That is what makes one
 * reader's Saturn-Mercury different from another's, and it is three-quarters of
 * the input here.
 *
 * Not a shorter chain through /api/chart/dasha-interpretation: that route takes
 * lords and dates only, and refuses two-lord chains because the panel's
 * built-in map already covers them well. See lib/current-period-reading.ts for
 * the longer version of why these stayed two routes.
 *
 * Provider note: Anthropic, like every LLM route here. A missing
 * ANTHROPIC_API_KEY takes this route with it, and the card falls back to the
 * template sentence it used to show -- a degraded card, not a broken page.
 */

/*
 * EFFORT -- medium, measured rather than assumed.
 *
 * Swept with `scripts/effort-compare.mjs --route current-period` over the three
 * shapes the card produces: two lords with placements, three lords with
 * placements, and three lords from a chart that carried no positions. Averaged
 * per call, on Opus 5:
 *
 *     low     245 output tokens    6.0s   $0.0100
 *     medium  302 output tokens    6.1s   $0.0115
 *     high    431 output tokens    7.2s   $0.0147
 *
 * The shallow curve the sibling dasha route found holds here too: medium is
 * 1.1x low, not the multiple that reasoning about thinking budgets predicts.
 *
 * WHAT THE SWEEP CHANGED ABOUT THE PROMPT, which matters more than the dial.
 * The first version asked for "3 to 4 sentences" and got four sentences of
 * forty words each -- about 200 words, roughly 500 output tokens, $0.0150 to
 * $0.0193 a call. Every reading was good and none of them fit the card, which
 * sits in a two-column grid under a progress bar. Naming a word ceiling as well
 * as a sentence count took output to the numbers above and cost a third of the
 * spend. A sentence count alone does not bound length.
 *
 * WHAT THE DIAL BUYS, and it is less than expected. All three levels use the
 * natal placements, which was the thing worth checking -- they are the input
 * this route has that the template it replaces did not, and a reading that
 * skipped them would be an expensive way of printing the old sentence. So the
 * difference is narrower: medium reaches for the birth nakshatra where low
 * mostly does not, and reads more evenly -- low closed one reading on "let it
 * stay unfinished", which is advice rather than description. That is 0.15 of a
 * cent, and at this route's ceiling the whole gap is about $2 of exposure a day.
 *
 * High is 1.5x low and is not the top of a trend, it is variance: one case
 * spent 789 output tokens and 11.6s to produce the *shortest* reading in the
 * sweep, all of it thinking. Same reading, dearer and slower.
 *
 * `max_tokens` is 8000 for the reason its sibling's is: thinking counts against
 * it, nothing measured comes near it, and headroom is free because billing is
 * per token generated.
 */
const EFFORT = "medium" as const;

export const maxDuration = 30;

const REQUEST_TIMEOUT_MS = 20_000;

/*
 * One reading per stack per process lifetime.
 *
 * This is a mount-time call on the most visited surface in the app, so the
 * cache is doing more work than the drill-down's: every visitor who opens the
 * timing section asks for it, and a reader who navigates away and back asks
 * twice. Keyed on the stack, the nakshatra and the progress *band* -- see
 * lib/current-period-reading.ts for why a band and not the live percentage.
 *
 * Bounded, so a long-lived server cannot grow it without limit.
 */
const MAX_CACHE_ENTRIES = 500;
const cache = new Map<string, string>();

function remember(key: string, value: string) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

/*
 * Frozen, so it is the cacheable prefix. Everything that varies per request --
 * the lords, their placements, the dates, the phase -- goes in the user turn,
 * after the breakpoint.
 */
const SYSTEM_PROMPT = `You write the "what this means for you" paragraph on the current-period card of a Vedic astrology report.

You are given the Vimshottari dasha stack the reader is living in right now, outermost first: the Maha Dasha, its Antardasha, and the Pratyantardasha when the chart supplies one. Each lord conditions the one after it -- the outer periods set the terms the innermost one plays out -- so this is one reading about how they combine, not two or three readings stacked up.

You are also given where each of those lords sits in the reader's birth chart, and the nakshatra the whole sequence is counted from. Use the placements. They are what makes this reader's Saturn period different from every other reader's Saturn period, and a reading that names only the lords could have been written without seeing the chart.

Rules:
- Exactly 3 sentences, one paragraph, no more than 80 words in total. This is a card in a report, not an essay; a long sentence is not a way around the count.
- Every lord in the stack must do some work. Say what the Maha Dasha asks for across its long span, then what the inner period is doing with that now.
- Work each lord's sign and house into what you say about it, rather than listing the placement and then ignoring it.
- Say where in the period the reader stands using the phrasing you are given for it. Do not convert it to a percentage, a number of days, or a date.
- Write about the texture of the period: what it asks for, what it makes easier or harder. Address the reader as "you".
- State nothing you were not given. No degrees, no aspects, no yogas, no transits, no other planets, and no signs or houses beyond the ones supplied.
- No predictions of specific events, no health, legal, or financial advice, and nothing fatalistic. A dasha describes conditions, not outcomes.
- Plain prose. You may name the levels Maha Dasha and Antardasha, because the card printed beside this paragraph names them too.`;

type Body = {
  stack?: unknown;
  nakshatra?: unknown;
  progressPercent?: unknown;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseStack(value: unknown): CurrentPeriodStep[] {
  if (!Array.isArray(value)) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, "`stack` must be an array of periods.");
  }
  if (value.length < MIN_CURRENT_PERIOD_STEPS || value.length > MAX_CURRENT_PERIOD_STEPS) {
    throw new ApiError(
      ErrorCode.VALIDATION_FAILED,
      `\`stack\` must hold ${MIN_CURRENT_PERIOD_STEPS} to ${MAX_CURRENT_PERIOD_STEPS} periods, outermost first.`,
    );
  }

  return value.map((entry, index) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    const level = CURRENT_PERIOD_LEVELS[index];

    const lord = String(row.lord ?? "");
    if (!LORD_SET.has(lord)) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, `\`${level}\` is not a Vimshottari lord: ${lord}.`);
    }

    const startDate = String(row.startDate ?? "");
    const endDate = String(row.endDate ?? "");
    if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        `\`${level}\` needs ISO dates (YYYY-MM-DD) for startDate and endDate.`,
      );
    }

    /* Placement is optional -- a chart can reach the panel without positions --
       but half of one is not, because the prompt renders both or neither. */
    const sign = row.sign === undefined ? undefined : String(row.sign);
    const house = row.house === undefined ? undefined : Number(row.house);
    if (sign !== undefined && !SIGN_SET.has(sign)) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, `\`${level}\` has an unknown sign: ${sign}.`);
    }
    if (house !== undefined && (!Number.isInteger(house) || house < 1 || house > 12)) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, `\`${level}\` has a house outside 1-12.`);
    }

    return {
      lord,
      startDate,
      endDate,
      ...(sign !== undefined && house !== undefined ? { sign, house } : {}),
    };
  });
}

function parseNakshatra(value: unknown): CurrentPeriodFacts["nakshatra"] {
  const row = (value ?? {}) as Record<string, unknown>;

  const name = String(row.name ?? "");
  if (!NAKSHATRA_SET.has(name)) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, `Unknown nakshatra: ${name}.`);
  }

  const lord = String(row.lord ?? "");
  if (!LORD_SET.has(lord)) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, `\`nakshatra.lord\` is not a Vimshottari lord.`);
  }

  const pada = Number(row.pada);
  if (!Number.isInteger(pada) || pada < 1 || pada > 4) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, "`nakshatra.pada` must be 1 to 4.");
  }

  return { name, lord, pada };
}

function parseProgress(value: unknown): number {
  const percent = Number(value);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, "`progressPercent` must be 0 to 100.");
  }
  return percent;
}

export async function POST(request: NextRequest) {
  try {
    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, "Request body must be JSON.");
    }

    const facts: CurrentPeriodFacts = {
      stack: parseStack(body.stack),
      nakshatra: parseNakshatra(body.nakshatra),
      progressPercent: parseProgress(body.progressPercent),
    };

    const key = currentPeriodCacheKey(facts);
    const cached = cache.get(key);
    if (cached) {
      return NextResponse.json({ reading: cached, cached: true });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      /* The card falls back to its template sentence on any non-OK response,
         so this is a degraded feature rather than a broken page. */
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "The current-period reading is unavailable: ANTHROPIC_API_KEY is not configured.",
        { statusCode: 503 },
      );
    }

    /* Past the cache, so this request is about to cost money. The per-minute
       limit in the proxy has already run; this is the daily ceiling, checked
       here rather than in the proxy because the proxy cannot see that the
       cache above served the last four callers for free. */
    const budget = await consumeLlmBudget("/api/chart/current-period", request);
    if (!budget.allowed) {
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        route: "/api/chart/current-period",
        event: "llm_budget_exhausted",
        scope: budget.scope,
      }));
      throw new ApiError(
        ErrorCode.RATE_LIMITED,
        budget.scope === "anonymous"
          ? "Sign in to keep reading current-period interpretations today."
          : "Current-period readings are rate limited for today.",
        { details: { retryAfterSeconds: budget.retryAfterSeconds, scope: budget.scope } },
      );
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: REQUEST_TIMEOUT_MS,
    });

    const response = await client.messages.create({
      model: "claude-opus-5",
      /* Headroom for thinking, not a target; see the note on EFFORT above. */
      max_tokens: 8000,
      /* thinking is omitted, which on this model runs adaptive by default. */
      output_config: { effort: EFFORT },
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: renderCurrentPeriodFacts(facts) }],
    });

    /*
     * One line per uncached call, which is what the effort note above is
     * measured on. Estimating spend from prompt sizes gets the input side
     * roughly right and says nothing about the output side, where the money is.
     */
    console.info(JSON.stringify({
      timestamp: new Date().toISOString(),
      route: "/api/chart/current-period",
      event: "llm_usage",
      effort: EFFORT,
      depth: facts.stack.length,
      placements: facts.stack.filter((step) => step.sign).length,
      stopReason: response.stop_reason,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
    }));

    if (response.stop_reason === "refusal") {
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "The current-period reading was declined.",
        { details: { category: response.stop_details?.category ?? null } },
      );
    }

    /*
     * Truncation is a failure, not a short reading. Thinking counts against
     * `max_tokens`, so a run that reasons past the ceiling returns whatever
     * prose it had reached -- a sentence ending mid-clause, which would
     * otherwise be cached and shown as if it were the reading.
     */
    if (response.stop_reason === "max_tokens") {
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        route: "/api/chart/current-period",
        event: "llm_output_truncated",
        effort: EFFORT,
        outputTokens: response.usage.output_tokens,
      }));
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "The current-period reading ran past its token ceiling.",
      );
    }

    const reading = stripInlineMarkdown(
      response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join(""),
    ).trim();

    if (!reading) {
      throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "No current-period reading was returned.");
    }

    remember(key, reading);
    return NextResponse.json({ reading, cached: false });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      /* Most specific first: a 400 from us is a bug, a 429 is worth retrying,
         a connection error is the network. */
      if (error instanceof Anthropic.BadRequestError) {
        console.error("current-period: bad request to Anthropic", error.message);
      } else if (error instanceof Anthropic.AuthenticationError) {
        console.error("current-period: ANTHROPIC_API_KEY rejected");
      } else if (error instanceof Anthropic.RateLimitError) {
        console.error("current-period: rate limited");
      } else if (error instanceof Anthropic.APIConnectionTimeoutError) {
        console.error("current-period: timed out after", REQUEST_TIMEOUT_MS, "ms");
      } else if (error instanceof Anthropic.APIError) {
        console.error("current-period: Anthropic error", error.status, error.message);
      } else {
        console.error("current-period: unexpected", error);
      }
    }
    return errorResponse(error, "The current-period reading could not be prepared.");
  }
}
