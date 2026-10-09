/**
 * Daily spend ceilings for the routes that call a paid LLM provider.
 *
 * Why this exists alongside lib/rate-limiter.ts: that module answers "is this
 * one caller hammering us right now", and it answers it well. It cannot answer
 * "is today's bill about to be a problem", because its window resets every 60
 * seconds -- 5 requests a minute is 7,200 requests a day -- and a caller with a
 * pool of addresses never trips a per-IP limit at all. Those are the two ways an
 * API key actually gets burned, and neither is a burst.
 *
 * So this is the second layer, and it is deliberately a different shape: a
 * ceiling per UTC day, counted both globally per route and per caller, checked
 * immediately before the provider call and never on a cache hit.
 *
 * WHO A CALLER IS
 *
 * A signed-in account and a signed-out address are both callers here, but they
 * are not the same kind of thing and they do not get the same allowance. An
 * address is a weak name for a person in both directions at once -- a proxy
 * pool makes one abuser look like thousands, a campus NAT makes thousands of
 * people look like one -- so no single number set on it is right. The signed-out
 * tier is therefore sized as a taste of the feature, and the full allowance is
 * attached to an account, which is a name a caller cannot mint by the thousand
 * and cannot have imposed on them by their employer's router.
 *
 * A refusal at the signed-out tier reports `scope: "anonymous"` rather than
 * `"caller"`, because it is the one refusal the visitor can lift themselves.
 *
 * TWO LAYERS, AND WHY BOTH
 *
 * The counters live in Postgres (`llm_budget_counters`, incremented by a single
 * atomic upsert in lib/db/llm-budget-counters.ts), which is what makes the
 * number below a real ceiling rather than a per-instance one. They are also
 * mirrored in process memory, and the mirror is consulted first.
 *
 * The mirror is a *fast rejection* layer, and it is sound as one for a specific
 * reason: an instance's local tally only ever counts calls that instance made,
 * so it is a lower bound on the shared total. Local >= limit therefore implies
 * shared >= limit, and the refusal needs no round trip. The converse does not
 * hold, so local < limit proves nothing and the shared counter is consulted.
 * An allowed call pays one round trip; a refused one, after the first, pays
 * nothing -- which is the right way round, because the traffic being refused is
 * by definition the traffic there is a lot of.
 *
 * Mirroring the returned count back into memory is what closes the loop: once
 * the shared counter has told an instance the route is spent, that instance
 * refuses locally from then on, and stops writing rows for callers it has never
 * seen. The table cannot be inflated by the abuse it is there to stop.
 *
 * WHEN NEON IS DOWN
 *
 * The failure mode is a deliberate choice, so: **a database error degrades to
 * the process-local ceiling. It does not block the call.** The degraded state
 * is not "no ceiling" -- it is exactly the (instances x limit) ceiling this
 * module shipped with, which still bounds a runaway client loop and a single
 * determined abuser, i.e. the ways a key is actually emptied. Failing closed
 * would trade a bounded, time-limited overspend for a certain and immediate
 * outage of three user-facing features every time Neon hiccups, which is the
 * worse trade for an app whose LLM output is an enrichment on top of chart
 * arithmetic that still works. A failing round trip is also not retried on
 * every subsequent call: the first error opens a short circuit breaker so an
 * outage does not add a database timeout to every LLM request's latency.
 */

import {
  bumpSharedLlmCounters,
  isSharedLlmCounterConfigured,
  pruneSharedLlmCounters,
  type SharedLlmCounts,
} from "@/lib/db/llm-budget-counters";
import { sessionFromRequest } from "@/lib/identity/require-session";
import { LLM_ACCOUNT_PER_DAY, LLM_FREE_PER_DAY } from "@/lib/llm-budget-tiers";
import { clientKey } from "@/lib/rate-limiter";

export type LlmRouteKey =
  | "/api/chart/current-period"
  | "/api/chart/domain-brief"
  | "/api/chart/advanced-story"
  | "/api/chart/varga-commentary"
  | "/api/chart/yoga-classics"
  | "/api/chart/area-classics"
  | "/api/chart/ask-classics"
  | "/api/chart/dasha-reading"
  | "/api/chart/life-shifts"
  | "/api/chart/story-prose"
  | "/api/palm-reading"
  | "/api/palm-reading/ask";

type LlmBudgetConfig = {
  /** Paid calls this route may make in one UTC day, across every caller. */
  perDay: number;
  /** Paid calls one signed-in account may make in one UTC day. */
  perCallerPerDay: number;
  /** Paid calls one signed-out address may make in one UTC day. */
  perAnonPerDay: number;
};

/*
 * Sized by what the call costs, not by what feels generous.
 *
 * 2026-10-04: every route moved to Claude Opus 5.5 at low effort, the owner's
 * call to hold costs down across the sections. Opus 5.5 is 20% cheaper per
 * token than Opus 5 ($4/$20 against $5/$25), and low spends less on
 * thinking, which is most of the output bill. The per-call figures below were
 * measured on Opus 5 at the efforts they name, so read them as ceilings now
 * rather than measurements, and re-measure from the llm_usage lines. The
 * daily totals are left as they were: they bound a bad day, and a cheaper
 * call only widens the margin.
 *
 * 2026-10-06: every route except palm reading and its follow-up questions
 * moved to Claude Haiku 4.5, the owner's call to cut the bill again. Haiku is
 * $1/$5 per million tokens, a quarter of Opus 5.5's rates, and with `thinking`
 * omitted it does not think, so the thinking that was most of the output bill
 * is gone as well. Two things in the llm_usage lines change with it: there is
 * no effort to log, so those routes log the model instead; and Haiku caches
 * nothing under a 4,096-token prefix, which is every chart route's system
 * prompt, so their cacheReadTokens read 0, and where the figures below
 * mention a cached system prefix they describe Opus. Palm reading and its
 * follow-ups went back to Claude Opus 5 at low effort. The daily totals stay
 * as they were, for the reason above.
 *
 * 2026-10-07: the same routes moved to Claude Haiku 5.5 at low effort
 * (lib/llm-models.ts), the owner's call. It is $0.10/$0.50 per million tokens
 * for prompts up to 100K tokens, a tenth of Haiku 4.5, though its tokenizer
 * counts the same text about 30% higher and low effort may spend a little on
 * thinking. It also caches from 512 tokens, so the system prompts the routes
 * already mark are cached again and cacheReadTokens stop reading 0. Every
 * Haiku figure below was measured on Haiku 4.5 and is now a ceiling about
 * eight times too high; the Opus retries cost what they did. The daily
 * totals stay, for the reason above. Also from that day the classical notes'
 * checks block in every language, English included, and in English they
 * catch "king" and insults turned on the reader, so English notes can retry
 * on Opus too; the worst cases written below already assume every unit
 * retries.
 *
 * The route totals are whole-deployment numbers rather than per-instance ones,
 * so they bite where they read. They are sized by what a call costs: the short
 * text routes use Claude Opus 5 with a cached system prefix, while palm reading uses
 * Opus 5 vision over an image with nothing cached, and its reading is about
 * five thousand output tokens -- $0.125 of output alone, so roughly $0.15 a
 * call. An order of magnitude dearer, hence 100 a day against 2500.
 *
 * (This said "high effort with max_tokens 6000" until 2026-09-13. That route
 * settled on `low` and 16000 after measuring -- higher effort spends the budget
 * on thinking and truncates the reading mid-JSON; see its own header. The
 * conclusion drawn here was right and the reason given for it had gone stale.)
 *
 * Follow-up questions sit between the two: Opus 5 at low effort (medium before
 * 2026-10-04), max_tokens 700, with a cached system prefix but a per-reading context that cannot be
 * shared between callers. Cheap per call, but a conversation is many calls
 * where a reading is one, so the route total is set well above palm reading's
 * while the per-caller number stays the same -- the ceiling that matters for a
 * question thread is the daily allowance, not the route's.
 *
 * The varga commentary is the dearest of the text routes and the one a visitor
 * can only spend once. Opus 5 at medium effort, ten notes in a single response
 * against the same cached system prefix: 2831 input and 1799 output tokens
 * measured, which is $0.0596 a call -- about seven times a one-paragraph note. The
 * atlas asks for all ten key vargas at once, on mount, so one atlas visit is
 * one call and there is no drill-down that could make it many.
 *
 * Roughly three quarters of that is output tokens, which is the number to watch
 * if the notes are ever allowed to run longer: the first draft came back at
 * ~600 characters each and cost $0.0733.
 *
 * (This said $0.055 until the arithmetic was checked. `usage.input_tokens`
 * already excludes the cached prefix -- cache reads and writes are reported
 * separately -- and subtracting the 964-token prefix from it again discounted
 * the same tokens twice. Worth knowing before quoting any of these figures:
 * total prompt is input_tokens + cache_read + cache_creation, not input_tokens.)
 *
 * That makes 400 a count of distinct charts per day rather than of
 * interactions, and it is a ceiling rather than a forecast: 400 x $0.0596 is
 * about $24, and only a day that exhausts the route reaches it. The cheap
 * text routes can afford 2500 because they cost fractions of a cent; this one
 * cannot, and sizing it like them would have put a $150 day one cache miss
 * away.
 *
 * The written PDF report is the dearest call in the app by a wide margin, and
 * also varies its effort by who is asking. Opus 5 over the whole
 * nine-chapter document, streamed, max_tokens 32000, at HIGH for an account
 * and MEDIUM for a signed-out address. Measured on the sample chart:
 *
 *     high     186s   4,467 input   13,700 output   $0.37   2,897 words
 *     medium    97s   4,467 input    6,112 output   $0.18   2,673 words
 *
 * Output is 94% of the cost either way, and almost all of the difference is
 * thinking rather than prose -- the two tiers write the same amount. So the
 * split saves half the price of the dearest route for the callers whose
 * identity is cheapest to mint, and what it costs them is the cross-chapter
 * care that no single paragraph shows.
 *
 * 60 a day is the worst case -- sixty accounts each taking a high-effort
 * report -- which is about $22, deliberately the same daily exposure as palm
 * reading's 100 and the varga atlas's 400. Three routes, one ceiling on what a
 * bad day costs. A realistic mix lands well under it. It is also a count of
 * distinct reports per reader: since 2026-10-06 the cache is keyed by the
 * request *and* the caller (see that route's cacheKey), so a reader's second
 * download of the same reading is free, and no caller is served a report that
 * another caller's download paid for.
 *
 * THE TWO TIERS are 4 free, then 8 once registered, on every route in the
 * table. An address is a weak name for a person in both directions at once --
 * a proxy pool makes one abuser look like thousands, a campus NAT makes
 * thousands of people look like one -- so no number set on it is right, and the
 * signed-out one is still set below a working allowance. Registering is what
 * buys a real one, because an account is a name a caller cannot mint by the
 * thousand and cannot have imposed on them by their employer's router.
 *
 * These were 2 and 10, then 5 and 15, and are now 4 and 8. The first move was a
 * raise, because the ceiling a real session met first was the one on the
 * cheapest route -- a five-level dasha drill-down reached dozens of distinct
 * chains (its paid chain reading was removed on 2026-10-08). This one is a cut, because the mix stopped being cheap: the varga
 * commentary is $0.0596 a call, and an allowance sized against routes that cost
 * fractions of a cent stopped describing what a caller can actually spend.
 *
 * The shape is unchanged -- signed-out is a taste, an account is the working
 * allowance -- but the gap between them narrowed from threefold to twofold. So
 * registering now buys twice as much rather than three times as much, and the
 * sign-in prompt lands one reading earlier than it used to.
 *
 * WHAT THE CUT BUYS is mostly bounded at the route rather than at the caller.
 * The text routes cache, so only *distinct* requests count -- revisiting a
 * dasha period or a domain is free -- and their totals did not move. Palm
 * reading is where a per-caller number is real money, and its total halved:
 * 100 a day is about $15 of exposure where 200 was about $30.
 *
 * Note which way the *proportions* went. A signed-out address can now take 4%
 * of palm reading's day and an account 8%, up from 2.5% and 7.5%, because the
 * route total came down further than the tiers did. That is the intended shape
 * -- the number that bounds the bill is the route's, and the per-caller tiers
 * exist to stop one visitor eating it, which 8 out of 100 still does.
 *
 * Follow-up questions remain the one place where the per-caller number is a
 * *conversation* rather than that many features used, and eight is where this
 * change will be felt first: it is a short thread where fifteen was a session's
 * worth. That is the trade, made deliberately.
 */
const LLM_BUDGETS: Record<LlmRouteKey, LlmBudgetConfig> = {
  /* The same arithmetic as life-shifts below, and the same answer, reached
     from the other direction. A call here was about what the dasha
     drill-down's chain reading cost -- $0.0115 measured against its $0.0090,
     one paragraph either way against a cached prefix -- but it is not driven
     by clicking: the panel asks on mount, and the panel is on the results
     page, so this is bought by *visitors* rather than by the few who drill.
     That is the whole difference between that route's 2500 and this one's
     1200, which is about $14 of exposure on a day that exhausts the route.

     What holds it there is the cache key, which is the stack plus a coarse
     progress band rather than the live percentage the card prints. A chart
     costs one call and keeps costing nothing for the months until its
     antardasha changes band; keying on the percentage would have re-bought
     every reading at midnight and made this number a per-day-per-chart one. */
  "/api/chart/current-period": {
    perDay: 1200,
    perCallerPerDay: LLM_ACCOUNT_PER_DAY,
    perAnonPerDay: LLM_FREE_PER_DAY,
  },
  "/api/chart/domain-brief": {
    // One paid call covers all seven areas, the same briefs for every caller.
    perDay: 2500,
    perCallerPerDay: LLM_ACCOUNT_PER_DAY,
    perAnonPerDay: LLM_FREE_PER_DAY,
  },
  /* One call writes every passage on the advanced page, and that is a
     constraint rather than a preference: there are eight modules, so a call
     per module would spend over half a signed-in visitor's daily allowance on
     a single page view. */
  "/api/chart/advanced-story": {
    perDay: 2000,
    perCallerPerDay: LLM_ACCOUNT_PER_DAY,
    perAnonPerDay: LLM_FREE_PER_DAY,
  },
  "/api/chart/varga-commentary": {
    perDay: 400,
    perCallerPerDay: LLM_ACCOUNT_PER_DAY,
    perAnonPerDay: LLM_FREE_PER_DAY,
  },
  /* The classical note in the yoga section: Haiku 4.5 since 2026-10-06, over
     at most five yogas' passages, cited. Measured on Opus 5.5 at low effort,
     against a cached system prefix, on two sample charts on 2026-10-04:
     1,142-1,530 input tokens plus a
     1,248-token prefix, and 544-855 output tokens, which is $0.016-$0.029 a
     call, about half a varga atlas. Output is two thirds of it, so the
     word ceiling in the prompt is the lever, as on current-period.

     A chart costs one call and then nothing: the cache is keyed by the yogas
     and verses chosen, not the chart, so charts sharing their leading yogas
     share a note, and a chart none of whose yogas the book names never calls
     at all. The section is on the members-only advanced page, mounted only
     when scrolled to, so this is bought by signed-in readers who look at
     their yogas. 600 a day is about $17 on a day that exhausts the route,
     inside the $22 every dear route here is held to.

     Measured again on 2026-10-06: Haiku costs $0.003-$0.006 a note, and a
     note that fails its checks (most often a Hindi or Bengali one) is
     retried once on Opus 5.5 at low effort inside the same unit, so a unit
     costs $0.006 without the retry and about $0.036 with it. That puts an
     exhausted day at $4 if nothing retries and about $22 if everything does. */
  "/api/chart/yoga-classics": {
    perDay: 600,
    perCallerPerDay: LLM_ACCOUNT_PER_DAY,
    perAnonPerDay: LLM_FREE_PER_DAY,
  },
  /* The classical notes on the life-areas page: the same model as the yoga
     note, but one call writes every area -- up to seven documents of six
     short passages, about 3,000 input tokens, and seven notes of at most 70
     words, about 1,000-1,300 output tokens with Opus 5.5's thinking. At the yoga
     note's measured rates that is roughly $0.04 a call. That figure is an
     ESTIMATE from token counts, made on 2026-10-04 when the account's monthly
     limit stopped a live measurement; replace it from the llm_usage lines.

     A chart costs one call however many areas the reader opens, and the cache
     is keyed by the passages chosen, so charts that meet the same conditions
     share notes. The page is public and one link from the results page, so
     this is bought by visitors rather than only by members. 500 a day is
     about $20 on a day that exhausts the route, inside the $22 every dear
     route here is held to.

     Measured again on 2026-10-06: Haiku costs $0.005-$0.015 a call and Opus
     5.5 at low effort about $0.06 for every area. Areas that fail their
     checks are retried once on Opus inside the same unit, and only those,
     so a unit costs up to $0.015 without the retry and up to about $0.075
     with all seven. An exhausted day is $8 if nothing retries and about $37
     if every call retries every area, which only all-Hindi or all-Bengali
     traffic could approach: over the $22 line, so watch the llm_note_retry
     lines before raising the ceiling. */
  "/api/chart/area-classics": {
    perDay: 500,
    perCallerPerDay: LLM_ACCOUNT_PER_DAY,
    perAnonPerDay: LLM_FREE_PER_DAY,
  },
  /* "Ask the classics" on the life-areas page: one answer to one of a fixed
     set of questions, Haiku 4.5 over at most eight passages, cited. An
     ESTIMATE from token counts until the llm_usage lines say otherwise: about
     1,800 input tokens (the system prompt and eight short passages) and
     150-250 output, which is roughly $0.003 a call. The question's embedding
     is a separate OpenAI call of about a millionth of a dollar, made once per
     question per process, and not counted here.

     A unit is a question the reader clicks, so this is bought by clicking,
     unlike the notes that ask on mount; the per-caller tiers are what hold a
     visitor to a few questions a day. The cache is keyed by the question and
     the passages chosen, so charts that meet the same conditions share
     answers, and asking a question twice is free. An answer that fails its
     checks is retried once on Opus 5.5 at low effort inside the same unit,
     about $0.03, as on the other classical notes. 600 a day is about $2 if
     nothing retries and about $20 if everything does, inside the $22 every
     dear route here is held to.

     2026-10-07: questions the reader types, and answers in every language.
     A typed question is screened first, on Haiku with a structured output:
     about 830 input and 30 output tokens, under $0.001, measured. The screen
     and the answer are one unit, and a question the screen refuses still
     spends it, so trying instructions over and over costs the caller their
     day, not the route's. Hindi and Bengali answers retry on Opus about half
     the time, as on the other notes, which the $20 worst case above already
     assumes of every unit. */
  /* 2026-10-07, the owner's call: more questions a day than the other routes
     allow, the one exception to "4 free, 8 signed in". Eight ready questions
     and a box to type more were a visitor's allowance spent in one visit,
     and an answer now costs about $0.001 on Haiku 5.5 at low effort. Twelve
     signed out and twenty-four signed in keep the shape the tiers have
     (signing in buys twice as much). The route total rises to 700 from 600:
     about $0.70 a day if nothing retries, and $22 if every unit retried on
     Opus, the ceiling every dear route here is held to. The panel words its
     own limit message and states no number, so nothing else needs to change
     with these. */
  "/api/chart/ask-classics": {
    perDay: 700,
    perCallerPerDay: 24,
    perAnonPerDay: 12,
  },
  /* The reading for one dasha period the reader picks on the timeline, from
     a Maha Dasha down to a Sookshma (2026-10-08): Haiku 5.5 at low effort
     over the period's facts and up to ten cited passages, about the size of
     an "Ask the classics" answer, so about $0.001 a reading. It is bought by
     a click on "Read this period", never on mount or on a drill, so this is
     paid by readers who ask, as the old drill-down's chain reading was. The tiers
     stay the standard four and eight: the sign-in prompt states those numbers
     for "Dasha readings", and an exception would make it wrong. The total is
     Ask the classics' 700 for the same reason: $22 if every unit retried on
     Opus, the ceiling every dear route here is held to. */
  "/api/chart/dasha-reading": {
    perDay: 700,
    perCallerPerDay: LLM_ACCOUNT_PER_DAY,
    perAnonPerDay: LLM_FREE_PER_DAY,
  },
  /* Sized by where it renders rather than by what one call costs, which is
     the opposite way round from the atlas above it. A call here is cheaper
     -- at most five short readings against varga's ten -- but the brief
     variant of the panel sits on the results page, which is the most
     visited surface in the app, where the atlas is two navigations deep.
     Against that, the panel asks only for the chapters it actually renders
     (one on the results page, up to five on /insights/life-shifts) and the
     route caches by chapter set, so a chart costs one call rather than one
     per view. 1200 is roughly half the chart routes' ceiling: enough that a
     normal day never touches it, low enough that a bad day is a section
     falling back to its templates rather than a bill. Revisit it against
     the llm_usage lines once this has run for a week. */
  "/api/chart/life-shifts": {
    perDay: 1200,
    perCallerPerDay: LLM_ACCOUNT_PER_DAY,
    perAnonPerDay: LLM_FREE_PER_DAY,
  },
  "/api/chart/story-prose": {
    perDay: 60,
    perCallerPerDay: LLM_ACCOUNT_PER_DAY,
    perAnonPerDay: LLM_FREE_PER_DAY,
  },
  "/api/palm-reading": {
    perDay: 100,
    perCallerPerDay: LLM_ACCOUNT_PER_DAY,
    perAnonPerDay: LLM_FREE_PER_DAY,
  },
  "/api/palm-reading/ask": {
    perDay: 1500,
    perCallerPerDay: LLM_ACCOUNT_PER_DAY,
    perAnonPerDay: LLM_FREE_PER_DAY,
  },
};

const MS_PER_DAY = 86_400_000;

/** Days of spent counters to keep for reading back; today is day zero of these. */
const COUNTER_RETENTION_DAYS = 7;

/** How long one database error suppresses the round trip on this instance. */
const SHARED_OUTAGE_COOLDOWN_MS = 30_000;

/**
 * This instance's view of the counters, for the current UTC day only.
 *
 * Holds the larger of what this instance has spent and what the shared counter
 * last reported, so it is always a lower bound on the true total -- which is
 * the property the fast rejection above depends on.
 */
const counters = new Map<string, number>();
let countersDay = -1;

/** Set on a database error; the shared counter is skipped until `now` passes it. */
let sharedUnavailableUntil = 0;

/** The UTC day whose prune has already been issued by this instance. */
let prunedDay = -1;

function utcDayNumber(now: number) {
  return Math.floor(now / MS_PER_DAY);
}

/** The `utc_day` key: the UTC calendar date, derived from the day number. */
function utcDayKey(dayNumber: number) {
  return new Date(dayNumber * MS_PER_DAY).toISOString().slice(0, 10);
}

function secondsUntilUtcMidnight(now: number) {
  const nextMidnight = (utcDayNumber(now) + 1) * MS_PER_DAY;
  return Math.max(1, Math.ceil((nextMidnight - now) / 1000));
}

function rollOver(now: number) {
  const day = utcDayNumber(now);
  if (day !== countersDay) {
    /* A new UTC day makes every existing count meaningless, so there is nothing
       to scan or filter -- the map goes. Postgres cannot do the same trick
       because the rows outlive the process, hence the prune below. */
    counters.clear();
    countersDay = day;
  }
}

/**
 * Which ceiling refused.
 *
 * `anonymous` is split out from `caller` because it is the only one of the
 * three a visitor can do something about right now, and "rate limited, try
 * again tomorrow" is the wrong thing to tell someone whose actual position is
 * "sign in and carry on". The routes pass this through to the client so the
 * refusal can read as an invitation rather than a wall.
 */
export type LlmBudgetScope = "global" | "caller" | "anonymous";

export type LlmBudgetResult =
  | { allowed: true; remaining: number; callerRemaining: number }
  | {
      allowed: false;
      scope: LlmBudgetScope;
      retryAfterSeconds: number;
    };

function refuse(scope: LlmBudgetScope, now: number): LlmBudgetResult {
  return { allowed: false, scope, retryAfterSeconds: secondsUntilUtcMidnight(now) };
}

/**
 * Who is spending, and therefore which allowance applies.
 *
 * `user:` and `ip:` are namespaced rather than bare so the two can never name
 * the same bucket, and so a row in `llm_budget_counters` says which kind of
 * caller it counted without anyone having to infer it from the shape.
 */
export type LlmCaller = {
  key: string;
  signedIn: boolean;
};

/** The session cookie's value, without parsing the whole jar. */

/**
 * Resolve the caller, falling back to the address on any doubt.
 *
 * No cookie means no query -- `resolveSession` returns on a null token before
 * it touches the database -- so the signed-out path, which is the one abuse
 * arrives on, costs nothing extra.
 *
 * A failed lookup is treated as signed out rather than propagated. These three
 * routes have never required an account and must not start 500ing because the
 * session store is unreachable; the cost of guessing wrong is the smaller
 * allowance, which is the safe direction to be wrong in.
 *
 * Exported for a route that has to know who is asking before its cache
 * lookup -- the PDF report keeps an entry per caller -- and that then hands
 * the caller to consumeLlmBudget, so the session is read once, not twice.
 */
export async function resolveLlmCaller(request: Request): Promise<LlmCaller> {
  const session = await sessionFromRequest(request);
  if (session) {
    return { key: `user:${session.userId}`, signedIn: true };
  }
  /* An IPv6 caller counts as its /64; see clientKey. */
  return { key: `ip:${clientKey(request)}`, signedIn: false };
}

/**
 * Ask for the old days to go, once per process per day, without blocking.
 *
 * Deliberately not awaited and deliberately swallowing its error: a failed
 * prune means seven-day-old rows live a little longer, which is not a reason to
 * fail or slow down the request that happened to trigger it. `prunedDay` is set
 * before the call, not after, so a burst of concurrent requests issues one
 * delete rather than one each.
 */
function schedulePrune(day: number) {
  if (prunedDay === day) {
    return;
  }
  prunedDay = day;
  void pruneSharedLlmCounters(utcDayKey(day - COUNTER_RETENTION_DAYS)).catch(() => {});
}

/**
 * Reserve one paid call against `route`'s daily budget.
 *
 * Call this *after* the cache lookup and immediately before the provider call,
 * so a served-from-cache response costs nothing. A reservation is not released
 * if the provider then fails: counting an attempt that reached the provider is
 * the safe direction, because a provider erroring after it has already billed
 * us is exactly the case a budget is for.
 *
 * `from` is the request, or the caller resolveLlmCaller has already read from
 * it; either way the same allowance is spent.
 */
export async function consumeLlmBudget(
  route: LlmRouteKey,
  from: Request | LlmCaller,
  now: number = Date.now(),
): Promise<LlmBudgetResult> {
  rollOver(now);

  const config = LLM_BUDGETS[route];
  /* Told apart by shape, not `instanceof Request`, which a request built from
     another copy of the class would fail -- and be counted as a caller. */
  const caller = "signedIn" in from ? from : await resolveLlmCaller(from);
  /* One number or the other, chosen once, so every check below and the
     `remaining` reported back all speak about the same allowance. */
  const callerLimit = caller.signedIn ? config.perCallerPerDay : config.perAnonPerDay;
  const callerScope: LlmBudgetScope = caller.signedIn ? "caller" : "anonymous";
  const globalKey = route;
  const callerKey = `${route}::${caller.key}`;

  /* Layer one: this instance's mirror. A refusal here is free and correct --
     see the header on why a local count can only understate the shared one. */
  const localGlobal = counters.get(globalKey) ?? 0;
  if (localGlobal >= config.perDay) {
    return refuse("global", now);
  }

  const localCaller = counters.get(callerKey) ?? 0;
  if (localCaller >= callerLimit) {
    return refuse(callerScope, now);
  }

  /* Reserved locally before the await, so that concurrent calls on this
     instance cannot all pass the check above on the same stale reading, and so
     the ceiling still exists at all if the round trip below never happens. */
  counters.set(globalKey, localGlobal + 1);
  counters.set(callerKey, localCaller + 1);

  const localResult: LlmBudgetResult = {
    allowed: true,
    remaining: config.perDay - localGlobal - 1,
    callerRemaining: callerLimit - localCaller - 1,
  };

  if (!isSharedLlmCounterConfigured() || now < sharedUnavailableUntil) {
    return localResult;
  }

  const day = utcDayNumber(now);
  let shared: SharedLlmCounts;
  try {
    shared = await bumpSharedLlmCounters(utcDayKey(day), route, caller.key);
  } catch (error) {
    sharedUnavailableUntil = now + SHARED_OUTAGE_COOLDOWN_MS;
    console.warn(JSON.stringify({
      timestamp: new Date(now).toISOString(),
      route,
      event: "llm_budget_shared_counter_unavailable",
      /* Named so the log reads as the decision it is, not as a bare error. */
      degradedTo: "per-instance ceiling",
      cooldownSeconds: SHARED_OUTAGE_COOLDOWN_MS / 1000,
      error: error instanceof Error ? error.message : String(error),
    }));
    return localResult;
  }

  sharedUnavailableUntil = 0;
  schedulePrune(day);

  /* The shared totals include every other instance, so they can only be larger.
     Taking the max both keeps the mirror a valid lower bound and arms the fast
     rejection above: once the shared counter says the route is spent, this
     instance stops asking. */
  counters.set(globalKey, Math.max(counters.get(globalKey) ?? 0, shared.routeTotal));
  counters.set(callerKey, Math.max(counters.get(callerKey) ?? 0, shared.caller));

  /* Strictly greater, because the returned counts already include this call. */
  if (shared.routeTotal > config.perDay) {
    return refuse("global", now);
  }
  if (shared.caller > callerLimit) {
    return refuse(callerScope, now);
  }

  return {
    allowed: true,
    remaining: config.perDay - shared.routeTotal,
    callerRemaining: callerLimit - shared.caller,
  };
}

/**
 * Current usage for one route, for logging and for the tests.
 *
 * This instance's view, which is the shared total as of its last round trip and
 * never higher than the truth. Synchronous on purpose: the callers of this are
 * log lines and assertions, and neither is worth a query. `used` can read above
 * `limit` once the ceiling has been hit, because a refused attempt is counted
 * before it is refused.
 */
export function readLlmBudgetUsage(route: LlmRouteKey, now: number = Date.now()) {
  rollOver(now);
  return {
    used: counters.get(route) ?? 0,
    limit: LLM_BUDGETS[route].perDay,
  };
}

/** Test seam. Never called by application code. */
export function __resetLlmBudgetForTests() {
  counters.clear();
  countersDay = -1;
  sharedUnavailableUntil = 0;
  prunedDay = -1;
}
