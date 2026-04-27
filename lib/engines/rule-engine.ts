
import type { PlanetPosition, HousePlacement } from "./swiss-ephemeris-engine";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface DeterministicRule {
  title: string;
  insight: string;
  basis: string;
  priority: "high" | "medium" | "low";
  category: string;
  confidence_score: number;
  tension_note: string;
}

export interface LifeDomainInsight {
  key:
    | "love_life"
    | "career"
    | "family"
    | "inheritance"
    | "influence"
    | "life_cycle"
    | "travel_destinations";
  label: string;
  headline: string;
  overview: string;
  strengths: string[];
  watchouts: string[];
  timing_triggers: string[];
  supporting_patterns: string[];
  guidance: string;
  long_game: string;
  confidence_score: number;
}

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const SIGN_ELEMENTS: Record<string, string> = {
  Aries: "Fire", Leo: "Fire", Sagittarius: "Fire",
  Taurus: "Earth", Virgo: "Earth", Capricorn: "Earth",
  Gemini: "Air", Libra: "Air", Aquarius: "Air",
  Cancer: "Water", Scorpio: "Water", Pisces: "Water",
};

const SIGN_RULERS: Record<string, string> = {
  Aries: "Mars", Taurus: "Venus", Gemini: "Mercury", Cancer: "Moon",
  Leo: "Sun", Virgo: "Mercury", Libra: "Venus", Scorpio: "Mars",
  Sagittarius: "Jupiter", Capricorn: "Saturn", Aquarius: "Saturn", Pisces: "Jupiter",
};

const PLANET_OWN_SIGNS: Record<string, Set<string>> = {
  Sun: new Set(["Leo"]),
  Moon: new Set(["Cancer"]),
  Mercury: new Set(["Gemini", "Virgo"]),
  Venus: new Set(["Taurus", "Libra"]),
  Mars: new Set(["Aries", "Scorpio"]),
  Jupiter: new Set(["Sagittarius", "Pisces"]),
  Saturn: new Set(["Capricorn", "Aquarius"]),
};

const PLANET_EXALTATIONS: Record<string, string> = {
  Sun: "Aries", Moon: "Taurus", Mercury: "Virgo", Venus: "Pisces",
  Mars: "Capricorn", Jupiter: "Cancer", Saturn: "Libra",
};

const PLANET_DEBILITATIONS: Record<string, string> = {
  Sun: "Libra", Moon: "Scorpio", Mercury: "Pisces", Venus: "Virgo",
  Mars: "Cancer", Jupiter: "Capricorn", Saturn: "Aries",
};

const ASCENDANT_INSIGHTS: Record<string, string> = {
  Aries: "Direct, action-driven and competitive. You perform best with bold goals and quick execution loops.",
  Taurus: "Steady, practical and value-focused. Long-horizon consistency becomes your strongest advantage.",
  Gemini: "Adaptive, curious and mentally agile. You thrive through communication and cross-domain learning.",
  Cancer: "Protective, intuitive and family-centered. Emotional safety strongly influences peak performance.",
  Leo: "Expressive, leadership-oriented and generous. You gain momentum when your work is visible and creative.",
  Virgo: "Analytical, service-oriented and precision-focused. Systems, routines and quality standards matter deeply.",
  Libra: "Diplomatic, relational and aesthetics-oriented. Collaboration quality is a decisive growth factor.",
  Scorpio: "Intense, strategic and transformational. You excel in high-stakes or deeply investigative environments.",
  Sagittarius: "Vision-led, exploratory and principle-driven. Expansion, travel and knowledge seek expression.",
  Capricorn: "Disciplined, structured and legacy-focused. You build authority through strategic persistence.",
  Aquarius: "Innovative, system-level and future-facing. Originality and community impact energize your path.",
  Pisces: "Imaginative, empathic and spiritually receptive. Art, healing and compassion become key channels.",
};

const SUN_SIGN_INSIGHTS: Record<string, string> = {
  Aries: "Core identity seeks challenge and autonomy.",
  Taurus: "Core identity seeks stability and material grounding.",
  Gemini: "Core identity seeks variety, ideas and exchange.",
  Cancer: "Core identity seeks emotional belonging and protection.",
  Leo: "Core identity seeks recognition and creative influence.",
  Virgo: "Core identity seeks mastery through detail and utility.",
  Libra: "Core identity seeks balance, fairness and partnership.",
  Scorpio: "Core identity seeks depth, truth and transformation.",
  Sagittarius: "Core identity seeks meaning, growth and freedom.",
  Capricorn: "Core identity seeks structure, achievement and respect.",
  Aquarius: "Core identity seeks innovation and social contribution.",
  Pisces: "Core identity seeks transcendence and compassionate purpose.",
};

const MOON_SIGN_INSIGHTS: Record<string, string> = {
  Aries: "Emotional rhythm is quick and decisive, with rapid recovery after setbacks.",
  Taurus: "Emotional rhythm is calm and stable, preferring predictable comfort.",
  Gemini: "Emotional rhythm is cerebral and conversational, needing mental stimulation.",
  Cancer: "Emotional rhythm is sensitive and nurturing, requiring strong home anchors.",
  Leo: "Emotional rhythm is warm and expressive, supported by appreciation.",
  Virgo: "Emotional rhythm is precise and careful, soothed by order and routine.",
  Libra: "Emotional rhythm is harmony-seeking, distressed by unresolved conflict.",
  Scorpio: "Emotional rhythm is deep and private, requiring trust before openness.",
  Sagittarius: "Emotional rhythm is optimistic and freedom-seeking, supported by exploration.",
  Capricorn: "Emotional rhythm is reserved and responsible, comforted by control.",
  Aquarius: "Emotional rhythm is detached and objective, preferring conceptual distance.",
  Pisces: "Emotional rhythm is porous and intuitive, requiring energetic boundaries.",
};

export const HOUSE_THEMES: Record<number, string> = {
  1: "identity, appearance and direction",
  2: "assets, income and values",
  3: "communication, learning and siblings",
  4: "home, roots and emotional foundations",
  5: "creativity, romance and children",
  6: "service, routines and health",
  7: "partnerships and agreements",
  8: "shared resources and transformation",
  9: "beliefs, wisdom and long-distance journeys",
  10: "career, authority and public standing",
  11: "community, networks and long goals",
  12: "retreat, subconscious and spiritual closure",
};

const CAREER_INSIGHTS: Record<string, string> = {
  Aries: "Leadership-driven career path. You excel in entrepreneurship, military, sports, or any role demanding initiative and speed.",
  Taurus: "Career stability through finance, agriculture, luxury goods, art, or banking. You build wealth through patience and material mastery.",
  Gemini: "Communication-centered career path. Journalism, writing, teaching, marketing, or trading leverage your intellectual agility.",
  Cancer: "Nurturing professions suit you best. Healthcare, hospitality, real estate, food industry, or counseling align with your protective nature.",
  Leo: "Careers in leadership, entertainment, politics, or creative direction fulfill your need for visibility and authority.",
  Virgo: "Service-oriented and analytical careers thrive. Medicine, accounting, research, quality assurance, or data science match your precision.",
  Libra: "Partnership-based and aesthetic careers prosper. Law, diplomacy, fashion, interior design, or mediation harness your balance-seeking nature.",
  Scorpio: "Investigative and transformative careers suit you. Research, psychology, surgery, detective work, or financial analysis leverage your depth.",
  Sagittarius: "Expansive careers in education, philosophy, travel, publishing, or international relations match your visionary drive.",
  Capricorn: "Structured careers with long-term growth. Government, corporate management, engineering, architecture, or administration reward your discipline.",
  Aquarius: "Innovative and humanitarian careers excel. Technology, social reform, science, aviation, or network-based businesses fit your originality.",
  Pisces: "Creative and healing careers flourish. Music, film, spirituality, charity work, therapy, or marine fields channel your compassion.",
};

const LOVE_INSIGHTS: Record<string, string> = {
  Aries: "Passionate, direct and conquest-oriented in romance. You need a partner who matches your energy and respects your independence.",
  Taurus: "Loyal, sensual and stability-seeking in love. You value consistency, physical affection, and shared material comfort above all.",
  Gemini: "Intellectually stimulated in love. You need mental connection, variety in expression, and a partner who enjoys conversation.",
  Cancer: "Deeply nurturing and emotionally invested. You seek security, family bonds, and a partner who values emotional intimacy.",
  Leo: "Generous, warm and dramatic in love. You crave admiration, loyalty, and a partner who celebrates your creative spirit.",
  Virgo: "Thoughtful, devoted and service-oriented in love. You express care through practical acts and value reliability in a partner.",
  Libra: "Harmony-driven and partnership-oriented. You seek beauty, fairness, and deep companionship with someone who values balance.",
  Scorpio: "Intense, transformative and deeply loyal in love. You demand authenticity, emotional depth, and complete trust in partnerships.",
  Sagittarius: "Freedom-loving and adventure-seeking in romance. You need a partner who shares your love for exploration and growth.",
  Capricorn: "Committed, traditional and goal-oriented in love. You value long-term stability and a partner with matching ambition.",
  Aquarius: "Unconventional and friendship-based in love. You value intellectual equality, personal space, and a partner who embraces uniqueness.",
  Pisces: "Romantic, empathic and spiritually connected in love. You seek a soulmate bond, creative expression, and emotional transcendence.",
};

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

const ELEMENT_GUIDANCE: Record<string, string> = {
  Fire: "take initiative early, but pair momentum with pacing so you do not burn through opportunities too quickly.",
  Earth: "build through consistency, measurable habits, and patient accumulation rather than dramatic leaps.",
  Air: "keep communication open, ask better questions, and let perspective changes become part of the strategy.",
  Water: "trust intuitive timing, but protect boundaries so emotion stays informative instead of overwhelming.",
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

function signDistance(startSign: string, targetSign: string): number {
  const si = ZODIAC_SIGNS.indexOf(startSign);
  const ti = ZODIAC_SIGNS.indexOf(targetSign);
  return ((ti - si + 12) % 12) + 1;
}

function planetDignity(planet: PlanetPosition): string {
  if (planet.sign === PLANET_EXALTATIONS[planet.name]) return "exalted";
  if (planet.sign === PLANET_DEBILITATIONS[planet.name]) return "debilitated";
  if (PLANET_OWN_SIGNS[planet.name]?.has(planet.sign)) return "own_sign";
  return "neutral";
}

function houseByNumber(houses: HousePlacement[], num: number): HousePlacement {
  return houses.find((h) => h.house_number === num)!;
}

function ordinal(v: number): string {
  if (v % 100 >= 10 && v % 100 <= 20) return `${v}th`;
  const suffixes: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };
  return `${v}${suffixes[v % 10] || "th"}`;
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

function planetListSentence(names: string[]): string {
  if (names.length === 0)
    return "There are no direct planetary occupants, so the house lord carries most of the story.";
  return `This house is further activated by ${names.join(", ")}, which bring their themes directly into view.`;
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
  const classical = planets.filter((p) =>
    ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"].includes(p.name)
  );
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
  return strengths.slice(0, 2);
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
  ];
  if (primaryHouse.planets.length > 0) {
    triggers.push(
      `${primaryHouse.planets.join(", ")} activations make this topic louder.`
    );
  }
  return triggers.slice(0, 2);
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
  ].slice(0, 2);
}

function domainLongGame(
  label: string,
  primaryHouse: HousePlacement,
  primaryLord: PlanetPosition,
  domElement: string
): string {
  return (
    `${label} improves when ${primaryLord.name}-led choices stay paced and consistent around ` +
    `${HOUSE_THEMES[primaryHouse.house_number]}.`
  );
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

  let confidence = 0.72;
  if (primaryHouse.planets.length > 0) confidence += 0.05;
  if (["exalted", "own_sign"].includes(planetDignity(primaryLord))) confidence += 0.06;
  if (["exalted", "own_sign"].includes(planetDignity(anchorPlanet))) confidence += 0.04;
  if (planetDignity(primaryLord) === "debilitated") confidence -= 0.03;
  if (planetDignity(anchorPlanet) === "debilitated") confidence -= 0.02;
  confidence = Math.max(0.66, Math.min(0.91, Math.round(confidence * 100) / 100));

  const headline =
    `${config.label}: ${primaryHouse.sign} house ${primaryHouse.house_number}, led by ${primaryLord.name}.`;

  const overview =
    `${primaryHouse.sign} sets a ${SIGN_STYLE_PHRASES[primaryHouse.sign]} tone for ${config.summary_focus}. ` +
    `${primaryLord.name} in house ${primaryLord.house} links outcomes to ${HOUSE_THEMES[primaryLord.house]}.`;

  return {
    key: key as LifeDomainInsight["key"],
    label: config.label,
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
// Career rules
// --------------------------------------------------------------------------

function careerRules(planets: PlanetPosition[], houses: HousePlacement[]): DeterministicRule[] {
  const rules: DeterministicRule[] = [];
  const house10 = houseByNumber(houses, 10);
  const tenthLordName = SIGN_RULERS[house10.sign];
  const tenthLord = planetByName(planets, tenthLordName);

  let tensionNote = "";
  if ([6, 8, 12].includes(tenthLord.house)) {
    tensionNote =
      "The 10th-lord placement suggests career growth comes through delays, service pressure, " +
      "or behind-the-scenes restructuring before authority stabilizes.";
  }

  rules.push({
    title: `Career Axis: 10th House in ${house10.sign}`,
    insight: CAREER_INSIGHTS[house10.sign],
    basis: `10th house sign: ${house10.sign}. Lord ${tenthLordName} placed in house ${tenthLord.house} in ${tenthLord.sign}.`,
    priority: "high",
    category: "career",
    confidence_score: 0.82,
    tension_note: tensionNote,
  });

  if (house10.planets.length > 0) {
    rules.push({
      title: "Career Activators in House 10",
      insight: `${house10.planets.join(", ")} directly energize your professional identity, bringing their qualities into public standing and career ambition.`,
      basis: `Planets in 10th house (${house10.sign}): ${house10.planets.join(", ")}.`,
      priority: "medium",
      category: "career",
      confidence_score: 0.75,
      tension_note: "",
    });
  }

  return rules;
}

// --------------------------------------------------------------------------
// Love rules
// --------------------------------------------------------------------------

function loveRules(planets: PlanetPosition[], houses: HousePlacement[]): DeterministicRule[] {
  const rules: DeterministicRule[] = [];
  const house7 = houseByNumber(houses, 7);
  const house5 = houseByNumber(houses, 5);
  const seventhLordName = SIGN_RULERS[house7.sign];
  const seventhLord = planetByName(planets, seventhLordName);
  const venus = planetByName(planets, "Venus");

  let axisTension = "";
  if ([6, 8, 12].includes(seventhLord.house)) {
    axisTension =
      "Partnership may demand more maturity than chemistry at first. The chart shows lessons " +
      "around pacing, trust, or unequal effort before stability is reached.";
  }

  let venusTension = "";
  if (SIGN_ELEMENTS[venus.sign] !== SIGN_ELEMENTS[house7.sign]) {
    venusTension =
      `Venus expresses love through ${SIGN_ELEMENTS[venus.sign].toLowerCase()} qualities, while the 7th house ` +
      `asks for ${SIGN_ELEMENTS[house7.sign].toLowerCase()} partnership habits. Desire and commitment style ` +
      "may need deliberate alignment.";
  }

  rules.push({
    title: `Partnership Axis: 7th House in ${house7.sign}`,
    insight: LOVE_INSIGHTS[house7.sign],
    basis: `7th house sign: ${house7.sign}. Lord ${seventhLordName} in house ${seventhLord.house} (${seventhLord.sign}).`,
    priority: "high",
    category: "love",
    confidence_score: 0.81,
    tension_note: axisTension,
  });

  rules.push({
    title: `Venus in ${venus.sign} (House ${venus.house})`,
    insight: `Venus governs love expression. In ${venus.sign}, romance channels through ${SIGN_ELEMENTS[venus.sign].toLowerCase()} qualities, shaping how you attract and give affection.`,
    basis: `Venus at ${venus.degree_in_sign.toFixed(2)} deg in ${venus.sign}, house ${venus.house}.`,
    priority: "medium",
    category: "love",
    confidence_score: 0.77,
    tension_note: venusTension,
  });

  if (house5.planets.length > 0) {
    rules.push({
      title: "Romance House Activators",
      insight: `${house5.planets.join(", ")} in the 5th house bring creative and romantic energy, enhancing self-expression and passionate connection.`,
      basis: `5th house in ${house5.sign} with ${house5.planets.join(", ")}.`,
      priority: "medium",
      category: "love",
      confidence_score: 0.72,
      tension_note: "",
    });
  }

  return rules;
}

// --------------------------------------------------------------------------
// Dignity rules
// --------------------------------------------------------------------------

function dignityRules(planets: PlanetPosition[]): DeterministicRule[] {
  const rules: DeterministicRule[] = [];
  const classicalNames = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];

  for (const name of classicalNames) {
    const planet = planetByName(planets, name);
    const dignity = planetDignity(planet);
    if (dignity === "neutral") continue;

    let insight: string;
    let priority: "high" | "medium" | "low";
    let confidence: number;
    let tension = "";

    if (dignity === "exalted") {
      insight = `${planet.name} is exalted in ${planet.sign}, so this planet can express its strengths cleanly and with unusually high capacity.`;
      priority = "high";
      confidence = 0.86;
    } else if (dignity === "own_sign") {
      insight = `${planet.name} is in its own sign in ${planet.sign}, which stabilizes how this planet operates and makes its agenda easier to trust.`;
      priority = "medium";
      confidence = 0.8;
    } else {
      insight = `${planet.name} is debilitated in ${planet.sign}, which can make this planetary function feel inconsistent until it is strengthened through conscious practice.`;
      priority = "high";
      confidence = 0.79;
      tension =
        "This placement is not a verdict, but it does mean this area of life improves when you use structure, mentorship, and repetition instead of raw instinct.";
    }

    let category = "core";
    if (["Mercury", "Jupiter", "Saturn"].includes(planet.name)) category = "career";
    else if (["Venus", "Moon", "Mars"].includes(planet.name)) category = "love";

    rules.push({
      title: `${planet.name} Strength: ${dignity.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
      insight,
      basis: `${planet.name} placed in ${planet.sign}, house ${planet.house}.`,
      priority,
      category,
      confidence_score: confidence,
      tension_note: tension,
    });
  }

  return rules;
}

// --------------------------------------------------------------------------
// Yoga rules
// --------------------------------------------------------------------------

function yogaRules(planets: PlanetPosition[], houses: HousePlacement[]): DeterministicRule[] {
  const rules: DeterministicRule[] = [];
  const sun = planetByName(planets, "Sun");
  const moon = planetByName(planets, "Moon");
  const mercury = planetByName(planets, "Mercury");
  const mars = planetByName(planets, "Mars");
  const jupiter = planetByName(planets, "Jupiter");

  if (sun.house === mercury.house) {
    rules.push({
      title: "Budha-Aditya Pattern",
      insight: "Sun and Mercury occupy the same house, which often sharpens intellect, message control, and the ability to turn ideas into influence.",
      basis: `Sun and Mercury are both in house ${sun.house}.`,
      priority: "medium",
      category: "career",
      confidence_score: 0.78,
      tension_note: "",
    });
  }

  const moonToJupiter = signDistance(moon.sign, jupiter.sign);
  if ([1, 4, 7, 10].includes(moonToJupiter)) {
    rules.push({
      title: "Gaja-Kesari Support",
      insight: "Jupiter holds a kendra relationship from the Moon, which usually supports resilience, social grace, and the ability to recover perspective after emotional turbulence.",
      basis: `Moon in ${moon.sign}; Jupiter in ${jupiter.sign} (${moonToJupiter} houses from Moon).`,
      priority: "medium",
      category: "core",
      confidence_score: 0.76,
      tension_note: "",
    });
  }

  if (moon.house === mars.house) {
    rules.push({
      title: "Chandra-Mangala Drive",
      insight: "Moon and Mars share the same house, creating strong emotional activation, financial hunger, and quick response energy. This can be productive when directed well.",
      basis: `Moon and Mars are both in house ${moon.house}.`,
      priority: "medium",
      category: "career",
      confidence_score: 0.73,
      tension_note: "The same pattern can also increase impatience or emotional overreaction if pressure has no healthy outlet.",
    });
  }

  const house9 = houseByNumber(houses, 9);
  if (house9.planets.length > 0) {
    rules.push({
      title: "Fortune House Activation",
      insight: "The 9th house is active, which often magnifies teachers, belief systems, long-range luck, and the role of guidance in the life path.",
      basis: `9th house in ${house9.sign} with ${house9.planets.join(", ")}.`,
      priority: "low",
      category: "core",
      confidence_score: 0.68,
      tension_note: "",
    });
  }

  return rules;
}

// --------------------------------------------------------------------------
// Core path rules
// --------------------------------------------------------------------------

function corePathRules(
  ascendantSign: string,
  planets: PlanetPosition[],
  houses: HousePlacement[]
): DeterministicRule[] {
  const rules: DeterministicRule[] = [];
  const lagnaLordName = SIGN_RULERS[ascendantSign];
  const lagnaLord = planetByName(planets, lagnaLordName);
  const moon = planetByName(planets, "Moon");
  const rahu = planetByName(planets, "Rahu");
  const ketu = planetByName(planets, "Ketu");

  let lagnaTension = "";
  if ([6, 8, 12].includes(lagnaLord.house)) {
    lagnaTension =
      "The ascendant lord works through a dusthana house, so your path grows through pressure, hidden effort, " +
      "or repeated reinvention rather than immediate ease.";
  }

  rules.push({
    title: `Ascendant Lord: ${lagnaLord.name} in House ${lagnaLord.house}`,
    insight: `The ruler of your lagna is ${lagnaLord.name}, and its placement ties life direction to ${HOUSE_THEMES[lagnaLord.house]}. This is one of the clearest signatures for how your chart actually moves.`,
    basis: `${lagnaLord.name} rules ${ascendantSign} and is placed in ${lagnaLord.sign}, house ${lagnaLord.house}.`,
    priority: "high",
    category: "core",
    confidence_score: 0.86,
    tension_note: lagnaTension,
  });

  rules.push({
    title: `Emotional Focus: Moon in House ${moon.house}`,
    insight: `Your emotional attention repeatedly returns to ${HOUSE_THEMES[moon.house]}, which tells us where you instinctively seek reassurance, rhythm, and belonging.`,
    basis: `Moon placed in ${moon.sign}, house ${moon.house}.`,
    priority: "medium",
    category: "core",
    confidence_score: 0.77,
    tension_note: "",
  });

  rules.push({
    title: `Nodal Axis: Rahu ${rahu.house} / Ketu ${ketu.house}`,
    insight: `Rahu pulls growth toward ${HOUSE_THEMES[rahu.house]}, while Ketu asks for detachment and maturity around ${HOUSE_THEMES[ketu.house]}. This axis often describes the chart's deeper hunger-and-release pattern.`,
    basis: `Rahu in ${rahu.sign}, house ${rahu.house}; Ketu in ${ketu.sign}, house ${ketu.house}.`,
    priority: "medium",
    category: "core",
    confidence_score: 0.74,
    tension_note: "When Rahu is loud, urgency can outrun clarity. When Ketu is loud, detachment can look like drift. The work is to keep both ends of the axis conscious.",
  });

  const kendraPlanets = planets.filter((p) => [1, 4, 7, 10].includes(p.house)).map((p) => p.name);
  if (kendraPlanets.length >= 3) {
    rules.push({
      title: "Angular House Emphasis",
      insight: `${kendraPlanets.join(", ")} occupy angular houses, which makes the chart more visible, eventful, and responsive to decisive action in the outer world.`,
      basis: `Planets in kendras: ${kendraPlanets.join(", ")}.`,
      priority: "medium",
      category: "core",
      confidence_score: 0.73,
      tension_note: "",
    });
  }

  return rules;
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

export function generateRules(
  ascendantSign: string,
  planets: PlanetPosition[],
  houses: HousePlacement[]
): { rules: DeterministicRule[]; summary: string } {
  const rules: DeterministicRule[] = [];

  const sun = planetByName(planets, "Sun");
  const moon = planetByName(planets, "Moon");
  const venus = planetByName(planets, "Venus");

  let sunMoonTension = "";
  if (SIGN_ELEMENTS[sun.sign] !== SIGN_ELEMENTS[moon.sign]) {
    sunMoonTension =
      `Your core drive runs through ${SIGN_ELEMENTS[sun.sign].toLowerCase()} energy while your emotional body ` +
      `leans ${SIGN_ELEMENTS[moon.sign].toLowerCase()}. Motivation and emotional pacing may not always want the same thing.`;
  }

  rules.push({
    title: `Lagna Signature: ${ascendantSign}`,
    insight: ASCENDANT_INSIGHTS[ascendantSign],
    basis: `Ascendant computed in ${ascendantSign}.`,
    priority: "high",
    category: "core",
    confidence_score: 0.89,
    tension_note: "",
  });

  rules.push({
    title: `Solar Identity in ${sun.sign}`,
    insight: SUN_SIGN_INSIGHTS[sun.sign],
    basis: `Sun sign placement: ${sun.sign} (${sun.degree_in_sign.toFixed(2)} deg).`,
    priority: "high",
    category: "core",
    confidence_score: 0.84,
    tension_note: sunMoonTension,
  });

  rules.push({
    title: `Lunar Mindset in ${moon.sign}`,
    insight: MOON_SIGN_INSIGHTS[moon.sign],
    basis: `Moon sign placement: ${moon.sign} (${moon.degree_in_sign.toFixed(2)} deg).`,
    priority: "high",
    category: "core",
    confidence_score: 0.85,
    tension_note: sunMoonTension,
  });

  const classical = planets.filter((p) =>
    ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"].includes(p.name)
  );
  const elCounts = elementCount(classical);
  const { element: domEl, count: domCount } = dominantElement(planets);

  let elementTension = "";
  if (SIGN_ELEMENTS[venus.sign] !== domEl) {
    elementTension =
      `Your dominant element is ${domEl.toLowerCase()}, but Venus expresses through ` +
      `${SIGN_ELEMENTS[venus.sign].toLowerCase()} dynamics. Attraction and default momentum may pull in different directions.`;
  }

  rules.push({
    title: `Dominant Element: ${domEl}`,
    insight: `${domCount} of 7 classical planets are in ${domEl} signs, which shapes your default decision style and energetic baseline.`,
    basis: `Element distribution: ${JSON.stringify(elCounts)}.`,
    priority: "medium",
    category: "core",
    confidence_score: 0.78,
    tension_note: elementTension,
  });

  let denseHouse = houses[0];
  for (const h of houses) {
    if (h.planets.length > denseHouse.planets.length) denseHouse = h;
  }
  if (denseHouse.planets.length > 0) {
    rules.push({
      title: `Focused House: ${denseHouse.house_number}`,
      insight: `Multiple planetary activations highlight house ${denseHouse.house_number}: ${HOUSE_THEMES[denseHouse.house_number]}.`,
      basis: `House ${denseHouse.house_number} in ${denseHouse.sign} carries ${denseHouse.planets.join(", ")}.`,
      priority: "medium",
      category: "core",
      confidence_score: 0.74,
      tension_note: "",
    });
  }

  rules.push(...corePathRules(ascendantSign, planets, houses));
  rules.push(...dignityRules(planets));
  rules.push(...careerRules(planets, houses));
  rules.push(...loveRules(planets, houses));
  rules.push(...yogaRules(planets, houses));

  const strongestPlanets = classical
    .filter((p) => ["exalted", "own_sign"].includes(planetDignity(p)))
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
