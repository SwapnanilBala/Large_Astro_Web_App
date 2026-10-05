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
import {
  AREA_CLASSICS_SYSTEM_PROMPT,
  AREA_TOPIC_LIST,
  areaClassicsInstruction,
  areaDocuments,
  areaReadingsFrom,
  selectAreas,
  type AreaChart,
  type AreaSelection,
} from "@/lib/knowledge/area-classics-reading";
import { parseBirthSex, type BirthSex } from "@/lib/birth-sex";
import type { AreaClassicsResponse } from "@/lib/knowledge/classical-reading";
import { chartPlacementKeys } from "@/lib/knowledge/placements";
import { passagesForChart } from "@/lib/knowledge/retrieve";
import { consumeLlmBudget } from "@/lib/llm-budget";
import { COMMENTARY_LANGUAGES } from "@/lib/varga-commentary";

/*
 * "From the classics" for the life areas: what the Brihat Jataka says about
 * each area of the reader's life, written for them and cited verse by verse.
 *
 * ── RETRIEVAL BY THE CHART, NOT BY SIMILARITY ──────────────────────────────
 *
 * The passages come from `knowledge_passages`, chosen by what the chart is:
 * its placements as keys (lib/knowledge/placements.ts), matched against each
 * passage's conditions, and its yogas, matched against the yoga chapters'
 * tags. A passage reaches an area only when its condition holds in this chart
 * and it is tagged with one of the area's topics. No embedding call, and
 * nothing the browser wrote: the route takes birth details, rebuilds the chart
 * itself, and every string the model reads comes from the corpus, the
 * catalogue or the key vocabulary.
 *
 * ── ONE CALL FOR EVERY AREA ────────────────────────────────────────────────
 *
 * The life-areas page lets a reader move between seven areas, and a call per
 * area would spend the daily allowance on clicking, as the domain briefs
 * found. So one call writes them all: one document per area, one paragraph per
 * area under its marker, cut apart again by areaReadingsFrom. An area the book
 * says nothing about for this chart is not sent, and a chart with no area at
 * all costs nothing -- the budget is consumed only after that.
 *
 * ── CITATIONS, NOT A SCHEMA ────────────────────────────────────────────────
 *
 * As on the yoga note: citations and structured output are mutually
 * exclusive, and the citations are the point. An area whose paragraph cites
 * nothing is dropped rather than shipped.
 */

const MODEL = "claude-opus-5-5";
const EFFORT = "low" as const;

export const maxDuration = 60;

const REQUEST_TIMEOUT_MS = 50_000;
const CACHE_HEADER = "private, no-store";

/*
 * Bounded, process-lifetime, keyed by what was sent rather than by the chart:
 * charts whose conditions pick the same passages for every area share an
 * answer.
 */
const MAX_CACHE_ENTRIES = 500;
type Readings = AreaClassicsResponse["readings"];
const cache = new Map<string, Readings>();
/* A reader landing on the page and a quick reload share one paid call. */
const inFlight = new Map<string, Promise<Readings>>();

function remember(key: string, value: Readings) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

/** What the model is sent, canonically: the areas, their passages, conditions and yogas, and the reader's sex. */
function cacheKey(languageCode: string, selection: AreaSelection[], sex: BirthSex | undefined): string {
  const canonical = selection
    .map(({ area, passages, conditions, yogaNames }) =>
      [area, passages.map((p) => p.id).join(","), [...conditions].sort().join(","), [...yogaNames].sort().join(",")].join(
        "|",
      ),
    )
    .join(";");
  return `${languageCode}:${sex ?? "unsaid"}:${createHash("sha1").update(canonical).digest("hex")}`;
}

async function writeReadings(
  request: NextRequest,
  selection: AreaSelection[],
  languageCode: string,
  sex: BirthSex | undefined,
): Promise<Readings> {
  if (!process.env.ANTHROPIC_API_KEY) {
    /* The page renders either way; this is a missing layer, not a broken page. */
    throw new ApiError(
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      "The classical notes are unavailable: ANTHROPIC_API_KEY is not configured.",
      { statusCode: 503 },
    );
  }

  /* Past the cache and past the empty case, so this request is about to cost money. */
  const budget = await consumeLlmBudget("/api/chart/area-classics", request);
  if (!budget.allowed) {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      route: "/api/chart/area-classics",
      event: "llm_budget_exhausted",
      scope: budget.scope,
    }));
    throw new ApiError(
      ErrorCode.RATE_LIMITED,
      budget.scope === "anonymous"
        ? "Sign in to keep reading classical notes today."
        : "Classical notes are rate limited for today.",
      { details: { retryAfterSeconds: budget.retryAfterSeconds, scope: budget.scope } },
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 });
  const startedAt = Date.now();
  const response = await client.messages.create({
    model: MODEL,
    /* Headroom for thinking plus seven short notes, not a target. */
    max_tokens: 6000,
    output_config: { effort: EFFORT },
    system: [{ type: "text", text: AREA_CLASSICS_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          ...areaDocuments(selection),
          { type: "text", text: areaClassicsInstruction(selection, COMMENTARY_LANGUAGES[languageCode], sex) },
        ],
      },
    ],
  });

  console.info(JSON.stringify({
    timestamp: new Date().toISOString(),
    route: "/api/chart/area-classics",
    event: "llm_usage",
    model: MODEL,
    effort: EFFORT,
    areas: selection.length,
    passages: selection.reduce((sum, { passages }) => sum + passages.length, 0),
    language: languageCode,
    elapsedMs: Date.now() - startedAt,
    stopReason: response.stop_reason,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
  }));

  if (response.stop_reason === "refusal") {
    throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "The classical notes were declined.");
  }
  /* Truncation is a failure, not a short answer: the last area would be cut mid-sentence. */
  if (response.stop_reason === "max_tokens") {
    throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "The classical notes ran past their token ceiling.");
  }

  const readings = areaReadingsFrom(response.content, selection);
  /* A multi-item answer can come back one short with a clean stop reason; say
     which, so a recurring gap shows up in the logs rather than as a card that
     never appears. */
  const missing = selection.map(({ area }) => area).filter((area) => !readings[area]);
  if (missing.length > 0) {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      route: "/api/chart/area-classics",
      event: "llm_reading_short",
      missing,
    }));
  }
  if (missing.length === selection.length) {
    throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "The classical notes came back without their sources.");
  }
  return readings;
}

export async function GET(request: NextRequest) {
  try {
    const chartParams = readChartParams(Object.fromEntries(request.nextUrl.searchParams.entries()));
    if (!hasAllChartParams(chartParams)) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, "Complete birth details are required for the classical notes.");
    }
    try {
      chartParamsToBirthInput(chartParams);
    } catch (error) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, error instanceof Error ? error.message : "Invalid birth details.");
    }

    /* An unknown language is English, as on the other commentary routes. */
    const requested = request.nextUrl.searchParams.get("language") ?? "";
    const languageCode = Object.hasOwn(COMMENTARY_LANGUAGES, requested) ? requested : "en";

    /* The same cached chart the page was rendered from. */
    const payload = getChartPayload(chartParams);
    const sex = parseBirthSex(chartParams.birthSex);
    const chart: AreaChart = {
      keys: chartPlacementKeys({
        planets: payload.chart.planets,
        ascendantSign: payload.chart.ascendant.sign,
        navamsa: payload.chart.navamsa,
        sex,
      }),
      yogas: (payload.chart.yogas ?? [])
        .filter((yoga) => yoga.present)
        .map((yoga) => ({ id: yoga.yoga_id, planets: yoga.involved_planets })),
    };

    const selection = selectAreas(
      await passagesForChart({
        topics: AREA_TOPIC_LIST,
        chartKeys: [...chart.keys],
        yogaIds: chart.yogas.map((yoga) => yoga.id),
      }),
      chart,
    );
    if (selection.length === 0) {
      const empty: AreaClassicsResponse = { readings: {}, cached: false };
      return NextResponse.json(empty, { headers: { "Cache-Control": CACHE_HEADER } });
    }

    const key = cacheKey(languageCode, selection, sex);
    const cached = cache.get(key);
    if (cached) {
      const hit: AreaClassicsResponse = { readings: cached, cached: true };
      return NextResponse.json(hit, { headers: { "Cache-Control": CACHE_HEADER } });
    }

    let writing = inFlight.get(key);
    if (!writing) {
      writing = writeReadings(request, selection, languageCode, sex)
        .then((readings) => {
          remember(key, readings);
          return readings;
        })
        .finally(() => {
          inFlight.delete(key);
        });
      inFlight.set(key, writing);
    }
    const fresh: AreaClassicsResponse = { readings: await writing, cached: false };
    return NextResponse.json(fresh, { headers: { "Cache-Control": CACHE_HEADER } });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      if (error instanceof Anthropic.BadRequestError) {
        console.error("area-classics: bad request to Anthropic", error.message);
      } else if (error instanceof Anthropic.AuthenticationError) {
        console.error("area-classics: ANTHROPIC_API_KEY rejected");
      } else if (error instanceof Anthropic.RateLimitError) {
        console.error("area-classics: rate limited");
      } else if (error instanceof Anthropic.APIConnectionTimeoutError) {
        console.error("area-classics: timed out after", REQUEST_TIMEOUT_MS, "ms");
      } else if (error instanceof Anthropic.APIError) {
        console.error("area-classics: Anthropic error", error.status, error.message);
      } else {
        console.error("area-classics: unexpected", error);
      }
    }
    return errorResponse(error, "The classical notes could not be prepared.");
  }
}
