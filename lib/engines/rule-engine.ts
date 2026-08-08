
import type { PlanetPosition, HousePlacement } from "./swiss-ephemeris-engine";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

// These types are declared once, in lib/astro-types.ts, and re-exported here so
// existing importers (chart-service, reading-store, the tests) keep working.
export type {
  DeterministicRule,
  LifeDomainInsight,
  LifeDomainKey,
  RuleCategory,
  RulePriority,
  RuleTier,
  PlanetDignity,
  EvidenceClaim,
  RarityBand,
  RuleRarity,
  RuleDisplay,
  RuleEvidence,
  RuleSelectionMeta,
  DomainDisplay,
  DomainEvidence,
} from "@/lib/astro-types";

import type {
  DeterministicRule,
  EvidenceClaim,
  LifeDomainInsight,
  RuleDisplay,
  RuleEvidence,
} from "@/lib/astro-types";

// The rule interpreter. generateRules() is a thin adapter over this: build the
// context, fire the rules, attach measured rarity and per-chart strength, rank,
// and map onto the payload shape.
import { buildRuleContext, CLASSICAL_PLANETS, SIGN_ELEMENTS, SIGN_RULERS } from "@/lib/rules/context";
import { planetDignity as dignityOf } from "@/lib/rules/context";
import { evaluateRules } from "@/lib/rules";
import { rarityFor, rarityLabel, RARITY_DATASET } from "@/lib/rules/rarity";
import { computeStrength } from "@/lib/rules/strength";
import { selectRules } from "@/lib/rules/selection";
import { humanDignity, ordinal } from "@/lib/rules/paths";

// Declared in lib/rules/tables.ts alongside the other copy tables, and
// re-exported here as a runtime value: chart-service.ts and rule-engine.test.ts
// both import HOUSE_THEMES from this module.
export { HOUSE_THEMES } from "@/lib/rules/tables";
import { HOUSE_THEMES } from "@/lib/rules/tables";

const SIGN_STYLE_PHRASES: Record<string, string> = {
  Aries: "fast-moving, bold, and initiative-heavy",
  Taurus: "steady, resource-aware, and stabilizing",
  Gemini: "curious, adaptable, and communication-led",
  Cancer: "protective, emotional, and security-seeking",
  Leo: "visible, expressive, and leadership-oriented",
  Virgo: "practical, detail-sensitive, and improvement-focused",
  Libra: "relational, balanced, and diplomacy-driven",
  Scorpio: "intense, strategic, and transformative",
  Sagittarius: "expansive, principle-led, and exploratory",
  Capricorn: "structured, disciplined, and long-range",
  Aquarius: "independent, unconventional, and network-aware",
  Pisces: "intuitive, fluid, and spiritually receptive",
};


const LIFE_DOMAIN_CONFIG: Record<
  string,
  {
    label: string;
    primary_house: number;
    secondary_house: number;
    anchor_planet: string;
    summary_focus: string;
  }
> = {
  love_life: {
    label: "Love Life",
    primary_house: 7,
    secondary_house: 5,
    anchor_planet: "Venus",
    summary_focus: "partnership, attraction, emotional availability, and long-term bonding",
  },
  career: {
    label: "Career",
    primary_house: 10,
    secondary_house: 6,
    anchor_planet: "Saturn",
    summary_focus: "career growth, authority, public standing, and work ethic",
  },
  family: {
    label: "Family",
    primary_house: 4,
    secondary_house: 2,
    anchor_planet: "Moon",
    summary_focus: "home life, emotional grounding, lineage, and support systems",
  },
  inheritance: {
    label: "Inheritance",
    primary_house: 8,
    secondary_house: 2,
    anchor_planet: "Jupiter",
    summary_focus: "inheritance, shared assets, legacies, and resource transitions",
  },
  influence: {
    label: "Influence",
    primary_house: 11,
    secondary_house: 10,
    anchor_planet: "Sun",
    summary_focus: "influence, network effect, social reach, and the ability to move people",
  },
  life_cycle: {
    label: "Life Cycle",
    primary_house: 1,
    secondary_house: 8,
    anchor_planet: "Moon",
    summary_focus: "major life phases, reinvention, recovery, and long-range personal evolution",
  },
  travel_destinations: {
    label: "Travel & Destinations",
    primary_house: 9,
    secondary_house: 3,
    anchor_planet: "Jupiter",
    summary_focus: "long-distance travel, foreign lands, pilgrimages, relocation potential, and short journeys",
  },
};

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function planetByName(planets: PlanetPosition[], name: string): PlanetPosition {
  const p = planets.find((p) => p.name === name);
  if (!p) throw new Error(`Planet ${name} not found`);
  return p;
}

/** The dignity tables live in lib/rules/context.ts; this is the positional form. */
function planetDignity(planet: PlanetPosition): string {
  return dignityOf(planet.name, planet.sign);
}

function houseByNumber(houses: HousePlacement[], num: number): HousePlacement {
  return houses.find((h) => h.house_number === num)!;
}

function dignitySummary(planet: PlanetPosition): string {
  const d = planetDignity(planet);
  if (d === "exalted")
    return `${planet.name} is exalted, so its results tend to express strongly and with clean timing.`;
  if (d === "own_sign")
    return `${planet.name} is in its own sign, which gives this area steadiness and better internal coherence.`;
  if (d === "debilitated")
    return `${planet.name} is debilitated, so this area develops through correction, maturity, and repeated refinement.`;
  return `${planet.name} is neutral by dignity here, so outcomes depend more on discipline and surrounding support.`;
}

function elementCount(planets: PlanetPosition[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of planets) {
    const el = SIGN_ELEMENTS[p.sign];
    counts[el] = (counts[el] || 0) + 1;
  }
  return counts;
}

function dominantElement(planets: PlanetPosition[]): { element: string; count: number } {
  const classical = planets.filter((p) => CLASSICAL_PLANETS.includes(p.name));
  const counts = elementCount(classical);
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

function roundedConfidence(value: number): number {
  return Math.round(value * 100) / 100;
}

function boundedDomainScore(value: number): number {
  return roundedConfidence(Math.max(0.55, Math.min(0.94, value)));
}

function dignitySignal(planet: PlanetPosition, strongBoost: number, ownSignBoost: number, debilityDrag: number): number {
  const dignity = planetDignity(planet);
  if (dignity === "exalted") return strongBoost;
  if (dignity === "own_sign") return ownSignBoost;
  if (dignity === "debilitated") return debilityDrag;
  return 0;
}

function housePlacementSignal(houseNumber: number): number {
  let signal = 0;
  if ([1, 4, 7, 10].includes(houseNumber)) signal += 0.05;
  if ([1, 5, 9].includes(houseNumber)) signal += 0.04;
  if ([3, 6, 10, 11].includes(houseNumber)) signal += 0.02;
  if ([6, 8, 12].includes(houseNumber)) signal -= 0.04;
  return signal;
}

function planetRulesHouse(planetName: string, house: HousePlacement): boolean {
  return SIGN_RULERS[house.sign] === planetName;
}

function anchorHouseRelevanceSignal(
  anchorPlanet: PlanetPosition,
  primaryHouse: HousePlacement,
  secondaryHouse: HousePlacement
): number {
  let signal = 0;
  if (anchorPlanet.house === primaryHouse.house_number) signal += 0.04;
  if (anchorPlanet.house === secondaryHouse.house_number) signal += 0.03;
  if (planetRulesHouse(anchorPlanet.name, primaryHouse)) signal += 0.025;
  if (planetRulesHouse(anchorPlanet.name, secondaryHouse)) signal += 0.015;
  return signal;
}

function calculateDomainSignalScore(
  primaryHouse: HousePlacement,
  secondaryHouse: HousePlacement,
  primaryLord: PlanetPosition,
  anchorPlanet: PlanetPosition
): number {
  const primaryOccupancySignal = Math.min(primaryHouse.planets.length, 3) * 0.025;
  const secondaryOccupancySignal = Math.min(secondaryHouse.planets.length, 2) * 0.015;

  const signal =
    0.64 +
    primaryOccupancySignal +
    secondaryOccupancySignal +
    housePlacementSignal(primaryLord.house) +
    dignitySignal(primaryLord, 0.065, 0.045, -0.05) +
    dignitySignal(anchorPlanet, 0.045, 0.03, -0.035) +
    anchorHouseRelevanceSignal(anchorPlanet, primaryHouse, secondaryHouse);

  return boundedDomainScore(signal);
}

// --------------------------------------------------------------------------
// Life domain insight builder
// --------------------------------------------------------------------------

function buildDomainStrengths(
  primaryHouse: HousePlacement,
  secondaryHouse: HousePlacement,
  primaryLord: PlanetPosition,
  anchorPlanet: PlanetPosition
): string[] {
  const strengths: string[] = [
    `${primaryHouse.sign} shapes this area with a ${SIGN_STYLE_PHRASES[primaryHouse.sign]} tone.`,
    `${primaryLord.name} in house ${primaryLord.house} points results toward ${HOUSE_THEMES[primaryLord.house]}.`,
  ];
  if (primaryHouse.planets.length > 0) {
    strengths.push(
      `${primaryHouse.planets.join(", ")} make this topic more visible.`
    );
  } else {
    strengths.push(
      `${secondaryHouse.sign} adds support through ${HOUSE_THEMES[secondaryHouse.house_number]}.`
    );
  }
  strengths.push(dignitySummary(anchorPlanet));
  return strengths.slice(0, 3);
}

function buildDomainWatchouts(
  primaryHouse: HousePlacement,
  primaryLord: PlanetPosition,
  anchorPlanet: PlanetPosition
): string[] {
  const watchouts: string[] = [];
  if ([6, 8, 12].includes(primaryLord.house)) {
    watchouts.push(
      `House ${primaryLord.house} can bring delays, hidden work, or emotional cost before results stabilize.`
    );
  }
  if (planetDignity(primaryLord) === "debilitated") {
    watchouts.push(
      `${primaryLord.name} is debilitated, so routines and mentorship matter.`
    );
  }
  if (planetDignity(anchorPlanet) === "debilitated") {
    watchouts.push(
      `${anchorPlanet.name} can create mixed signals between instinct and timing.`
    );
  }
  if (primaryHouse.planets.length === 0) {
    watchouts.push(
      "With no direct occupants, steady follow-through matters more than dramatic turns."
    );
  }
  return watchouts.slice(0, 2);
}

function domainGuidance(
  domElement: string,
  primaryHouse: HousePlacement,
  primaryLord: PlanetPosition,
  label: string
): string {
  return (
    `For ${label.toLowerCase()}, use your ${domElement.toLowerCase()} style and strengthen ` +
    `${primaryLord.name}-led habits around ${HOUSE_THEMES[primaryHouse.house_number]}.`
  );
}

function domainTimingTriggers(
  config: (typeof LIFE_DOMAIN_CONFIG)[string],
  primaryHouse: HousePlacement,
  primaryLord: PlanetPosition,
  anchorPlanet: PlanetPosition
): string[] {
  const triggers: string[] = [
    `${primaryLord.name} periods and major transits move this area fastest.`,
    `${anchorPlanet.name} activations color timing through ${HOUSE_THEMES[anchorPlanet.house]}.`,
    `Transits over house ${config.primary_house}, house ${config.secondary_house}, or ${primaryHouse.sign} should be treated as confirmation windows rather than standalone promises.`,
  ];
  if (primaryHouse.planets.length > 0) {
    triggers.push(
      `${primaryHouse.planets.join(", ")} activations make this topic louder.`
    );
  }
  return triggers.slice(0, 3);
}

function domainSupportingPatterns(
  primaryHouse: HousePlacement,
  secondaryHouse: HousePlacement,
  primaryLord: PlanetPosition,
  anchorPlanet: PlanetPosition
): string[] {
  return [
    `${primaryHouse.sign} sets the main tone.`,
    `${secondaryHouse.sign} adds support through house ${secondaryHouse.house_number}.`,
    `${anchorPlanet.name} filters instinct through house ${anchorPlanet.house}.`,
    dignitySummary(primaryLord),
  ];
}

function domainLongGame(
  label: string,
  primaryHouse: HousePlacement,
  primaryLord: PlanetPosition,
  domElement: string
): string {
  return (
    `${label} improves when ${primaryLord.name}-led choices stay paced, measurable, and consistent around ` +
    `${HOUSE_THEMES[primaryHouse.house_number]}. Use repeated evidence from the house lord, anchor planet, and timing triggers before treating a single event as decisive.`
  );
}

// --------------------------------------------------------------------------
// Life domain: the client-facing tier
//
// Everything below produces plain language. The technical versions -- the
// "Career: Capricorn house 10, led by Saturn." headline, the house-lord
// notation, the four stacked lists -- survive untouched on the legacy fields
// and are demoted into `evidence`.
// --------------------------------------------------------------------------

/** Plain-language framing per domain, replacing "Label: Sign house N" headlines. */
const DOMAIN_PLAIN_COPY: Record<string, { headline: string; focus: string }> = {
  love_life: {
    headline: "What partnership actually asks of you",
    focus: "who you pair with, and what it takes to keep it working",
  },
  career: {
    headline: "Where your working life is heading",
    focus: "the work you do and the standing it earns you",
  },
  family: {
    headline: "What home is supposed to give you",
    focus: "the people you came from, and the base you build for yourself",
  },
  inheritance: {
    headline: "What reaches you through other people",
    focus: "shared money, what you inherit, and resources you did not earn alone",
  },
  influence: {
    headline: "How far your voice carries",
    focus: "your network, your reach, and your ability to move people",
  },
  life_cycle: {
    headline: "How you reinvent yourself",
    focus: "the long arc of your phases, recoveries and rebuilds",
  },
  travel_destinations: {
    headline: "Where you end up, and why",
    focus: "distance, unfamiliar ground, and the places that change you",
  },
};

function buildDomainDisplayBody(
  focus: string,
  primaryHouse: HousePlacement,
  primaryLord: PlanetPosition
): string {
  return (
    `Your ${focus} runs on a ${SIGN_STYLE_PHRASES[primaryHouse.sign]} rhythm. ` +
    `Whatever drives this area keeps steering it toward ${HOUSE_THEMES[primaryLord.house]}, ` +
    `which is where the results actually land -- not always where you were looking for them.`
  );
}

function buildDomainDisplayStrengths(
  primaryHouse: HousePlacement,
  secondaryHouse: HousePlacement,
  primaryLord: PlanetPosition
): string[] {
  const strengths = [
    `This part of life moves at a ${SIGN_STYLE_PHRASES[primaryHouse.sign]} pace, and fights you when you force another one.`,
    `What you get out of it tends to arrive through ${HOUSE_THEMES[primaryLord.house]}.`,
  ];
  strengths.push(
    primaryHouse.planets.length > 0
      ? "You have real weight behind this one. Several parts of your chart are actively involved, so it rarely stays quiet for long."
      : `It draws quiet support from ${HOUSE_THEMES[secondaryHouse.house_number]}, which is where to look when the main route stalls.`
  );
  return strengths.slice(0, 3);
}

function buildDomainDisplayWatchouts(
  primaryHouse: HousePlacement,
  primaryLord: PlanetPosition,
  anchorPlanet: PlanetPosition
): string[] {
  const watchouts: string[] = [];
  if ([6, 8, 12].includes(primaryLord.house)) {
    watchouts.push(
      "Expect this one to take longer than it should and cost more effort than it looks like it should. That is the shape of it, not a sign you picked wrong."
    );
  }
  if (planetDignity(primaryLord) === "debilitated") {
    watchouts.push(
      "This area rewards structure and good advice more than instinct. Waiting until you feel naturally good at it is the wrong order."
    );
  }
  if (planetDignity(anchorPlanet) === "debilitated") {
    watchouts.push(
      "Your read on timing here is less reliable than your read on people. Check the calendar against someone else's judgement."
    );
  }
  if (primaryHouse.planets.length === 0) {
    watchouts.push(
      "Nothing is forcing this area to happen. It moves when you move it, and it will sit still indefinitely if you let it."
    );
  }
  return watchouts.slice(0, 2);
}

/** Max 2, and deliberately free of transit and house vocabulary. */
function buildDomainDisplayTiming(
  primaryHouse: HousePlacement,
  anchorPlanet: PlanetPosition
): string[] {
  const dignity = planetDignity(anchorPlanet);
  const instinct =
    dignity === "exalted" || dignity === "own_sign"
      ? "Your instincts about when to act here are good. When something feels ready, it usually is."
      : dignity === "debilitated"
        ? "Give yourself a second opinion on timing here. Your first read tends to run early or late, rarely on the beat."
        : "Timing here answers to preparation more than to opportunity. The opening tends to arrive for whoever is already set up for it.";

  const shape =
    primaryHouse.planets.length > 0
      ? "When this area moves, it moves loudly and in front of other people."
      : "When this area moves, it usually moves quietly, and you may only notice in hindsight.";

  return [instinct, shape].slice(0, 2);
}

function buildDomainClaims(
  config: (typeof LIFE_DOMAIN_CONFIG)[string],
  primaryHouse: HousePlacement,
  secondaryHouse: HousePlacement,
  primaryLord: PlanetPosition,
  anchorPlanet: PlanetPosition
): EvidenceClaim[] {
  return [
    { label: "Primary house", value: `${ordinal(config.primary_house)} house`, kind: "placement" },
    { label: "Sign on that house", value: primaryHouse.sign, kind: "placement" },
    { label: "House lord", value: primaryLord.name, kind: "lordship" },
    {
      label: "Lord placement",
      value: `${ordinal(primaryLord.house)} house`,
      kind: "placement",
      detail: `In ${primaryLord.sign}, ${humanDignity(planetDignity(primaryLord))} by dignity.`,
    },
    { label: "Supporting house", value: `${ordinal(secondaryHouse.house_number)} house`, kind: "placement" },
    {
      label: "Anchor planet",
      value: anchorPlanet.name,
      kind: "dignity",
      detail: `${humanDignity(planetDignity(anchorPlanet))} in ${anchorPlanet.sign}.`,
    },
  ];
}

function buildLifeDomainInsight(
  key: string,
  planets: PlanetPosition[],
  houses: HousePlacement[],
  domElement: string
): LifeDomainInsight {
  const config = LIFE_DOMAIN_CONFIG[key];
  const primaryHouse = houseByNumber(houses, config.primary_house);
  const secondaryHouse = houseByNumber(houses, config.secondary_house);
  const primaryLordName = SIGN_RULERS[primaryHouse.sign];
  const primaryLord = planetByName(planets, primaryLordName);
  const anchorPlanet = planetByName(planets, config.anchor_planet);

  const confidence = calculateDomainSignalScore(
    primaryHouse,
    secondaryHouse,
    primaryLord,
    anchorPlanet
  );

  const headline =
    `${config.label}: ${primaryHouse.sign} house ${primaryHouse.house_number}, led by ${primaryLord.name}.`;

  const overview =
    `${primaryHouse.sign} sets a ${SIGN_STYLE_PHRASES[primaryHouse.sign]} tone for ${config.summary_focus}. ` +
    `${primaryLord.name} in house ${primaryLord.house} links outcomes to ${HOUSE_THEMES[primaryLord.house]}. ` +
    `The practical read is to separate the promise of house ${config.primary_house} from the delivery route of ${primaryLord.name}, then use ${anchorPlanet.name} as the instinctive filter.`;

  const plain = DOMAIN_PLAIN_COPY[key];

  return {
    key: key as LifeDomainInsight["key"],
    label: config.label,

    display: {
      headline: plain.headline,
      body: buildDomainDisplayBody(plain.focus, primaryHouse, primaryLord),
      guidance:
        `For ${config.label.toLowerCase()}, lead with your ${domElement.toLowerCase()} instincts, ` +
        `then build the habits that keep ${HOUSE_THEMES[primaryHouse.house_number]} in working order.`,
      long_game:
        `This area improves slowly and then holds. Treat any single event as evidence rather than a verdict, ` +
        `and give it several attempts before you decide what it means about you.`,
      strengths: buildDomainDisplayStrengths(primaryHouse, secondaryHouse, primaryLord),
      watchouts: buildDomainDisplayWatchouts(primaryHouse, primaryLord, anchorPlanet),
      timing: buildDomainDisplayTiming(primaryHouse, anchorPlanet),
    },

    evidence: {
      technical_note: `${headline} ${overview}`,
      claims: buildDomainClaims(config, primaryHouse, secondaryHouse, primaryLord, anchorPlanet),
      // Deliberately the same number as confidence_score. This is a STRENGTH
      // signal, not a rarity one, and it stops being rendered as a percentage.
      signal_score: confidence,
    },

    // Every legacy field below is computed exactly as before. Nothing is
    // dropped -- these are demoted to the technical tier at the render sites,
    // not deleted.
    headline,
    overview,
    strengths: buildDomainStrengths(primaryHouse, secondaryHouse, primaryLord, anchorPlanet),
    watchouts: buildDomainWatchouts(primaryHouse, primaryLord, anchorPlanet),
    timing_triggers: domainTimingTriggers(config, primaryHouse, primaryLord, anchorPlanet),
    supporting_patterns: domainSupportingPatterns(primaryHouse, secondaryHouse, primaryLord, anchorPlanet),
    guidance: domainGuidance(domElement, primaryHouse, primaryLord, config.label),
    long_game: domainLongGame(config.label, primaryHouse, primaryLord, domElement),
    confidence_score: confidence,
  };
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

/**
 * Fire every rule against one chart.
 *
 * This used to be nineteen hand-written `rules.push({ ... })` blocks carrying
 * seventeen hardcoded confidence constants. It is now an adapter: build the
 * evaluation context, let the interpreter fire the data-driven rule set, attach
 * measured rarity and per-chart strength, rank, and map onto the payload shape.
 *
 * Two properties the rest of the app depends on:
 *
 *   - The returned array is the FULL fired list, in declaration order, with the
 *     Lagna signature at index 0. Selection is metadata on each rule, never a
 *     filter -- no consumer surface can be starved by a ranking change.
 *   - `confidence_score` mirrors `selection.score`, which is
 *     `rarity.score * strength` and therefore still ascending-in-noteworthiness.
 *     Six descending sorts across the UI and the story engine read it.
 */
export function generateRules(
  ascendantSign: string,
  planets: PlanetPosition[],
  houses: HousePlacement[]
): { rules: DeterministicRule[]; summary: string } {
  const ctx = buildRuleContext(ascendantSign, planets, houses);

  const scored = evaluateRules(ctx).map((fired) => {
    const rarity = rarityFor(fired.rarity_key);
    const strength = computeStrength(fired.definition, ctx, fired.bindings);
    return { fired, rarity, strength, score: rarity.score * strength };
  });

  const { meta } = selectRules(
    scored.map((s) => ({
      instance_key: s.fired.instance_key,
      category: s.fired.category,
      tier: s.fired.tier,
      score: s.score,
    }))
  );

  const rules: DeterministicRule[] = scored.map(({ fired, rarity, strength, score }) => {
    const selection = meta.get(fired.instance_key) ?? { selected: false, rank: 0 };

    const display: RuleDisplay = {
      headline: fired.headline,
      body: fired.body,
      tension: fired.tension,
      rarity_label: rarityLabel(rarity),
    };

    const evidence: RuleEvidence = {
      technical_note: fired.technical_note,
      claims: fired.claims,
      rarity,
      matched_conditions: fired.matched_conditions,
    };

    return {
      id: fired.id,
      instance_key: fired.instance_key,
      tier: fired.tier,
      display,
      evidence,
      selection: { strength, score, selected: selection.selected, rank: selection.rank },
      category: fired.category,
      priority: fired.priority,
    };
  });

  // Composed independently of the rules, from chart-level facts no selection
  // layer can invalidate. This string is persisted to guest_readings, so
  // deriving it from a re-rankable list would write drift into the database.
  const sun = planetByName(planets, "Sun");
  const moon = planetByName(planets, "Moon");
  const domEl = ctx.derived.dominant_element;

  const strongestPlanets = planets
    .filter((p) => CLASSICAL_PLANETS.includes(p.name))
    .filter((p) => ["exalted", "own_sign"].includes(dignityOf(p.name, p.sign)))
    .map((p) => p.name);
  const strengthLine =
    strongestPlanets.length > 0
      ? ` Strongest support comes from ${strongestPlanets.slice(0, 2).join(", ")}.`
      : "";

  const summary =
    `Chart core: ${ascendantSign} Lagna with Sun in ${sun.sign} and Moon in ${moon.sign}. ` +
    `Dominant elemental tone is ${domEl}.${strengthLine}`;

  return { rules, summary };
}

/** Rank-ordered instance keys of the selected rules. */
export function selectedRuleIds(rules: DeterministicRule[]): string[] {
  return rules
    .filter((r) => r.selection?.selected)
    .sort((a, b) => (a.selection!.rank ?? 0) - (b.selection!.rank ?? 0))
    .map((r) => r.instance_key!)
    .filter((key): key is string => Boolean(key));
}

/** The rarity dataset the current payload was built against. */
export function rulesDatasetVersion(): string {
  return RARITY_DATASET.version;
}

export function generateLifeDomainInsights(
  _ascendantSign: string,
  planets: PlanetPosition[],
  houses: HousePlacement[]
): LifeDomainInsight[] {
  const { element: domEl } = dominantElement(planets);
  return Object.keys(LIFE_DOMAIN_CONFIG).map((key) =>
    buildLifeDomainInsight(key, planets, houses, domEl)
  );
}
