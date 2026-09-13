import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import { consumeLlmBudget } from "@/lib/llm-budget";
import { sessionFromRequest } from "@/lib/identity/require-session";
import { stripInlineMarkdown } from "@/lib/prompt-input";
import {
  chartParamsToBirthInput,
  getChartPayload,
  hasAllChartParams,
  readChartParams,
} from "@/lib/chart-params";
import { makeCacheKey } from "@/lib/server-cache";
import {
  buildAdvancedDigest,
  type AdvancedModuleKey,
} from "@/lib/engines/advanced-digest";

/*
 * The advanced page, told as a story instead of shown as a readout.
 *
 * Why: that page renders about eighteen thousand characters and two hundred
 * numbers across six modules. The aspect panel alone is eighteen cards of
 * "Rahu opposition Ketu, 0.00 degrees, applying", each captioned with the same
 * sentence every other aspect of that type gets. All of it is true and none of
 * it says what the chart is like. A layman reads it as a wall of notation.
 *
 * So the engine keeps deciding what is true and the model is only allowed to
 * phrase it -- the same contract as /api/chart/domain-brief and
 * /api/chart/dasha-interpretation. The panels are unchanged underneath; they
 * move behind a disclosure and the passage stands in front.
 *
 * ONE call, not one per module, and this is a constraint rather than a
 * preference: there are eight modules against a per-account daily allowance in
 * the low tens (lib/llm-budget-tiers.ts), so a per-module call would spend over
 * half a signed-in visitor's day on one page view. Writing the passages
 * together is also the better shape -- they are one reading of one chart, so
 * the timing passage can lean on what the strength passage established, which
 * eight independent calls cannot do.
 *
 * Signed in only. The page in front shows a gate; this route enforces it.
 *
 * Abuse note: as with its siblings, the only caller input is birth parameters.
 * The digest is rebuilt server-side from getChartPayload, so no string from the
 * query reaches the model.
 */

export const maxDuration = 60;

const REQUEST_TIMEOUT_MS = 45_000;
const CACHE_HEADER = "private, max-age=3600, stale-while-revalidate=1800";

/* Bump when the prompt or the digest changes, so a revision is not hidden
   behind cache entries written by the previous wording. */
const ADVANCED_STORY_PROMPT_VERSION = "1";

const MAX_CACHE_ENTRIES = 300;
const cache = new Map<string, AdvancedStoryResponse>();

function remember(key: string, value: AdvancedStoryResponse) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

export type AdvancedStoryResponse = {
  opening: string;
  passages: Partial<Record<AdvancedModuleKey, string>>;
  cached: boolean;
};

const MODULE_BRIEFS: Record<AdvancedModuleKey, string> = {
  timing: "the birth nakshatra and the period currently running",
  aspects: "how the planets are talking to each other",
  navamsa: "what the ninth-harmonic chart adds or takes away",
  divisional: "why the chart is cut into smaller charts at all",
  strength: "which planets can actually deliver, and the yogas that formed",
  transits: "what the sky is doing against the birth chart right now",
  ashtakavarga: "which parts of the zodiac this chart actually supports",
};

/*
 * Frozen, so it is the cacheable prefix. The chart's own digest varies per
 * request and goes in the user turn, after the breakpoint.
 */
const SYSTEM_PROMPT = `You write the connective prose for the advanced page of a Vedic astrology report.

The reader is a layman. The page behind your text is dense: aspect orbs, shadbala ratios, divisional charts, dasha dates. They can open any of it, and most of them never will. Your passages are what they read instead.

You are given a digest of what the engine found. Write an opening and one passage per module named in the request.

Rules:
- The opening is 2 to 3 sentences and says what kind of chart this is overall. It is the only place allowed to generalise.
- Each passage is 2 to 3 sentences about its own module, and must say something this chart specifically shows. A sentence that would be true of any chart is wasted.
- Write them as one reading. Later passages may refer back to what an earlier one established.
- Address the reader as "you". Plain prose, warm, no markdown, no headings, no lists.
- You may name planets, signs, nakshatras and periods, because the page shows them. Do not invent degrees, dates or numbers that are not in the digest.
- Do not explain what a technique is. Say what it found.
- No predictions of specific events, no health, legal or financial advice, nothing fatalistic. A chart describes conditions, not outcomes.
- Never mention orbs, ratios, scores, or the word "digest". Those are how the finding was reached, not what it means.`;

function buildSchema(available: AdvancedModuleKey[]) {
  const properties: Record<string, unknown> = {
    opening: { type: "string" },
  };
  for (const key of available) {
    properties[key] = { type: "string" };
  }
  return {
    type: "object",
    properties,
    required: ["opening", ...available],
    additionalProperties: false,
  };
}

export async function GET(request: NextRequest) {
  try {
    const rawParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const chartParams = readChartParams(rawParams);

    if (!hasAllChartParams(chartParams)) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        "Complete birth details are required for the advanced story.",
      );
    }

    try {
      chartParamsToBirthInput(chartParams);
    } catch (error) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        error instanceof Error ? error.message : "Invalid birth details.",
      );
    }

    /* Signed in, or nothing. The page in front of this shows a sign-in gate,
       but a gate the API does not enforce is decoration -- the route is a URL
       and anyone can fetch it. Checked before the chart is built so an
       anonymous caller costs an auth lookup and not an ephemeris run. */
    const session = await sessionFromRequest(request);
    if (!session) {
      throw new ApiError(
        ErrorCode.UNAUTHORIZED,
        "Sign in to open the advanced reading.",
      );
    }

    const payload = getChartPayload(chartParams);
    const digest = buildAdvancedDigest(payload);

    if (digest.available.length === 0) {
      throw new ApiError(
        ErrorCode.NOT_FOUND,
        "This chart has no advanced modules to narrate.",
      );
    }

    /* Keyed on the digest itself, so any change in what the engine found --
       or in what this route chooses to send -- misses the cache on its own. */
    const key = makeCacheKey("advanced_story", {
      prompt_version: ADVANCED_STORY_PROMPT_VERSION,
      digest: digest.text,
    });

    const cached = cache.get(key);
    if (cached) {
      return NextResponse.json(
        { ...cached, cached: true },
        { headers: { "Cache-Control": CACHE_HEADER } },
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      /* The page falls back to the panels it already had, so this is a
         degraded feature rather than a broken page. */
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "The advanced story is unavailable: ANTHROPIC_API_KEY is not configured.",
        { statusCode: 503 },
      );
    }

    const budget = await consumeLlmBudget("/api/chart/advanced-story", request);
    if (!budget.allowed) {
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        route: "/api/chart/advanced-story",
        event: "llm_budget_exhausted",
        scope: budget.scope,
      }));
      throw new ApiError(
        ErrorCode.RATE_LIMITED,
        budget.scope === "anonymous"
          ? "Sign in to keep reading the advanced chapters."
          : "The advanced story is rate limited for today.",
        { details: { retryAfterSeconds: budget.retryAfterSeconds } },
      );
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: REQUEST_TIMEOUT_MS,
    });

    const wanted = digest.available
      .map((key) => `- ${key}: ${MODULE_BRIEFS[key]}`)
      .join("\n");

    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 4000,
      /* Seven short passages, not an essay. Low effort keeps the page from
         waiting on reasoning it does not need. */
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: buildSchema(digest.available) },
      },
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role: "user",
          content: `Write the opening and one passage for each of these modules:\n${wanted}\n\nWhat the engine found:\n\n${digest.text}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "The advanced story was declined.",
        { details: { category: response.stop_details?.category ?? null } },
      );
    }

    const parsed = response.parsed_output as Record<string, string> | null;
    if (!parsed?.opening) {
      throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "No advanced story was returned.");
    }

    const passages: Partial<Record<AdvancedModuleKey, string>> = {};
    for (const moduleKey of digest.available) {
      const passage = parsed[moduleKey];
      if (typeof passage === "string" && passage.trim()) {
        passages[moduleKey] = stripInlineMarkdown(passage).trim();
      }
    }

    const result: AdvancedStoryResponse = {
      opening: stripInlineMarkdown(parsed.opening).trim(),
      passages,
      cached: false,
    };

    remember(key, result);
    return NextResponse.json(result, { headers: { "Cache-Control": CACHE_HEADER } });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      if (error instanceof Anthropic.BadRequestError) {
        console.error("advanced-story: bad request to Anthropic", error.message);
      } else if (error instanceof Anthropic.AuthenticationError) {
        console.error("advanced-story: ANTHROPIC_API_KEY rejected");
      } else if (error instanceof Anthropic.RateLimitError) {
        console.error("advanced-story: rate limited");
      } else if (error instanceof Anthropic.APIConnectionTimeoutError) {
        console.error("advanced-story: timed out after", REQUEST_TIMEOUT_MS, "ms");
      } else if (error instanceof Anthropic.APIError) {
        console.error("advanced-story: Anthropic error", error.status, error.message);
      } else {
        console.error("advanced-story: unexpected", error);
      }
    }
    return errorResponse(error, "The advanced story could not be prepared.");
  }
}
