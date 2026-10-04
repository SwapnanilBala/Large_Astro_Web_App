import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import { YOGA_DEFINITIONS } from "@/lib/engines/yoga-engine";
import { KNOWLEDGE_PLANETS } from "@/lib/knowledge/corpus";
import { passagesTaggedWith } from "@/lib/knowledge/retrieve";
import {
  YOGA_CLASSICS_MAX_REQUEST,
  type YogaClassicsReading,
  type YogaClassicsResponse,
  type YogaClassicsYoga,
} from "@/lib/knowledge/yoga-classics";
import {
  YOGA_CLASSICS_SYSTEM_PROMPT,
  readingFrom,
  selectYogaPassages,
  yogaClassicsInstruction,
  yogaDocuments,
  type YogaWithPassages,
} from "@/lib/knowledge/yoga-classics-reading";
import { consumeLlmBudget } from "@/lib/llm-budget";
import { COMMENTARY_LANGUAGES } from "@/lib/varga-commentary";

/*
 * "From the classics" for the yoga section: what the Brihat Jataka says about
 * the yogas this chart has, written for the reader and cited verse by verse.
 *
 * ── RETRIEVAL, THEN ONE CALL ───────────────────────────────────────────────
 *
 * The browser sends the chart's yogas as ids, planets and strengths. The
 * passages come from `knowledge_passages` (lib/knowledge/corpus is the source
 * of truth, loaded by `npm run knowledge:load`): an exact match on the
 * engine's own yoga ids, narrowed to verses about the planets that form each
 * yoga here, for the five highest-ranked yogas the book speaks to. No
 * embedding call is involved. A chart none of whose yogas the book names gets
 * `reading: null` and costs nothing -- the budget is consumed only after that.
 *
 * ── CITATIONS, NOT A SCHEMA ────────────────────────────────────────────────
 *
 * Every other chart route asks for structured output. This one cannot:
 * citations and `output_config.format` are mutually exclusive, and the
 * citations are the point. Each yoga is a document whose passages are its
 * content blocks, so a citation names whole passages and maps straight back to
 * a row; the reader sees each statement's verse under the reading. A reading
 * with no citations at all is treated as a failure rather than shipped, because
 * an uncited note is exactly what this section exists not to print.
 *
 * ── GROUNDING AND TONE ─────────────────────────────────────────────────────
 *
 * The engine decides which yogas the chart has; the passages decide what may
 * be said about them; the model only words it. Passages about death, illness,
 * caste, crime, harm to family or sexual morality never reach it (withheld in
 * the corpus and filtered in SQL), and the prompt forbids those topics anyway,
 * because a shown passage can still be harsh (Kemadruma's "will be dirty ...
 * and will be wicked").
 */

const MODEL = "claude-opus-5-5";
const EFFORT = "low" as const;

export const maxDuration = 60;

const REQUEST_TIMEOUT_MS = 45_000;

/*
 * Bounded, process-lifetime, keyed by the yogas and passages actually used.
 * The key is the selection, not the chart, so two charts whose top yogas and
 * forming planets agree share an answer -- which is common, since the library
 * covers a few dozen yogas.
 */
const MAX_CACHE_ENTRIES = 300;
const cache = new Map<string, YogaClassicsReading>();

function remember(key: string, value: YogaClassicsReading) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

const DEFINITIONS = new Map(YOGA_DEFINITIONS.map((definition) => [definition.id, definition]));
/* What `involved_planets` may hold: the nine grahas, plus the ascendant for the
   yogas that are about it. Anything else is dropped rather than refused, so an
   odd label on one yoga does not cost the chart its note. */
const PLANETS = new Set<string>([...KNOWLEDGE_PLANETS, "Ascendant"]);
const STRENGTHS = new Set<string>(["strong", "moderate", "weak"]);


function parseYogas(value: unknown): YogaClassicsYoga[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, "`yogas` must be a non-empty array.");
  }
  if (value.length > YOGA_CLASSICS_MAX_REQUEST) {
    throw new ApiError(
      ErrorCode.VALIDATION_FAILED,
      `\`yogas\` may hold at most ${YOGA_CLASSICS_MAX_REQUEST} entries.`,
    );
  }
  const seen = new Set<string>();
  const yogas: YogaClassicsYoga[] = [];
  for (const entry of value) {
    const row = (entry ?? {}) as Record<string, unknown>;
    const id = String(row.id ?? "");
    /* Every field is checked against a closed set, so nothing the browser
       wrote reaches the prompt: the names and rules the model reads come from
       the catalogue, keyed by this id. */
    if (!DEFINITIONS.has(id)) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, `${id || "A yoga"} is not in the catalogue.`);
    }
    const strength = String(row.strength ?? "");
    if (!STRENGTHS.has(strength)) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, `${id} has no recognisable strength.`);
    }
    if (seen.has(id)) continue;
    seen.add(id);
    const planets = Array.isArray(row.planets)
      ? [...new Set(row.planets.map(String).filter((planet) => PLANETS.has(planet)))]
      : [];
    yogas.push({ id, planets, strength: strength as YogaClassicsYoga["strength"] });
  }
  return yogas;
}

/** The selection, canonically: which yogas, how formed, which passages. */
function cacheKey(selection: YogaWithPassages[]): string {
  const canonical = selection
    .map(({ yoga, passages }) =>
      [yoga.id, yoga.strength, [...yoga.planets].sort().join("+"), passages.map((p) => p.id).join(",")].join("|"),
    )
    .join(";");
  return createHash("sha1").update(canonical).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    let body: { yogas?: unknown; language?: unknown };
    try {
      body = (await request.json()) as { yogas?: unknown; language?: unknown };
    } catch {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, "Request body must be JSON.");
    }

    const yogas = parseYogas(body.yogas);
    /* An unknown language is English, as on the other commentary routes. */
    const languageCode =
      typeof body.language === "string" && body.language in COMMENTARY_LANGUAGES ? body.language : "en";
    const languageName = COMMENTARY_LANGUAGES[languageCode];

    const selection = selectYogaPassages(
      await passagesTaggedWith(yogas.map((yoga) => yoga.id)),
      yogas,
    );
    if (selection.length === 0) {
      const empty: YogaClassicsResponse = { reading: null, cached: false };
      return NextResponse.json(empty);
    }

    /* Part of the key: the same yogas in two languages are two answers. */
    const key = `${languageCode}:${cacheKey(selection)}`;
    const cached = cache.get(key);
    if (cached) {
      const hit: YogaClassicsResponse = { reading: cached, cached: true };
      return NextResponse.json(hit);
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      /* The yoga list renders either way; this is a missing layer, not a broken page. */
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "The classical note is unavailable: ANTHROPIC_API_KEY is not configured.",
        { statusCode: 503 },
      );
    }

    /* Past the cache and past the empty case, so this request is about to cost money. */
    const budget = await consumeLlmBudget("/api/chart/yoga-classics", request);
    if (!budget.allowed) {
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        route: "/api/chart/yoga-classics",
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

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: REQUEST_TIMEOUT_MS });
    const names = selection.map(({ yoga }) => DEFINITIONS.get(yoga.id)?.name ?? yoga.id);
    const response = await client.messages.create({
      model: MODEL,
      /* Headroom for thinking plus a short note, not a target. */
      max_tokens: 4000,
      output_config: { effort: EFFORT },
      system: [{ type: "text", text: YOGA_CLASSICS_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: [...yogaDocuments(selection), { type: "text", text: yogaClassicsInstruction(names, languageName) }],
        },
      ],
    });

    /* One line per uncached call, as on every paid route here, so the effort
       and budget questions are settled from logs rather than from arithmetic. */
    console.info(JSON.stringify({
      timestamp: new Date().toISOString(),
      route: "/api/chart/yoga-classics",
      event: "llm_usage",
      model: MODEL,
      effort: EFFORT,
      yogas: selection.length,
      passages: selection.reduce((sum, { passages }) => sum + passages.length, 0),
      language: languageCode,
      stopReason: response.stop_reason,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
    }));

    if (response.stop_reason === "refusal") {
      throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "The classical note was declined.");
    }
    /* Truncation is a failure, not a short answer: thinking counts against
       max_tokens, and a note cut off mid-sentence is worse than none. */
    if (response.stop_reason === "max_tokens") {
      throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "The classical note ran past its token ceiling.");
    }

    const reading = readingFrom(response.content, selection);
    if (reading.sources.length === 0) {
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        route: "/api/chart/yoga-classics",
        event: "llm_reading_uncited",
        segments: reading.segments.length,
      }));
      throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "The classical note came back without its sources.");
    }

    remember(key, reading);
    const fresh: YogaClassicsResponse = { reading, cached: false };
    return NextResponse.json(fresh);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      if (error instanceof Anthropic.BadRequestError) {
        console.error("yoga-classics: bad request to Anthropic", error.message);
      } else if (error instanceof Anthropic.AuthenticationError) {
        console.error("yoga-classics: ANTHROPIC_API_KEY rejected");
      } else if (error instanceof Anthropic.RateLimitError) {
        console.error("yoga-classics: rate limited");
      } else if (error instanceof Anthropic.APIConnectionTimeoutError) {
        console.error("yoga-classics: timed out after", REQUEST_TIMEOUT_MS, "ms");
      } else if (error instanceof Anthropic.APIError) {
        console.error("yoga-classics: Anthropic error", error.status, error.message);
      } else {
        console.error("yoga-classics: unexpected", error);
      }
    }
    return errorResponse(error, "The classical note could not be prepared.");
  }
}
