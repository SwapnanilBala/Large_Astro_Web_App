import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import { consumeLlmBudget } from "@/lib/llm-budget";
import { stripInlineMarkdown } from "@/lib/prompt-input";
import { IMPORTANT_DIVISION_NUMBERS } from "@/lib/divisional-chart-guide";
import {
  COMMENTARY_LANGUAGES,
  COMMENTARY_POINTS,
  type VargaNote,
} from "@/lib/varga-commentary";

/*
 * Chart-specific commentary for the varga atlas.
 *
 * What the page already had: a curated paragraph per key varga, written once
 * and translated into six languages, saying what D9 *is*. What it did not have
 * is anything about what D9 says on *this* chart -- the atlas showed a table of
 * signs and left the reader to draw the line between them. That line is what
 * this route asks for.
 *
 * ── ONE CALL, TEN VARGAS ───────────────────────────────────────────────────
 *
 * The brief was that the model should research and comment once, on the key
 * vargas. Both halves are enforced here rather than left to the caller:
 *
 *   Once -- one request covers all ten. Not ten requests, and not one per tab
 *   switch. A per-division route would have been the obvious shape and is the
 *   wrong one: ten calls cost ten times the input tokens for the same chart,
 *   ten budget units, and ten chances to fail separately, and the notes would
 *   have been written without sight of each other. Written together, the model
 *   can say that D9 and D10 agree, which is the observation a reader actually
 *   wants and which no single-varga call can make.
 *
 *   Key vargas only -- IMPORTANT_DIVISION_NUMBERS, the ten the atlas already
 *   promotes (D1, D2, D4, D7, D9, D10, D12, D24, D30, D60). The engine
 *   calculates twenty; the other ten are supporting charts the report is
 *   deliberately not meant to present as independent verdicts, and paying a
 *   model to comment on them would undo that. A request naming one is refused.
 *
 * ── EFFORT -- medium ───────────────────────────────────────────────────────
 *
 * Asked for, and measured rather than taken on trust. Sweeping this route's own
 * shipped prompt over the ten-varga payload
 * (`node scripts/effort-compare.mjs --route varga --efforts low,medium,high`):
 *
 *     low     ~1100 output tokens   ~19.0s   $0.045
 *     medium  ~1859 output tokens   ~25.6s   $0.064
 *     high    ~5045 output tokens   ~52.1s   $0.143
 *
 * Medium is 1.4x low. The interesting column is the middle one: high takes 52
 * seconds, which is past REQUEST_TIMEOUT_MS below and within a rounding error
 * of `maxDuration`. So on this route medium is not a balance point between
 * quality and cost -- it is the highest setting that fits, and raising the dial
 * further would not produce a better answer, it would produce a timeout.
 *
 * (Those three rows are the prompt without the output schema, because that is
 * what the sweep script sends. The shipped path costs slightly less -- 1799
 * output tokens, 25.4s -- since the schema does the structuring that the model
 * otherwise spends tokens inventing. At high, without a schema, it started
 * emitting a fenced JSON block unprompted.)
 *
 * What medium buys over low is the cross-varga observation. The job is not ten
 * independent paragraphs -- it is ten paragraphs that have read each other, and
 * that is the part a lower setting drops first.
 *
 * ── GROUNDING ──────────────────────────────────────────────────────────────
 *
 * The engine decides every sign; the model is allowed to say what the pattern
 * means and nothing else. No degrees, no houses, no aspects, no dates, no
 * strengths -- none of which it is given, and all of which it could plausibly
 * invent. Same contract as the dasha route: the engine owns what is true, the
 * model owns how it reads.
 */

const EFFORT = "medium" as const;

export const maxDuration = 60;

/*
 * Ten paragraphs in one response, so this is a bigger generation than the other
 * chart routes and the timeout is set against the route's own ceiling rather
 * than copied from them. 45s leaves the handler room to return a real error
 * inside maxDuration instead of being killed mid-flight.
 */
const REQUEST_TIMEOUT_MS = 45_000;

/*
 * Bounded, process-lifetime, keyed by the chart's own placements.
 *
 * The same atlas is revisited constantly -- every tab switch used to be a
 * re-render and every back-navigation a fresh mount -- and the commentary for a
 * given set of placements never changes. Persisting it would mean a row per
 * chart in `generated_artifacts`, which is scoped to a signed-in user and a
 * saved chart; this feature works signed-out, so that table is the wrong home
 * and a cache is the honest one. The cost of a cold process is one call.
 */
const MAX_CACHE_ENTRIES = 200;
const cache = new Map<string, VargaNote[]>();

function remember(key: string, value: VargaNote[]) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

const KEY_DIVISIONS = new Set<number>(IMPORTANT_DIVISION_NUMBERS);
const POINTS = new Set<string>(COMMENTARY_POINTS);

const SIGNS = new Set([
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
]);

/*
 * Frozen, so it is the cacheable prefix. Everything that varies per chart --
 * the placements -- goes in the user turn, after the breakpoint. Across
 * visitors this is the same prefix every time, which is the whole reason the
 * per-call input cost of a ten-varga prompt stays reasonable.
 */
const SYSTEM_PROMPT = `You write the chart-specific notes for the divisional-chart atlas of a Vedic astrology report.

You are given the ten key vargas for one birth chart. For each, you get every point's sign in the D1 (the main chart) and its sign in that varga. That is the whole of your evidence.

Return exactly one note for every varga you are given -- no more, no fewer -- and set the "division" field on each to that varga's number. The user turn names the count and lists the numbers; check your output against that list before you finish.

Rules for each note:
- Two sentences, 45 words at the outside. No heading, no preamble, no list, no markdown, no varga label -- the page prints the label itself. These sit in a fixed panel beside the chart, so a note that runs long is a note that gets cut off.
- Say what this varga shows for THIS chart. Name the specific signs you are reasoning from. A note that would read the same for any chart is a failed note.
- A point whose varga sign repeats its D1 sign is a consistency signal: the theme is carried rather than redirected. Say so where it matters, and do not treat it as automatically good or bad.
- Address the reader as "you".
- State nothing you were not given. No degrees, no houses, no house lords, no aspects, no nakshatras, no planetary strengths, no dashas, no dates. If you want to say something you cannot support from the signs above, leave it out.
- No predictions of specific events, no health, legal, or financial advice, and nothing fatalistic. A varga describes emphasis, not outcome.

Rules across the set:
- You are writing ten notes that have read each other. Where two vargas point the same way, or pull against each other, say so in one of them rather than in both.
- Do not repeat the same observation in more than one note.
- D1 is the foundation the others refine. D30 and D60 are fine-grained and should be phrased with more reserve than the rest.`;

const NotesSchema = z.object({
  notes: z.array(
    z.object({
      division: z.number().int(),
      note: z.string(),
    }),
  ),
});

type RawPosition = { name: string; rashi: string; divisional: string };
type RawFacts = { division: number; label: string; positions: RawPosition[] };

function parseDivisions(value: unknown): RawFacts[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiError(
      ErrorCode.VALIDATION_FAILED,
      "`divisions` must be a non-empty array.",
    );
  }
  if (value.length > KEY_DIVISIONS.size) {
    throw new ApiError(
      ErrorCode.VALIDATION_FAILED,
      `\`divisions\` may hold at most ${KEY_DIVISIONS.size} entries.`,
    );
  }

  const seen = new Set<number>();
  return value.map((entry) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    const division = Number(row.division);
    if (!KEY_DIVISIONS.has(division)) {
      /* The product rule, enforced where it costs money. See the header. */
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        `D${row.division} is not one of the key vargas this route comments on.`,
      );
    }
    if (seen.has(division)) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, `D${division} appears twice.`);
    }
    seen.add(division);

    if (!Array.isArray(row.positions) || row.positions.length === 0) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        `D${division} carries no positions.`,
      );
    }
    if (row.positions.length > POINTS.size) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        `D${division} carries more positions than there are points.`,
      );
    }

    const positions = row.positions.map((raw) => {
      const position = (raw ?? {}) as Record<string, unknown>;
      const name = String(position.name ?? "");
      const rashi = String(position.rashi ?? "");
      const divisional = String(position.divisional ?? "");
      /* Every field is a closed set, so nothing free-form from the browser
         reaches the prompt. That is cheaper to guarantee here than to reason
         about downstream. */
      if (!POINTS.has(name) || !SIGNS.has(rashi) || !SIGNS.has(divisional)) {
        throw new ApiError(
          ErrorCode.VALIDATION_FAILED,
          `D${division} has a position this route does not recognise.`,
        );
      }
      return { name, rashi, divisional };
    });

    return { division, label: `D${division}`, positions };
  });
}

/** Canonical, so the same chart hits the same entry whatever order it arrives in. */
function cacheKey(facts: RawFacts[]): string {
  const canonical = [...facts]
    .sort((left, right) => left.division - right.division)
    .map((fact) => {
      const positions = [...fact.positions]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((position) => `${position.name}:${position.rashi}>${position.divisional}`)
        .join(",");
      return `${fact.division}|${positions}`;
    })
    .join(";");
  return createHash("sha1").update(canonical).digest("hex");
}

function renderFacts(facts: RawFacts[]): string {
  return facts
    .map((fact) => {
      const rows = fact.positions
        .map((position) => {
          const repeats = position.rashi === position.divisional ? "  (repeats D1)" : "";
          return `  ${position.name}: D1 ${position.rashi} -> ${fact.label} ${position.divisional}${repeats}`;
        })
        .join("\n");
      return `${fact.label}\n${rows}`;
    })
    .join("\n\n");
}

export async function POST(request: NextRequest) {
  try {
    let body: { divisions?: unknown; language?: unknown };
    try {
      body = (await request.json()) as { divisions?: unknown; language?: unknown };
    } catch {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, "Request body must be JSON.");
    }

    const facts = parseDivisions(body.divisions);
    /* An unknown language is English, not an error: the page still works, and
       refusing a chart because the browser asked for a locale this table has
       not caught up with would be the wrong failure. */
    const languageCode =
      typeof body.language === "string" && body.language in COMMENTARY_LANGUAGES
        ? body.language
        : "en";
    const languageName = COMMENTARY_LANGUAGES[languageCode];
    /* Part of the key: the same placements in two languages are two answers. */
    const key = `${languageCode}:${cacheKey(facts)}`;

    const cached = cache.get(key);
    if (cached) {
      return NextResponse.json({ notes: cached, cached: true });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      /* The atlas renders its curated guidance either way, so this is a
         missing layer rather than a broken page. */
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "Chart notes are unavailable: ANTHROPIC_API_KEY is not configured.",
        { statusCode: 503 },
      );
    }

    /* Past the cache, so this request is about to cost money. */
    const budget = await consumeLlmBudget("/api/chart/varga-commentary", request);
    if (!budget.allowed) {
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        route: "/api/chart/varga-commentary",
        event: "llm_budget_exhausted",
        scope: budget.scope,
      }));
      throw new ApiError(
        ErrorCode.RATE_LIMITED,
        budget.scope === "anonymous"
          ? "Sign in to keep reading chart notes today."
          : "Chart notes are rate limited for today.",
        { details: { retryAfterSeconds: budget.retryAfterSeconds, scope: budget.scope } },
      );
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: REQUEST_TIMEOUT_MS,
    });

    /*
     * Structured output rather than prose that this file then has to cut into
     * ten pieces. Ten notes in one response need a boundary, and every
     * boundary invented in a prompt -- a label, a blank line, a delimiter --
     * is one the model is free to put in the prose as well. A schema moves
     * that problem to the API, which is where it is actually solved.
     */
    const response = await client.messages.parse({
      model: "claude-opus-5",
      /* Headroom for thinking plus ten paragraphs, not a target. */
      max_tokens: 16000,
      /* thinking is omitted, which on this model runs adaptive by default. */
      output_config: {
        effort: EFFORT,
        format: zodOutputFormat(NotesSchema),
      },
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role: "user",
          content:
            `Write exactly ${facts.length} notes, one for each of these vargas: ` +
            `${facts.map((fact) => fact.label).join(", ")}.\n` +
            /* After the varga list and before the placements, so it is the
               last instruction read and the first thing acted on. Sign and
               varga names stay as given -- they are the page's own labels and
               a translated "Navamsa" would not match the heading above it. */
            `Write every note in ${languageName}. Leave planet names, sign names and varga labels exactly as they appear below.\n\n` +
            `${renderFacts(facts)}`,
        },
      ],
    });

    /*
     * One line per uncached call, so the effort question can be settled from
     * logs rather than from arithmetic -- the same reason the dasha route
     * carries one. Thinking bills at the output rate and is most of what a
     * request at this effort generates, so `outputTokens` is the number that
     * matters when someone next reaches for this dial.
     */
    console.info(JSON.stringify({
      timestamp: new Date().toISOString(),
      route: "/api/chart/varga-commentary",
      event: "llm_usage",
      effort: EFFORT,
      divisions: facts.length,
      language: languageCode,
      stopReason: response.stop_reason,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
    }));

    if (response.stop_reason === "refusal") {
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "The chart notes were declined.",
        { details: { category: response.stop_details?.category ?? null } },
      );
    }

    /*
     * Truncation is a failure, not a short answer. Thinking counts against
     * `max_tokens`, so a run that reasons past the ceiling returns whatever it
     * had reached -- with a schema that is usually unparseable, but a run that
     * stopped after six notes would parse fine and quietly ship four missing
     * ones. Checking the stop reason catches both.
     */
    if (response.stop_reason === "max_tokens") {
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        route: "/api/chart/varga-commentary",
        event: "llm_output_truncated",
        effort: EFFORT,
        outputTokens: response.usage.output_tokens,
      }));
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "The chart notes ran past their token ceiling.",
      );
    }

    const parsed = response.parsed_output;
    if (!parsed) {
      throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "No chart notes were returned.");
    }

    /* Keyed by division rather than taken in order: the schema does not
       promise the array came back in the order it was asked for, and a note
       printed under the wrong varga is worse than a missing one. */
    const byDivision = new Map<number, string>();
    for (const entry of parsed.notes) {
      const note = stripInlineMarkdown(entry.note).trim();
      if (note && KEY_DIVISIONS.has(entry.division)) {
        byDivision.set(entry.division, note);
      }
    }

    const notes: VargaNote[] = facts
      .map((fact) => ({ division: fact.division, note: byDivision.get(fact.division) ?? "" }))
      .filter((entry) => entry.note.length > 0);

    if (notes.length === 0) {
      throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "No chart notes were returned.");
    }

    /*
     * A short set is the failure mode this route actually has.
     *
     * The first ten-varga run came back with nine notes and `end_turn` -- not
     * truncated, the model simply wrote one fewer than asked, and D24 went out
     * with no note at all. Nothing upstream catches that: a schema cannot
     * require one entry per requested division, and nine well-formed notes
     * parse exactly as cleanly as ten.
     *
     * Not fatal, because the atlas prints its curated guidance for every varga
     * either way and a missing note costs a panel rather than a page. But it is
     * worth a log line, because the fix if it recurs is a prompt change and
     * nobody would think to make one from a page that merely looks a bit empty.
     */
    if (notes.length < facts.length) {
      const missing = facts
        .filter((fact) => !byDivision.has(fact.division))
        .map((fact) => fact.label);
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        route: "/api/chart/varga-commentary",
        event: "llm_notes_incomplete",
        effort: EFFORT,
        asked: facts.length,
        returned: notes.length,
        missing,
      }));
    }

    remember(key, notes);
    return NextResponse.json({ notes, cached: false });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      /* Most specific first: a 400 from us is a bug, a 429 is worth retrying,
         a connection error is the network. */
      if (error instanceof Anthropic.BadRequestError) {
        console.error("varga-commentary: bad request to Anthropic", error.message);
      } else if (error instanceof Anthropic.AuthenticationError) {
        console.error("varga-commentary: ANTHROPIC_API_KEY rejected");
      } else if (error instanceof Anthropic.RateLimitError) {
        console.error("varga-commentary: rate limited");
      } else if (error instanceof Anthropic.APIConnectionTimeoutError) {
        console.error("varga-commentary: timed out after", REQUEST_TIMEOUT_MS, "ms");
      } else if (error instanceof Anthropic.APIError) {
        console.error("varga-commentary: Anthropic error", error.status, error.message);
      } else {
        console.error("varga-commentary: unexpected", error);
      }
    }
    return errorResponse(error, "The chart notes could not be prepared.");
  }
}
