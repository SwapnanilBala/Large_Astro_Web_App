import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import { sessionFromRequest } from "@/lib/identity/require-session";
import { consumeLlmBudget } from "@/lib/llm-budget";
import { stripInlineMarkdown } from "@/lib/prompt-input";
import {
  PARAGRAPHS_PER_CHAPTER,
  STORY_PROSE_SCHEMA,
  WORDS_PER_PARAGRAPH,
  missingProseChapters,
  parseStoryProse,
  renderStoryProseFacts,
  type StoryProse,
  type StoryProseFacts,
} from "@/lib/story-prose";

/*
 * The written prose for the PDF report.
 *
 * lib/story-prose.ts carries what this may and may not rewrite, and why. This
 * file is the call.
 *
 * ── EFFORT -- high for an account, medium for an address ──────────────────
 *
 * This is the route where effort buys the most and costs the most, so it is
 * the one where the two are worth splitting by who is asking.
 *
 * Why it buys anything at all: every other LLM route here writes two or three
 * sentences about one thing. This writes a document whose nine chapters have
 * to agree with each other, each grounded in its own placements, over about
 * 2,900 words. The model has to hold the whole report in view to avoid saying
 * the same thing in the marriage chapter and the family one, and that is the
 * part a lower setting drops first.
 *
 * Why it is split: at high this is by far the most expensive call in the app.
 * Measured on the sample chart, three runs each:
 *
 *     high     186s   4,467 input   13,700 output   $0.37   2,897 words
 *     medium    97s   4,467 input    6,112 output   $0.18   2,673 words
 *
 * Read the last two columns together: medium is 2.1x cheaper and 1.9x faster
 * and writes the same amount of prose. The whole difference is thinking, which
 * is 94% of the cost and none of the output the reader sees. That is what
 * makes this dial worth splitting rather than simply lowering -- the saving is
 * real and what it costs is invisible in any single paragraph.
 * An account is a name a caller cannot mint by the thousand, so it is the one
 * identity worth spending twice as much on; a signed-out address is the tier
 * where a proxy pool turns one abuser into a thousand callers.
 *
 * A signed-out reader is not getting a worse report -- they get the same nine
 * chapters, the same length, written at medium. What they do not get is the
 * cross-chapter care that the extra thinking buys, which is real and is also
 * the hardest thing to see in any one paragraph.
 *
 * Both tiers are allowed the same latency budget: `maxDuration` is 300, which
 * high needs and medium does not. The reader has pressed download and is
 * watching a progress dialog either way.
 *
 * ── WHY IT STREAMS ────────────────────────────────────────────────────────
 *
 * `max_tokens` is 32000: about 4,500 tokens of prose plus whatever adaptive
 * thinking spends at high effort, which on a job this size is most of the
 * budget. The SDK asks for streaming at that size precisely so a long
 * generation cannot trip an HTTP timeout, and `finalMessage()` hands back the
 * assembled message since nothing here renders token by token.
 *
 * That is also why the output schema is hand-written in lib/story-prose.ts
 * rather than built with `zodOutputFormat`: that helper exists for
 * `messages.parse()`, which is non-streaming.
 *
 * ── GROUNDING ─────────────────────────────────────────────────────────────
 *
 * The engine decides every placement and every claim about evidence strength.
 * The model gets those, plus the sentence the engine wrote from them, and is
 * asked for the paragraphs a writer would have written from the same notes. It
 * may not introduce a placement, a date, a degree or a house that is not in
 * the signals it was handed -- all of which it could invent plausibly, and all
 * of which a reader would take as computed, because everything else on the
 * page is.
 */

/*
 * Keyed by whether the caller has an account. `sessionFromRequest` is the same
 * helper lib/llm-budget.ts resolves its caller with, so the tier here and the
 * allowance there cannot disagree within one request -- and asking twice costs
 * one session lookup on a route that is about to spend three minutes.
 */
const EFFORT_BY_TIER = {
  account: "high",
  address: "medium",
} as const;

type ProseTier = keyof typeof EFFORT_BY_TIER;

export const maxDuration = 300;

/* Leaves ~50s inside maxDuration for the handler to return a real error rather
   than be killed mid-flight. */
const REQUEST_TIMEOUT_MS = 250_000;

/*
 * Bounded, process-lifetime, keyed by the facts.
 *
 * A reader who downloads the same report twice -- which people do, having lost
 * the first file -- should not pay for it twice, and neither should the key.
 * Persisting it would mean a row per chart in `generated_artifacts`, which is
 * scoped to a signed-in user; this works signed-out, so a cache is the honest
 * answer and a cold process costs one call.
 *
 * Smaller than the other routes' caches because each entry is a whole report.
 */
const MAX_CACHE_ENTRIES = 60;
const cache = new Map<string, StoryProse>();

function remember(key: string, value: StoryProse) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

const CHAPTER_IDS = new Set([
  "essence", "marriage", "family", "career", "wealth",
  "strengths", "emotional-orientation", "timing", "grounding",
]);

const SUPPORT_LEVELS = new Set(["well-supported", "supported", "exploratory"]);

/*
 * Frozen, so it is the cacheable prefix. Everything that varies per reader --
 * the placements, the drafts -- goes in the user turn after the breakpoint.
 * At roughly 1,200 tokens this is the largest cached prefix in the app, and
 * across readers it is the same bytes every time.
 */
const SYSTEM_PROMPT = `You write the prose for a printed Vedic astrology report -- a bound PDF a client keeps, not a web page they skim.

You are given, for each chapter: its title, its section, how strong the evidence behind it is, the placements it rests on, and the draft sentence the calculation engine wrote from those placements. Replace the draft. Keep the facts.

WHAT YOU WRITE
- An introduction: one paragraph, 60 to 90 words, naming what the report covers and how to read it. Not a summary of the chapters.
- A preface: exactly 2 paragraphs, ${WORDS_PER_PARAGRAPH} words each, on what this chart is like to live inside. This is the only place you may write about the reader as a whole rather than about one chapter.
- For each chapter: an opening of 1 to 2 sentences that could stand alone as a pull quote, then exactly ${PARAGRAPHS_PER_CHAPTER} paragraphs of ${WORDS_PER_PARAGRAPH} words each.

RULES ON FACTS
- Every placement you name must appear in that chapter's placement list. No degrees, no houses, no aspects, no nakshatras, no dashas, no dates, no planetary strengths beyond what you are given.
- You may reason about what a placement means. You may not add a second placement to support the reasoning.
- The evidence strength is printed next to your paragraphs. Write a "well-supported" chapter with confidence and an "exploratory" one with visible reserve -- name the uncertainty in the prose rather than leaving the pill to carry it alone.
- Do not restate the At a glance table or the three threads as a list. You may develop a thread in the chapter it belongs to.

RULES ON WRITING
- Address the reader as "you". Never name them.
- Plain prose. No headings, no bullet points, no markdown, no em-dash-separated asides stacked three deep. Paragraphs, in complete sentences.
- The nine chapters are read in one sitting. Do not repeat an observation, an image or a sentence shape across them. If marriage and family both rest on the same placement, say the shared part once and let the other chapter take a different angle on it.
- No predictions of specific events. No health, legal or financial advice. Nothing fatalistic: a chart describes conditions and tendencies, never outcomes.
- Do not mention astrology as a practice, this report, the calculation, or yourself. Write the reading, not a frame around it.

Return one object per chapter, with the id exactly as given, in the order given.`;

function parseFacts(value: unknown): StoryProseFacts {
  if (!value || typeof value !== "object") {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, "`facts` must be an object.");
  }
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.chapters) || raw.chapters.length === 0) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, "`facts.chapters` must be a non-empty array.");
  }
  if (raw.chapters.length > CHAPTER_IDS.size) {
    throw new ApiError(
      ErrorCode.VALIDATION_FAILED,
      `\`facts.chapters\` may hold at most ${CHAPTER_IDS.size} entries.`,
    );
  }

  const text = (input: unknown, limit: number) => {
    const out = typeof input === "string" ? input.trim() : "";
    /* Bounded because every one of these lands in a paid prompt. */
    return out.slice(0, limit);
  };

  const seen = new Set<string>();
  const chapters = raw.chapters.map((entry) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    const id = String(row.id ?? "");
    if (!CHAPTER_IDS.has(id)) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, `Unknown chapter id: ${id || "(blank)"}.`);
    }
    if (seen.has(id)) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, `Chapter ${id} appears twice.`);
    }
    seen.add(id);
    const support = String(row.support ?? "supported");
    if (!SUPPORT_LEVELS.has(support)) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, `Unknown evidence strength: ${support}.`);
    }
    const signals = Array.isArray(row.signals) ? row.signals.slice(0, 8) : [];
    return {
      id: id as StoryProseFacts["chapters"][number]["id"],
      title: text(row.title, 200),
      eyebrow: text(row.eyebrow, 120),
      support: support as StoryProseFacts["chapters"][number]["support"],
      signals: signals.map((signal) => {
        const pair = (signal ?? {}) as Record<string, unknown>;
        return { label: text(pair.label, 80), value: text(pair.value, 200) };
      }),
      draft: text(row.draft, 2000),
    };
  });

  const glance = Array.isArray(raw.atAGlance) ? raw.atAGlance.slice(0, 8) : [];
  const themes = Array.isArray(raw.centralThemes) ? raw.centralThemes.slice(0, 5) : [];

  return {
    clientName: text(raw.clientName, 120) || undefined,
    headline: text(raw.headline, 200),
    subtitle: text(raw.subtitle, 300),
    atAGlance: glance.map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      return {
        label: text(row.label, 80),
        value: text(row.value, 120),
        context: text(row.context, 300),
      };
    }),
    centralThemes: themes.map((theme) => text(theme, 300)).filter(Boolean),
    chapters,
  };
}

/**
 * Canonical, so the same report hits the same entry however it arrives.
 *
 * The tier is part of the key. Without it the first reader of a chart decides
 * which effort every later reader of that chart gets -- an account arriving
 * second would be served the medium report it did not ask for, and an address
 * arriving second would be handed the expensive one for free. Two entries per
 * chart is the cost of the answer matching the asker.
 */
function cacheKey(facts: StoryProseFacts, tier: ProseTier): string {
  const canonical = [
    facts.headline,
    facts.subtitle,
    ...facts.centralThemes,
    ...facts.atAGlance.map((item) => `${item.label}=${item.value}`),
    ...[...facts.chapters]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((chapter) =>
        [
          chapter.id,
          chapter.support,
          chapter.signals.map((signal) => `${signal.label}=${signal.value}`).join(","),
          chapter.draft,
        ].join("|"),
      ),
  ].join(";");
  return `${tier}:${createHash("sha1").update(canonical).digest("hex")}`;
}

/* Markdown is forbidden by the prompt; this is what makes that true rather
   than requested. Applied per paragraph so a stray asterisk cannot survive. */
function clean(value: string): string {
  return stripInlineMarkdown(value).trim();
}

export async function POST(request: NextRequest) {
  try {
    let body: { facts?: unknown };
    try {
      body = (await request.json()) as { facts?: unknown };
    } catch {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, "Request body must be JSON.");
    }

    const facts = parseFacts(body.facts);
    const session = await sessionFromRequest(request);
    const tier: ProseTier = session ? "account" : "address";
    const effort = EFFORT_BY_TIER[tier];
    const key = cacheKey(facts, tier);

    const cached = cache.get(key);
    if (cached) {
      return NextResponse.json({ prose: cached, cached: true });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      /* The PDF still renders from the engine's own prose, so this is a
         thinner report rather than a broken download. */
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "Written prose is unavailable: ANTHROPIC_API_KEY is not configured.",
        { statusCode: 503 },
      );
    }

    /* Past the cache, so this request is about to cost money -- and more of it
       than any other route here. */
    const budget = await consumeLlmBudget("/api/chart/story-prose", request);
    if (!budget.allowed) {
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        route: "/api/chart/story-prose",
        event: "llm_budget_exhausted",
        scope: budget.scope,
      }));
      throw new ApiError(
        ErrorCode.RATE_LIMITED,
        budget.scope === "anonymous"
          ? "Sign in to download another written report today."
          : "Written reports are rate limited for today.",
        { details: { retryAfterSeconds: budget.retryAfterSeconds, scope: budget.scope } },
      );
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: REQUEST_TIMEOUT_MS,
    });

    const startedAt = Date.now();
    const response = await client.messages
      .stream({
        model: "claude-opus-5",
        max_tokens: 32000,
        /* thinking is omitted, which on this model runs adaptive by default. */
        output_config: {
          effort,
          format: { type: "json_schema", schema: STORY_PROSE_SCHEMA as unknown as Record<string, unknown> },
        },
        system: [
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        ],
        messages: [{ role: "user", content: renderStoryProseFacts(facts) }],
      })
      .finalMessage();

    const elapsedMs = Date.now() - startedAt;

    console.info(JSON.stringify({
      timestamp: new Date().toISOString(),
      route: "/api/chart/story-prose",
      event: "llm_usage",
      effort,
      tier,
      chapters: facts.chapters.length,
      elapsedMs,
      stopReason: response.stop_reason,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
    }));

    if (response.stop_reason === "refusal") {
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "The written report was declined.",
        { details: { category: response.stop_details?.category ?? null } },
      );
    }

    /* Truncation is a failure, not a short report. At this size a run that
       reasons past the ceiling returns unparseable JSON anyway, but checking
       the stop reason says so in the log rather than in a parse error. */
    if (response.stop_reason === "max_tokens") {
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        route: "/api/chart/story-prose",
        event: "llm_output_truncated",
        effort,
        outputTokens: response.usage.output_tokens,
      }));
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "The written report ran past its token ceiling.",
      );
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "The written report was not valid JSON.");
    }

    const prose = parseStoryProse(parsedJson);
    if (!prose) {
      throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "The written report was the wrong shape.");
    }

    const cleaned: StoryProse = {
      introduction: clean(prose.introduction),
      preface: prose.preface.map(clean).filter(Boolean),
      chapters: prose.chapters.map((chapter) => ({
        id: chapter.id,
        opening: clean(chapter.opening),
        narrative: chapter.narrative.map(clean).filter(Boolean),
      })).filter((chapter) => chapter.narrative.length > 0),
    };

    if (cleaned.chapters.length === 0) {
      throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "No written chapters were returned.");
    }

    /*
     * A short set is survivable here and worth a log line.
     *
     * applyStoryProse merges per chapter, so a chapter the model skipped keeps
     * the engine's draft -- the report is mixed rather than missing, and a
     * reader cannot tell except that one chapter reads more plainly. The same
     * failure on the varga route was a model writing nine notes when asked for
     * ten; there is no reason to think a nine-chapter document is immune.
     */
    const missing = missingProseChapters(facts, cleaned);
    if (missing.length > 0) {
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        route: "/api/chart/story-prose",
        event: "llm_chapters_incomplete",
        effort,
        asked: facts.chapters.length,
        returned: cleaned.chapters.length,
        missing,
      }));
    }

    remember(key, cleaned);
    return NextResponse.json({ prose: cleaned, cached: false });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      /* Most specific first: a 400 from us is a bug, a 429 is worth retrying,
         a connection error is the network. */
      if (error instanceof Anthropic.BadRequestError) {
        console.error("story-prose: bad request to Anthropic", error.message);
      } else if (error instanceof Anthropic.AuthenticationError) {
        console.error("story-prose: ANTHROPIC_API_KEY rejected");
      } else if (error instanceof Anthropic.RateLimitError) {
        console.error("story-prose: rate limited");
      } else if (error instanceof Anthropic.APIConnectionTimeoutError) {
        console.error("story-prose: timed out after", REQUEST_TIMEOUT_MS, "ms");
      } else if (error instanceof Anthropic.APIError) {
        console.error("story-prose: Anthropic error", error.status, error.message);
      } else {
        console.error("story-prose: unexpected", error);
      }
    }
    return errorResponse(error, "The written report could not be prepared.");
  }
}
