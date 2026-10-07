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
import type { LifeDomainKey } from "@/lib/astro-types";
import { parseBirthSex, type BirthSex } from "@/lib/birth-sex";
import { checkNote, type NoteFailure, type NoteProblem } from "@/lib/knowledge/classical-note-check";
import type { AreaClassicsResponse } from "@/lib/knowledge/classical-reading";
import { chartPlacementKeys } from "@/lib/knowledge/placements";
import { passagesForChart } from "@/lib/knowledge/retrieve";
import { consumeLlmBudget } from "@/lib/llm-budget";
import { CHART_EFFORT, CHART_MODEL } from "@/lib/llm-models";
import { COMMENTARY_LANGUAGES } from "@/lib/varga-commentary";

/*
 * "From the classics" for the life areas: what the Brihat Jataka says about
 * each area of the reader's life, written for them and cited verse by verse,
 * and for a reader who said she is a woman, what the Strijataka (1931), a book
 * on women's charts, says too.
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
 *
 * ── CHECKED, THEN RETRIED ONCE ─────────────────────────────────────────────
 *
 * As on the yoga note, each area's paragraph is checked before it ships
 * (lib/knowledge/classical-note-check.ts), and the areas that fail -- uncited,
 * or for a Hindi or Bengali reader in the wrong script or with a forbidden
 * word -- are asked for once more on Opus 5.5, in one call that sends only
 * their documents. The areas that passed are kept whatever the retry does,
 * and nothing is charged to the reader's allowance twice.
 */

/* Claude Haiku 5.5 at low effort since 2026-10-07 (lib/llm-models.ts):
   Haiku 4.5 from 2026-10-06, Opus 5.5 at low effort before. */
const MODEL = CHART_MODEL;

/* The one retry, as on the yoga note: what the notes ran on before. */
type Ask = Pick<Anthropic.MessageCreateParamsNonStreaming, "model" | "output_config">;
const FIRST: Ask = { model: MODEL, output_config: { effort: CHART_EFFORT } };
const RETRY: Ask = { model: "claude-opus-5-5", output_config: { effort: "low" } };

export const maxDuration = 60;

const REQUEST_TIMEOUT_MS = 50_000;
/* The retry gets what is left of maxDuration, less a margin to answer in, and
   is not started with less time than Opus needs to finish. */
const DEADLINE_MS = 55_000;
const RETRY_MIN_MS = 15_000;
const CACHE_HEADER = "private, no-store";

const FAILED: Record<NoteFailure, string> = {
  refusal: "The classical notes were declined.",
  /* Truncation is a failure, not a short answer: the last area would be cut mid-sentence. */
  max_tokens: "The classical notes ran past their token ceiling.",
  uncited: "The classical notes came back without their sources.",
  check: "The classical notes came back in the wrong language or with words they may not use.",
};

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

type Written = {
  readings: Readings;
  /** Why each area that was sent and is not in `readings` could not be shipped. */
  failures: Partial<Record<LifeDomainKey, NoteFailure>>;
};

/** One paid call for these areas: the notes that can ship, and why the rest cannot. */
async function writeAreas(
  client: Anthropic,
  ask: Ask,
  attempt: number,
  selection: AreaSelection[],
  languageCode: string,
  sex: BirthSex | undefined,
  options?: { timeout: number },
): Promise<Written> {
  const startedAt = Date.now();
  const response = await client.messages.create(
    {
      ...ask,
      /* Headroom for seven short notes, and Opus's thinking on the retry, not a target. */
      max_tokens: 6000,
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
    },
    options,
  );

  console.info(JSON.stringify({
    timestamp: new Date().toISOString(),
    route: "/api/chart/area-classics",
    event: "llm_usage",
    model: ask.model,
    attempt,
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

  const failEvery = (failure: NoteFailure): Written => ({
    readings: {},
    failures: Object.fromEntries(selection.map(({ area }) => [area, failure])),
  });
  if (response.stop_reason === "refusal") return failEvery("refusal");
  if (response.stop_reason === "max_tokens") return failEvery("max_tokens");

  const found = areaReadingsFrom(response.content, selection);
  const written: Written = { readings: {}, failures: {} };
  const flagged: { area: LifeDomainKey; problems: NoteProblem[]; blocks: boolean }[] = [];
  for (const { area } of selection) {
    const reading = found[area];
    if (!reading) {
      written.failures[area] = "uncited";
      continue;
    }
    const check = checkNote(reading, languageCode);
    if (check.problems.length > 0) flagged.push({ area, problems: check.problems, blocks: check.blocks });
    if (check.blocks) written.failures[area] = "check";
    else written.readings[area] = reading;
  }
  if (flagged.length > 0) {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      route: "/api/chart/area-classics",
      event: "llm_note_check",
      model: ask.model,
      attempt,
      language: languageCode,
      flagged,
    }));
  }
  return written;
}

async function writeReadings(
  request: NextRequest,
  selection: AreaSelection[],
  languageCode: string,
  sex: BirthSex | undefined,
  receivedAt: number,
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
  const first = await writeAreas(client, FIRST, 1, selection, languageCode, sex);
  const readings: Readings = { ...first.readings };
  let failures = first.failures;

  const failed = selection.filter(({ area }) => !readings[area]);
  if (failed.length > 0) {
    const leftMs = DEADLINE_MS - (Date.now() - receivedAt);
    const retrying = leftMs >= RETRY_MIN_MS;
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      route: "/api/chart/area-classics",
      event: "llm_note_retry",
      failures,
      language: languageCode,
      model: RETRY.model,
      leftMs,
      retrying,
    }));
    if (retrying) {
      try {
        const second = await writeAreas(client, RETRY, 2, failed, languageCode, sex, {
          timeout: Math.min(REQUEST_TIMEOUT_MS, leftMs),
        });
        Object.assign(readings, second.readings);
        failures = second.failures;
      } catch (error) {
        /* The areas that passed are still owed to the reader. */
        console.error(JSON.stringify({
          timestamp: new Date().toISOString(),
          route: "/api/chart/area-classics",
          event: "llm_note_retry_failed",
          error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        }));
      }
    }
  }

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
    throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, FAILED[failures[missing[0]] ?? "uncited"]);
  }
  return readings;
}

export async function GET(request: NextRequest) {
  const receivedAt = Date.now();
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
        moonNakshatra: payload.chart.nakshatra?.name,
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
      writing = writeReadings(request, selection, languageCode, sex, receivedAt)
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
