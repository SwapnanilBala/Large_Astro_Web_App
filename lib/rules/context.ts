/**
 * The evaluation context: every chart fact a rule is allowed to see.
 *
 * `buildRuleContext` is pure and is built once per chart, then reused by every
 * rule, every strength bonus and every Monte Carlo iteration. All arithmetic
 * lives here -- `occupant_count`, `dignity`, `element`, `rules_houses` and the
 * `derived` aggregates are precomputed fields, so rule records never need an
 * expression language to reach them.
 */

import type { PlanetPosition, HousePlacement } from "@/lib/engines/swiss-ephemeris-engine";
import type { PlanetDignity } from "@/lib/astro-types";

// ---------------------------------------------------------------------------
// Astronomical constants
// ---------------------------------------------------------------------------

export const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

export const SIGN_ELEMENTS: Record<string, string> = {
  Aries: "Fire", Leo: "Fire", Sagittarius: "Fire",
  Taurus: "Earth", Virgo: "Earth", Capricorn: "Earth",
  Gemini: "Air", Libra: "Air", Aquarius: "Air",
  Cancer: "Water", Scorpio: "Water", Pisces: "Water",
};

export const SIGN_RULERS: Record<string, string> = {
  Aries: "Mars", Taurus: "Venus", Gemini: "Mercury", Cancer: "Moon",
  Leo: "Sun", Virgo: "Mercury", Libra: "Venus", Scorpio: "Mars",
  Sagittarius: "Jupiter", Capricorn: "Saturn", Aquarius: "Saturn", Pisces: "Jupiter",
};

export const PLANET_OWN_SIGNS: Record<string, Set<string>> = {
  Sun: new Set(["Leo"]),
  Moon: new Set(["Cancer"]),
  Mercury: new Set(["Gemini", "Virgo"]),
  Venus: new Set(["Taurus", "Libra"]),
  Mars: new Set(["Aries", "Scorpio"]),
  Jupiter: new Set(["Sagittarius", "Pisces"]),
  Saturn: new Set(["Capricorn", "Aquarius"]),
};

export const PLANET_EXALTATIONS: Record<string, string> = {
  Sun: "Aries", Moon: "Taurus", Mercury: "Virgo", Venus: "Pisces",
  Mars: "Capricorn", Jupiter: "Cancer", Saturn: "Libra",
};

export const PLANET_DEBILITATIONS: Record<string, string> = {
  Sun: "Libra", Moon: "Scorpio", Mercury: "Pisces", Venus: "Virgo",
  Mars: "Cancer", Jupiter: "Capricorn", Saturn: "Aries",
};

export const CLASSICAL_PLANETS = [
  "Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn",
];

/**
 * The three category-specific planet sets, matching the legacy dignity loop's
 * dynamic category assignment (rule-engine.ts:687-689) exactly. Order within
 * each set is the classical order, so expansion is deterministic.
 */
export const CORE_PLANETS = ["Sun"];
export const CAREER_PLANETS = ["Mercury", "Jupiter", "Saturn"];
export const LOVE_PLANETS = ["Moon", "Venus", "Mars"];

// ---------------------------------------------------------------------------
// Context shapes
// ---------------------------------------------------------------------------

export type PlanetFacts = {
  name: string;
  sign: string;
  element: string;
  house: number;
  dignity: PlanetDignity;
  is_retrograde: boolean;
  is_combust: boolean;
  rules_houses: number[];
  /**
   * Whole-sign distance *to* this planet *from* each other planet, keyed by
   * lowercased name (`sign_distance_from.moon`). Precomputed because the
   * binding layer is where arithmetic lives -- rules only ever read it.
   */
  sign_distance_from: Record<string, number>;
  /** Present but unreachable from display templates -- see displayTemplate's refine. */
  degree_in_sign: number;
};

export type HouseFacts = {
  number: number;
  sign: string;
  element: string;
  lord: string;
  occupants: string[];
  occupant_count: number;
};

export type AscendantFacts = {
  sign: string;
  element: string;
  lord: string;
};

export type DerivedFacts = {
  dominant_element: string;
  dominant_element_count: number;
  densest_house: number;
  element_counts: Record<string, number>;
  /** Every planet, nodes included, sitting in houses 1/4/7/10 -- in chart order. */
  kendra_planets: string[];
  kendra_planet_count: number;
};

export type RuleContext = {
  ascendant: AscendantFacts;
  planets: Record<string, PlanetFacts>;
  houses: Record<number, HouseFacts>;
  derived: DerivedFacts;
};

// ---------------------------------------------------------------------------
// Derivations
// ---------------------------------------------------------------------------

export function planetDignity(name: string, sign: string): PlanetDignity {
  if (sign === PLANET_EXALTATIONS[name]) return "exalted";
  if (sign === PLANET_DEBILITATIONS[name]) return "debilitated";
  if (PLANET_OWN_SIGNS[name]?.has(sign)) return "own_sign";
  return "neutral";
}

/** Whole-sign distance from `startSign` to `targetSign`, 1-based (same sign = 1). */
export function signDistance(startSign: string, targetSign: string): number {
  const si = ZODIAC_SIGNS.indexOf(startSign);
  const ti = ZODIAC_SIGNS.indexOf(targetSign);
  return ((ti - si + 12) % 12) + 1;
}

/**
 * Element tallies over the seven classical planets.
 *
 * Key insertion order follows first appearance in the planet array, which is
 * what makes `dominantElement`'s tie-break reproducible.
 */
function elementCounts(planets: PlanetPosition[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of planets) {
    const el = SIGN_ELEMENTS[p.sign];
    counts[el] = (counts[el] || 0) + 1;
  }
  return counts;
}

/**
 * Highest-count element, ties broken by first appearance.
 *
 * Reproduces rule-engine.ts:304-318 exactly, including the "Fire" seed for a
 * chart with no classical planets.
 */
function dominantElement(counts: Record<string, number>): { element: string; count: number } {
  let maxEl = "Fire";
  let maxCount = 0;
  for (const [el, c] of Object.entries(counts)) {
    if (c > maxCount) {
      maxEl = el;
      maxCount = c;
    }
  }
  return { element: maxEl, count: maxCount };
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildRuleContext(
  ascendantSign: string,
  planets: PlanetPosition[],
  houses: HousePlacement[],
): RuleContext {
  const houseFacts: Record<number, HouseFacts> = {};
  for (const h of houses) {
    houseFacts[h.house_number] = {
      number: h.house_number,
      sign: h.sign,
      element: SIGN_ELEMENTS[h.sign],
      lord: SIGN_RULERS[h.sign],
      occupants: h.planets,
      occupant_count: h.planets.length,
    };
  }

  // Which houses each planet rules, by the sign sitting on them.
  const rulesHouses: Record<string, number[]> = {};
  for (const h of houses) {
    const lord = SIGN_RULERS[h.sign];
    if (!lord) continue;
    (rulesHouses[lord] ??= []).push(h.house_number);
  }

  const planetFacts: Record<string, PlanetFacts> = {};
  for (const p of planets) {
    const distanceFrom: Record<string, number> = {};
    for (const other of planets) {
      distanceFrom[other.name.toLowerCase()] = signDistance(other.sign, p.sign);
    }
    planetFacts[p.name] = {
      name: p.name,
      sign: p.sign,
      element: SIGN_ELEMENTS[p.sign],
      house: p.house,
      dignity: planetDignity(p.name, p.sign),
      is_retrograde: p.is_retrograde ?? false,
      is_combust: p.is_combust ?? false,
      rules_houses: rulesHouses[p.name] ?? [],
      sign_distance_from: distanceFrom,
      degree_in_sign: p.degree_in_sign,
    };
  }

  const classical = planets.filter((p) => CLASSICAL_PLANETS.includes(p.name));
  const counts = elementCounts(classical);
  const { element: domEl, count: domCount } = dominantElement(counts);

  // First house holding the maximum, scanning in array order -- matches
  // rule-engine.ts:940-943.
  let densest = houses[0];
  for (const h of houses) {
    if (h.planets.length > densest.planets.length) densest = h;
  }

  const kendraPlanets = planets
    .filter((p) => [1, 4, 7, 10].includes(p.house))
    .map((p) => p.name);

  return {
    ascendant: {
      sign: ascendantSign,
      element: SIGN_ELEMENTS[ascendantSign],
      lord: SIGN_RULERS[ascendantSign],
    },
    planets: planetFacts,
    houses: houseFacts,
    derived: {
      dominant_element: domEl,
      dominant_element_count: domCount,
      densest_house: densest.house_number,
      element_counts: counts,
      kendra_planets: kendraPlanets,
      kendra_planet_count: kendraPlanets.length,
    },
  };
}

/** The planet names a `for_each` set expands to, filtered to what the chart has. */
export function forEachPlanets(set: string, ctx: RuleContext): string[] {
  const names =
    set === "classical_planets" ? CLASSICAL_PLANETS
    : set === "core_planets" ? CORE_PLANETS
    : set === "career_planets" ? CAREER_PLANETS
    : set === "love_planets" ? LOVE_PLANETS
    : Object.keys(ctx.planets);
  return names.filter((n) => ctx.planets[n] !== undefined);
}
