import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import { consumeLlmBudget } from "@/lib/llm-budget";
import { stripInlineMarkdown } from "@/lib/prompt-input";
import {
  chartParamsToBirthInput,
  getLifeDomainPayload,
  hasAllChartParams,
  readChartParams,
} from "@/lib/chart-params";
import { makeCacheKey } from "@/lib/server-cache";
import type { LifeDomainInsight, LifeDomainKey } from "@/lib/astro-types";

/*
 * The Ultimate Module's brief, written against that chart's own evidence.
 *
 * Why this route exists: the Connected Insight Zone renders display.body, which
 * the rule engine composes from whichever rules fired. That is accurate and it
 * is the same shape for everyone whose chart fires the same rules -- it states
 * the findings but does not weigh them against each other. What the section is
 * actually for is the synthesis: this domain is prominent, the support is
 * divisional and the pressure is timing, and here is what that combination asks
 * of you. That is a phrasing job, and it is the one thing the rule engine
 * genuinely cannot do, because the number of evidence combinations is not a
 * content project.
 *
 * Same contract as /api/chart/dasha-interpretation, and deliberately so: the
 * engine decides what is true -- which domain, how active, which evidence
 * families support and which press -- and the model is only allowed to phrase
 * it. The deterministic body stays underneath as the fallback, so a missing key,
 * a refusal, a timeout or an exhausted budget all leave the panel exactly as it
 * was before this route existed.
 *
 * Provider note: Anthropic, reading ANTHROPIC_API_KEY, shared with the dasha
 * route. /api/palm-reading is OpenAI and stays that way.
 *
 * Abuse note: the only thing a caller controls here is the birth parameters and
 * a domain key from a closed set of seven. Everything in the prompt is rebuilt
 * server-side from getLifeDomainPayload -- no string from the request body or
 * query reaches the model. That is not an accident of this implementation; it
 * is why the route recomputes the payload instead of accepting the insight the
 * client already has in memory, which would have been one fetch cheaper and
 * would have turned the route into an open text relay on our key.
 */

export const maxDuration = 30;

const REQUEST_TIMEOUT_MS = 20_000;
const CACHE_HEADER = "private, max-age=3600, stale-while-revalidate=1800";

/* Bump when the prompt or the fact selection changes, so a copy revision is not
   hidden behind warm cache entries written by the previous wording. */
const DOMAIN_BRIEF_PROMPT_VERSION = "1";

/* One chart has seven domains and the panel is a tab strip, so a single reader
   clicking along the row fills seven entries. Bounded so a long-lived server
   cannot grow it without limit. */
const MAX_CACHE_ENTRIES = 500;
const cache = new Map<string, string>();

function remember(key: string, value: string) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

const DOMAIN_KEYS = new Set<string>([
  "love_life",
  "career",
  "family",
  "inheritance",
  "influence",
  "life_cycle",
  "travel_destinations",
]);

/*
 * Frozen, so it is the cacheable prefix. Everything that varies per request --
 * the domain, its evidence -- goes in the user turn, after the breakpoint.
 */
const SYSTEM_PROMPT = `You write one short brief for a single life area in a Vedic astrology report.

You are given a structured summary of what the chart engine found for that area: how active it is relative to the reader's other areas, how strong the conclusion is, which families of evidence support it, which press on it, and the leading sub-themes.

Your job is to weigh those findings against each other and say what the combination means. The findings themselves are already established; do not re-list them.

Rules:
- 2 to 3 sentences. No heading, no preamble, no list, no markdown.
- Address the reader as "you".
- Lead with the synthesis, not the evidence. Name a tension explicitly when support and pressure disagree.
- State nothing you were not given. No planets, houses, signs, degrees, nakshatras, dashas or dates unless they appear in the input.
- Do not name the evidence families, the activity band, or any score. Those are how the finding was reached, not what it means.
- No predictions of specific events, no health, legal or financial advice, and nothing fatalistic. A chart describes conditions, not outcomes.
- Plain prose, warm but not effusive. No astrology jargon the reader has not already been shown.`;

/** Everything the model is told, built only from engine output. */
function buildFacts(insight: LifeDomainInsight, rank: number, total: number): string {
  const lines: string[] = [];

  lines.push(`Life area: ${insight.label}`);
  lines.push(`Headline already shown to the reader: ${insight.display.headline}`);
  lines.push(
    `Activity: ${insight.signal_profile.activity_band} (ranked ${rank} of ${total} areas in this chart)`,
  );
  lines.push(
    `Conclusion strength: ${insight.evidence_matrix.conclusion_strength}; status: ${insight.evidence_matrix.confirmation_status}`,
  );

  const supporting = insight.evidence_matrix.supporting_families;
  const pressure = insight.evidence_matrix.pressure_families;
  lines.push(
    `Supporting evidence families: ${supporting.length > 0 ? supporting.join(", ") : "none"}`,
  );
  lines.push(
    `Pressure evidence families: ${pressure.length > 0 ? pressure.join(", ") : "none"}`,
  );

  const leadingSubthemes = insight.subthemes.slice(0, 3);
  if (leadingSubthemes.length > 0) {
    lines.push("Leading sub-themes:");
    for (const subtheme of leadingSubthemes) {
      lines.push(`  - ${subtheme.label} (${subtheme.band})`);
    }
  }

  if (insight.display.strengths.length > 0) {
    lines.push("What the chart supports here:");
    for (const item of insight.display.strengths) lines.push(`  - ${item}`);
  }

  if (insight.display.watchouts.length > 0) {
    lines.push("What it asks you to watch:");
    for (const item of insight.display.watchouts) lines.push(`  - ${item}`);
  }

  if (insight.display.timing.length > 0) {
    lines.push("Timing already shown to the reader:");
    for (const item of insight.display.timing) lines.push(`  - ${item}`);
  }

  return lines.join("\n");
}

export async function GET(request: NextRequest) {
  try {
    const rawParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const chartParams = readChartParams(rawParams);

    if (!hasAllChartParams(chartParams)) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        "Complete birth details are required for a life-area brief.",
      );
    }

    /* Parsed here purely to turn a bad input into a 400 before the builder
       throws its own error deeper down -- same as the life-domains route. */
    try {
      chartParamsToBirthInput(chartParams);
    } catch (error) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        error instanceof Error ? error.message : "Invalid birth details.",
      );
    }

    const domain = request.nextUrl.searchParams.get("domain") ?? "";
    if (!DOMAIN_KEYS.has(domain)) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        `\`domain\` must be one of: ${[...DOMAIN_KEYS].join(", ")}.`,
      );
    }

    /* Shared cache and shared key with the page and /insights/life-areas, so
       this route never computes a reading those two would disagree with. */
    const payload = getLifeDomainPayload(chartParams);
    const insight = payload.insights.find((entry) => entry.key === (domain as LifeDomainKey));
    if (!insight) {
      throw new ApiError(
        ErrorCode.NOT_FOUND,
        "That life area was not generated for this chart.",
      );
    }

    /* Ranked the same way the panel ranks them, so "ranked 2 of 7" in the
       prompt matches the order the reader is looking at. */
    const ranked = [...payload.insights].sort(
      (a, b) => b.signal_profile.activity_score - a.signal_profile.activity_score,
    );
    const rank = ranked.findIndex((entry) => entry.key === insight.key) + 1;

    const facts = buildFacts(insight, rank, ranked.length);

    /* Keyed on the facts themselves rather than on the birth parameters. Same
       evidence means the same brief, and any change in what the engine found --
       or in what this route decides to send -- misses the cache on its own
       without a version to remember to bump. */
    const key = makeCacheKey("domain_brief", {
      domain,
      prompt_version: DOMAIN_BRIEF_PROMPT_VERSION,
      facts,
    });

    const cached = cache.get(key);
    if (cached) {
      return NextResponse.json(
        { brief: cached, cached: true },
        { headers: { "Cache-Control": CACHE_HEADER } },
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      /* The panel falls back to the engine's own body on any non-OK response,
         so this is a degraded feature rather than a broken page. */
      /* 503 rather than 502, matching /api/palm-reading's missing-key branch.
         The distinction is load-bearing on the client: a provider error is
         worth another attempt on the next domain, a key that is not configured
         never is, and the panel can only tell them apart by status. */
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "Life-area briefs are unavailable: ANTHROPIC_API_KEY is not configured.",
        { statusCode: 503 },
      );
    }

    /* Past the cache, so this request is about to cost money. */
    const budget = consumeLlmBudget("/api/chart/domain-brief", request);
    if (!budget.allowed) {
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        route: "/api/chart/domain-brief",
        event: "llm_budget_exhausted",
        scope: budget.scope,
      }));
      throw new ApiError(
        ErrorCode.RATE_LIMITED,
        "Life-area briefs are rate limited for today.",
        { details: { retryAfterSeconds: budget.retryAfterSeconds } },
      );
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: REQUEST_TIMEOUT_MS,
    });

    const response = await client.messages.create({
      model: "claude-opus-5",
      /* Deliberately short output: 2-3 sentences. */
      max_tokens: 1000,
      /* Low effort suits a short phrasing job and keeps the tab strip
         responsive; thinking is omitted, which on this model runs adaptive. */
      output_config: { effort: "low" },
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: facts }],
    });

    if (response.stop_reason === "refusal") {
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "The brief was declined.",
        { details: { category: response.stop_details?.category ?? null } },
      );
    }

    const brief = stripInlineMarkdown(
      response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join(""),
    ).trim();


    if (!brief) {
      throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "No brief was returned.");
    }

    remember(key, brief);
    return NextResponse.json(
      { brief, cached: false },
      { headers: { "Cache-Control": CACHE_HEADER } },
    );
  } catch (error) {
    if (!(error instanceof ApiError)) {
      /* Most specific first: a 400 from us is a bug, a 429 is worth retrying,
         a connection error is the network. Collapsing them into one branch
         loses the distinction the caller needs. */
      if (error instanceof Anthropic.BadRequestError) {
        console.error("domain-brief: bad request to Anthropic", error.message);
      } else if (error instanceof Anthropic.AuthenticationError) {
        console.error("domain-brief: ANTHROPIC_API_KEY rejected");
      } else if (error instanceof Anthropic.RateLimitError) {
        console.error("domain-brief: rate limited");
      } else if (error instanceof Anthropic.APIConnectionTimeoutError) {
        console.error("domain-brief: timed out after", REQUEST_TIMEOUT_MS, "ms");
      } else if (error instanceof Anthropic.APIError) {
        console.error("domain-brief: Anthropic error", error.status, error.message);
      } else {
        console.error("domain-brief: unexpected", error);
      }
    }
    return errorResponse(error, "The life-area brief could not be prepared.");
  }
}
