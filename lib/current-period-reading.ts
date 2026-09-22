import { SIGN_ORDER } from "@/lib/constellation-geometry";
import { NAKSHATRAS } from "@/lib/engines/panchanga";
import type { DashaInfo, NakshatraInfo, PlanetPosition } from "@/lib/astro-types";

/**
 * The facts the running dasha stack contributes to its written reading.
 *
 * Why this is not `/api/chart/dasha-interpretation` with a shorter chain: that
 * route answers "what does this chain of lords mean", takes lords and dates and
 * nothing else, and refuses two-lord chains on purpose -- the panel's 81-entry
 * DASHA_COMBO_EFFECTS map already covers maha -> antar and costs nothing. The
 * current-period card is a different question with a different input. It knows
 * the reader's natal placements for these particular lords, the nakshatra the
 * whole Vimshottari sequence is counted from, and how far through the period
 * they are, and none of those fit through that route's door. Widening it to
 * take them would give one route two prompts and two contracts.
 *
 * Every field here comes from a closed vocabulary -- nine lords, twelve signs,
 * twelve houses, twenty-seven nakshatras, ISO dates -- which is what lets the
 * route validate rather than sanitize. The panel is a client component, so its
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

export type CurrentPeriodResponse = {
  reading: string;
  cached: boolean;
};

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
 * own `formatDate`: that one is locale-tagged, so a French reader's prompt would
 * carry "12 mars 2019" into an English reading. The card and the reading do
 * diverge in wording for non-English locales as a result, which is the same
 * trade every written route here already makes -- the prose is English.
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
 * The user turn. Shared so the route and scripts/effort-compare.mjs cannot
 * measure a different prompt from the one that ships.
 */
export function renderCurrentPeriodFacts(facts: CurrentPeriodFacts): string {
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
  ].join("\n\n");
}

/**
 * What makes two requests the same reading.
 *
 * The phase band rather than the percentage, for the reason given above; the
 * placements are implied by the lords and the chart, so they are left out and
 * the key stays short.
 */
export function currentPeriodCacheKey(facts: CurrentPeriodFacts): string {
  const stack = facts.stack
    .map((step) => `${step.lord}@${step.startDate}..${step.endDate}`)
    .join(">");
  const { name, lord, pada } = facts.nakshatra;
  return `${stack}|${name}/${lord}/${pada}|${currentPeriodPhase(facts.progressPercent)}`;
}
