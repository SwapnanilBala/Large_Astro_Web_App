import { IMPORTANT_DIVISION_NUMBERS } from "./divisional-chart-guide";
import type { DivisionalChartInfo } from "./astro-types";

/**
 * The facts one varga contributes to the atlas commentary.
 *
 * Deliberately thin. The engine has already decided every sign in here; the
 * model's job is to say what the pattern means, not to work out what it is.
 * Anything the model would need to *derive* -- a house lord, an aspect, a
 * strength score -- is left out rather than half-supplied, because a prompt
 * that hands over two thirds of a calculation invites the model to finish it.
 */
export type VargaFacts = {
  division: number;
  label: string;
  positions: Array<{ name: string; rashi: string; divisional: string }>;
};

/** One paragraph about one varga, as written for this chart. */
export type VargaNote = {
  division: number;
  note: string;
};

export type VargaCommentaryResponse = {
  notes: VargaNote[];
  cached: boolean;
};

/**
 * The language a note is written in, and its name as the prompt says it.
 *
 * The curated guidance on this page ships in six languages; a note bolted
 * underneath it in English would be the one paragraph a Hindi reader cannot
 * read. The model is told which language to write in rather than the page
 * translating afterwards, because there is nothing to translate at build time
 * -- the text does not exist until the chart does.
 *
 * Keyed by lib/i18n-context's Language union. Adding a language there without
 * adding it here degrades to English rather than failing, which is the right
 * way round for a decorative layer.
 */
export const COMMENTARY_LANGUAGES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  bn: "Bengali",
  hi: "Hindi",
  it: "Italian",
  fr: "French",
};

/** The points worth sending. The engine returns these in a stable order. */
export const COMMENTARY_POINTS = [
  "Ascendant", "Sun", "Moon", "Mercury", "Venus",
  "Mars", "Jupiter", "Saturn", "Rahu", "Ketu",
] as const;

/**
 * The ten key vargas, as facts, from a full atlas payload.
 *
 * Filtered to IMPORTANT_DIVISION_NUMBERS here *and* again in the route. Doing
 * it twice is not redundancy for its own sake: this copy is what keeps the
 * client from asking about D40 in the first place, and the route's copy is what
 * keeps a hand-written request from getting an answer about it. The rule -- only
 * the promoted vargas are commented on -- is a product decision, so it is
 * enforced where the money is spent, not only where the UI is drawn.
 */
export function buildVargaFacts(
  charts: Record<number, DivisionalChartInfo>,
): VargaFacts[] {
  const facts: VargaFacts[] = [];
  for (const division of IMPORTANT_DIVISION_NUMBERS) {
    const chart = charts[division];
    if (!chart) continue;
    const positions = COMMENTARY_POINTS.map((name) => {
      const found = chart.positions.find((position) => position.name === name);
      return found
        ? { name, rashi: found.rashi_sign, divisional: found.divisional_sign }
        : null;
    }).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    if (positions.length === 0) continue;
    facts.push({ division, label: chart.label, positions });
  }
  return facts;
}
