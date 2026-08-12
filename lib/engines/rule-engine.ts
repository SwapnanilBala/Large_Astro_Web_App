
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
  DomainRuleHit,
  DomainEvidenceFamily,
  DomainEvidenceMatrix,
  DomainEvidenceMatrixEntry,
  DomainSubtheme,
  EvidenceClaim,
  LifeDomainInsight,
  LifeDomainKey,
  RuleDisplay,
  RuleEvidence,
} from "@/lib/astro-types";
import {
  evaluateLifeDomainRules,
  LIFE_DOMAIN_RULES_VERSION,
  type LifeDomainExtendedEvidence,
} from "./life-domain-rules";
export { LIFE_DOMAIN_RULES_VERSION };

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


type LifeDomainConfig = {
  label: string;
  primary_house: number;
  secondary_house: number;
  anchor_planet: string;
  summary_focus: string;
  decision_test: string;
  boundary_focus: string;
};

type DomainSubthemeConfig = {
  key: string;
  label: string;
  houses: number[];
  planets: string[];
  families: DomainEvidenceFamily[];
  divisions: number[];
};

const DOMAIN_SUBTHEMES: Record<LifeDomainKey, DomainSubthemeConfig[]> = {
  career: [
    { key: "vocation", label: "Vocation", houses: [9, 10], planets: ["Sun", "Jupiter"], families: ["primary", "divisional"], divisions: [10] },
    { key: "daily_work", label: "Daily work", houses: [6, 10], planets: ["Saturn", "Mercury"], families: ["primary", "strength"], divisions: [10] },
    { key: "leadership", label: "Leadership", houses: [10, 11], planets: ["Sun", "Saturn"], families: ["yoga", "divisional"], divisions: [10] },
    { key: "entrepreneurship", label: "Entrepreneurship", houses: [3, 10, 11], planets: ["Mars", "Mercury"], families: ["supporting", "strength"], divisions: [10] },
    { key: "earnings", label: "Earnings", houses: [2, 11], planets: ["Jupiter", "Mercury"], families: ["house_support", "supporting"], divisions: [] },
    { key: "recognition", label: "Professional recognition", houses: [10, 11], planets: ["Sun", "Jupiter"], families: ["divisional", "yoga"], divisions: [10] },
  ],
  love_life: [
    { key: "attraction", label: "Attraction", houses: [5, 7], planets: ["Venus", "Mars"], families: ["primary", "supporting"], divisions: [] },
    { key: "commitment", label: "Commitment", houses: [7, 8], planets: ["Venus", "Jupiter", "Saturn"], families: ["divisional", "strength"], divisions: [9] },
    { key: "availability", label: "Emotional availability", houses: [4, 7], planets: ["Moon", "Venus"], families: ["supporting", "strength"], divisions: [9] },
    { key: "intimacy", label: "Intimacy", houses: [8, 12], planets: ["Venus", "Moon"], families: ["primary", "divisional"], divisions: [9] },
    { key: "repair", label: "Conflict repair", houses: [6, 7], planets: ["Mars", "Mercury", "Venus"], families: ["contradiction", "strength"], divisions: [9] },
    { key: "shared_resources", label: "Shared resources", houses: [2, 8], planets: ["Venus", "Jupiter"], families: ["house_support", "supporting"], divisions: [] },
  ],
  family: [
    { key: "home", label: "Home environment", houses: [4], planets: ["Moon"], families: ["primary", "divisional"], divisions: [4] },
    { key: "parents", label: "Parents", houses: [4, 9], planets: ["Moon", "Sun"], families: ["divisional", "supporting"], divisions: [12] },
    { key: "lineage", label: "Lineage", houses: [2, 8], planets: ["Moon", "Jupiter"], families: ["divisional", "primary"], divisions: [7, 12] },
    { key: "property", label: "Property", houses: [4, 11], planets: ["Mars", "Moon"], families: ["divisional", "house_support"], divisions: [4] },
    { key: "caregiving", label: "Caregiving", houses: [4, 6], planets: ["Moon", "Jupiter"], families: ["supporting", "strength"], divisions: [] },
    { key: "security", label: "Emotional security", houses: [2, 4], planets: ["Moon", "Venus"], families: ["primary", "strength"], divisions: [4] },
  ],
  inheritance: [
    { key: "ownership", label: "Ownership", houses: [2, 8], planets: ["Jupiter", "Saturn"], families: ["primary", "house_support"], divisions: [2] },
    { key: "debt", label: "Debt and obligations", houses: [6, 8], planets: ["Saturn", "Mars"], families: ["contradiction", "strength"], divisions: [] },
    { key: "transfers", label: "Resource transfers", houses: [2, 8, 11], planets: ["Jupiter", "Mercury"], families: ["divisional", "supporting"], divisions: [2] },
    { key: "documentation", label: "Documentation", houses: [3, 8], planets: ["Mercury", "Saturn"], families: ["strength", "house_support"], divisions: [] },
    { key: "shared_assets", label: "Shared assets", houses: [2, 7, 8], planets: ["Venus", "Jupiter"], families: ["primary", "divisional"], divisions: [2] },
  ],
  influence: [
    { key: "communication", label: "Communication", houses: [3], planets: ["Mercury"], families: ["primary", "strength"], divisions: [5] },
    { key: "leadership", label: "Leadership", houses: [10], planets: ["Sun", "Saturn"], families: ["divisional", "yoga"], divisions: [5, 10] },
    { key: "audience", label: "Audience", houses: [3, 11], planets: ["Mercury", "Rahu"], families: ["primary", "house_support"], divisions: [11] },
    { key: "alliances", label: "Alliances", houses: [7, 11], planets: ["Venus", "Jupiter"], families: ["supporting", "yoga"], divisions: [11] },
    { key: "authority", label: "Institutional authority", houses: [10, 11], planets: ["Sun", "Saturn"], families: ["divisional", "strength"], divisions: [10] },
    { key: "reach", label: "Social reach", houses: [3, 10, 11], planets: ["Mercury", "Sun"], families: ["divisional", "house_support"], divisions: [5, 10, 11] },
  ],
  life_cycle: [
    { key: "identity", label: "Identity changes", houses: [1, 8], planets: ["Moon", "Sun"], families: ["primary", "divisional"], divisions: [8] },
    { key: "recovery", label: "Recovery patterns", houses: [6, 8], planets: ["Moon", "Saturn"], families: ["strength", "house_support"], divisions: [27, 30] },
    { key: "endings", label: "Endings and release", houses: [8, 12], planets: ["Saturn", "Ketu"], families: ["divisional", "contradiction"], divisions: [8, 30] },
    { key: "resilience", label: "Resilience", houses: [1, 6, 8], planets: ["Mars", "Saturn"], families: ["strength", "yoga"], divisions: [27] },
    { key: "reinvention", label: "Reinvention", houses: [1, 8, 12], planets: ["Moon", "Rahu"], families: ["primary", "timing"], divisions: [8] },
  ],
  travel_destinations: [
    { key: "short_journeys", label: "Short journeys", houses: [3], planets: ["Mercury"], families: ["primary", "strength"], divisions: [] },
    { key: "education", label: "Education travel", houses: [5, 9], planets: ["Jupiter", "Mercury"], families: ["supporting", "yoga"], divisions: [] },
    { key: "pilgrimage", label: "Pilgrimage", houses: [9, 12], planets: ["Jupiter", "Ketu"], families: ["primary", "timing"], divisions: [] },
    { key: "foreign_work", label: "Foreign work", houses: [6, 9, 12], planets: ["Saturn", "Rahu"], families: ["strength", "timing"], divisions: [] },
    { key: "relocation", label: "Relocation", houses: [4, 9, 12], planets: ["Moon", "Jupiter"], families: ["divisional", "house_support"], divisions: [4] },
    { key: "settlement", label: "Long-term settlement", houses: [4, 9, 11, 12], planets: ["Moon", "Saturn"], families: ["divisional", "strength"], divisions: [4] },
  ],
};

const LIFE_DOMAIN_CONFIG: Record<LifeDomainKey, LifeDomainConfig> = {
  love_life: {
    label: "Love Life",
    primary_house: 7,
    secondary_house: 5,
    anchor_planet: "Venus",
    summary_focus: "partnership, attraction, emotional availability, and long-term bonding",
    decision_test: "reciprocity, conflict repair, and shared commitments repeat in behavior",
    boundary_focus: "chemistry overrule reliability, consent, or compatible values",
  },
  career: {
    label: "Career",
    primary_house: 10,
    secondary_house: 6,
    anchor_planet: "Saturn",
    summary_focus: "career growth, authority, public standing, and work ethic",
    decision_test: "the role adds visible proof, real authority, and a sustainable workload",
    boundary_focus: "urgency or status disguise unclear authority and chronic overwork",
  },
  family: {
    label: "Family",
    primary_house: 4,
    secondary_house: 2,
    anchor_planet: "Moon",
    summary_focus: "home life, emotional grounding, lineage, and support systems",
    decision_test: "care, boundaries, and practical responsibility make the home more restorative",
    boundary_focus: "temporary peace replace honest communication and emotional safety",
  },
  inheritance: {
    label: "Inheritance",
    primary_house: 8,
    secondary_house: 2,
    anchor_planet: "Jupiter",
    summary_focus: "inheritance, shared assets, legacies, and resource transitions",
    decision_test: "ownership, liabilities, valuation, and exit conditions are independently verified",
    boundary_focus: "goodwill or family pressure replace complete records and clear ownership",
  },
  influence: {
    label: "Influence",
    primary_house: 11,
    secondary_house: 10,
    anchor_planet: "Sun",
    summary_focus: "influence, network effect, social reach, and the ability to move people",
    decision_test: "the message is useful, repeatable, and supported by credible work",
    boundary_focus: "attention expand faster than the message, audience, or delivery system",
  },
  life_cycle: {
    label: "Life Cycle",
    primary_house: 1,
    secondary_house: 8,
    anchor_planet: "Moon",
    summary_focus: "major life phases, reinvention, recovery, and long-range personal evolution",
    decision_test: "daily behavior already supports the identity or direction you want to claim",
    boundary_focus: "a dramatic reset leave the underlying habit, fear, or dependency untouched",
  },
  travel_destinations: {
    label: "Travel & Destinations",
    primary_house: 9,
    secondary_house: 3,
    anchor_planet: "Jupiter",
    summary_focus: "long-distance travel, foreign lands, pilgrimages, relocation potential, and short journeys",
    decision_test: "purpose, documents, finances, health, and daily logistics support the move",
    boundary_focus: "the idea of escape substitute for a workable life in the destination",
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
  config: LifeDomainConfig,
  primaryHouse: HousePlacement,
  primaryLord: PlanetPosition,
  secondaryLord: PlanetPosition,
  anchorPlanet: PlanetPosition
): string[] {
  const triggers: string[] = [
    `${primaryLord.name} periods and major transits move ${config.label.toLowerCase()} fastest.`,
    `${secondaryLord.name} periods test whether support from house ${config.secondary_house} can carry the primary promise.`,
    `${anchorPlanet.name} activations color ${config.label.toLowerCase()} timing through ${HOUSE_THEMES[anchorPlanet.house]}.`,
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
  secondaryLord: PlanetPosition,
  anchorPlanet: PlanetPosition
): string[] {
  return [
    `${primaryHouse.sign} sets the main tone.`,
    `${secondaryHouse.sign} adds support through house ${secondaryHouse.house_number}.`,
    `${secondaryLord.name} carries that supporting house from house ${secondaryLord.house}.`,
    `${anchorPlanet.name} filters instinct through house ${anchorPlanet.house}.`,
    dignitySummary(primaryLord),
  ];
}

function domainLongGame(
  label: string,
  primaryHouse: HousePlacement,
  primaryLord: PlanetPosition
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

type DomainNarrativeProfile = {
  headline: string;
  body: string;
  approachStrength: string;
  deliveryStrength: string;
  occupiedStrength: string;
  quietStrength: string;
  linkedSignal: string;
  primaryRisk: string;
  anchorRisk: string;
  baselineWatchout: string;
  strongTiming: string;
  weakTiming: string;
  neutralTiming: string;
  activeTiming: string;
  quietTiming: string;
  guidance: string;
  longGame: string;
};

const DOMAIN_NARRATIVES: Record<LifeDomainKey, DomainNarrativeProfile> = {
  love_life: {
    headline: "What partnership actually asks of you",
    body: "Partnership starts through {styleWithArticle} approach to attraction, but commitment is delivered through {delivery}. The distance between those two shows what a bond must learn before it can last.",
    approachStrength: "You read chemistry and reciprocity through {sign}'s {style} style; forced intimacy is unlikely to feel convincing.",
    deliveryStrength: "{lord} carries partnership outcomes into {delivery}, so love tends to affect that part of life directly.",
    occupiedStrength: "With {occupants} directly activating partnership, relationship choices become visible and difficult to postpone.",
    quietStrength: "With partnership unoccupied, the romantic pattern develops through {support}; consistent behavior matters more than dramatic beginnings.",
    linkedSignal: "Romance and commitment are tightly linked here, so attraction tends to become a decision about the future.",
    primaryRisk: "Partnership can ask for repair work, boundaries, or patience before equality is possible; chemistry alone will not solve that workload.",
    anchorRisk: "{anchor} asks for more discernment than indulgence: affection may be real while values and compatibility still need separate checks.",
    baselineWatchout: "The recurring relationship test is whether closeness remains reciprocal after the first intensity settles.",
    strongTiming: "{anchor} gives clean relationship instincts; mutual interest is easier to recognize and commitment conversations land at the right pace.",
    weakTiming: "Attraction can arrive before reliability is proven, so let consistency establish the timing instead of chemistry.",
    neutralTiming: "Relationship timing improves when affection is matched by clear agreements and repeatable follow-through.",
    activeTiming: "Partnership periods tend to announce themselves openly through meetings, choices, or a visible change in commitment.",
    quietTiming: "A meaningful bond may form quietly; notice who keeps showing up before looking for a dramatic turning point.",
    guidance: "In love, {elementMethod}. Then test attraction against reciprocity, conflict repair, and whether both people can keep agreements.",
    longGame: "The durable relationship pattern is built by letting {lord} mature your standards; fewer assumptions and better repair matter more than constant intensity.",
  },
  career: {
    headline: "Where your working life is heading",
    body: "Your public work favors {styleWithArticle} operating style. Recognition accumulates through {delivery}, so the job title matters less than the proof you build along that route.",
    approachStrength: "Your professional advantage is {sign}'s {style} way of solving problems and taking responsibility.",
    deliveryStrength: "{lord} routes advancement through {delivery}; that is where competence becomes reputation.",
    occupiedStrength: "{occupants} make career decisions a foreground concern, increasing both visibility and the cost of drifting without a plan.",
    quietStrength: "With the career zone unoccupied, professional traction comes through {support}; daily systems create the public result.",
    linkedSignal: "Workload and public standing reinforce one another strongly, so better process is likely to produce visible advancement.",
    primaryRisk: "Career progress may require apprenticeship, repeated proof, or behind-the-scenes labor before authority catches up with ability.",
    anchorRisk: "{anchor} can turn discipline into self-criticism; use deadlines and standards without making every delay a verdict on your competence.",
    baselineWatchout: "The professional trap is confusing motion with progress; prioritize work that leaves evidence, leverage, or a stronger position.",
    strongTiming: "{anchor} supports patient professional timing; promotions and heavier responsibility are easier to accept when the structure is ready.",
    weakTiming: "Professional pressure can make the next offer look more urgent than it is; verify role, authority, and workload before committing.",
    neutralTiming: "Career openings respond to preparation: credentials, work samples, and useful relationships should exist before the vacancy appears.",
    activeTiming: "Career shifts are likely to be public and measurable, such as a new mandate, title, client base, or change in accountability.",
    quietTiming: "The next professional phase may begin as a process change or private responsibility before anyone calls it advancement.",
    guidance: "At work, {elementMethod}. Convert that instinct into visible proof, a repeatable system, and a clear next level of responsibility.",
    longGame: "Career compounds when {lord} turns skill into authority; choose roles that deepen judgement instead of merely increasing activity.",
  },
  family: {
    headline: "What home is supposed to give you",
    body: "Home and belonging are filtered through {styleWithArticle} emotional rhythm. Stability is rebuilt through {delivery}, which reveals where family patterns are actually repaired.",
    approachStrength: "{sign} gives the private life {styleWithArticle} way of protecting, nesting, and deciding who feels like family.",
    deliveryStrength: "{lord} connects emotional security with {delivery}; changes there tend to alter the atmosphere at home.",
    occupiedStrength: "{occupants} keep family and home themes active, making private decisions central rather than occasional.",
    quietStrength: "With the home zone unoccupied, belonging is strengthened through {support}; speech, shared values, and practical continuity carry more weight.",
    linkedSignal: "Home and lineage are closely connected, so changing the household pattern also changes what is carried forward from family.",
    primaryRisk: "Family stability may require difficult caretaking, privacy, or emotional repair before the home feels restorative again.",
    anchorRisk: "{anchor} can blur your needs with the family's mood; name what belongs to you before taking responsibility for everyone else.",
    baselineWatchout: "The family pattern becomes costly when peace is maintained by avoiding the conversation that would make the home safer.",
    strongTiming: "{anchor} supports accurate emotional timing; you can usually tell when to gather people, set a boundary, or make a home change.",
    weakTiming: "Family decisions can be made from a temporary mood, so let the emotional weather settle before changing the structure around it.",
    neutralTiming: "Home decisions work best after the practical and emotional needs have both been named, not when one is used to silence the other.",
    activeTiming: "Family developments tend to become obvious through a move, a caregiving decision, or a visible change in household roles.",
    quietTiming: "The private life changes through small routines first; the larger family shift becomes clear only after those habits hold.",
    guidance: "For family, {elementMethod}. Use that instinct to create predictable care, clearer boundaries, and a home that restores rather than drains.",
    longGame: "Family security improves as {lord} helps you replace inherited reflexes with chosen rituals, honest speech, and steadier forms of support.",
  },
  inheritance: {
    headline: "What reaches you through other people",
    body: "Shared money and legacy questions unfold through {styleWithArticle} risk pattern. Their consequences land in {delivery}, so stewardship matters as much as what is received.",
    approachStrength: "{sign} gives you {styleWithArticle} response to debt, dependency, confidential resources, and irreversible financial decisions.",
    deliveryStrength: "{lord} directs shared-resource outcomes toward {delivery}; that area often carries the real obligation attached to an asset.",
    occupiedStrength: "{occupants} make shared assets and legacy matters more active, increasing the need for explicit ownership and documentation.",
    quietStrength: "With the inheritance zone unoccupied, resource transfers depend more on {support}; reserves and family agreements become the stabilizer.",
    linkedSignal: "Stored wealth and transferred wealth are closely linked, so what is preserved matters as much as what is inherited.",
    primaryRisk: "Shared resources can arrive with delay, secrecy, debt, or emotional strings; investigate obligations before counting the asset.",
    anchorRisk: "{anchor} can overestimate goodwill or future value; independent advice and complete records are more useful than reassurance.",
    baselineWatchout: "The main financial boundary is transparency: unclear ownership, undocumented promises, and mixed accounts should never be treated as minor details.",
    strongTiming: "{anchor} supports sound stewardship; negotiations are cleaner when growth, tax, debt, and responsibility are discussed together.",
    weakTiming: "Optimism can outrun due diligence, so delay signatures until ownership, liabilities, and exit conditions are fully visible.",
    neutralTiming: "Resource transfers favor preparation over prediction; organize records and contingencies before money or responsibility changes hands.",
    activeTiming: "A shared-resource period is likely to surface through a concrete negotiation, settlement, debt decision, or change in ownership.",
    quietTiming: "The important shift may begin with paperwork or a private conversation long before any asset visibly changes hands.",
    guidance: "With shared resources, {elementMethod}. Follow that instinct with documentation, independent valuation, and a clear map of responsibility.",
    longGame: "Legacy becomes safer when {lord} turns complexity into stewardship; protect future choices instead of maximizing the immediate transfer.",
  },
  influence: {
    headline: "How far your voice carries",
    body: "Your reach grows through {styleWithArticle} social strategy. Influence is earned in {delivery}, showing where an audience begins to trust your judgement.",
    approachStrength: "{sign} gives your network {styleWithArticle} way of gathering allies, sharing ideas, and deciding which groups deserve your energy.",
    deliveryStrength: "{lord} converts reach into results through {delivery}; credibility there determines how far the message travels.",
    occupiedStrength: "{occupants} amplify network activity, making alliances, audiences, and collective goals unusually visible.",
    quietStrength: "With the network zone unoccupied, influence grows through {support}; reputation has to precede reach.",
    linkedSignal: "Public standing and network reach feed each other directly, so credible work is the strongest audience-building strategy.",
    primaryRisk: "Influence can grow through demanding groups, political friction, or obligations that consume more energy than the access is worth.",
    anchorRisk: "{anchor} can make visibility personal; separate the usefulness of the message from the amount of attention it receives.",
    baselineWatchout: "The audience becomes a distraction when reach expands faster than the message, boundaries, or delivery system can support.",
    strongTiming: "{anchor} supports visible leadership; it is easier to know when to claim credit, represent the group, or put your name behind an idea.",
    weakTiming: "Recognition can distort judgement, so test the message with trusted peers before treating applause or resistance as proof.",
    neutralTiming: "Influence grows when a useful message is repeated consistently enough for other people to carry it without your supervision.",
    activeTiming: "Network shifts tend to be public, arriving through invitations, introductions, audience growth, or a larger collective responsibility.",
    quietTiming: "The next expansion may start with one strategic ally; depth of trust matters more than the first visible increase in reach.",
    guidance: "For influence, {elementMethod}. Turn that instinct into a repeatable message, a defined audience, and alliances with mutual value.",
    longGame: "Reach compounds when {lord} ties visibility to contribution; build a body of work that other people can quote, use, and recommend.",
  },
  life_cycle: {
    headline: "How you reinvent yourself",
    body: "Identity changes through {styleWithArticle} cycle of action and reflection. Each reinvention is delivered through {delivery}, which names the terrain where the new self is tested.",
    approachStrength: "{sign} gives self-direction {styleWithArticle} pattern; you renew momentum by returning to that native way of meeting life.",
    deliveryStrength: "{lord} carries identity changes into {delivery}, so major personal chapters are rarely confined to appearance or mood.",
    occupiedStrength: "{occupants} intensify self-development, making reinvention an active and recurring part of the life story.",
    quietStrength: "With identity unoccupied, transformation gathers through {support}; change begins below the surface before it becomes a new direction.",
    linkedSignal: "Identity and transformation are tightly coupled, so endings tend to produce a genuine new operating system rather than a cosmetic reset.",
    primaryRisk: "Personal growth can be shaped by crisis, exhaustion, or retreat; recovery must be treated as part of the change rather than a delay in it.",
    anchorRisk: "{anchor} can make a temporary feeling look like a permanent identity; wait for the pattern to repeat before rewriting your self-concept.",
    baselineWatchout: "Reinvention becomes avoidance when the outer change is dramatic but the underlying habit, fear, or dependency remains untouched.",
    strongTiming: "{anchor} gives good instincts for personal turning points; inner readiness and outer change are more likely to arrive together.",
    weakTiming: "A strong mood can trigger a premature reset, so make identity decisions after the emotional peak rather than inside it.",
    neutralTiming: "A new chapter is ready when the daily behavior already resembles the person you intend to become.",
    activeTiming: "Life-cycle shifts are likely to be unmistakable, bringing a visible change in role, body, direction, or personal priorities.",
    quietTiming: "Reinvention begins privately through recovery and changed habits; the new identity becomes visible only after it is stable.",
    guidance: "For reinvention, {elementMethod}. Reduce the change to one identity-defining habit and let repeated action make the new chapter credible.",
    longGame: "Personal evolution deepens when {lord} turns each ending into a better structure for agency, resilience, and self-trust.",
  },
  travel_destinations: {
    headline: "Where you end up, and why",
    body: "Distance and discovery follow {styleWithArticle} appetite for movement. The purpose of travel is delivered through {delivery}, revealing what a place is meant to teach or change.",
    approachStrength: "{sign} gives travel {styleWithArticle} rhythm; the right journey needs to match that pace rather than merely look impressive.",
    deliveryStrength: "{lord} connects distant places with {delivery}, so destination choices often serve that larger purpose.",
    occupiedStrength: "{occupants} activate travel and relocation themes, making movement, foreign links, or changing horizons more consequential.",
    quietStrength: "With long-distance travel unoccupied, movement grows through {support}; short trips, skills, and logistics prepare the larger departure.",
    linkedSignal: "Short journeys and long-distance movement reinforce each other, so local exploration can become the bridge to relocation or foreign opportunity.",
    primaryRisk: "Travel can involve bureaucracy, health strain, hidden cost, or separation; the meaningful destination still requires practical buffers.",
    anchorRisk: "{anchor} can idealize a place before daily life there is understood; compare the dream with cost, routine, community, and legal reality.",
    baselineWatchout: "Movement becomes escape when the destination is expected to solve a pattern that has not been addressed at home.",
    strongTiming: "{anchor} supports expansive travel choices; learning, meaning, and logistics are more likely to point toward the same destination.",
    weakTiming: "The promise of distance can be exaggerated, so verify documents, finances, and daily conditions before treating a place as destiny.",
    neutralTiming: "Travel timing improves when purpose and preparation agree; a clear reason to go is more reliable than restlessness alone.",
    activeTiming: "Travel periods are likely to arrive through a visible invitation, course, relocation option, or foreign connection.",
    quietTiming: "The important journey may begin with research, language, paperwork, or repeated short trips before the long move becomes possible.",
    guidance: "For travel, {elementMethod}. Match that instinct with a defined purpose, realistic logistics, and enough margin for the unfamiliar.",
    longGame: "Distance becomes meaningful when {lord} turns experience into perspective; choose journeys that expand judgement, not only scenery.",
  },
};

const ELEMENT_METHODS: Record<string, string> = {
  Fire: "act directly and create momentum",
  Earth: "build proof through routines and material follow-through",
  Air: "name the terms, compare options, and keep communication moving",
  Water: "read the emotional undercurrent and protect what needs time",
};

type DomainNarrativeFacts = Record<
  "style" | "styleWithArticle" | "delivery" | "support" | "sign" | "lord" | "secondaryLord" | "anchor" | "occupants" | "elementMethod",
  string
>;

function renderDomainNarrative(template: string, facts: DomainNarrativeFacts): string {
  return template.replace(/\{(\w+)\}/g, (_match, token: string) => facts[token as keyof DomainNarrativeFacts] ?? "");
}

function rankedRuleHits(
  rules: DomainRuleHit[],
  impact: DomainRuleHit["impact"]
): DomainRuleHit[] {
  return rules
    .filter((rule) => rule.impact === impact)
    .sort((left, right) => right.weight - left.weight || left.id.localeCompare(right.id));
}

function uniqueCopy(items: Array<string | undefined>): string[] {
  return [...new Set(items.filter((item): item is string => Boolean(item?.trim())))];
}

function matrixStatus(rules: DomainRuleHit[]): DomainEvidenceMatrixEntry["status"] {
  const hasSupport = rules.some((rule) => rule.impact === "support" || rule.impact === "activation");
  const hasPressure = rules.some((rule) => rule.impact === "pressure");
  if (hasSupport && hasPressure) return "mixed";
  if (hasSupport) return "support";
  if (hasPressure) return "pressure";
  return "context";
}

function matrixEntry(
  family: DomainEvidenceFamily,
  label: string,
  rules: DomainRuleHit[],
  fallback: string
): DomainEvidenceMatrixEntry {
  const ordered = [...rules].sort((left, right) => right.weight - left.weight);
  return {
    family,
    label,
    status: matrixStatus(ordered),
    summary: ordered[0]?.summary ?? fallback,
    technical_note: ordered.map((rule) => rule.technical_note).join(" ") || fallback,
  };
}

function buildEvidenceMatrix(
  label: string,
  rules: DomainRuleHit[]
): DomainEvidenceMatrix {
  const groups: Array<[DomainEvidenceFamily, string, (rule: DomainRuleHit) => boolean, string]> = [
    ["primary", "Natal promise", (rule) => /^(primary_|delivery_|primary_house_|benefic_|malefic_|matrix_primary_)/.test(rule.id), "The natal house and its ruler remain the baseline evidence."],
    ["supporting", "Supporting factors", (rule) => /^(supporting_|anchor_|primary_secondary_|shared_domain_|domain_yoga|matrix_support_)/.test(rule.id), "No dominant supporting factor overrides the natal baseline."],
    ["divisional", "Divisional confirmation", (rule) => rule.id.startsWith("divisional_"), "No relevant divisional confirmation was available."],
    ["strength", "Delivery capacity", (rule) => rule.id.startsWith("shadbala_"), "Measured Shadbala was not available for this calculation."],
    ["house_support", "House support", (rule) => rule.id.startsWith("ashtakavarga_"), "Ashtakavarga house support was not available."],
    ["yoga", "Combination support", (rule) => rule.id.startsWith("domain_yoga_"), "No relevant yoga was strong enough to modify the conclusion."],
    ["timing", "Timing and activation", (rule) => rule.id.startsWith("timing_"), "No direct timing activation is being claimed."],
  ];
  const entries = groups.map(([family, entryLabel, predicate, fallback]) =>
    matrixEntry(family, entryLabel, rules.filter(predicate), fallback)
  );
  const supportFamilies = entries
    .filter((entry) => entry.status === "support")
    .map((entry) => entry.family);
  const pressureFamilies = entries
    .filter((entry) => entry.status === "pressure")
    .map((entry) => entry.family);
  const mixedFamilies = entries.filter((entry) => entry.status === "mixed");
  const natal = entries.find((entry) => entry.family === "primary")!;
  const divisional = entries.find((entry) => entry.family === "divisional")!;
  const independentSupportGroups = uniqueCopy([
    natal.status === "support" ? "natal_promise" : undefined,
    entries.find((entry) => entry.family === "supporting")?.status === "support" ? "supporting_natal" : undefined,
    ["divisional", "strength", "yoga"].some((family) =>
      entries.find((entry) => entry.family === family)?.status === "support"
    ) ? "delivery_confirmation" : undefined,
    entries.find((entry) => entry.family === "house_support")?.status === "support" ? "house_environment" : undefined,
    entries.find((entry) => entry.family === "timing")?.status === "support" ? "activation" : undefined,
  ]);

  let confirmationStatus: DomainEvidenceMatrix["confirmation_status"] = "insufficient";
  if (divisional.status === "support" && natal.status === "support") confirmationStatus = "confirmed";
  else if (divisional.status === "pressure" && (natal.status === "support" || natal.status === "mixed")) confirmationStatus = "qualified";
  else if (divisional.status === "support" && natal.status === "pressure") confirmationStatus = "improved";
  else if (
    mixedFamilies.length >= 2 ||
    pressureFamilies.length >= 3 ||
    (supportFamilies.length >= 2 && pressureFamilies.length >= 2)
  ) confirmationStatus = "contradictory";
  else if (divisional.status !== "context") confirmationStatus = "qualified";

  if (confirmationStatus === "contradictory") {
    entries.push({
      family: "contradiction",
      label: "Contradiction check",
      status: "mixed",
      summary: "Independent evidence families disagree, so this conclusion should be used cautiously.",
      technical_note: `Support: ${supportFamilies.join(", ") || "none"}; pressure: ${pressureFamilies.join(", ") || "none"}; mixed: ${mixedFamilies.map((entry) => entry.family).join(", ") || "none"}.`,
    });
  }

  const conclusionStrength: DomainEvidenceMatrix["conclusion_strength"] =
    natal.status === "support" &&
    independentSupportGroups.length >= 3 &&
    pressureFamilies.length <= 1 &&
    confirmationStatus !== "contradictory"
      ? "strong"
      : independentSupportGroups.length >= 2 && confirmationStatus !== "contradictory"
        ? "moderate"
        : "cautious";
  const baseSynthesis: Record<DomainEvidenceMatrix["confirmation_status"], string> = {
    confirmed: "Natal promise confirmed in the relevant divisional chart.",
    qualified: "Natal promise is present but weakened or qualified in delivery.",
    improved: "The relevant divisional chart improves a pressured natal pattern.",
    contradictory: "Evidence is contradictory and should be treated cautiously.",
    insufficient: "The natal reading remains primary because independent confirmation is limited.",
  };
  const strengthEntry = entries.find((entry) => entry.family === "strength");
  const houseEntry = entries.find((entry) => entry.family === "house_support");
  let modifier = "";
  if (strengthEntry?.status === "support" && houseEntry?.status === "pressure") modifier = " A strong ruler is working with weaker house support.";
  else if (strengthEntry?.status === "pressure" && houseEntry?.status === "support") modifier = " A weaker ruler receives protective house reinforcement.";
  else if (natal.status === "support" && houseEntry?.status === "pressure") modifier = " Strong natal promise meets lighter support conditions.";
  else if (natal.status === "mixed" && houseEntry?.status === "support") modifier = " A moderate natal promise has unusually favorable support conditions.";
  if (natal.status !== "support" && conclusionStrength !== "cautious") {
    modifier += " The natal baseline caps this below a strong conclusion.";
  }
  if (rules.some((rule) => rule.id.endsWith("_time_caution"))) {
    modifier += " Exact-time confirmation is withheld because the recorded birth time is approximate.";
  }

  return {
    entries,
    supporting_families: supportFamilies,
    pressure_families: pressureFamilies,
    independent_support_groups: independentSupportGroups,
    conclusion_strength: conclusionStrength,
    confirmation_status: confirmationStatus,
    synthesis: `${baseSynthesis[confirmationStatus]}${modifier} ${label} is described as especially strong only when at least three independent evidence groups agree after correlated delivery signals are collapsed.`.trim(),
  };
}

function buildDomainSubthemes(
  key: LifeDomainKey,
  houses: HousePlacement[],
  planets: PlanetPosition[],
  matrix: DomainEvidenceMatrix,
  evidence?: LifeDomainExtendedEvidence
): DomainSubtheme[] {
  const familyStatuses = new Map(matrix.entries.map((entry) => [entry.family, entry.status]));
  const shadbala = new Map((evidence?.shadbala ?? []).map((item) => [item.planet, item]));
  const hasReliableBirthTime = !evidence?.birthTimeFallback &&
    (evidence?.birthTimeAccuracy === undefined || evidence.birthTimeAccuracy === "exact");

  return DOMAIN_SUBTHEMES[key]
    .map((subtheme) => {
      let score = 0.44;
      const occupied = subtheme.houses.filter((house) => houseByNumber(houses, house).planets.length > 0);
      score += Math.min(0.14, occupied.length * 0.055);
      const strongPlanets = subtheme.planets.filter((name) => {
        const planet = planets.find((item) => item.name === name);
        if (!planet) return false;
        const dignity = planetDignity(planet);
        return dignity === "exalted" || dignity === "own_sign" || (shadbala.get(name)?.strengthRatio ?? 0) >= 1;
      });
      const weakPlanets = subtheme.planets.filter((name) => {
        const planet = planets.find((item) => item.name === name);
        return Boolean(planet && (planetDignity(planet) === "debilitated" || (shadbala.get(name)?.strengthRatio ?? 1) < 0.85));
      });
      score += Math.min(0.12, strongPlanets.length * 0.05);
      score -= Math.min(0.1, weakPlanets.length * 0.045);
      const divisionalSignals = hasReliableBirthTime
        ? subtheme.divisions.flatMap((division) => {
            const chart = evidence?.divisionalCharts?.[division];
            if (!chart) return [];
            return subtheme.planets.flatMap((planetName) => {
              const position = chart.positions.find((item) => item.name === planetName);
              if (!position) return [];
              return [{
                division,
                planetName,
                dignity: dignityOf(planetName, position.divisional_sign),
              }];
            });
          })
        : [];
      const divisionalSupport = divisionalSignals.filter((signal) =>
        signal.dignity === "exalted" || signal.dignity === "own_sign"
      );
      const divisionalPressure = divisionalSignals.filter((signal) => signal.dignity === "debilitated");
      score += Math.min(0.08, divisionalSupport.length * 0.04);
      score -= Math.min(0.08, divisionalPressure.length * 0.04);
      for (const family of subtheme.families) {
        const status = familyStatuses.get(family);
        if (status === "support") score += 0.045;
        if (status === "pressure") score -= 0.035;
      }
      score = Math.round(Math.max(0.25, Math.min(0.92, score)) * 100) / 100;
      const band: DomainSubtheme["band"] = score >= 0.68 ? "leading" : score >= 0.52 ? "supporting" : "developing";
      const reasons = uniqueCopy([
        occupied.length > 0 ? `houses ${occupied.join(" and ")} are activated` : undefined,
        strongPlanets.length > 0 ? `${strongPlanets.join(" and ")} add delivery strength` : undefined,
        weakPlanets.length > 0 ? `${weakPlanets.join(" and ")} need reinforcement` : undefined,
        divisionalSupport.length > 0 ? `D${[...new Set(divisionalSupport.map((signal) => signal.division))].join(" and D")} confirms this specific theme` : undefined,
        divisionalPressure.length > 0 ? `D${[...new Set(divisionalPressure.map((signal) => signal.division))].join(" and D")} qualifies its delivery` : undefined,
        !hasReliableBirthTime && subtheme.divisions.length > 0 ? "divisional ranking is withheld without an exact birth time" : undefined,
      ]);
      return {
        key: subtheme.key,
        label: subtheme.label,
        score,
        band,
        summary: reasons.length > 0
          ? `${subtheme.label} ranks ${band} because ${reasons.join(", while ")}.`
          : `${subtheme.label} remains ${band}; it needs clearer activation before becoming a leading theme.`,
        supporting_families: [
          ...new Set([
            ...subtheme.families.filter((family) => familyStatuses.get(family) === "support"),
            ...(divisionalSupport.length > 0 ? ["divisional" as const] : []),
          ]),
        ],
      };
    })
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label));
}

function buildDomainClarity(
  label: string,
  rules: DomainRuleHit[]
): string {
  const support = rankedRuleHits(rules, "support")[0];
  const pressure = rankedRuleHits(rules, "pressure")[0];
  const activation = rankedRuleHits(rules, "activation")[0];
  const lead = support ?? activation ?? rules[0];

  if (!lead) {
    return `${label} needs repeated evidence before one event is treated as a stable pattern.`;
  }

  return pressure
    ? `${lead.summary} The main condition is equally important: ${pressure.summary}`
    : `${lead.summary} No dominant pressure rule overrides that support, so consistency becomes the main test.`;
}

function buildDomainDecisionRule(
  config: LifeDomainConfig,
  activationPlanets: string[]
): string {
  const timing = activationPlanets.length > 0
    ? ` Give extra weight to ${activationPlanets.join(", ")} periods only when the visible evidence agrees.`
    : "";
  return `Move on ${config.label.toLowerCase()} decisions when ${config.decision_test}.${timing}`;
}

function buildDomainBoundaryRule(
  config: LifeDomainConfig,
  rules: DomainRuleHit[]
): string {
  const pressure = rankedRuleHits(rules, "pressure")[0];
  const condition = pressure ? `${pressure.summary} ` : "";
  return `${condition}Do not let ${config.boundary_focus}.`;
}

function domainsAreLinked(
  primaryHouse: HousePlacement,
  secondaryHouse: HousePlacement,
  primaryLord: PlanetPosition,
  secondaryLord: PlanetPosition
): boolean {
  return (
    primaryLord.name === secondaryLord.name ||
    primaryLord.house === secondaryHouse.house_number ||
    secondaryLord.house === primaryHouse.house_number
  );
}

function buildDomainDisplayStrengths(
  profile: DomainNarrativeProfile,
  facts: DomainNarrativeFacts,
  primaryHouse: HousePlacement,
  secondaryHouse: HousePlacement,
  primaryLord: PlanetPosition,
  secondaryLord: PlanetPosition,
  rules: DomainRuleHit[]
): string[] {
  const third = domainsAreLinked(primaryHouse, secondaryHouse, primaryLord, secondaryLord)
    ? profile.linkedSignal
    : primaryHouse.planets.length > 0
      ? profile.occupiedStrength
      : profile.quietStrength;

  return uniqueCopy([
    ...rankedRuleHits(rules, "support").map((rule) => rule.summary),
    ...rankedRuleHits(rules, "activation").map((rule) => rule.summary),
    renderDomainNarrative(profile.approachStrength, facts),
    renderDomainNarrative(profile.deliveryStrength, facts),
    renderDomainNarrative(third, facts),
  ]).slice(0, 3);
}

function buildDomainDisplayWatchouts(
  profile: DomainNarrativeProfile,
  facts: DomainNarrativeFacts,
  primaryHouse: HousePlacement,
  primaryLord: PlanetPosition,
  anchorPlanet: PlanetPosition,
  rules: DomainRuleHit[]
): string[] {
  const watchouts: string[] = rankedRuleHits(rules, "pressure").map(
    (rule) => rule.summary
  );
  const lordNeedsCare =
    [6, 8, 12].includes(primaryLord.house) ||
    planetDignity(primaryLord) === "debilitated" ||
    primaryLord.is_retrograde ||
    primaryLord.is_combust;
  const anchorNeedsCare =
    planetDignity(anchorPlanet) === "debilitated" ||
    anchorPlanet.is_retrograde ||
    anchorPlanet.is_combust;

  if (lordNeedsCare) watchouts.push(profile.primaryRisk);
  if (anchorNeedsCare) watchouts.push(profile.anchorRisk);
  if (primaryHouse.planets.length === 0 || watchouts.length === 0) {
    watchouts.push(profile.baselineWatchout);
  }

  return [...new Set(watchouts)]
    .slice(0, 2)
    .map((item) => renderDomainNarrative(item, facts));
}

/** Max 2, and deliberately free of transit and house vocabulary. */
function buildDomainDisplayTiming(
  profile: DomainNarrativeProfile,
  facts: DomainNarrativeFacts,
  primaryHouse: HousePlacement,
  secondaryHouse: HousePlacement,
  primaryLord: PlanetPosition,
  secondaryLord: PlanetPosition,
  anchorPlanet: PlanetPosition,
  rules: DomainRuleHit[]
): string[] {
  const dignity = planetDignity(anchorPlanet);
  const instinct =
    dignity === "exalted" || dignity === "own_sign"
      ? profile.strongTiming
      : dignity === "debilitated" || anchorPlanet.is_retrograde || anchorPlanet.is_combust
        ? profile.weakTiming
        : profile.neutralTiming;
  const shape = domainsAreLinked(primaryHouse, secondaryHouse, primaryLord, secondaryLord)
    ? profile.linkedSignal
    : primaryHouse.planets.length > 0
      ? profile.activeTiming
      : profile.quietTiming;

  const activation = rankedRuleHits(rules, "activation")[0]?.summary;
  return uniqueCopy([
    activation,
    renderDomainNarrative(instinct, facts),
    renderDomainNarrative(shape, facts),
  ]).slice(0, 2);
}

function buildDomainClaims(
  config: LifeDomainConfig,
  primaryHouse: HousePlacement,
  secondaryHouse: HousePlacement,
  primaryLord: PlanetPosition,
  secondaryLord: PlanetPosition,
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
      label: "Supporting lord",
      value: secondaryLord.name,
      kind: "lordship",
      detail: `Placed in the ${ordinal(secondaryLord.house)} house, ${humanDignity(planetDignity(secondaryLord))} by dignity.`,
    },
    {
      label: "Anchor planet",
      value: anchorPlanet.name,
      kind: "dignity",
      detail: `${humanDignity(planetDignity(anchorPlanet))} in ${anchorPlanet.sign}.`,
    },
  ];
}

function buildLifeDomainInsight(
  key: LifeDomainKey,
  planets: PlanetPosition[],
  houses: HousePlacement[],
  domElement: string,
  extendedEvidence?: LifeDomainExtendedEvidence
): LifeDomainInsight {
  const config = LIFE_DOMAIN_CONFIG[key];
  const primaryHouse = houseByNumber(houses, config.primary_house);
  const secondaryHouse = houseByNumber(houses, config.secondary_house);
  const primaryLordName = SIGN_RULERS[primaryHouse.sign];
  const primaryLord = planetByName(planets, primaryLordName);
  const secondaryLordName = SIGN_RULERS[secondaryHouse.sign];
  const secondaryLord = planetByName(planets, secondaryLordName);
  const anchorPlanet = planetByName(planets, config.anchor_planet);
  const { rules: domainRules, profile: signalProfile } = evaluateLifeDomainRules({
    key,
    label: config.label,
    primaryHouse,
    secondaryHouse,
    primaryLord,
    secondaryLord,
    anchorPlanet,
    planets,
    houses,
    evidence: extendedEvidence,
  });
  const evidenceMatrix = buildEvidenceMatrix(
    config.label,
    domainRules
  );
  const subthemes = buildDomainSubthemes(
    key,
    houses,
    planets,
    evidenceMatrix,
    extendedEvidence
  );
  const confidence = signalProfile.activity_score;

  const headline =
    `${config.label}: ${primaryHouse.sign} house ${primaryHouse.house_number}, led by ${primaryLord.name}.`;

  const overview =
    `${primaryHouse.sign} sets a ${SIGN_STYLE_PHRASES[primaryHouse.sign]} tone for ${config.summary_focus}. ` +
    `${primaryLord.name} in house ${primaryLord.house} links outcomes to ${HOUSE_THEMES[primaryLord.house]}. ` +
    `The practical read is to separate the promise of house ${config.primary_house} from the delivery route of ${primaryLord.name}, then use ${anchorPlanet.name} as the instinctive filter.`;

  const profile = DOMAIN_NARRATIVES[key];
  const style = SIGN_STYLE_PHRASES[primaryHouse.sign];
  const facts: DomainNarrativeFacts = {
    style,
    styleWithArticle: `${/^[aeiou]/i.test(style) ? "an" : "a"} ${style}`,
    delivery: HOUSE_THEMES[primaryLord.house],
    support: HOUSE_THEMES[secondaryHouse.house_number],
    sign: primaryHouse.sign,
    lord: primaryLord.name,
    secondaryLord: secondaryLord.name,
    anchor: anchorPlanet.name,
    occupants: primaryHouse.planets.join(", ") || "No planet",
    elementMethod: ELEMENT_METHODS[domElement] ?? ELEMENT_METHODS.Fire,
  };
  const leadingSpecificRule =
    rankedRuleHits(domainRules, "support")[0] ??
    rankedRuleHits(domainRules, "activation")[0] ??
    rankedRuleHits(domainRules, "pressure")[0];
  const displayBody = uniqueCopy([
    renderDomainNarrative(profile.body, facts),
    leadingSpecificRule?.summary,
  ]).join(" ");

  return {
    key,
    label: config.label,

    display: {
      headline: profile.headline,
      body: displayBody,
      guidance: renderDomainNarrative(profile.guidance, facts),
      long_game: renderDomainNarrative(profile.longGame, facts),
      clarity: `${evidenceMatrix.synthesis} ${buildDomainClarity(config.label, domainRules)}`,
      decision_rule: buildDomainDecisionRule(
        config,
        signalProfile.activation_planets
      ),
      boundary_rule: buildDomainBoundaryRule(config, domainRules),
      strengths: buildDomainDisplayStrengths(
        profile,
        facts,
        primaryHouse,
        secondaryHouse,
        primaryLord,
        secondaryLord,
        domainRules
      ),
      watchouts: buildDomainDisplayWatchouts(
        profile,
        facts,
        primaryHouse,
        primaryLord,
        anchorPlanet,
        domainRules
      ),
      timing: buildDomainDisplayTiming(
        profile,
        facts,
        primaryHouse,
        secondaryHouse,
        primaryLord,
        secondaryLord,
        anchorPlanet,
        domainRules
      ),
    },

    evidence: {
      technical_note: `${headline} ${overview}`,
      claims: buildDomainClaims(config, primaryHouse, secondaryHouse, primaryLord, secondaryLord, anchorPlanet),
      // Legacy sort consumers still read confidence_score; both fields now
      // carry the rule-derived activity score, never a probability.
      signal_score: confidence,
    },
    rule_hits: domainRules,
    signal_profile: signalProfile,
    evidence_matrix: evidenceMatrix,
    subthemes,

    // Every legacy field below is computed exactly as before. Nothing is
    // dropped -- these are demoted to the technical tier at the render sites,
    // not deleted.
    headline,
    overview,
    strengths: buildDomainStrengths(primaryHouse, secondaryHouse, primaryLord, anchorPlanet),
    watchouts: buildDomainWatchouts(primaryHouse, primaryLord, anchorPlanet),
    timing_triggers: domainTimingTriggers(config, primaryHouse, primaryLord, secondaryLord, anchorPlanet),
    supporting_patterns: domainSupportingPatterns(primaryHouse, secondaryHouse, primaryLord, secondaryLord, anchorPlanet),
    guidance: domainGuidance(domElement, primaryHouse, primaryLord, config.label),
    long_game: domainLongGame(config.label, primaryHouse, primaryLord),
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
  houses: HousePlacement[],
  extendedEvidence?: LifeDomainExtendedEvidence
): LifeDomainInsight[] {
  const { element: domEl } = dominantElement(planets);
  return (Object.keys(LIFE_DOMAIN_CONFIG) as LifeDomainKey[]).map((key) =>
    buildLifeDomainInsight(key, planets, houses, domEl, extendedEvidence)
  );
}
