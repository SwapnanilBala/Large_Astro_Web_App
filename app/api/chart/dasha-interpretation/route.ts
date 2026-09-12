import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import { consumeLlmBudget } from "@/lib/llm-budget";
import { stripInlineMarkdown } from "@/lib/prompt-input";

/*
 * Interpretation for one Vimshottari lord chain.
 *
 * Why this route exists: the panel's DASHA_COMBO_EFFECTS map holds 81 strings,
 * which is complete for maha -> antar (9 x 9) and nothing else. The drill-down
 * goes five levels, and the lookup key is `${mahaLord}-${deepestLord}` -- the
 * middle lords are discarded -- so Sun -> Saturn -> Moon -> Venus renders the
 * same sentence as its Sun -> Saturn parent. Levels 3, 4 and 5 are 729, 6,561
 * and 59,049 real chains; that is not a content project.
 *
 * So the deterministic map keeps the two-lord case it already covers well, and
 * this route is asked only for the chains it cannot: three lords and deeper.
 * The engine decides *what is true* -- which lords, in which order, over which
 * window -- and the model is only allowed to phrase it.
 *
 * Provider note: this route is Anthropic. /api/palm-reading is OpenAI and stays
 * that way; the two read different environment variables and neither falls back
 * to the other, so a missing key degrades one feature rather than both.
 */

export const maxDuration = 30;

const REQUEST_TIMEOUT_MS = 20_000;

/* The panel is a client component; a chain is stable for a given birth chart,
   so one process-lifetime map saves the repeat calls that drilling in and back
   out again would otherwise make. Bounded so a long-lived server cannot grow
   it without limit. */
const MAX_CACHE_ENTRIES = 500;
const cache = new Map<string, string>();

function remember(key: string, value: string) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

const LEVEL_LABELS: Record<number, string> = {
  1: "Maha Dasha",
  2: "Antardasha",
  3: "Pratyantardasha",
  4: "Sookshma Dasha",
  5: "Prana Dasha",
};

const LORDS = new Set([
  "Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu",
]);

/*
 * Frozen, so it is the cacheable prefix. Everything that varies per request --
 * the lords, the dates -- goes in the user turn, after the breakpoint.
 */
const SYSTEM_PROMPT = `You write one short interpretation of a Vimshottari dasha chain for a Vedic astrology report.

The chain is given outermost-first: the first lord is the Maha Dasha, the next its Antardasha, and so on inward. The last lord is the period actually running. Each lord conditions the one after it, so the reading is the outer periods setting terms that the innermost one plays out.

Rules:
- 2 to 3 sentences. No heading, no preamble, no list, no markdown.
- Every lord in the chain must do some work in the sentence. If you cannot say something specific about the middle lords, say how they qualify the innermost one rather than dropping them.
- Write about the texture of the period -- what it asks for, what it makes easier or harder. Address the reader as "you".
- State nothing you were not given. No degrees, no houses, no signs, no aspects, no other planets, no dates beyond the window supplied.
- No predictions of specific events, no health, legal, or financial advice, and nothing fatalistic. A dasha describes conditions, not outcomes.
- Plain prose. Do not use the Sanskrit level names unless the chain is only two lords deep.`;

type Body = {
  lords?: unknown;
  startDate?: unknown;
  endDate?: unknown;
};

function parseLords(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, "`lords` must be an array of planet names.");
  }
  if (value.length < 3 || value.length > 5) {
    /* Two lords are already covered by the deterministic map, so the panel
       should not be asking; refusing here keeps that contract visible. */
    throw new ApiError(
      ErrorCode.VALIDATION_FAILED,
      "`lords` must hold 3 to 5 entries -- shallower chains are served from the built-in map.",
    );
  }
  const lords = value.map((entry) => String(entry));
  const unknown = lords.filter((lord) => !LORDS.has(lord));
  if (unknown.length > 0) {
    throw new ApiError(
      ErrorCode.VALIDATION_FAILED,
      `Not Vimshottari lords: ${unknown.join(", ")}.`,
    );
  }
  return lords;
}

function parseDate(value: unknown, field: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, `\`${field}\` must be an ISO date (YYYY-MM-DD).`);
  }
  return text;
}

export async function POST(request: NextRequest) {
  try {
    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, "Request body must be JSON.");
    }

    const lords = parseLords(body.lords);
    const startDate = parseDate(body.startDate, "startDate");
    const endDate = parseDate(body.endDate, "endDate");

    const key = `${lords.join(">")}|${startDate}|${endDate}`;
    const cached = cache.get(key);
    if (cached) {
      return NextResponse.json({ interpretation: cached, cached: true });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      /* The panel falls back to its deterministic sentence on any non-OK
         response, so this is a degraded feature rather than a broken page. */
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "Dasha interpretation is unavailable: ANTHROPIC_API_KEY is not configured.",
        { statusCode: 503 },
      );
    }

    /* Past the cache, so this request is about to cost money. The per-minute
       limit in the proxy has already run; this is the daily ceiling, and it is
       checked here rather than in the proxy precisely because the proxy cannot
       see that the cache above served the last four requests for free. */
    const budget = await consumeLlmBudget("/api/chart/dasha-interpretation", request);
    if (!budget.allowed) {
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        route: "/api/chart/dasha-interpretation",
        event: "llm_budget_exhausted",
        scope: budget.scope,
      }));
      throw new ApiError(
        ErrorCode.RATE_LIMITED,
        budget.scope === "anonymous"
          ? "Sign in to keep reading dasha interpretations today."
          : "Dasha interpretations are rate limited for today.",
        { details: { retryAfterSeconds: budget.retryAfterSeconds, scope: budget.scope } },
      );
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: REQUEST_TIMEOUT_MS,
    });

    const chain = lords
      .map((lord, index) => `${LEVEL_LABELS[index + 1] ?? `level ${index + 1}`}: ${lord}`)
      .join("\n");

    const response = await client.messages.create({
      model: "claude-opus-5",
      /* Deliberately short output: 2-3 sentences. */
      max_tokens: 1000,
      /* Low effort suits a short phrasing job and keeps the panel responsive;
         thinking is omitted, which on this model runs adaptive by default. */
      output_config: { effort: "low" },
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role: "user",
          content: `${chain}\n\nThe ${lords[lords.length - 1]} period runs ${startDate} to ${endDate}.`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "The interpretation was declined.",
        { details: { category: response.stop_details?.category ?? null } },
      );
    }

    const interpretation = stripInlineMarkdown(
      response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join(""),
    ).trim();


    if (!interpretation) {
      throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "No interpretation was returned.");
    }

    remember(key, interpretation);
    return NextResponse.json({ interpretation, cached: false });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      /* Most specific first: a 400 from us is a bug, a 429 is worth retrying,
         a connection error is the network. Collapsing them into one branch
         loses the distinction the caller needs. */
      if (error instanceof Anthropic.BadRequestError) {
        console.error("dasha-interpretation: bad request to Anthropic", error.message);
      } else if (error instanceof Anthropic.AuthenticationError) {
        console.error("dasha-interpretation: ANTHROPIC_API_KEY rejected");
      } else if (error instanceof Anthropic.RateLimitError) {
        console.error("dasha-interpretation: rate limited");
      } else if (error instanceof Anthropic.APIConnectionTimeoutError) {
        console.error("dasha-interpretation: timed out after", REQUEST_TIMEOUT_MS, "ms");
      } else if (error instanceof Anthropic.APIError) {
        console.error("dasha-interpretation: Anthropic error", error.status, error.message);
      } else {
        console.error("dasha-interpretation: unexpected", error);
      }
    }
    return errorResponse(error, "The dasha interpretation could not be prepared.");
  }
}
