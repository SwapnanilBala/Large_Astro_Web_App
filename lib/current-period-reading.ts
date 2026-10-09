import { SIGN_ORDER } from "@/lib/constellation-geometry";
import { NAKSHATRAS } from "@/lib/engines/panchanga";
import { COMMENTARY_LANGUAGES } from "@/lib/varga-commentary";
import type { DashaInfo, NakshatraInfo, PlanetPosition } from "@/lib/astro-types";

/**
 * The facts the running dasha stack contributes to its written reading.
 *
 * Why this is not `/api/chart/dasha-reading` asked about today's periods: that
 * route reads one period the reader picks, from the chart's facts and the
 * classical passages, cited, and it is paid for by a click. This card is the
 * same subject at a different price. It is bought on mount for every visitor
 * who opens the timing section, so it is one short paragraph from closed-
 * vocabulary facts -- the reader's natal placements for these particular lords,
 * the nakshatra the whole Vimshottari sequence is counted from, and how far
 * through the period they are -- cached by a coarse progress band. Answering it
 * through the period reading would buy a cited reading for everyone who
 * scrolls past.
 *
 * Every field here comes from a closed vocabulary -- nine lords, twelve signs,
 * twelve houses, twenty-seven nakshatras, ISO dates, and beside them the
 * language codes COMMENTARY_LANGUAGES names -- which is what lets the route
 * validate rather than sanitize. The panel is a client component, so its
 * request body is caller-controlled and reaches a prompt; a field that admitted
 * free text would be the one place worth attacking. There is no such field.
 */

/** Outermost first. Deeper levels are the drill-down's business, not this card's. */
export const CURRENT_PERIOD_LEVELS = ["Maha Dasha", "Antardasha", "Pratyantardasha"] as const;

export const VIMSHOTTARI_LORDS = [
  "Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu",
] as const;

export const LORD_SET: ReadonlySet<string> = new Set(VIMSHOTTARI_LORDS);
export const SIGN_SET: ReadonlySet<string> = new Set(SIGN_ORDER);
export const NAKSHATRA_SET: ReadonlySet<string> = new Set(NAKSHATRAS);

export type CurrentPeriodStep = {
  lord: string;
  /** ISO YYYY-MM-DD, as the dasha engine emits them. */
  startDate: string;
  endDate: string;
  /** Where this lord sits natally. Absent when the chart carried no positions. */
  sign?: string;
  /** Natal house, 1-12. Present or absent together with `sign`. */
  house?: number;
};

export type CurrentPeriodFacts = {
  /** Outermost first: Maha Dasha, Antardasha, and the Pratyantardasha if known. */
  stack: CurrentPeriodStep[];
  nakshatra: { name: string; lord: string; pada: number };
  /** How far through the innermost period the reader is, 0-100. */
  progressPercent: number;
};

/** What the panel sends: the facts, and the language the reading is to be written in. */
export type CurrentPeriodRequest = CurrentPeriodFacts & { language: string };

export type CurrentPeriodResponse = {
  reading: string;
  cached: boolean;
};

/**
 * The language a reading is written in: a code COMMENTARY_LANGUAGES names, or
 * English, as on the other commentary routes. Not an error, because a page in
 * a language that table has not caught up with should still get a reading. An
 * own key only: `in` would take "constructor" and ask for a reading in
 * "function Object() { [native code] }".
 */
export function currentPeriodLanguage(value: unknown): string {
  return typeof value === "string" && Object.hasOwn(COMMENTARY_LANGUAGES, value) ? value : "en";
}

/** Both ends of what the panel can send, so the route can say so in one place. */
export const MIN_CURRENT_PERIOD_STEPS = 2;
export const MAX_CURRENT_PERIOD_STEPS = CURRENT_PERIOD_LEVELS.length;

/*
 * Progress as a band, not as a number, and the reason is the cache.
 *
 * The card beside the reading prints a live percentage and a day count, both of
 * which move every day. Keying a cached reading on either would mean buying a
 * fresh one every midnight for a chart whose period has years left to run --
 * paying per day for a sentence that would have been written the same way.
 *
 * Bands also happen to be the only form the model should be given. "You are
 * 41.6% through" is not a sentence anyone writes, and a model handed the number
 * will either round it into prose badly or quote it back; handing over the
 * phrasing is what stops the reading from inventing its own.
 */
const PHASE_BANDS: ReadonlyArray<{ upTo: number; phrase: string }> = [
  { upTo: 12, phrase: "has only just opened" },
  { upTo: 38, phrase: "is in its early stretch" },
  { upTo: 62, phrase: "is around its midpoint" },
  { upTo: 88, phrase: "is well past its midpoint" },
  { upTo: Number.POSITIVE_INFINITY, phrase: "is in its closing stretch" },
];

export function currentPeriodPhase(progressPercent: number): string {
  const clamped = Number.isFinite(progressPercent)
    ? Math.min(100, Math.max(0, progressPercent))
    : 0;
  return (PHASE_BANDS.find((band) => clamped < band.upTo) ?? PHASE_BANDS[PHASE_BANDS.length - 1])
    .phrase;
}

/*
 * Worded here rather than in the panel, and deliberately not with the panel's
 * own `formatDate`: that one is locale-tagged, and the facts go to the model in
 * English whatever the page's language, as on the classical notes. The model
 * writes the reading in the reader's language from them (see
 * renderCurrentPeriodFacts).
 */
function formatPeriodDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatPeriodWindow(startIso: string, endIso: string): string {
  return `${formatPeriodDate(startIso)} - ${formatPeriodDate(endIso)}`;
}

/**
 * The facts for the stack the reader is standing in, or null if there is no
 * reading to buy.
 *
 * Returns null rather than a partial set when the maha dasha or the antardasha
 * is missing: two lords is the shallowest stack that says anything a lord's
 * own theme does not already say, and the card's template sentence is a fine
 * answer for a chart that cannot supply them.
 */
export function buildCurrentPeriodFacts(
  dasha: DashaInfo,
  nakshatra: NakshatraInfo,
  planets: PlanetPosition[] | undefined,
  progressPercent: number,
): CurrentPeriodFacts | null {
  const placementOf = (lord: string): Pick<CurrentPeriodStep, "sign" | "house"> => {
    const position = planets?.find((planet) => planet.name === lord);
    if (!position || !SIGN_SET.has(position.sign)) return {};
    if (!Number.isInteger(position.house) || position.house < 1 || position.house > 12) return {};
    return { sign: position.sign, house: position.house };
  };

  const candidates: Array<CurrentPeriodStep | null> = [
    dasha.current_dasha && dasha.current_dasha_start && dasha.current_dasha_end
      ? {
          lord: dasha.current_dasha,
          startDate: dasha.current_dasha_start,
          endDate: dasha.current_dasha_end,
          ...placementOf(dasha.current_dasha),
        }
      : null,
    dasha.current_antardasha && dasha.current_antardasha_start && dasha.current_antardasha_end
      ? {
          lord: dasha.current_antardasha,
          startDate: dasha.current_antardasha_start,
          endDate: dasha.current_antardasha_end,
          ...placementOf(dasha.current_antardasha),
        }
      : null,
    dasha.current_pratyantar && dasha.current_pratyantar_start && dasha.current_pratyantar_end
      ? {
          lord: dasha.current_pratyantar,
          startDate: dasha.current_pratyantar_start,
          endDate: dasha.current_pratyantar_end,
          ...placementOf(dasha.current_pratyantar),
        }
      : null,
  ];

  /* Stop at the first gap rather than filtering, so a chart with a
     pratyantardasha but no antardasha cannot produce a stack whose second
     entry is labelled as the first's sub-period when it is not. */
  const stack: CurrentPeriodStep[] = [];
  for (const candidate of candidates) {
    if (!candidate) break;
    if (!LORD_SET.has(candidate.lord)) break;
    stack.push(candidate);
  }

  if (stack.length < MIN_CURRENT_PERIOD_STEPS) return null;
  if (!NAKSHATRA_SET.has(nakshatra.name) || !LORD_SET.has(nakshatra.lord)) return null;

  return {
    stack,
    nakshatra: { name: nakshatra.name, lord: nakshatra.lord, pada: nakshatra.pada },
    progressPercent,
  };
}

/**
 * The user turn: the facts, then the language. Shared so the route and
 * scripts/effort-compare.mjs cannot measure a different prompt from the one
 * that ships.
 *
 * The reading is written straight in the reader's language from English
 * facts, the way the classical notes are, rather than written in English and
 * translated afterwards. An unknown language code is English.
 */
export function renderCurrentPeriodFacts(facts: CurrentPeriodFacts, languageCode = "en"): string {
  const code = currentPeriodLanguage(languageCode);
  const language = COMMENTARY_LANGUAGES[code];
  const rows = facts.stack.map((step, index) => {
    const level = CURRENT_PERIOD_LEVELS[index] ?? `level ${index + 1}`;
    const placement =
      step.sign && step.house
        ? `, natal ${step.lord} in ${step.sign}, house ${step.house}`
        : "";
    return `${level}: ${step.lord} (${formatPeriodWindow(step.startDate, step.endDate)})${placement}`;
  });

  const innermostLevel = CURRENT_PERIOD_LEVELS[facts.stack.length - 1] ?? "innermost period";

  return [
    rows.join("\n"),
    `Birth nakshatra: ${facts.nakshatra.name}, pada ${facts.nakshatra.pada}, ruled by ${facts.nakshatra.lord}.`,
    `The ${innermostLevel} ${currentPeriodPhase(facts.progressPercent)}.`,
    `Write the paragraph in ${language}.` +
      /* Last, where the model reads it: handed English facts, Haiku answered
         a Hindi reader in English on the classical notes until told this. */
      (code === "en" ? "" : ` Write every sentence in ${language}, although the facts above are in English.`),
  ].join("\n\n");
}

/**
 * What makes two requests the same reading: everything the prompt is given.
 *
 * The phase band rather than the percentage, for the reason given above. The
 * placements are in it too. They used to be left out as implied by the lords
 * and the chart, but the route takes them from the browser, so a request
 * could pair a real stack with signs and houses of its own choosing and file
 * a reading written about them under the real chart's entry, for every
 * visitor with that stack to be served. And the language, first: the same
 * stack in two languages is two readings, and a Hindi page must never be
 * served the English one.
 */
export function currentPeriodCacheKey(facts: CurrentPeriodFacts, languageCode = "en"): string {
  const stack = facts.stack
    .map((step) => `${step.lord}@${step.startDate}..${step.endDate}@${step.sign ?? "-"}/${step.house ?? "-"}`)
    .join(">");
  const { name, lord, pada } = facts.nakshatra;
  return `${currentPeriodLanguage(languageCode)}:${stack}|${name}/${lord}/${pada}|${currentPeriodPhase(facts.progressPercent)}`;
}
