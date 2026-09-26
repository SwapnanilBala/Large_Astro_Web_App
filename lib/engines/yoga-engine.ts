
import type { PlanetPosition, HousePlacement } from "./swiss-ephemeris-engine";
import { calculateNavamsa } from "./navamsa-engine";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface YogaChartInput {
  planets: PlanetPosition[];
  houses: HousePlacement[];
  ascendantSign: string;
  /**
   * Degree of the ascendant within `ascendantSign`, 0 to 30.
   *
   * Optional because every yoga here predates it and none of them needed it:
   * a planet's navamsa follows from its own sign and degree, both of which
   * `planets` already carries, but the ascendant arrives as a bare sign.
   * Lagna Vargottama is the only definition that requires this, and it simply
   * does not fire when the field is absent rather than guessing a degree.
   */
  ascendantDegreeInSign?: number;
}

export interface YogaDetectionResult {
  yoga_id: string;
  name: string;
  sanskrit: string;
  category: "mahapurusha" | "wealth" | "benefic" | "challenging" | "viparita" | "nabhasa";
  present: boolean;
  strength: "strong" | "moderate" | "weak";
  occurrence_chance: number;
  involved_planets: string[];
  description: string;
  effects: string;
  activation_timing?: string;
  key_traits?: string[];
  detailed_description?: string;
  cancellation?: string;
  source?: string;
}

type YogaCandidateResult = Omit<YogaDetectionResult, "occurrence_chance"> | YogaDetectionResult;

interface YogaDefinition {
  id: string;
  name: string;
  sanskrit: string;
  category: YogaDetectionResult["category"];
  description: string;
  effects: string;
  /**
   * The classical text the combination is drawn from.
   *
   * Optional only because the first hundred definitions predate the field and
   * are not all traceable to one text -- a dozen of them are this project's own
   * constructions with Sanskrit-style names rather than quotations from the
   * literature, and back-filling a citation onto those would invent an
   * authority they do not have. Every definition added from 2026-09-25 carries
   * one, and new records should not be written without it.
   *
   * Chapter numbers follow the editions named in CLASSICAL SOURCES below.
   */
  source?: string;
  detect: (chart: YogaChartInput) => YogaCandidateResult | null;
}

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const SIGN_RULERS: Record<string, string> = {
  Aries: "Mars", Taurus: "Venus", Gemini: "Mercury", Cancer: "Moon",
  Leo: "Sun", Virgo: "Mercury", Libra: "Venus", Scorpio: "Mars",
  Sagittarius: "Jupiter", Capricorn: "Saturn", Aquarius: "Saturn", Pisces: "Jupiter",
};

const PLANET_OWN_SIGNS: Record<string, string[]> = {
  Sun: ["Leo"],
  Moon: ["Cancer"],
  Mercury: ["Gemini", "Virgo"],
  Venus: ["Taurus", "Libra"],
  Mars: ["Aries", "Scorpio"],
  Jupiter: ["Sagittarius", "Pisces"],
  Saturn: ["Capricorn", "Aquarius"],
};

const PLANET_EXALTATIONS: Record<string, string> = {
  Sun: "Aries", Moon: "Taurus", Mercury: "Virgo", Venus: "Pisces",
  Mars: "Capricorn", Jupiter: "Cancer", Saturn: "Libra",
};

const PLANET_DEBILITATIONS: Record<string, string> = {
  Sun: "Libra", Moon: "Scorpio", Mercury: "Pisces", Venus: "Virgo",
  Mars: "Cancer", Jupiter: "Capricorn", Saturn: "Aries",
};

const NATURAL_BENEFICS = ["Jupiter", "Venus", "Mercury"];
const NATURAL_MALEFICS = ["Sun", "Mars", "Saturn", "Rahu", "Ketu"];
const CLASSICAL_PLANETS = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
const YOGA_OCCURRENCE_THRESHOLD = 30;

// --------------------------------------------------------------------------
// Helper functions
// --------------------------------------------------------------------------

export function getSignLord(sign: string): string {
  return SIGN_RULERS[sign] ?? "Sun";
}

export function isInKendra(house: number): boolean {
  return [1, 4, 7, 10].includes(house);
}

export function isInTrikona(house: number): boolean {
  return [1, 5, 9].includes(house);
}

export function isExalted(planet: string, sign: string): boolean {
  return PLANET_EXALTATIONS[planet] === sign;
}

export function isDebilitated(planet: string, sign: string): boolean {
  return PLANET_DEBILITATIONS[planet] === sign;
}

export function isOwnSign(planet: string, sign: string): boolean {
  return PLANET_OWN_SIGNS[planet]?.includes(sign) ?? false;
}

export function isInDusthana(house: number): boolean {
  return [6, 8, 12].includes(house);
}

export function arePlanetsConjunct(
  p1Name: string,
  p2Name: string,
  planets: PlanetPosition[]
): boolean {
  const planet1 = planets.find((p) => p.name === p1Name);
  const planet2 = planets.find((p) => p.name === p2Name);
  if (!planet1 || !planet2) return false;
  return planet1.sign === planet2.sign;
}

export function getHouseLord(
  houseNum: number,
  houses: HousePlacement[],
  _ascendant: string
): string {
  const house = houses.find((h) => h.house_number === houseNum);
  if (!house) return "Sun";
  return getSignLord(house.sign);
}

function findPlanet(planets: PlanetPosition[], name: string): PlanetPosition | undefined {
  return planets.find((p) => p.name === name);
}

function signDistance(fromSign: string, toSign: string): number {
  const fi = ZODIAC_SIGNS.indexOf(fromSign);
  const ti = ZODIAC_SIGNS.indexOf(toSign);
  return ((ti - fi + 12) % 12) + 1;
}

function planetStrength(planet: string, sign: string): "strong" | "moderate" | "weak" {
  if (isExalted(planet, sign)) return "strong";
  if (isOwnSign(planet, sign)) return "strong";
  if (isDebilitated(planet, sign)) return "weak";
  return "moderate";
}

function overallStrength(strengths: Array<"strong" | "moderate" | "weak">): "strong" | "moderate" | "weak" {
  if (strengths.includes("strong") && !strengths.includes("weak")) return "strong";
  if (strengths.includes("weak") && !strengths.includes("strong")) return "weak";
  return "moderate";
}

function planetsInRelativeHouse(
  baseSign: string,
  relativeHouse: number,
  planets: PlanetPosition[],
  allowedNames?: string[]
): PlanetPosition[] {
  return planets.filter((planet) => {
    if (allowedNames && !allowedNames.includes(planet.name)) return false;
    return signDistance(baseSign, planet.sign) === relativeHouse;
  });
}

function planetsInRelativeHouses(
  baseSign: string,
  relativeHouses: number[],
  planets: PlanetPosition[],
  allowedNames?: string[]
): PlanetPosition[] {
  return planets.filter((planet) => {
    if (allowedNames && !allowedNames.includes(planet.name)) return false;
    return relativeHouses.includes(signDistance(baseSign, planet.sign));
  });
}

function uniquePlanetNames(planets: PlanetPosition[]): string[] {
  return [...new Set(planets.map((planet) => planet.name))];
}

function houseLordPlanet(
  houseNum: number,
  chart: YogaChartInput
): { lordName: string; planet?: PlanetPosition } {
  const lordName = getHouseLord(houseNum, chart.houses, chart.ascendantSign);
  return { lordName, planet: findPlanet(chart.planets, lordName) };
}

function hasFullAspect(from: PlanetPosition, to: PlanetPosition): boolean {
  return [1, 5, 7, 9].includes(signDistance(from.sign, to.sign));
}

function calculateOccurrenceChance(yoga: Omit<YogaDetectionResult, "occurrence_chance">): number {
  const strengthBase: Record<YogaDetectionResult["strength"], number> = {
    strong: 88,
    moderate: 65,
    weak: 40,
  };
  const categoryAdjustment: Record<YogaDetectionResult["category"], number> = {
    mahapurusha: 8,
    wealth: 5,
    benefic: 4,
    challenging: -5,
    viparita: 6,
    nabhasa: 2,
  };
  const cancellationPenalty = yoga.cancellation ? 25 : 0;
  const raw = strengthBase[yoga.strength] + categoryAdjustment[yoga.category] - cancellationPenalty;
  return Math.min(99, Math.max(0, Math.round(raw)));
}

function withOccurrenceChance(
  yoga: YogaCandidateResult
): YogaDetectionResult {
  if ("occurrence_chance" in yoga) return yoga;
  return {
    ...yoga,
    occurrence_chance: calculateOccurrenceChance(yoga),
  };
}

function richYogaDetail(
  name: string,
  effects: string,
  involvedPlanets: string[],
  activationTiming: string,
  traits: string[]
): string {
  const planetText = involvedPlanets.length > 0
    ? ` It is carried by ${involvedPlanets.join(", ")}, so the result depends on how those planets are supported by dasha, transit, and practical choices.`
    : "";
  return `${name} is strongest when the chart's promise is reinforced by timing and repeated life circumstances.${planetText} ${effects} Watch for it to show most clearly during ${activationTiming.toLowerCase()}. Core traits: ${traits.join(", ")}.`;
}

function generatedYogaResult(
  recipe: GeneratedYogaRecipe,
  strength: YogaDetectionResult["strength"],
  involvedPlanets: string[],
  description: string
): YogaCandidateResult {
  return {
    yoga_id: recipe.id,
    name: recipe.name,
    sanskrit: recipe.sanskrit,
    category: recipe.category,
    present: true,
    strength,
    involved_planets: [...new Set(involvedPlanets)],
    description,
    effects: recipe.effects,
    activation_timing: recipe.activation_timing,
    key_traits: recipe.key_traits,
    source: recipe.source,
    detailed_description: richYogaDetail(
      recipe.name,
      recipe.effects,
      [...new Set(involvedPlanets)],
      recipe.activation_timing,
      recipe.key_traits
    ),
  };
}

// --------------------------------------------------------------------------
// Mahapurusha Yoga helper
// --------------------------------------------------------------------------

function detectMahapurusha(
  planetName: string,
  yogaId: string,
  yogaName: string,
  sanskrit: string,
  description: string,
  effects: string,
  chart: YogaChartInput
): YogaCandidateResult | null {
  const planet = findPlanet(chart.planets, planetName);
  if (!planet) return null;

  const inKendra = isInKendra(planet.house);
  const exalted = isExalted(planetName, planet.sign);
  const ownSign = isOwnSign(planetName, planet.sign);

  if (inKendra && (exalted || ownSign)) {
    return {
      yoga_id: yogaId,
      name: yogaName,
      sanskrit,
      category: "mahapurusha",
      present: true,
      strength: exalted ? "strong" : "moderate",
      involved_planets: [planetName],
      description,
      effects,
    };
  }

  return null;
}

type GeneratedYogaRecipe = {
  id: string;
  name: string;
  sanskrit: string;
  category: YogaDetectionResult["category"];
  description: string;
  effects: string;
  activation_timing: string;
  key_traits: string[];
  source?: string;
};

type HouseLordPlacementRecipe = GeneratedYogaRecipe & {
  fromHouse: number;
  targetHouses: number[];
};

type MutualHouseLordRecipe = GeneratedYogaRecipe & {
  houseA: number;
  houseB: number;
};

type PlanetHouseRecipe = GeneratedYogaRecipe & {
  planet: string;
  targetHouses: number[];
};

type RelativePlanetRecipe = GeneratedYogaRecipe & {
  basePlanet: string;
  allowedPlanets: string[];
  relativeHouses: number[];
  minCount: number;
};

type ConjunctionRecipe = GeneratedYogaRecipe & {
  planets: string[];
};

function houseList(houses: number[]): string {
  return houses.map((house) => `${house}`).join("/");
}

/**
 * The placement clause of a generated sentence.
 *
 * Every recipe before 2026-09 named a set of houses -- the kendras, the
 * trikonas, the upachayas -- so "is placed in house 7, matching the 1/4/7/10
 * house condition" read correctly: the house and the set it belongs to are
 * two different facts. The own-house and digbala records name exactly one
 * house, where that sentence says the same thing twice.
 */
function placementClause(subject: string, house: number, targets: number[]): string {
  if (targets.length === 1) return `${subject} occupies the ${ordinal(house)} house.`;
  return `${subject} is placed in house ${house}, matching the ${houseList(targets)} house condition.`;
}

/**
 * House numbers reach the reader inside sentences, and a bare `th` produced
 * "the 1th lord" for every combination involving the ascendant, the 2nd or the
 * 3rd. Only twelve values ever pass through here, but the general rule is no
 * longer to write than the special case would be.
 */
function ordinal(house: number): string {
  const teens = house % 100;
  if (teens >= 11 && teens <= 13) return house + "th";
  switch (house % 10) {
    case 1: return house + "st";
    case 2: return house + "nd";
    case 3: return house + "rd";
    default: return house + "th";
  }
}

function createHouseLordPlacementYoga(recipe: HouseLordPlacementRecipe): YogaDefinition {
  return {
    id: recipe.id,
    name: recipe.name,
    sanskrit: recipe.sanskrit,
    category: recipe.category,
    description: recipe.description,
    effects: recipe.effects,
    source: recipe.source,
    detect: (chart) => {
      const lord = houseLordPlanet(recipe.fromHouse, chart);
      if (!lord.planet || !recipe.targetHouses.includes(lord.planet.house)) return null;
      return generatedYogaResult(
        recipe,
        planetStrength(lord.lordName, lord.planet.sign),
        [lord.lordName],
        placementClause(`The ${ordinal(recipe.fromHouse)} lord (${lord.lordName})`, lord.planet.house, recipe.targetHouses)
      );
    },
  };
}

function createMutualHouseLordYoga(recipe: MutualHouseLordRecipe): YogaDefinition {
  return {
    id: recipe.id,
    name: recipe.name,
    sanskrit: recipe.sanskrit,
    category: recipe.category,
    description: recipe.description,
    effects: recipe.effects,
    source: recipe.source,
    detect: (chart) => {
      const lordA = houseLordPlanet(recipe.houseA, chart);
      const lordB = houseLordPlanet(recipe.houseB, chart);
      if (!lordA.planet || !lordB.planet) return null;
      const exchanged = lordA.planet.house === recipe.houseB && lordB.planet.house === recipe.houseA;
      if (!exchanged) return null;
      return generatedYogaResult(
        recipe,
        overallStrength([
          planetStrength(lordA.lordName, lordA.planet.sign),
          planetStrength(lordB.lordName, lordB.planet.sign),
        ]),
        [lordA.lordName, lordB.lordName],
        `The ${ordinal(recipe.houseA)} lord (${lordA.lordName}) and ${ordinal(recipe.houseB)} lord (${lordB.lordName}) exchange houses.`
      );
    },
  };
}

function createPlanetHouseYoga(recipe: PlanetHouseRecipe): YogaDefinition {
  return {
    id: recipe.id,
    name: recipe.name,
    sanskrit: recipe.sanskrit,
    category: recipe.category,
    description: recipe.description,
    effects: recipe.effects,
    source: recipe.source,
    detect: (chart) => {
      const planet = findPlanet(chart.planets, recipe.planet);
      if (!planet || !recipe.targetHouses.includes(planet.house)) return null;
      return generatedYogaResult(
        recipe,
        planetStrength(recipe.planet, planet.sign),
        [recipe.planet],
        placementClause(recipe.planet, planet.house, recipe.targetHouses)
      );
    },
  };
}

function createRelativePlanetYoga(recipe: RelativePlanetRecipe): YogaDefinition {
  return {
    id: recipe.id,
    name: recipe.name,
    sanskrit: recipe.sanskrit,
    category: recipe.category,
    description: recipe.description,
    effects: recipe.effects,
    source: recipe.source,
    detect: (chart) => {
      const base = findPlanet(chart.planets, recipe.basePlanet);
      if (!base) return null;
      const planets = planetsInRelativeHouses(
        base.sign,
        recipe.relativeHouses,
        chart.planets,
        recipe.allowedPlanets
      ).filter((planet) => planet.name !== recipe.basePlanet);
      if (planets.length < recipe.minCount) return null;
      return generatedYogaResult(
        recipe,
        planets.length >= recipe.minCount + 1 ? "strong" : "moderate",
        [recipe.basePlanet, ...uniquePlanetNames(planets)],
        `${uniquePlanetNames(planets).join(", ")} occupy the ${houseList(recipe.relativeHouses)} signs from ${recipe.basePlanet}.`
      );
    },
  };
}

function createConjunctionYoga(recipe: ConjunctionRecipe): YogaDefinition {
  return {
    id: recipe.id,
    name: recipe.name,
    sanskrit: recipe.sanskrit,
    category: recipe.category,
    description: recipe.description,
    effects: recipe.effects,
    source: recipe.source,
    detect: (chart) => {
      const planets = recipe.planets.map((planet) => findPlanet(chart.planets, planet));
      if (planets.some((planet) => !planet)) return null;
      const presentPlanets = planets as PlanetPosition[];
      const sign = presentPlanets[0].sign;
      if (!presentPlanets.every((planet) => planet.sign === sign)) return null;
      return generatedYogaResult(
        recipe,
        overallStrength(presentPlanets.map((planet) => planetStrength(planet.name, planet.sign))),
        recipe.planets,
        `${recipe.planets.join(", ")} are conjunct in ${sign}.`
      );
    },
  };
}

// --------------------------------------------------------------------------
// Yoga definitions
// --------------------------------------------------------------------------

const ADDITIONAL_YOGA_DEFINITIONS: YogaDefinition[] = [
  {
    id: "parvata",
    name: "Parvata Yoga",
    sanskrit: "पर्वत योग",
    category: "benefic",
    description: "Natural benefics occupy kendras while dusthana houses are free from heavy affliction.",
    effects: "Gives stable rise, respected conduct, good fortune, and a mountain-like capacity to endure.",
    detect: (chart) => {
      const beneficsInKendra = chart.planets.filter((p) =>
        NATURAL_BENEFICS.includes(p.name) && isInKendra(p.house)
      );
      const maleficsInDusthana = chart.planets.filter((p) =>
        NATURAL_MALEFICS.includes(p.name) && isInDusthana(p.house)
      );
      if (beneficsInKendra.length >= 2 && maleficsInDusthana.length <= 1) {
        return {
          yoga_id: "parvata",
          name: "Parvata Yoga",
          sanskrit: "पर्वत योग",
          category: "benefic",
          present: true,
          strength: beneficsInKendra.length >= 3 ? "strong" : "moderate",
          involved_planets: uniquePlanetNames(beneficsInKendra),
          description: `${uniquePlanetNames(beneficsInKendra).join(", ")} occupy kendra houses with limited dusthana affliction.`,
          effects: "Gives stable rise, respected conduct, good fortune, and a mountain-like capacity to endure.",
        };
      }
      return null;
    },
  },
  {
    id: "kahala",
    name: "Kahala Yoga",
    sanskrit: "काहल योग",
    category: "wealth",
    description: "The 4th and 9th lords are strong or placed in kendra/trikona positions.",
    effects: "Supports courage, recognition, family standing, and forceful achievement.",
    detect: (chart) => {
      const lord4 = houseLordPlanet(4, chart);
      const lord9 = houseLordPlanet(9, chart);
      if (!lord4.planet || !lord9.planet) return null;
      const lord4Good = isInKendra(lord4.planet.house) || isInTrikona(lord4.planet.house);
      const lord9Good = isInKendra(lord9.planet.house) || isInTrikona(lord9.planet.house);
      if (lord4Good && lord9Good) {
        return {
          yoga_id: "kahala",
          name: "Kahala Yoga",
          sanskrit: "काहल योग",
          category: "wealth",
          present: true,
          strength: overallStrength([
            planetStrength(lord4.lordName, lord4.planet.sign),
            planetStrength(lord9.lordName, lord9.planet.sign),
          ]),
          involved_planets: [...new Set([lord4.lordName, lord9.lordName])],
          description: `The 4th lord (${lord4.lordName}) and 9th lord (${lord9.lordName}) both occupy supportive houses.`,
          effects: "Supports courage, recognition, family standing, and forceful achievement.",
        };
      }
      return null;
    },
  },
  {
    id: "chamara",
    name: "Chamara Yoga",
    sanskrit: "चामर योग",
    category: "benefic",
    description: "The ascendant lord is strong and protected by Jupiter or benefic influence.",
    effects: "Indicates refinement, learning, respect, and graceful public conduct.",
    detect: (chart) => {
      const ascLord = houseLordPlanet(1, chart);
      const jupiter = findPlanet(chart.planets, "Jupiter");
      if (!ascLord.planet || !jupiter) return null;
      const ascStrong = ["strong", "moderate"].includes(planetStrength(ascLord.lordName, ascLord.planet.sign));
      const jupiterProtects = jupiter.sign === ascLord.planet.sign || hasFullAspect(jupiter, ascLord.planet);
      if (ascStrong && jupiterProtects) {
        return {
          yoga_id: "chamara",
          name: "Chamara Yoga",
          sanskrit: "चामर योग",
          category: "benefic",
          present: true,
          strength: planetStrength(ascLord.lordName, ascLord.planet.sign),
          involved_planets: [...new Set([ascLord.lordName, "Jupiter"])],
          description: `Ascendant lord ${ascLord.lordName} is supported by Jupiter through conjunction or full aspect.`,
          effects: "Indicates refinement, learning, respect, and graceful public conduct.",
        };
      }
      return null;
    },
  },
  {
    id: "sankha",
    name: "Sankha Yoga",
    sanskrit: "शंख योग",
    category: "benefic",
    description: "The 5th and 6th lords form a kendra relationship while the ascendant lord has strength.",
    effects: "Supports learning, virtue, resilience, and the ability to overcome competition.",
    detect: (chart) => {
      const lord1 = houseLordPlanet(1, chart);
      const lord5 = houseLordPlanet(5, chart);
      const lord6 = houseLordPlanet(6, chart);
      if (!lord1.planet || !lord5.planet || !lord6.planet) return null;
      const lordsInKendra = [1, 4, 7, 10].includes(signDistance(lord5.planet.sign, lord6.planet.sign));
      const ascStrong = planetStrength(lord1.lordName, lord1.planet.sign) !== "weak";
      if (lordsInKendra && ascStrong) {
        return {
          yoga_id: "sankha",
          name: "Sankha Yoga",
          sanskrit: "शंख योग",
          category: "benefic",
          present: true,
          strength: overallStrength([
            planetStrength(lord1.lordName, lord1.planet.sign),
            planetStrength(lord5.lordName, lord5.planet.sign),
            planetStrength(lord6.lordName, lord6.planet.sign),
          ]),
          involved_planets: [...new Set([lord1.lordName, lord5.lordName, lord6.lordName])],
          description: `The 5th lord (${lord5.lordName}) and 6th lord (${lord6.lordName}) are in kendra relationship, with ascendant support.`,
          effects: "Supports learning, virtue, resilience, and the ability to overcome competition.",
        };
      }
      return null;
    },
  },
  {
    id: "bheri",
    name: "Bheri Yoga",
    sanskrit: "भेरी योग",
    category: "wealth",
    description: "The 9th lord is strong and benefic planets support angular or trinal houses.",
    effects: "Gives reputation, resources, ceremonial honor, and support from fortunate circumstances.",
    detect: (chart) => {
      const lord9 = houseLordPlanet(9, chart);
      if (!lord9.planet) return null;
      const beneficsGood = chart.planets.filter((p) =>
        NATURAL_BENEFICS.includes(p.name) && (isInKendra(p.house) || isInTrikona(p.house))
      );
      if (planetStrength(lord9.lordName, lord9.planet.sign) !== "weak" && beneficsGood.length >= 2) {
        return {
          yoga_id: "bheri",
          name: "Bheri Yoga",
          sanskrit: "भेरी योग",
          category: "wealth",
          present: true,
          strength: beneficsGood.length >= 3 ? "strong" : "moderate",
          involved_planets: [...new Set([lord9.lordName, ...uniquePlanetNames(beneficsGood)])],
          description: `The 9th lord ${lord9.lordName} is supported, and benefics occupy angular or trinal houses.`,
          effects: "Gives reputation, resources, ceremonial honor, and support from fortunate circumstances.",
        };
      }
      return null;
    },
  },
  {
    id: "mridanga",
    name: "Mridanga Yoga",
    sanskrit: "मृदंग योग",
    category: "wealth",
    description: "A strong planet in a kendra/trikona combines with a strong ascendant lord.",
    effects: "Produces skill, rhythm in life direction, status, and creative command.",
    detect: (chart) => {
      const ascLord = houseLordPlanet(1, chart);
      if (!ascLord.planet || planetStrength(ascLord.lordName, ascLord.planet.sign) === "weak") return null;
      const strongSupport = chart.planets.filter((p) =>
        CLASSICAL_PLANETS.includes(p.name) &&
        p.name !== ascLord.lordName &&
        (isInKendra(p.house) || isInTrikona(p.house)) &&
        planetStrength(p.name, p.sign) === "strong"
      );
      if (strongSupport.length > 0) {
        return {
          yoga_id: "mridanga",
          name: "Mridanga Yoga",
          sanskrit: "मृदंग योग",
          category: "wealth",
          present: true,
          strength: strongSupport.length >= 2 ? "strong" : "moderate",
          involved_planets: [...new Set([ascLord.lordName, ...uniquePlanetNames(strongSupport)])],
          description: `Ascendant lord ${ascLord.lordName} is not weak and receives support from strong planets in kendra/trikona houses.`,
          effects: "Produces skill, rhythm in life direction, status, and creative command.",
        };
      }
      return null;
    },
  },
  {
    id: "vesi",
    name: "Vesi Yoga",
    sanskrit: "वेशि योग",
    category: "benefic",
    description: "One or more planets, excluding Moon and nodes, occupy the 2nd sign from the Sun.",
    effects: "Strengthens initiative, speech, self-effort, and independent achievement.",
    detect: (chart) => {
      const sun = findPlanet(chart.planets, "Sun");
      if (!sun) return null;
      const planets = planetsInRelativeHouse(sun.sign, 2, chart.planets, CLASSICAL_PLANETS)
        .filter((p) => p.name !== "Moon" && p.name !== "Sun");
      if (planets.length > 0) {
        return {
          yoga_id: "vesi",
          name: "Vesi Yoga",
          sanskrit: "वेशि योग",
          category: "benefic",
          present: true,
          strength: planets.length >= 2 ? "strong" : "moderate",
          involved_planets: ["Sun", ...uniquePlanetNames(planets)],
          description: `${uniquePlanetNames(planets).join(", ")} occupy the 2nd sign from the Sun.`,
          effects: "Strengthens initiative, speech, self-effort, and independent achievement.",
        };
      }
      return null;
    },
  },
  {
    id: "vosi",
    name: "Vosi Yoga",
    sanskrit: "वोशि योग",
    category: "benefic",
    description: "One or more planets, excluding Moon and nodes, occupy the 12th sign from the Sun.",
    effects: "Supports restraint, strategy, private strength, and disciplined self-expression.",
    detect: (chart) => {
      const sun = findPlanet(chart.planets, "Sun");
      if (!sun) return null;
      const planets = planetsInRelativeHouse(sun.sign, 12, chart.planets, CLASSICAL_PLANETS)
        .filter((p) => p.name !== "Moon" && p.name !== "Sun");
      if (planets.length > 0) {
        return {
          yoga_id: "vosi",
          name: "Vosi Yoga",
          sanskrit: "वोशि योग",
          category: "benefic",
          present: true,
          strength: planets.length >= 2 ? "strong" : "moderate",
          involved_planets: ["Sun", ...uniquePlanetNames(planets)],
          description: `${uniquePlanetNames(planets).join(", ")} occupy the 12th sign from the Sun.`,
          effects: "Supports restraint, strategy, private strength, and disciplined self-expression.",
        };
      }
      return null;
    },
  },
  {
    id: "ubhayachari",
    name: "Ubhayachari Yoga",
    sanskrit: "उभयचारी योग",
    category: "benefic",
    description: "Planets occupy both the 2nd and 12th signs from the Sun.",
    effects: "Gives balanced self-expression, resourcefulness, and capacity to operate in public and private spheres.",
    detect: (chart) => {
      const sun = findPlanet(chart.planets, "Sun");
      if (!sun) return null;
      const allowed = CLASSICAL_PLANETS.filter((p) => p !== "Sun" && p !== "Moon");
      const second = planetsInRelativeHouse(sun.sign, 2, chart.planets, allowed);
      const twelfth = planetsInRelativeHouse(sun.sign, 12, chart.planets, allowed);
      if (second.length > 0 && twelfth.length > 0) {
        return {
          yoga_id: "ubhayachari",
          name: "Ubhayachari Yoga",
          sanskrit: "उभयचारी योग",
          category: "benefic",
          present: true,
          strength: second.length + twelfth.length >= 3 ? "strong" : "moderate",
          involved_planets: ["Sun", ...uniquePlanetNames([...second, ...twelfth])],
          description: `Planets flank the Sun from both the 2nd and 12th signs.`,
          effects: "Gives balanced self-expression, resourcefulness, and capacity to operate in public and private spheres.",
        };
      }
      return null;
    },
  },
  {
    id: "sunapha",
    name: "Sunapha Yoga",
    sanskrit: "सुनफा योग",
    category: "benefic",
    description: "A planet other than Sun and nodes occupies the 2nd sign from the Moon.",
    effects: "Supports self-made wealth, intelligence, speech, and practical initiative.",
    detect: (chart) => {
      const moon = findPlanet(chart.planets, "Moon");
      if (!moon) return null;
      const planets = planetsInRelativeHouse(moon.sign, 2, chart.planets, CLASSICAL_PLANETS)
        .filter((p) => p.name !== "Sun" && p.name !== "Moon");
      if (planets.length > 0) {
        return {
          yoga_id: "sunapha",
          name: "Sunapha Yoga",
          sanskrit: "सुनफा योग",
          category: "benefic",
          present: true,
          strength: planets.length >= 2 ? "strong" : "moderate",
          involved_planets: ["Moon", ...uniquePlanetNames(planets)],
          description: `${uniquePlanetNames(planets).join(", ")} occupy the 2nd sign from the Moon.`,
          effects: "Supports self-made wealth, intelligence, speech, and practical initiative.",
        };
      }
      return null;
    },
  },
  {
    id: "anapha",
    name: "Anapha Yoga",
    sanskrit: "अनफा योग",
    category: "benefic",
    description: "A planet other than Sun and nodes occupies the 12th sign from the Moon.",
    effects: "Gives composure, self-control, reflective power, and private reserves of strength.",
    detect: (chart) => {
      const moon = findPlanet(chart.planets, "Moon");
      if (!moon) return null;
      const planets = planetsInRelativeHouse(moon.sign, 12, chart.planets, CLASSICAL_PLANETS)
        .filter((p) => p.name !== "Sun" && p.name !== "Moon");
      if (planets.length > 0) {
        return {
          yoga_id: "anapha",
          name: "Anapha Yoga",
          sanskrit: "अनफा योग",
          category: "benefic",
          present: true,
          strength: planets.length >= 2 ? "strong" : "moderate",
          involved_planets: ["Moon", ...uniquePlanetNames(planets)],
          description: `${uniquePlanetNames(planets).join(", ")} occupy the 12th sign from the Moon.`,
          effects: "Gives composure, self-control, reflective power, and private reserves of strength.",
        };
      }
      return null;
    },
  },
  {
    id: "durudhara",
    name: "Durudhara Yoga",
    sanskrit: "दुरुधरा योग",
    category: "benefic",
    description: "Planets other than Sun and nodes occupy both the 2nd and 12th signs from the Moon.",
    effects: "Shows material support, mental steadiness, and capacity to build life through balanced effort.",
    detect: (chart) => {
      const moon = findPlanet(chart.planets, "Moon");
      if (!moon) return null;
      const allowed = CLASSICAL_PLANETS.filter((p) => p !== "Sun" && p !== "Moon");
      const second = planetsInRelativeHouse(moon.sign, 2, chart.planets, allowed);
      const twelfth = planetsInRelativeHouse(moon.sign, 12, chart.planets, allowed);
      if (second.length > 0 && twelfth.length > 0) {
        return {
          yoga_id: "durudhara",
          name: "Durudhara Yoga",
          sanskrit: "दुरुधरा योग",
          category: "benefic",
          present: true,
          strength: second.length + twelfth.length >= 3 ? "strong" : "moderate",
          involved_planets: ["Moon", ...uniquePlanetNames([...second, ...twelfth])],
          description: `Planets flank the Moon from both the 2nd and 12th signs.`,
          effects: "Shows material support, mental steadiness, and capacity to build life through balanced effort.",
        };
      }
      return null;
    },
  },
  {
    id: "vasumati",
    name: "Vasumati Yoga",
    sanskrit: "वसुमति योग",
    category: "wealth",
    description: "Natural benefics occupy upachaya houses (3/6/10/11) from Lagna or Moon.",
    effects: "Indicates growing wealth, practical opportunities, and gains that increase through effort.",
    detect: (chart) => {
      const moon = findPlanet(chart.planets, "Moon");
      const fromLagna = chart.planets.filter((p) => NATURAL_BENEFICS.includes(p.name) && [3, 6, 10, 11].includes(p.house));
      const fromMoon = moon
        ? planetsInRelativeHouses(moon.sign, [3, 6, 10, 11], chart.planets, NATURAL_BENEFICS)
        : [];
      const involved = uniquePlanetNames([...fromLagna, ...fromMoon]);
      if (involved.length >= 2) {
        return {
          yoga_id: "vasumati",
          name: "Vasumati Yoga",
          sanskrit: "वसुमति योग",
          category: "wealth",
          present: true,
          strength: involved.length >= 3 ? "strong" : "moderate",
          involved_planets: moon ? ["Moon", ...involved] : involved,
          description: `${involved.join(", ")} occupy upachaya positions from Lagna or Moon.`,
          effects: "Indicates growing wealth, practical opportunities, and gains that increase through effort.",
        };
      }
      return null;
    },
  },
  {
    id: "shubha_kartari",
    name: "Shubha Kartari Yoga",
    sanskrit: "शुभ कर्तरी योग",
    category: "benefic",
    description: "Benefic planets flank the ascendant from the 2nd and 12th houses.",
    effects: "Protects the personality, improves support systems, and creates smoother life openings.",
    detect: (chart) => {
      const second = chart.planets.filter((p) => NATURAL_BENEFICS.includes(p.name) && p.house === 2);
      const twelfth = chart.planets.filter((p) => NATURAL_BENEFICS.includes(p.name) && p.house === 12);
      if (second.length > 0 && twelfth.length > 0) {
        return {
          yoga_id: "shubha_kartari",
          name: "Shubha Kartari Yoga",
          sanskrit: "शुभ कर्तरी योग",
          category: "benefic",
          present: true,
          strength: second.length + twelfth.length >= 3 ? "strong" : "moderate",
          involved_planets: uniquePlanetNames([...second, ...twelfth]),
          description: `Benefics flank the ascendant from houses 2 and 12.`,
          effects: "Protects the personality, improves support systems, and creates smoother life openings.",
        };
      }
      return null;
    },
  },
  {
    id: "papa_kartari",
    name: "Papa Kartari Yoga",
    sanskrit: "पाप कर्तरी योग",
    category: "challenging",
    description: "Malefic planets hem the ascendant from the 2nd and 12th houses.",
    effects: "Creates pressure around identity, support, and momentum until conscious discipline is developed.",
    detect: (chart) => {
      const second = chart.planets.filter((p) => NATURAL_MALEFICS.includes(p.name) && p.house === 2);
      const twelfth = chart.planets.filter((p) => NATURAL_MALEFICS.includes(p.name) && p.house === 12);
      if (second.length > 0 && twelfth.length > 0) {
        return {
          yoga_id: "papa_kartari",
          name: "Papa Kartari Yoga",
          sanskrit: "पाप कर्तरी योग",
          category: "challenging",
          present: true,
          strength: second.length + twelfth.length >= 3 ? "strong" : "moderate",
          involved_planets: uniquePlanetNames([...second, ...twelfth]),
          description: `Malefics flank the ascendant from houses 2 and 12.`,
          effects: "Creates pressure around identity, support, and momentum until conscious discipline is developed.",
        };
      }
      return null;
    },
  },
  {
    id: "neecha_bhanga_raja",
    name: "Neecha Bhanga Raja Yoga",
    sanskrit: "नीच भंग राज योग",
    category: "viparita",
    description: "A debilitated planet receives cancellation through its sign lord or exaltation lord in a kendra.",
    effects: "Converts early weakness into maturity, recovery, and eventual rise after setbacks.",
    detect: (chart) => {
      for (const planet of chart.planets.filter((p) => CLASSICAL_PLANETS.includes(p.name))) {
        if (!isDebilitated(planet.name, planet.sign)) continue;
        const signLord = findPlanet(chart.planets, getSignLord(planet.sign));
        const exaltSign = PLANET_EXALTATIONS[planet.name];
        const exaltLord = exaltSign ? findPlanet(chart.planets, getSignLord(exaltSign)) : undefined;
        const cancellationPlanet = [signLord, exaltLord].find((p) => p && isInKendra(p.house));
        if (cancellationPlanet) {
          return {
            yoga_id: "neecha_bhanga_raja",
            name: "Neecha Bhanga Raja Yoga",
            sanskrit: "नीच भंग राज योग",
            category: "viparita",
            present: true,
            strength: isInKendra(planet.house) ? "strong" : "moderate",
            involved_planets: [...new Set([planet.name, cancellationPlanet.name])],
            description: `${planet.name} is debilitated in ${planet.sign}, but cancellation comes through ${cancellationPlanet.name} in a kendra.`,
            effects: "Converts early weakness into maturity, recovery, and eventual rise after setbacks.",
          };
        }
      }
      return null;
    },
  },
  {
    id: "harsha",
    name: "Harsha Yoga",
    sanskrit: "हर्ष योग",
    category: "viparita",
    description: "The 6th lord is placed in a dusthana house.",
    effects: "Brings victory over enemies, resilience in service, and gains through overcoming problems.",
    detect: (chart) => {
      const lord6 = houseLordPlanet(6, chart);
      if (lord6.planet && isInDusthana(lord6.planet.house)) {
        return {
          yoga_id: "harsha",
          name: "Harsha Yoga",
          sanskrit: "हर्ष योग",
          category: "viparita",
          present: true,
          strength: lord6.planet.house === 6 ? "strong" : "moderate",
          involved_planets: [lord6.lordName],
          description: `The 6th lord (${lord6.lordName}) is placed in house ${lord6.planet.house}.`,
          effects: "Brings victory over enemies, resilience in service, and gains through overcoming problems.",
        };
      }
      return null;
    },
  },
  {
    id: "sarala",
    name: "Sarala Yoga",
    sanskrit: "सरल योग",
    category: "viparita",
    description: "The 8th lord is placed in a dusthana house.",
    effects: "Supports survival power, research ability, and protection during sudden reversals.",
    detect: (chart) => {
      const lord8 = houseLordPlanet(8, chart);
      if (lord8.planet && isInDusthana(lord8.planet.house)) {
        return {
          yoga_id: "sarala",
          name: "Sarala Yoga",
          sanskrit: "सरल योग",
          category: "viparita",
          present: true,
          strength: lord8.planet.house === 8 ? "strong" : "moderate",
          involved_planets: [lord8.lordName],
          description: `The 8th lord (${lord8.lordName}) is placed in house ${lord8.planet.house}.`,
          effects: "Supports survival power, research ability, and protection during sudden reversals.",
        };
      }
      return null;
    },
  },
  {
    id: "vimala",
    name: "Vimala Yoga",
    sanskrit: "विमल योग",
    category: "viparita",
    description: "The 12th lord is placed in a dusthana house.",
    effects: "Gives disciplined expenditure, privacy, spiritual cleansing, and gain from foreign or secluded settings.",
    detect: (chart) => {
      const lord12 = houseLordPlanet(12, chart);
      if (lord12.planet && isInDusthana(lord12.planet.house)) {
        return {
          yoga_id: "vimala",
          name: "Vimala Yoga",
          sanskrit: "विमल योग",
          category: "viparita",
          present: true,
          strength: lord12.planet.house === 12 ? "strong" : "moderate",
          involved_planets: [lord12.lordName],
          description: `The 12th lord (${lord12.lordName}) is placed in house ${lord12.planet.house}.`,
          effects: "Gives disciplined expenditure, privacy, spiritual cleansing, and gain from foreign or secluded settings.",
        };
      }
      return null;
    },
  },
  {
    id: "shakata",
    name: "Shakata Yoga",
    sanskrit: "शकट योग",
    category: "challenging",
    description: "Jupiter is placed 6th, 8th, or 12th from the Moon.",
    effects: "Creates alternating fortune and pressure, requiring steadiness through cycles of rise and dip.",
    detect: (chart) => {
      const moon = findPlanet(chart.planets, "Moon");
      const jupiter = findPlanet(chart.planets, "Jupiter");
      if (!moon || !jupiter) return null;
      const distance = signDistance(moon.sign, jupiter.sign);
      if ([6, 8, 12].includes(distance)) {
        return {
          yoga_id: "shakata",
          name: "Shakata Yoga",
          sanskrit: "शकट योग",
          category: "challenging",
          present: true,
          strength: planetStrength("Jupiter", jupiter.sign) === "strong" ? "weak" : "moderate",
          involved_planets: ["Moon", "Jupiter"],
          description: `Jupiter is ${distance} signs from the Moon.`,
          effects: "Creates alternating fortune and pressure, requiring steadiness through cycles of rise and dip.",
          cancellation: planetStrength("Jupiter", jupiter.sign) === "strong"
            ? "Jupiter has dignity strength, reducing the disruptive effect."
            : undefined,
        };
      }
      return null;
    },
  },
  {
    id: "kalanidhi",
    name: "Kalanidhi Yoga",
    sanskrit: "कलानिधि योग",
    category: "benefic",
    description: "Jupiter is in a wealth or dharma house and supported by Mercury or Venus.",
    effects: "Bestows refinement, learning, artistic taste, and respected knowledge.",
    detect: (chart) => {
      const jupiter = findPlanet(chart.planets, "Jupiter");
      if (!jupiter || ![2, 5, 9].includes(jupiter.house)) return null;
      const supporters = ["Mercury", "Venus"]
        .map((name) => findPlanet(chart.planets, name))
        .filter((p): p is PlanetPosition => Boolean(p))
        .filter((p) => p.sign === jupiter.sign || hasFullAspect(p, jupiter));
      if (supporters.length > 0) {
        return {
          yoga_id: "kalanidhi",
          name: "Kalanidhi Yoga",
          sanskrit: "कलानिधि योग",
          category: "benefic",
          present: true,
          strength: supporters.length === 2 ? "strong" : "moderate",
          involved_planets: ["Jupiter", ...uniquePlanetNames(supporters)],
          description: `Jupiter is in house ${jupiter.house} and supported by ${uniquePlanetNames(supporters).join(", ")}.`,
          effects: "Bestows refinement, learning, artistic taste, and respected knowledge.",
        };
      }
      return null;
    },
  },
  {
    id: "akhanda_samrajya",
    name: "Akhanda Samrajya Yoga",
    sanskrit: "अखंड साम्राज्य योग",
    category: "wealth",
    description: "Jupiter and key wealth/dharma lords are strong or placed in supportive houses.",
    effects: "Supports sustained authority, long-term prosperity, and durable institutional influence.",
    detect: (chart) => {
      const jupiter = findPlanet(chart.planets, "Jupiter");
      const lords = [2, 9, 11].map((house) => houseLordPlanet(house, chart));
      const strongLords = lords.filter((entry) =>
        entry.planet &&
        (isInKendra(entry.planet.house) || isInTrikona(entry.planet.house)) &&
        planetStrength(entry.lordName, entry.planet.sign) !== "weak"
      );
      if (jupiter && planetStrength("Jupiter", jupiter.sign) !== "weak" && strongLords.length >= 2) {
        return {
          yoga_id: "akhanda_samrajya",
          name: "Akhanda Samrajya Yoga",
          sanskrit: "अखंड साम्राज्य योग",
          category: "wealth",
          present: true,
          strength: strongLords.length === 3 ? "strong" : "moderate",
          involved_planets: [...new Set(["Jupiter", ...strongLords.map((entry) => entry.lordName)])],
          description: `Jupiter is not weak, and ${strongLords.length} wealth/dharma lords are strong in supportive houses.`,
          effects: "Supports sustained authority, long-term prosperity, and durable institutional influence.",
        };
      }
      return null;
    },
  },
  {
    id: "pushkala",
    name: "Pushkala Yoga",
    sanskrit: "पुष्कल योग",
    category: "wealth",
    description: "The Moon's sign lord connects with the ascendant lord in a supportive house.",
    effects: "Indicates social support, comfort, recognition, and material sufficiency.",
    detect: (chart) => {
      const moon = findPlanet(chart.planets, "Moon");
      const ascLord = houseLordPlanet(1, chart);
      if (!moon || !ascLord.planet) return null;
      const moonLordName = getSignLord(moon.sign);
      const moonLord = findPlanet(chart.planets, moonLordName);
      if (!moonLord) return null;
      const connected = moonLord.sign === ascLord.planet.sign || hasFullAspect(moonLord, ascLord.planet);
      if (connected && (isInKendra(moonLord.house) || isInTrikona(moonLord.house))) {
        return {
          yoga_id: "pushkala",
          name: "Pushkala Yoga",
          sanskrit: "पुष्कल योग",
          category: "wealth",
          present: true,
          strength: overallStrength([
            planetStrength(moonLordName, moonLord.sign),
            planetStrength(ascLord.lordName, ascLord.planet.sign),
          ]),
          involved_planets: [...new Set(["Moon", moonLordName, ascLord.lordName])],
          description: `Moon sign lord ${moonLordName} connects with ascendant lord ${ascLord.lordName}.`,
          effects: "Indicates social support, comfort, recognition, and material sufficiency.",
        };
      }
      return null;
    },
  },
  {
    id: "bhrigu_mangal",
    name: "Bhrigu-Mangal Yoga",
    sanskrit: "भृगु-मंगल योग",
    category: "wealth",
    description: "Venus and Mars are conjunct or in a full aspect relationship.",
    effects: "Combines passion with resources, supporting enterprise, design, attraction, and productive drive.",
    detect: (chart) => {
      const venus = findPlanet(chart.planets, "Venus");
      const mars = findPlanet(chart.planets, "Mars");
      if (!venus || !mars) return null;
      if (venus.sign === mars.sign || hasFullAspect(venus, mars)) {
        return {
          yoga_id: "bhrigu_mangal",
          name: "Bhrigu-Mangal Yoga",
          sanskrit: "भृगु-मंगल योग",
          category: "wealth",
          present: true,
          strength: overallStrength([planetStrength("Venus", venus.sign), planetStrength("Mars", mars.sign)]),
          involved_planets: ["Venus", "Mars"],
          description: `Venus and Mars are connected by conjunction or full aspect.`,
          effects: "Combines passion with resources, supporting enterprise, design, attraction, and productive drive.",
        };
      }
      return null;
    },
  },
  {
    id: "dharma_karmadhipati",
    name: "Dharma-Karmadhipati Yoga",
    sanskrit: "धर्म-कर्माधिपति योग",
    category: "wealth",
    description: "The 9th lord and 10th lord are conjunct, mutually aspecting, or in kendra relationship.",
    effects: "Aligns purpose with profession, creating status through meaningful work.",
    detect: (chart) => {
      const lord9 = houseLordPlanet(9, chart);
      const lord10 = houseLordPlanet(10, chart);
      if (!lord9.planet || !lord10.planet) return null;
      const connected =
        lord9.lordName === lord10.lordName ||
        lord9.planet.sign === lord10.planet.sign ||
        hasFullAspect(lord9.planet, lord10.planet) ||
        [1, 4, 7, 10].includes(signDistance(lord9.planet.sign, lord10.planet.sign));
      if (connected) {
        return {
          yoga_id: "dharma_karmadhipati",
          name: "Dharma-Karmadhipati Yoga",
          sanskrit: "धर्म-कर्माधिपति योग",
          category: "wealth",
          present: true,
          strength: overallStrength([
            planetStrength(lord9.lordName, lord9.planet.sign),
            planetStrength(lord10.lordName, lord10.planet.sign),
          ]),
          involved_planets: [...new Set([lord9.lordName, lord10.lordName])],
          description: `The 9th lord (${lord9.lordName}) and 10th lord (${lord10.lordName}) are meaningfully connected.`,
          effects: "Aligns purpose with profession, creating status through meaningful work.",
        };
      }
      return null;
    },
  },
  {
    id: "dhanakaraka",
    name: "Dhanakaraka Yoga",
    sanskrit: "धनकारक योग",
    category: "wealth",
    description: "The 2nd and 11th lords connect with Jupiter, Venus, or Mercury.",
    effects: "Supports income, savings, commercial intelligence, and practical material growth.",
    detect: (chart) => {
      const lord2 = houseLordPlanet(2, chart);
      const lord11 = houseLordPlanet(11, chart);
      if (!lord2.planet || !lord11.planet) return null;
      const wealthSupporters = chart.planets.filter((p) =>
        ["Jupiter", "Venus", "Mercury"].includes(p.name) &&
        (p.sign === lord2.planet?.sign || p.sign === lord11.planet?.sign || hasFullAspect(p, lord2.planet!) || hasFullAspect(p, lord11.planet!))
      );
      if (wealthSupporters.length > 0) {
        return {
          yoga_id: "dhanakaraka",
          name: "Dhanakaraka Yoga",
          sanskrit: "धनकारक योग",
          category: "wealth",
          present: true,
          strength: wealthSupporters.length >= 2 ? "strong" : "moderate",
          involved_planets: [...new Set([lord2.lordName, lord11.lordName, ...uniquePlanetNames(wealthSupporters)])],
          description: `The 2nd and 11th lords connect with wealth-supporting benefics.`,
          effects: "Supports income, savings, commercial intelligence, and practical material growth.",
        };
      }
      return null;
    },
  },
  {
    id: "rajalakshana",
    name: "Rajalakshana Yoga",
    sanskrit: "राजलक्षण योग",
    category: "wealth",
    description: "The ascendant lord is strong and multiple benefics support kendra/trikona houses.",
    effects: "Gives dignified bearing, public respect, leadership signs, and visible promise.",
    detect: (chart) => {
      const ascLord = houseLordPlanet(1, chart);
      if (!ascLord.planet || planetStrength(ascLord.lordName, ascLord.planet.sign) === "weak") return null;
      const beneficsGood = chart.planets.filter((p) =>
        NATURAL_BENEFICS.includes(p.name) && (isInKendra(p.house) || isInTrikona(p.house))
      );
      if (beneficsGood.length >= 2) {
        return {
          yoga_id: "rajalakshana",
          name: "Rajalakshana Yoga",
          sanskrit: "राजलक्षण योग",
          category: "wealth",
          present: true,
          strength: beneficsGood.length >= 3 ? "strong" : "moderate",
          involved_planets: [...new Set([ascLord.lordName, ...uniquePlanetNames(beneficsGood)])],
          description: `The ascendant lord is not weak, and benefics support angular or trinal houses.`,
          effects: "Gives dignified bearing, public respect, leadership signs, and visible promise.",
        };
      }
      return null;
    },
  },
  {
    id: "lagna_adhi",
    name: "Lagna Adhi Yoga",
    sanskrit: "लग्न अधि योग",
    category: "benefic",
    description: "Benefics occupy the 6th, 7th, or 8th houses from the ascendant.",
    effects: "Improves leadership, resilience, health management, and ability to handle opposition.",
    detect: (chart) => {
      const benefics = chart.planets.filter((p) =>
        NATURAL_BENEFICS.includes(p.name) && [6, 7, 8].includes(p.house)
      );
      if (benefics.length >= 2) {
        return {
          yoga_id: "lagna_adhi",
          name: "Lagna Adhi Yoga",
          sanskrit: "लग्न अधि योग",
          category: "benefic",
          present: true,
          strength: benefics.length >= 3 ? "strong" : "moderate",
          involved_planets: uniquePlanetNames(benefics),
          description: `${uniquePlanetNames(benefics).join(", ")} occupy houses 6, 7, or 8 from the ascendant.`,
          effects: "Improves leadership, resilience, health management, and ability to handle opposition.",
        };
      }
      return null;
    },
  },
];

const HOUSE_LORD_PLACEMENT_YOGA_RECIPES: HouseLordPlacementRecipe[] = [
  { id: "lagna_lord_kendra", name: "Lagna Lord Kendra Yoga", sanskrit: "Lagna Lord Kendra Yoga", category: "benefic", fromHouse: 1, targetHouses: [1, 4, 7, 10], description: "The ascendant lord occupies a kendra house.", effects: "Supports confidence, vitality, personal visibility, and steadier life direction.", activation_timing: "Ascendant lord dashas, major identity decisions, and transits to the 1st/10th houses", key_traits: ["self-possession", "visibility", "initiative"] },
  { id: "lagna_lord_trikona", name: "Lagna Lord Trikona Yoga", sanskrit: "Lagna Lord Trikona Yoga", category: "benefic", fromHouse: 1, targetHouses: [1, 5, 9], description: "The ascendant lord occupies a trikona house.", effects: "Links identity with luck, intelligence, faith, and purposeful growth.", activation_timing: "Ascendant lord dashas and years when education, children, mentors, or travel become central", key_traits: ["purpose", "learning", "good fortune"] },
  { id: "dhana_lord_kendra", name: "Dhana Lord Kendra Yoga", sanskrit: "Dhana Lord Kendra Yoga", category: "wealth", fromHouse: 2, targetHouses: [1, 4, 7, 10], description: "The 2nd lord occupies an angular house.", effects: "Strengthens earning capacity, stored resources, family support, and visible financial responsibility.", activation_timing: "2nd lord dashas, salary negotiations, asset decisions, and family-resource milestones", key_traits: ["earning", "stewardship", "stability"] },
  { id: "dhana_lord_trikona", name: "Dhana Lord Trikona Yoga", sanskrit: "Dhana Lord Trikona Yoga", category: "wealth", fromHouse: 2, targetHouses: [1, 5, 9], description: "The 2nd lord occupies a trinal house.", effects: "Connects wealth with merit, learning, counsel, and fortunate timing.", activation_timing: "2nd lord dashas and periods involving study, investment, teaching, or advisory work", key_traits: ["wealth sense", "judgment", "patience"] },
  { id: "parakrama_lord_upachaya", name: "Parakrama Upachaya Yoga", sanskrit: "Parakrama Upachaya Yoga", category: "benefic", fromHouse: 3, targetHouses: [3, 6, 10, 11], description: "The 3rd lord occupies an upachaya house.", effects: "Builds courage, skill, communication, and gains through repeated effort.", activation_timing: "3rd lord dashas, entrepreneurial pushes, skill-building seasons, and competitive cycles", key_traits: ["courage", "practice", "adaptability"] },
  { id: "sukha_lord_kendra", name: "Sukha Kendra Yoga", sanskrit: "Sukha Kendra Yoga", category: "benefic", fromHouse: 4, targetHouses: [1, 4, 7, 10], description: "The 4th lord occupies a kendra house.", effects: "Supports home stability, education, property themes, and emotional grounding.", activation_timing: "4th lord dashas, home moves, education phases, and family-foundation decisions", key_traits: ["grounding", "belonging", "inner steadiness"] },
  { id: "vidya_lord_trikona", name: "Vidya Trikona Yoga", sanskrit: "Vidya Trikona Yoga", category: "benefic", fromHouse: 5, targetHouses: [1, 5, 9], description: "The 5th lord occupies a trinal house.", effects: "Enhances intelligence, creativity, counsel, children, mantra, and merit.", activation_timing: "5th lord dashas, creative launches, romance periods, education, and child-related milestones", key_traits: ["creativity", "discernment", "merit"] },
  { id: "vidya_lord_kendra", name: "Vidya Kendra Yoga", sanskrit: "Vidya Kendra Yoga", category: "benefic", fromHouse: 5, targetHouses: [1, 4, 7, 10], description: "The 5th lord occupies an angular house.", effects: "Makes creativity and intelligence visible through public roles, teaching, or leadership.", activation_timing: "5th lord dashas and periods when creative work needs public structure", key_traits: ["creative authority", "guidance", "expression"] },
  { id: "shatru_lord_upachaya", name: "Shatru Vijaya Yoga", sanskrit: "Shatru Vijaya Yoga", category: "viparita", fromHouse: 6, targetHouses: [3, 6, 10, 11], description: "The 6th lord occupies an upachaya house.", effects: "Turns pressure, competition, service, and problem-solving into growth.", activation_timing: "6th lord dashas, demanding work cycles, health resets, and litigation or competition periods", key_traits: ["resilience", "discipline", "problem-solving"] },
  { id: "yuvati_lord_kendra", name: "Yuvati Kendra Yoga", sanskrit: "Yuvati Kendra Yoga", category: "benefic", fromHouse: 7, targetHouses: [1, 4, 7, 10], description: "The 7th lord occupies a kendra house.", effects: "Strengthens partnership visibility, contracts, negotiation, and public cooperation.", activation_timing: "7th lord dashas, marriage/partnership choices, client-facing work, and alliance cycles", key_traits: ["partnership", "diplomacy", "mutuality"] },
  { id: "randhra_lord_dusthana", name: "Randhra Transformation Yoga", sanskrit: "Randhra Transformation Yoga", category: "viparita", fromHouse: 8, targetHouses: [6, 8, 12], description: "The 8th lord occupies a dusthana house.", effects: "Can convert crisis, research, inheritance, or hidden pressure into resilience and insight.", activation_timing: "8th lord dashas, deep research phases, inheritance transitions, and major psychological turning points", key_traits: ["depth", "recovery", "investigation"] },
  { id: "bhagya_lord_trikona", name: "Bhagya Trikona Yoga", sanskrit: "Bhagya Trikona Yoga", category: "wealth", fromHouse: 9, targetHouses: [1, 5, 9], description: "The 9th lord occupies a trinal house.", effects: "Strengthens fortune, teachers, ethics, blessings, travel, and higher learning.", activation_timing: "9th lord dashas, mentor encounters, pilgrimage, publishing, legal, or higher-study windows", key_traits: ["luck", "wisdom", "faith"] },
  { id: "bhagya_lord_kendra", name: "Bhagya Kendra Yoga", sanskrit: "Bhagya Kendra Yoga", category: "wealth", fromHouse: 9, targetHouses: [1, 4, 7, 10], description: "The 9th lord occupies an angular house.", effects: "Makes dharma, education, guidance, and fortune visible in worldly life.", activation_timing: "9th lord dashas and years when teaching, travel, law, or public ethics shape decisions", key_traits: ["dharma", "recognition", "guidance"] },
  { id: "karma_lord_kendra", name: "Karma Kendra Yoga", sanskrit: "Karma Kendra Yoga", category: "wealth", fromHouse: 10, targetHouses: [1, 4, 7, 10], description: "The 10th lord occupies a kendra house.", effects: "Strengthens career direction, authority, reputation, and visible responsibility.", activation_timing: "10th lord dashas, promotions, public launches, leadership transitions, and Saturn/Jupiter transits to career houses", key_traits: ["career focus", "authority", "visibility"] },
  { id: "karma_lord_trikona", name: "Karma Trikona Yoga", sanskrit: "Karma Trikona Yoga", category: "wealth", fromHouse: 10, targetHouses: [1, 5, 9], description: "The 10th lord occupies a trinal house.", effects: "Links vocation with talent, merit, education, and fortunate sponsorship.", activation_timing: "10th lord dashas and windows when career intersects with teaching, creativity, or long-range purpose", key_traits: ["vocation", "purpose", "recognition"] },
  { id: "labha_lord_upachaya", name: "Labha Upachaya Yoga", sanskrit: "Labha Upachaya Yoga", category: "wealth", fromHouse: 11, targetHouses: [3, 6, 10, 11], description: "The 11th lord occupies an upachaya house.", effects: "Improves networks, gains, audience growth, patrons, and results from persistence.", activation_timing: "11th lord dashas, community-building phases, launches, and income expansion cycles", key_traits: ["gains", "networks", "momentum"] },
  { id: "vyaya_lord_dusthana", name: "Vyaya Release Yoga", sanskrit: "Vyaya Release Yoga", category: "viparita", fromHouse: 12, targetHouses: [6, 8, 12], description: "The 12th lord occupies a dusthana house.", effects: "Can redirect loss, retreat, foreign ties, or isolation into healing and spiritual clarity.", activation_timing: "12th lord dashas, retreat periods, foreign travel, therapy, and closure cycles", key_traits: ["release", "reflection", "spiritual repair"] },
  { id: "dharma_support_yoga", name: "Dharma Support Yoga", sanskrit: "Dharma Support Yoga", category: "benefic", fromHouse: 9, targetHouses: [2, 5, 11], description: "The 9th lord supports wealth, merit, or gains houses.", effects: "Connects fortune with learning, resources, audience, and inherited blessings.", activation_timing: "9th lord dashas and windows involving mentors, publishing, grants, patrons, or travel", key_traits: ["blessing", "learning", "support"] },
  { id: "artha_support_yoga", name: "Artha Support Yoga", sanskrit: "Artha Support Yoga", category: "wealth", fromHouse: 10, targetHouses: [2, 6, 10, 11], description: "The 10th lord supports practical artha houses.", effects: "Makes work, money, service, and gains reinforce one another.", activation_timing: "10th lord dashas, job changes, business cycles, and income-structure decisions", key_traits: ["productivity", "status", "earning"] },
  { id: "moksha_support_yoga", name: "Moksha Support Yoga", sanskrit: "Moksha Support Yoga", category: "benefic", fromHouse: 12, targetHouses: [4, 8, 12], description: "The 12th lord supports moksha houses.", effects: "Deepens intuition, private restoration, research, retreat, and inner release.", activation_timing: "12th lord dashas, solitude, retreat, occult study, dreamwork, and healing phases", key_traits: ["intuition", "closure", "depth"] },
];

const MUTUAL_HOUSE_LORD_YOGA_RECIPES: MutualHouseLordRecipe[] = [
  { id: "lagna_dhana_parivartana", name: "Lagna-Dhana Parivartana Yoga", sanskrit: "Lagna-Dhana Parivartana Yoga", category: "wealth", houseA: 1, houseB: 2, description: "The 1st and 2nd lords exchange houses.", effects: "Connects identity with earning, speech, family resources, and personal agency.", activation_timing: "1st or 2nd lord dashas and major financial self-definition periods", key_traits: ["self-worth", "earning", "voice"] },
  { id: "dharma_karma_parivartana", name: "Dharma-Karma Parivartana Yoga", sanskrit: "Dharma-Karma Parivartana Yoga", category: "wealth", houseA: 9, houseB: 10, description: "The 9th and 10th lords exchange houses.", effects: "Powerfully links purpose, teachers, reputation, and career action.", activation_timing: "9th/10th lord dashas, career turns, mentor-backed openings, and public responsibility cycles", key_traits: ["purpose", "career", "recognition"] },
  { id: "vidya_bhagya_parivartana", name: "Vidya-Bhagya Parivartana Yoga", sanskrit: "Vidya-Bhagya Parivartana Yoga", category: "benefic", houseA: 5, houseB: 9, description: "The 5th and 9th lords exchange houses.", effects: "Strengthens learning, merit, teaching, creativity, children, and blessings.", activation_timing: "5th/9th lord dashas, education, creative work, mentorship, and child-related milestones", key_traits: ["wisdom", "creativity", "fortune"] },
  { id: "karma_labha_parivartana", name: "Karma-Labha Parivartana Yoga", sanskrit: "Karma-Labha Parivartana Yoga", category: "wealth", houseA: 10, houseB: 11, description: "The 10th and 11th lords exchange houses.", effects: "Connects career authority with income, communities, patrons, and long-range gains.", activation_timing: "10th/11th lord dashas, launches, promotions, public networks, and audience growth", key_traits: ["career gains", "networks", "authority"] },
  { id: "sukha_yuvati_parivartana", name: "Sukha-Yuvati Parivartana Yoga", sanskrit: "Sukha-Yuvati Parivartana Yoga", category: "benefic", houseA: 4, houseB: 7, description: "The 4th and 7th lords exchange houses.", effects: "Links emotional foundation with partnership, home, public agreements, and belonging.", activation_timing: "4th/7th lord dashas, home decisions, marriage, cohabitation, and partnership agreements", key_traits: ["partnership", "home", "emotional balance"] },
  { id: "dhana_labha_parivartana", name: "Dhana-Labha Parivartana Yoga", sanskrit: "Dhana-Labha Parivartana Yoga", category: "wealth", houseA: 2, houseB: 11, description: "The 2nd and 11th lords exchange houses.", effects: "Strengthens wealth accumulation, income channels, networks, and financial planning.", activation_timing: "2nd/11th lord dashas, investment decisions, community income, and compensation cycles", key_traits: ["income", "assets", "networks"] },
  { id: "parakrama_karma_parivartana", name: "Parakrama-Karma Parivartana Yoga", sanskrit: "Parakrama-Karma Parivartana Yoga", category: "benefic", houseA: 3, houseB: 10, description: "The 3rd and 10th lords exchange houses.", effects: "Turns skills, communication, writing, and courage into visible professional action.", activation_timing: "3rd/10th lord dashas, media work, entrepreneurial pushes, and public communication cycles", key_traits: ["skill", "communication", "ambition"] },
  { id: "shatru_vyaya_parivartana", name: "Shatru-Vyaya Parivartana Yoga", sanskrit: "Shatru-Vyaya Parivartana Yoga", category: "viparita", houseA: 6, houseB: 12, description: "The 6th and 12th lords exchange houses.", effects: "Can transform service, illness, expense, retreat, and opposition into liberation from old burdens.", activation_timing: "6th/12th lord dashas, health resets, conflict resolution, retreat, and closure periods", key_traits: ["repair", "discipline", "release"] },
];

const PLANET_HOUSE_YOGA_RECIPES: PlanetHouseRecipe[] = [
  { id: "surya_kendra_prabha", name: "Surya Kendra Prabha Yoga", sanskrit: "Surya Kendra Prabha Yoga", category: "benefic", planet: "Sun", targetHouses: [1, 4, 7, 10], description: "Sun occupies a kendra house.", effects: "Strengthens leadership, visibility, confidence, and public identity.", activation_timing: "Sun dashas, solar returns, leadership invitations, and public visibility periods", key_traits: ["leadership", "clarity", "presence"] },
  { id: "chandra_kendra_saumya", name: "Chandra Kendra Saumya Yoga", sanskrit: "Chandra Kendra Saumya Yoga", category: "benefic", planet: "Moon", targetHouses: [1, 4, 7, 10], description: "Moon occupies a kendra house.", effects: "Improves emotional visibility, responsiveness, support networks, and public relatability.", activation_timing: "Moon dashas, family cycles, public-facing care roles, and major home decisions", key_traits: ["care", "receptivity", "belonging"] },
  { id: "budha_upachaya_yoga", name: "Budha Upachaya Yoga", sanskrit: "Budha Upachaya Yoga", category: "benefic", planet: "Mercury", targetHouses: [3, 6, 10, 11], description: "Mercury occupies an upachaya house.", effects: "Develops analysis, trade, writing, speech, technology, and strategic problem-solving.", activation_timing: "Mercury dashas, learning curves, launches, negotiation cycles, and technical work", key_traits: ["analysis", "communication", "commerce"] },
  { id: "shukra_kendra_saundarya", name: "Shukra Kendra Saundarya Yoga", sanskrit: "Shukra Kendra Saundarya Yoga", category: "benefic", planet: "Venus", targetHouses: [1, 4, 7, 10], description: "Venus occupies a kendra house.", effects: "Supports beauty, art, ease, diplomacy, relationships, and tasteful public presentation.", activation_timing: "Venus dashas, relationship decisions, design work, art launches, and social openings", key_traits: ["harmony", "beauty", "magnetism"] },
  { id: "mangala_upachaya_yoga", name: "Mangala Upachaya Yoga", sanskrit: "Mangala Upachaya Yoga", category: "benefic", planet: "Mars", targetHouses: [3, 6, 10, 11], description: "Mars occupies an upachaya house.", effects: "Builds courage, competitive strength, technical grit, and action under pressure.", activation_timing: "Mars dashas, athletic or technical pushes, conflict cycles, and ambitious work sprints", key_traits: ["drive", "competition", "execution"] },
  { id: "guru_trikona_kripa", name: "Guru Trikona Kripa Yoga", sanskrit: "Guru Trikona Kripa Yoga", category: "benefic", planet: "Jupiter", targetHouses: [1, 5, 9], description: "Jupiter occupies a trinal house.", effects: "Strengthens wisdom, teaching, faith, protection, children, and long-range blessings.", activation_timing: "Jupiter dashas, education, teaching, travel, legal matters, and mentor-backed expansion", key_traits: ["wisdom", "faith", "protection"] },
  { id: "shani_upachaya_yoga", name: "Shani Upachaya Yoga", sanskrit: "Shani Upachaya Yoga", category: "benefic", planet: "Saturn", targetHouses: [3, 6, 10, 11], description: "Saturn occupies an upachaya house.", effects: "Builds endurance, systems, maturity, durable gains, and authority through time.", activation_timing: "Saturn dashas, Saturn returns, promotions earned through pressure, and long work cycles", key_traits: ["discipline", "endurance", "structure"] },
  { id: "rahu_upachaya_yoga", name: "Rahu Upachaya Yoga", sanskrit: "Rahu Upachaya Yoga", category: "benefic", planet: "Rahu", targetHouses: [3, 6, 10, 11], description: "Rahu occupies an upachaya house.", effects: "Amplifies ambition, unconventional growth, technology, competition, and worldly gains.", activation_timing: "Rahu dashas, foreign/tech opportunities, sudden visibility, and high-risk growth phases", key_traits: ["ambition", "innovation", "reinvention"] },
  { id: "ketu_moksha_yoga", name: "Ketu Moksha Yoga", sanskrit: "Ketu Moksha Yoga", category: "benefic", planet: "Ketu", targetHouses: [4, 8, 12], description: "Ketu occupies a moksha house.", effects: "Deepens detachment, intuition, research, spiritual memory, and hidden mastery.", activation_timing: "Ketu dashas, retreat, meditation, research, closure, and inner-life turning points", key_traits: ["detachment", "insight", "spiritual memory"] },
  { id: "chandra_trikona_soma", name: "Chandra Trikona Soma Yoga", sanskrit: "Chandra Trikona Soma Yoga", category: "benefic", planet: "Moon", targetHouses: [1, 5, 9], description: "Moon occupies a trinal house.", effects: "Supports emotional intelligence, creativity, nurturing merit, and ease with learning.", activation_timing: "Moon dashas, creative periods, family blessings, education, and devotional practices", key_traits: ["empathy", "memory", "imagination"] },
];

const RELATIVE_PLANET_YOGA_RECIPES: RelativePlanetRecipe[] = [
  { id: "chandra_benefic_trine", name: "Chandra Benefic Trine Yoga", sanskrit: "Chandra Benefic Trine Yoga", category: "benefic", basePlanet: "Moon", allowedPlanets: NATURAL_BENEFICS, relativeHouses: [5, 9], minCount: 1, description: "A benefic occupies the 5th or 9th sign from the Moon.", effects: "Supports emotional hope, education, children, counsel, and fortunate mental patterns.", activation_timing: "Moon dashas, benefic dashas, family/education cycles, and Jupiter transits to the Moon", key_traits: ["hope", "learning", "emotional support"] },
  { id: "chandra_benefic_kendra", name: "Chandra Benefic Kendra Yoga", sanskrit: "Chandra Benefic Kendra Yoga", category: "benefic", basePlanet: "Moon", allowedPlanets: NATURAL_BENEFICS, relativeHouses: [1, 4, 7, 10], minCount: 1, description: "A benefic occupies a kendra from the Moon.", effects: "Stabilizes the mind through support, counsel, relationships, and visible opportunities.", activation_timing: "Moon or benefic dashas and transits to lunar kendras", key_traits: ["support", "stability", "receptivity"] },
  { id: "surya_benefic_trine", name: "Surya Benefic Trine Yoga", sanskrit: "Surya Benefic Trine Yoga", category: "benefic", basePlanet: "Sun", allowedPlanets: NATURAL_BENEFICS, relativeHouses: [5, 9], minCount: 1, description: "A benefic occupies the 5th or 9th sign from the Sun.", effects: "Refines leadership with wisdom, grace, counsel, and ethical visibility.", activation_timing: "Sun or benefic dashas, public leadership openings, and solar return emphasis", key_traits: ["noble conduct", "confidence", "grace"] },
  { id: "surya_malefic_upachaya", name: "Surya Malefic Upachaya Yoga", sanskrit: "Surya Malefic Upachaya Yoga", category: "benefic", basePlanet: "Sun", allowedPlanets: NATURAL_MALEFICS, relativeHouses: [3, 6, 10, 11], minCount: 1, description: "A natural malefic occupies an upachaya sign from the Sun.", effects: "Turns pressure into grit, leadership stamina, competition, and visible achievement.", activation_timing: "Sun or malefic dashas, competitive career periods, and authority tests", key_traits: ["stamina", "courage", "pressure-handling"] },
  { id: "moon_protected_by_jupiter_venus", name: "Moon Protected Yoga", sanskrit: "Moon Protected Yoga", category: "benefic", basePlanet: "Moon", allowedPlanets: ["Jupiter", "Venus"], relativeHouses: [1, 5, 7, 9], minCount: 1, description: "Jupiter or Venus supports the Moon by conjunction, opposition, or trinal relation.", effects: "Softens emotional volatility and improves support, kindness, counsel, and recovery.", activation_timing: "Moon, Jupiter, or Venus dashas and relationship/family healing periods", key_traits: ["kindness", "recovery", "support"] },
  { id: "lagna_benefic_flank", name: "Lagna Benefic Flank Yoga", sanskrit: "Lagna Benefic Flank Yoga", category: "benefic", basePlanet: "Sun", allowedPlanets: NATURAL_BENEFICS, relativeHouses: [2, 12], minCount: 1, description: "A benefic flanks the solar identity axis from the 2nd or 12th sign.", effects: "Adds support through speech, resources, retreat, diplomacy, and private preparation.", activation_timing: "Benefic dashas, financial decisions, retreat phases, and public-preparation windows", key_traits: ["preparation", "support", "speech"] },
  { id: "chandra_malefic_upachaya", name: "Chandra Malefic Upachaya Yoga", sanskrit: "Chandra Malefic Upachaya Yoga", category: "benefic", basePlanet: "Moon", allowedPlanets: NATURAL_MALEFICS, relativeHouses: [3, 6, 10, 11], minCount: 1, description: "A natural malefic occupies an upachaya sign from the Moon.", effects: "Builds emotional toughness, work capacity, and resilience through pressure.", activation_timing: "Moon or malefic dashas, hard work cycles, health discipline, and public accountability periods", key_traits: ["resilience", "work ethic", "emotional stamina"] },
];

const CONJUNCTION_YOGA_RECIPES: ConjunctionRecipe[] = [
  { id: "budha_shukra_yoga", name: "Budha-Shukra Yoga", sanskrit: "Budha-Shukra Yoga", category: "benefic", planets: ["Mercury", "Venus"], description: "Mercury and Venus are conjunct.", effects: "Combines language, taste, design, persuasion, commerce, and artistic intelligence.", activation_timing: "Mercury or Venus dashas, creative launches, negotiations, media work, and relationship decisions", key_traits: ["eloquence", "design", "persuasion"] },
  { id: "surya_mangala_yoga", name: "Surya-Mangala Yoga", sanskrit: "Surya-Mangala Yoga", category: "benefic", planets: ["Sun", "Mars"], description: "Sun and Mars are conjunct.", effects: "Creates forceful initiative, leadership, technical courage, and decisive action.", activation_timing: "Sun or Mars dashas, leadership tests, competition, and urgent execution windows", key_traits: ["decisiveness", "drive", "command"] },
  { id: "guru_shukra_yoga", name: "Guru-Shukra Yoga", sanskrit: "Guru-Shukra Yoga", category: "benefic", planets: ["Jupiter", "Venus"], description: "Jupiter and Venus are conjunct.", effects: "Blends wisdom and beauty, supporting teaching, art, devotion, prosperity, and counsel.", activation_timing: "Jupiter or Venus dashas, education, marriage, creative patronage, and devotional periods", key_traits: ["grace", "wisdom", "abundance"] },
  { id: "shani_budha_yoga", name: "Shani-Budha Yoga", sanskrit: "Shani-Budha Yoga", category: "benefic", planets: ["Saturn", "Mercury"], description: "Saturn and Mercury are conjunct.", effects: "Builds disciplined thinking, systems design, research skill, careful speech, and technical reliability.", activation_timing: "Saturn or Mercury dashas, study, systems work, contracts, and long technical projects", key_traits: ["precision", "systems", "patience"] },
  { id: "rahu_budha_yoga", name: "Rahu-Budha Yoga", sanskrit: "Rahu-Budha Yoga", category: "benefic", planets: ["Rahu", "Mercury"], description: "Rahu and Mercury are conjunct.", effects: "Amplifies unconventional intelligence, technology, media, analysis, and adaptive strategy.", activation_timing: "Rahu or Mercury dashas, technology openings, media visibility, foreign networks, and rapid learning cycles", key_traits: ["innovation", "strategy", "adaptability"] },
];

const GENERATED_YOGA_DEFINITIONS: YogaDefinition[] = [
  ...HOUSE_LORD_PLACEMENT_YOGA_RECIPES.map(createHouseLordPlacementYoga),
  ...MUTUAL_HOUSE_LORD_YOGA_RECIPES.map(createMutualHouseLordYoga),
  ...PLANET_HOUSE_YOGA_RECIPES.map(createPlanetHouseYoga),
  ...RELATIVE_PLANET_YOGA_RECIPES.map(createRelativePlanetYoga),
  ...CONJUNCTION_YOGA_RECIPES.map(createConjunctionYoga),
];

// --------------------------------------------------------------------------
// CLASSICAL SOURCES
// --------------------------------------------------------------------------
/*
 * The texts the `source` field cites, and the editions its chapter numbers
 * follow. Naming the edition matters because the numbering is not stable: BPHS
 * carries the Nabhasa chapter as 35 in Santhanam and as 37 in editions that
 * split the earlier material, so a bare "BPHS ch. 35" is ambiguous on its own.
 *
 *   BPHS            Brihat Parashara Hora Shastra, tr. R. Santhanam
 *   Brihat Jataka   Varahamihira, tr. V. Subrahmanya Sastri (2nd ed.)
 *   Phaladeepika    Mantreswara, tr. S.S. Sareen
 *   Saravali        Kalyana Varma, tr. R. Santhanam
 *   Jataka Parijata Vaidyanatha Dikshita, tr. V. Subrahmanya Sastri
 *
 * What a citation claims, and what it does not. It says the *combination* is
 * described in that text at that place -- the planets, houses and lords that
 * have to line up. It does not claim the wording here is a translation of
 * anything: every description, effect and timing line below is written for this
 * project, because the classical results are stated in terms ("becomes a king",
 * "destroys his enemies") that no reading in this product is going to print.
 *
 * Where a record is deliberately stricter than its source it says so in
 * `description` rather than quietly narrowing the rule. The Akriti yogas are
 * the main case; see the note under NABHASA YOGAS.
 */

// --------------------------------------------------------------------------
// Nabhasa yogas -- whole-chart patterns
// --------------------------------------------------------------------------
/*
 * The 32 Nabhasa yogas are the oldest systematic block in the literature --
 * Brihat Jataka gives them a chapter of their own -- and they are different in
 * kind from everything above. Every other yoga in this file is a statement
 * about one or two planets. A Nabhasa yoga is a statement about the shape the
 * whole chart makes: all seven classical grahas at once, ignoring Rahu and
 * Ketu. That is why `classicalPlanets` filters the nodes out, and why a chart
 * missing any of the seven is not judged loosely but not judged at all.
 *
 * The four families divide by what they measure:
 *
 *   Ashraya (3)   the modality of the signs -- movable, fixed or dual
 *   Dala (2)      whether the benefics or the malefics hold the angles
 *   Akriti (20)   the figure the occupied houses draw
 *   Sankhya (7)   how many signs the seven planets are spread across
 *
 * ── ONE DELIBERATE NARROWING ───────────────────────────────────────────────
 *
 * The Akriti rules are stated as "the planets occupy the 1st and 7th", and read
 * literally that is satisfied by a chart with all seven in the 1st -- an empty
 * 7th does not contradict the sentence. Read that way one chart fires a dozen
 * Akriti yogas at once and the panel becomes noise.
 *
 * So `houseGroups` requires both halves: every classical planet inside the
 * named set, *and* every house in that set actually occupied. That is a strict
 * subset of each classical rule and never a superset, which is the only
 * direction this file is allowed to differ in -- a chart this engine calls
 * Shakata is one every text would also call Shakata. Parasara's own precedence
 * rule points the same way: the Sankhya yogas apply only when no other Nabhasa
 * yoga obtains, which makes sense only if the Akriti figures are read as
 * figures rather than as loose bounds.
 */

const MOVABLE_SIGNS = ["Aries", "Cancer", "Libra", "Capricorn"];
const FIXED_SIGNS = ["Taurus", "Leo", "Scorpio", "Aquarius"];
const DUAL_SIGNS = ["Gemini", "Virgo", "Sagittarius", "Pisces"];

type NabhasaPattern =
  /** Every classical planet in signs of one modality. */
  | { kind: "modality"; signs: string[]; label: string }
  /** The seven classical planets spread across exactly this many signs. */
  | { kind: "signCount"; count: number }
  /** Planets confined to one of these house sets, every house in it occupied. */
  | { kind: "houseGroups"; groups: number[][] }
  /** A named group of planets all holding angles. */
  | { kind: "groupInKendras"; planets: string[] }
  /** Benefics hold one pair of houses and malefics the other. */
  | { kind: "beneficMaleficSplit"; beneficHouses: number[]; maleficHouses: number[] };

type NabhasaRecipe = GeneratedYogaRecipe & { pattern: NabhasaPattern };

function classicalPlanets(chart: YogaChartInput): PlanetPosition[] {
  return chart.planets.filter((planet) => CLASSICAL_PLANETS.includes(planet.name));
}

function matchNabhasa(
  pattern: NabhasaPattern,
  planets: PlanetPosition[]
): { planets: PlanetPosition[]; detail: string } | null {
  switch (pattern.kind) {
    case "modality": {
      if (!planets.every((planet) => pattern.signs.includes(planet.sign))) return null;
      return { planets, detail: `All seven classical planets occupy ${pattern.label} signs.` };
    }
    case "signCount": {
      const signs = [...new Set(planets.map((planet) => planet.sign))];
      if (signs.length !== pattern.count) return null;
      const noun = pattern.count === 1 ? "sign" : "signs";
      return {
        planets,
        detail: `The seven classical planets are spread across exactly ${pattern.count} ${noun}: ${signs.join(", ")}.`,
      };
    }
    case "houseGroups": {
      const occupied = new Set(planets.map((planet) => planet.house));
      for (const group of pattern.groups) {
        const confined = [...occupied].every((house) => group.includes(house));
        const complete = group.every((house) => occupied.has(house));
        if (confined && complete) {
          return {
            planets,
            detail: `The seven classical planets fall entirely in houses ${houseList(group)}, with every one of them occupied.`,
          };
        }
      }
      return null;
    }
    case "groupInKendras": {
      const named = planets.filter((planet) => pattern.planets.includes(planet.name));
      if (named.length !== pattern.planets.length) return null;
      if (!named.every((planet) => isInKendra(planet.house))) return null;
      return {
        planets: named,
        detail: `${pattern.planets.join(", ")} all hold angular houses (1/4/7/10).`,
      };
    }
    case "beneficMaleficSplit": {
      const benefics = planets.filter((planet) => NATURAL_BENEFICS.includes(planet.name));
      const malefics = planets.filter((planet) => NATURAL_MALEFICS.includes(planet.name));
      if (benefics.length === 0 || malefics.length === 0) return null;
      if (!benefics.every((planet) => pattern.beneficHouses.includes(planet.house))) return null;
      if (!malefics.every((planet) => pattern.maleficHouses.includes(planet.house))) return null;
      return {
        planets: [...benefics, ...malefics],
        detail: `The benefics hold houses ${houseList(pattern.beneficHouses)} and the malefics houses ${houseList(pattern.maleficHouses)}.`,
      };
    }
  }
}

function createNabhasaYoga(recipe: NabhasaRecipe): YogaDefinition {
  return {
    id: recipe.id,
    name: recipe.name,
    sanskrit: recipe.sanskrit,
    category: recipe.category,
    description: recipe.description,
    effects: recipe.effects,
    source: recipe.source,
    detect: (chart) => {
      const planets = classicalPlanets(chart);
      /* Every rule here is a claim about all seven at once, so an incomplete
         chart is not judged loosely -- it is not judged. */
      if (planets.length !== CLASSICAL_PLANETS.length) return null;
      const match = matchNabhasa(recipe.pattern, planets);
      if (!match) return null;
      return generatedYogaResult(
        recipe,
        overallStrength(match.planets.map((planet) => planetStrength(planet.name, planet.sign))),
        uniquePlanetNames(match.planets),
        match.detail
      );
    },
  };
}

/** Every Nabhasa record shares one citation; the family is given together. */
const NABHASA_SOURCE =
  "Brihat Jataka ch. 12; BPHS Nabhasa Yoga adhyaya (ch. 35 Santhanam); Saravali ch. 33";

const NABHASA_YOGA_RECIPES: NabhasaRecipe[] = [
  // ── Ashraya (3): the modality the whole chart rests on ──
  {
    id: "rajju", name: "Rajju Yoga", sanskrit: "रज्जु योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "modality", signs: MOVABLE_SIGNS, label: "movable" },
    description: "All seven classical planets occupy movable signs -- Aries, Cancer, Libra and Capricorn.",
    effects: "Gives a life of movement and repeated fresh starts: travel, relocation, changes of field. Momentum comes easily and settling does not.",
    activation_timing: "relocations, job changes, travel-heavy years, and the periods of planets in angular signs",
    key_traits: ["mobility", "initiative", "restlessness"],
  },
  {
    id: "musala", name: "Musala Yoga", sanskrit: "मुसल योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "modality", signs: FIXED_SIGNS, label: "fixed" },
    description: "All seven classical planets occupy fixed signs -- Taurus, Leo, Scorpio and Aquarius.",
    effects: "Gives weight and staying power: firm opinions, long tenures, standing that accumulates. What is built tends to last, and what is wrong is slow to be revised.",
    activation_timing: "long appointments, property and asset building, and the periods of planets in fixed signs",
    key_traits: ["endurance", "authority", "obstinacy"],
  },
  {
    id: "nala", name: "Nala Yoga", sanskrit: "नल योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "modality", signs: DUAL_SIGNS, label: "dual" },
    description: "All seven classical planets occupy dual signs -- Gemini, Virgo, Sagittarius and Pisces.",
    effects: "Gives adaptability and skill at handling two things at once: teaching, broking, translation, any work that stands between two parties.",
    activation_timing: "periods of dual responsibility, advisory and teaching work, and Mercury and Jupiter periods",
    key_traits: ["adaptability", "dexterity", "mediation"],
  },

  // ── Dala (2): which side holds the angles ──
  {
    id: "mala", name: "Mala Yoga", sanskrit: "माला योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "groupInKendras", planets: ["Jupiter", "Venus", "Mercury"] },
    description: "Jupiter, Venus and Mercury -- the three natural benefics -- all occupy angular houses.",
    effects: "Comfort arrives through people rather than through struggle: goodwill, pleasant surroundings, and help that turns up without being asked for.",
    activation_timing: "benefic periods, marriage and partnership years, and stretches of social expansion",
    key_traits: ["goodwill", "comfort", "ease"],
  },
  {
    id: "sarpa_nabhasa", name: "Sarpa Yoga", sanskrit: "सर्प योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "groupInKendras", planets: ["Sun", "Mars", "Saturn"] },
    description: "The Sun, Mars and Saturn all occupy angular houses, leaving the angles wholly to the malefics.",
    effects: "Results come through pressure rather than goodwill. Capacity for hard, unglamorous work is high; the cost is that little is handed over freely.",
    activation_timing: "Saturn and Mars periods, contested stretches, and work undertaken without support",
    key_traits: ["hardship", "resilience", "self-reliance"],
  },

  // ── Akriti (20): the figure the occupied houses draw ──
  {
    id: "gada", name: "Gada Yoga", sanskrit: "गदा योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "houseGroups", groups: [[1, 4], [4, 7], [7, 10], [10, 1]] },
    description: "All seven classical planets occupy two adjacent angular houses -- 1st and 4th, 4th and 7th, 7th and 10th, or 10th and 1st -- drawing the mace the yoga is named for.",
    effects: "Concentrates the whole chart into one quarter of life, usually home-and-self or work-and-partnership. Means and standing follow, within a narrow field.",
    activation_timing: "the periods of planets in the two occupied angles, and years that force a choice between home and career",
    key_traits: ["concentration", "acquisition", "narrowness"],
  },
  {
    id: "shakata_nabhasa", name: "Shakata Yoga (Nabhasa)", sanskrit: "शकट योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "houseGroups", groups: [[1, 7]] },
    description: "All seven classical planets fall in the 1st and 7th houses, both occupied. Distinct from the Moon-Jupiter Shakata Yoga above, which is an unrelated combination that happens to share the name.",
    effects: "Life runs on an axis between self and other, rising and falling like the cart it is named for. Fortunes swing, and partnership is the hinge they swing on.",
    activation_timing: "partnership periods, and the reversals that mark the start and end of major relationships",
    key_traits: ["oscillation", "partnership", "reversal"],
  },
  {
    id: "vihaga", name: "Vihaga Yoga", sanskrit: "विहग योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "houseGroups", groups: [[4, 10]] },
    description: "All seven classical planets fall in the 4th and 10th houses, both occupied -- the bird's two wings.",
    effects: "Life is lived between home and profession with little in between. Work that carries messages, moves between places, or serves at a distance suits it.",
    activation_timing: "career moves, relocations, and the periods of planets in the 4th and 10th",
    key_traits: ["movement", "service", "duality"],
  },
  {
    id: "shringataka", name: "Shringataka Yoga", sanskrit: "शृङ्गाटक योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "houseGroups", groups: [[1, 5, 9]] },
    description: "All seven classical planets fall in the 1st, 5th and 9th houses, all three occupied -- the triangle of the trines.",
    effects: "One of the strongest whole-chart figures: merit, learning and fortune reinforce each other, and the later half of life is specifically the better one.",
    activation_timing: "trine-lord periods, stretches of study and teaching, and the years after mid-life",
    key_traits: ["merit", "fortune", "contentment"],
  },
  {
    id: "hala", name: "Hala Yoga", sanskrit: "हल योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "houseGroups", groups: [[2, 6, 10], [3, 7, 11], [4, 8, 12]] },
    description: "All seven classical planets fall in one set of mutual trines that does not include the ascendant -- 2/6/10, 3/7/11 or 4/8/12 -- the plough.",
    effects: "Gives sustained productive labour rather than inherited advantage. Results are earned, work with land or production suits, and comfort arrives late.",
    activation_timing: "long working stretches, land and production work, and Saturn periods",
    key_traits: ["labour", "productivity", "patience"],
  },
  {
    id: "vajra", name: "Vajra Yoga", sanskrit: "वज्र योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "beneficMaleficSplit", beneficHouses: [1, 7], maleficHouses: [4, 10] },
    description: "The natural benefics hold the 1st and 7th houses while the malefics hold the 4th and 10th -- hard through the middle and soft at the ends, like the thunderbolt.",
    effects: "Pleasant at the beginning and end of life and harder through the middle. Physical vigour is good and the temperament is direct.",
    activation_timing: "mid-life pressure periods, and the periods of the angular malefics",
    key_traits: ["vigour", "directness", "mid-life strain"],
  },
  {
    id: "kamala", name: "Kamala Yoga", sanskrit: "कमल योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "houseGroups", groups: [[1, 4, 7, 10]] },
    description: "All seven classical planets are distributed across the four angles, every angle occupied -- the lotus.",
    effects: "The strongest of the Akriti figures. Every pillar of the chart is held -- standing, home, partnership and work all carry weight -- and reputation outlasts the person.",
    activation_timing: "angular periods, and the stretches that establish public standing",
    key_traits: ["eminence", "balance", "renown"],
  },
  {
    id: "vapi", name: "Vapi Yoga", sanskrit: "वापी योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "houseGroups", groups: [[2, 5, 8, 11], [3, 6, 9, 12]] },
    description: "All seven classical planets fall in the succedent houses (2/5/8/11) or the cadent ones (3/6/9/12), every house in that set occupied -- the step-well.",
    effects: "Gives accumulation rather than display: savings, reserves and holdings that are not obvious from outside.",
    activation_timing: "the periods of the 2nd and 11th lords, and long stretches of steady saving",
    key_traits: ["accumulation", "reserve", "discretion"],
  },
  {
    id: "yupa", name: "Yupa Yoga", sanskrit: "यूप योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "houseGroups", groups: [[1, 2, 3, 4]] },
    description: "All seven classical planets fall in the four houses from the 1st to the 4th, each occupied -- the sacrificial post.",
    effects: "Turns the chart inward onto self, family and home. Duty and ritual matter; self-restraint is natural and costs something in ambition.",
    activation_timing: "family obligations, ancestral duties, and the periods of the 1st to 4th lords",
    key_traits: ["duty", "restraint", "family"],
  },
  {
    id: "shara", name: "Shara Yoga", sanskrit: "शर योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "houseGroups", groups: [[4, 5, 6, 7]] },
    description: "All seven classical planets fall in the four houses from the 4th to the 7th, each occupied -- the arrow.",
    effects: "Gives a pointed, competitive streak and work that involves aiming at a target. Conflict is met rather than avoided.",
    activation_timing: "competitive stretches, disputes, and Mars periods",
    key_traits: ["aim", "competition", "sharpness"],
  },
  {
    id: "shakti_nabhasa", name: "Shakti Yoga", sanskrit: "शक्ति योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "houseGroups", groups: [[7, 8, 9, 10]] },
    description: "All seven classical planets fall in the four houses from the 7th to the 10th, each occupied -- the spear.",
    effects: "Slower to start and stronger later. Early means are limited, endurance is high, and standing is built rather than inherited.",
    activation_timing: "the second half of life, and the periods of the 9th and 10th lords",
    key_traits: ["endurance", "late strength", "resolve"],
  },
  {
    id: "danda", name: "Danda Yoga", sanskrit: "दण्ड योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "houseGroups", groups: [[10, 11, 12, 1]] },
    description: "All seven classical planets fall in the four houses from the 10th to the 1st, each occupied -- the staff.",
    effects: "Work and its costs dominate. Service to others is constant, and separation from family or home is a recurring theme.",
    activation_timing: "relocation for work, and the periods of the 10th and 12th lords",
    key_traits: ["service", "separation", "obligation"],
  },
  {
    id: "nauka", name: "Nauka Yoga", sanskrit: "नौका योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "houseGroups", groups: [[1, 2, 3, 4, 5, 6, 7]] },
    description: "The seven classical planets occupy the seven houses from the 1st to the 7th, one in each -- the boat.",
    effects: "Gives wide but shallow reach: several sources of income, much movement, and gains that come through trade or travel.",
    activation_timing: "trading stretches, travel years, and the periods of planets in the eastern half of the chart",
    key_traits: ["breadth", "trade", "mobility"],
  },
  {
    id: "koota", name: "Koota Yoga", sanskrit: "कूट योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "houseGroups", groups: [[4, 5, 6, 7, 8, 9, 10]] },
    description: "The seven classical planets occupy the seven houses from the 4th to the 10th, one in each -- the peak.",
    effects: "Gives guardedness and skill at holding a position. Work in security, custody or enforcement suits; candour does not come easily.",
    activation_timing: "stretches of confinement or heavy responsibility, and Saturn periods",
    key_traits: ["guardedness", "custody", "strategy"],
  },
  {
    id: "chhatra", name: "Chhatra Yoga", sanskrit: "छत्र योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "houseGroups", groups: [[7, 8, 9, 10, 11, 12, 1]] },
    description: "The seven classical planets occupy the seven houses from the 7th to the 1st, one in each -- the parasol.",
    effects: "Gives protection that lasts the whole life and strengthens at both ends. Kindness to dependants is marked, and support arrives from those in authority.",
    activation_timing: "stretches under a patron or an institution, and the periods of the 9th and 11th lords",
    key_traits: ["protection", "patronage", "kindness"],
  },
  {
    id: "chapa", name: "Chapa Yoga", sanskrit: "चाप योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "houseGroups", groups: [[10, 11, 12, 1, 2, 3, 4]] },
    description: "The seven classical planets occupy the seven houses from the 10th to the 4th, one in each -- the bow.",
    effects: "Gives skill with tools, vehicles and instruments, and a life spent partly away from home. Fortune is uneven but recovers.",
    activation_timing: "travel and posting years, and the periods of the 3rd and 12th lords",
    key_traits: ["skill", "travel", "recovery"],
  },
  {
    id: "ardha_chandra", name: "Ardha Chandra Yoga", sanskrit: "अर्धचन्द्र योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: {
      kind: "houseGroups",
      groups: [
        [2, 3, 4, 5, 6, 7, 8], [3, 4, 5, 6, 7, 8, 9], [5, 6, 7, 8, 9, 10, 11],
        [6, 7, 8, 9, 10, 11, 12], [8, 9, 10, 11, 12, 1, 2], [9, 10, 11, 12, 1, 2, 3],
        [11, 12, 1, 2, 3, 4, 5], [12, 1, 2, 3, 4, 5, 6],
      ],
    },
    description: "The seven classical planets occupy seven consecutive houses beginning from a house that is not an angle, one in each -- the half moon.",
    effects: "Gives a well-made appearance, physical strength, and the kind of command that is granted rather than seized.",
    activation_timing: "stretches of visible leadership, and the periods of the planets at either end of the run",
    key_traits: ["command", "strength", "grace"],
  },
  {
    id: "chakra", name: "Chakra Yoga", sanskrit: "चक्र योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "houseGroups", groups: [[1, 3, 5, 7, 9, 11]] },
    description: "All seven classical planets fall in the odd houses from the ascendant -- 1, 3, 5, 7, 9 and 11 -- every one occupied, drawing the wheel.",
    effects: "The most exalted of the wheel figures: authority over others, wide recognition, and a position that people organise themselves around.",
    activation_timing: "trine-lord periods, and the stretches that confer formal authority",
    key_traits: ["authority", "recognition", "centrality"],
  },
  {
    id: "samudra", name: "Samudra Yoga", sanskrit: "समुद्र योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "houseGroups", groups: [[2, 4, 6, 8, 10, 12]] },
    description: "All seven classical planets fall in the even houses from the ascendant -- 2, 4, 6, 8, 10 and 12 -- every one occupied, the ocean.",
    effects: "Gives depth of resource and an even temperament. Means are broad and steady rather than spectacular, and generosity is habitual.",
    activation_timing: "the periods of the 2nd and 4th lords, and long stretches of steady accumulation",
    key_traits: ["depth", "steadiness", "generosity"],
  },

  // ── Sankhya (7): how many signs hold the seven ──
  {
    id: "gola", name: "Gola Yoga", sanskrit: "गोल योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "signCount", count: 1 },
    description: "All seven classical planets occupy a single sign.",
    effects: "Everything the chart has is spent in one direction. Focus is absolute and range is not; means are usually modest and learning narrow but deep.",
    activation_timing: "the period of any planet in the occupied sign, which is to say most of the life",
    key_traits: ["singularity", "focus", "narrowness"],
  },
  {
    id: "yuga_nabhasa", name: "Yuga Yoga", sanskrit: "युग योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "signCount", count: 2 },
    description: "The seven classical planets are confined to two signs.",
    effects: "Life divides cleanly into two halves or two fields, and it is rare to be equally at home in both. Received opinion sits uneasily.",
    activation_timing: "the turn between the two groups of periods, often a single decisive year",
    key_traits: ["division", "contrast", "dissent"],
  },
  {
    id: "shula", name: "Shula Yoga", sanskrit: "शूल योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "signCount", count: 3 },
    description: "The seven classical planets are confined to three signs.",
    effects: "Gives a sharp, pointed nature: quick to engage, hard to deflect, effective in any work that rewards a direct approach.",
    activation_timing: "contested stretches, and the periods of planets in the most crowded of the three signs",
    key_traits: ["sharpness", "force", "directness"],
  },
  {
    id: "pasa", name: "Pasa Yoga", sanskrit: "पाश योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "signCount", count: 5 },
    description: "The seven classical planets are spread across five signs.",
    effects: "Gives a wide net of people and obligations -- many dependants and many claims. Skill at binding others into a common purpose is real, and so is the difficulty of getting free of it.",
    activation_timing: "stretches of expanding responsibility, and the periods of the 11th and 6th lords",
    key_traits: ["network", "obligation", "entanglement"],
  },
  {
    id: "damini", name: "Damini Yoga", sanskrit: "दामिनी योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "signCount", count: 6 },
    description: "The seven classical planets are spread across six signs.",
    effects: "Gives wide holdings and a habit of giving -- cattle and land in the old reading, many interests in the modern one. Charity is a settled disposition rather than an occasional act.",
    activation_timing: "the periods of the 2nd, 4th and 11th lords, and stretches of acquisition",
    key_traits: ["abundance", "charity", "breadth"],
  },
  {
    id: "veena", name: "Veena Yoga", sanskrit: "वीणा योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "signCount", count: 7 },
    description: "The seven classical planets occupy seven different signs, one in each -- the widest possible spread.",
    effects: "Gives range: several skills, an ear for music and pattern, and a life with more than one genuine vocation in it.",
    activation_timing: "successive periods each opening a different field, rather than one decisive stretch",
    key_traits: ["versatility", "artistry", "range"],
  },
];

// --------------------------------------------------------------------------
// Parivartana yogas -- exchanges between house lords
// --------------------------------------------------------------------------
/*
 * Mantreswara sorts the 66 possible exchanges into three classes, and the
 * class is decided entirely by which houses are involved:
 *
 *   Maha    both lords belong to the eight good houses (1, 2, 4, 5, 7, 9,
 *           10, 11). 28 pairs. Read as straightforwardly favourable.
 *   Khala   the 3rd lord exchanges with one of those eight. 8 pairs. Mixed:
 *           effort is rewarded, but unevenly.
 *   Dainya  at least one of the six, eight or twelve is involved. 30 pairs.
 *           The difficult class, and the one where the repo already carries
 *           the 6-12 exchange as a viparita result rather than a plain loss.
 *
 * Eight exchanges already exist above. These are the rest of the ones worth
 * printing -- the exchange is a real and fairly common configuration, so the
 * cut is about which ones say something a reader can act on, not about which
 * ones are valid.
 */

const PARIVARTANA_SOURCE = "Phaladeepika (parivartana: Maha, Khala and Dainya classes)";

const CLASSICAL_MUTUAL_LORD_RECIPES: MutualHouseLordRecipe[] = [
  // ── Maha parivartana ──
  { id: "lagna_sukha_parivartana", name: "Lagna-Sukha Parivartana Yoga", sanskrit: "लग्न-सुख परिवर्तन", category: "benefic", houseA: 1, houseB: 4, source: PARIVARTANA_SOURCE,
    description: "The 1st and 4th lords exchange houses.", effects: "Ties who you are to where you live. Home, land and family become the ground your confidence stands on, and a settled base is worth more to you than most people assume.", activation_timing: "moves, property decisions, and the periods of the 1st and 4th lords", key_traits: ["rootedness", "belonging", "security"] },
  { id: "lagna_vidya_parivartana", name: "Lagna-Vidya Parivartana Yoga", sanskrit: "लग्न-विद्या परिवर्तन", category: "benefic", houseA: 1, houseB: 5, source: PARIVARTANA_SOURCE,
    description: "The 1st and 5th lords exchange houses.", effects: "What you make is read as who you are. Creative work, teaching and children carry your identity, and recognition tends to arrive through something you produced rather than a post you held.", activation_timing: "creative projects, the birth or raising of children, and the periods of the 1st and 5th lords", key_traits: ["creativity", "self-expression", "recognition"] },
  { id: "lagna_yuvati_parivartana", name: "Lagna-Yuvati Parivartana Yoga", sanskrit: "लग्न-युवति परिवर्तन", category: "benefic", houseA: 1, houseB: 7, source: PARIVARTANA_SOURCE,
    description: "The 1st and 7th lords exchange houses.", effects: "Identity and partnership are hard to separate. You define yourself through the people you commit to, which makes partnership unusually decisive for better and worse.", activation_timing: "marriage, business partnerships, and the periods of the 1st and 7th lords", key_traits: ["partnership", "reciprocity", "dependence"] },
  { id: "lagna_bhagya_parivartana", name: "Lagna-Bhagya Parivartana Yoga", sanskrit: "लग्न-भाग्य परिवर्तन", category: "wealth", houseA: 1, houseB: 9, source: PARIVARTANA_SOURCE,
    description: "The 1st and 9th lords exchange houses.", effects: "One of the strongest exchanges. Luck attaches to the person rather than the circumstance: doors open, mentors appear, and long odds come in more often than they should.", activation_timing: "periods of the 1st and 9th lords, higher study, and long journeys", key_traits: ["fortune", "guidance", "conviction"] },
  { id: "lagna_karma_parivartana", name: "Lagna-Karma Parivartana Yoga", sanskrit: "लग्न-कर्म परिवर्तन", category: "wealth", houseA: 1, houseB: 10, source: PARIVARTANA_SOURCE,
    description: "The 1st and 10th lords exchange houses.", effects: "Your work is your name. Standing is built personally rather than institutionally, which makes reputation portable and also makes it yours to lose.", activation_timing: "promotions, changes of profession, and the periods of the 1st and 10th lords", key_traits: ["standing", "ambition", "visibility"] },
  { id: "lagna_labha_parivartana", name: "Lagna-Labha Parivartana Yoga", sanskrit: "लग्न-लाभ परिवर्तन", category: "wealth", houseA: 1, houseB: 11, source: PARIVARTANA_SOURCE,
    description: "The 1st and 11th lords exchange houses.", effects: "Gains follow from being yourself in public. Networks form around you rather than being joined, and income tends to arrive through people who already know your name.", activation_timing: "periods of the 1st and 11th lords, and stretches of widening social reach", key_traits: ["gain", "network", "influence"] },
  { id: "dhana_sukha_parivartana", name: "Dhana-Sukha Parivartana Yoga", sanskrit: "धन-सुख परिवर्तन", category: "wealth", houseA: 2, houseB: 4, source: PARIVARTANA_SOURCE,
    description: "The 2nd and 4th lords exchange houses.", effects: "Money turns into property and property back into money. Savings tend to take physical form -- a house, land, things kept rather than spent.", activation_timing: "property purchases, inheritance, and the periods of the 2nd and 4th lords", key_traits: ["assets", "thrift", "domestic comfort"] },
  { id: "dhana_vidya_parivartana", name: "Dhana-Vidya Parivartana Yoga", sanskrit: "धन-विद्या परिवर्तन", category: "wealth", houseA: 2, houseB: 5, source: PARIVARTANA_SOURCE,
    description: "The 2nd and 5th lords exchange houses.", effects: "Earning follows from something you made or knew first. Speculation, teaching and creative work pay, and the family's resources often back the first venture.", activation_timing: "creative ventures, investments, and the periods of the 2nd and 5th lords", key_traits: ["earning", "invention", "speculation"] },
  { id: "dhana_bhagya_parivartana", name: "Dhana-Bhagya Parivartana Yoga", sanskrit: "धन-भाग्य परिवर्तन", category: "wealth", houseA: 2, houseB: 9, source: PARIVARTANA_SOURCE,
    description: "The 2nd and 9th lords exchange houses.", effects: "Wealth and good fortune reinforce each other, often through family, teachers or a tradition you were handed. Generosity with money tends to return more than it costs.", activation_timing: "inheritance, patronage, and the periods of the 2nd and 9th lords", key_traits: ["prosperity", "patronage", "generosity"] },
  { id: "dhana_karma_parivartana", name: "Dhana-Karma Parivartana Yoga", sanskrit: "धन-कर्म परिवर्तन", category: "wealth", houseA: 2, houseB: 10, source: PARIVARTANA_SOURCE,
    description: "The 2nd and 10th lords exchange houses.", effects: "Income and profession are the same engine. Career decisions are also money decisions, and the surest route to more of one is more of the other.", activation_timing: "salary negotiations, career moves, and the periods of the 2nd and 10th lords", key_traits: ["income", "profession", "practicality"] },
  { id: "sukha_vidya_parivartana", name: "Sukha-Vidya Parivartana Yoga", sanskrit: "सुख-विद्या परिवर्तन", category: "benefic", houseA: 4, houseB: 5, source: PARIVARTANA_SOURCE,
    description: "The 4th and 5th lords exchange houses.", effects: "Home is where the making happens. Study, creative work and children are bound up with the household, and a settled domestic base is what unlocks the rest.", activation_timing: "study at home, raising children, and the periods of the 4th and 5th lords", key_traits: ["learning", "nurture", "domestic creativity"] },
  { id: "sukha_bhagya_parivartana", name: "Sukha-Bhagya Parivartana Yoga", sanskrit: "सुख-भाग्य परिवर्तन", category: "wealth", houseA: 4, houseB: 9, source: PARIVARTANA_SOURCE,
    description: "The 4th and 9th lords exchange houses.", effects: "Fortune arrives through roots -- family, land, an inherited belief or a place you came from. Moving far from that source tends to cost more than it gains.", activation_timing: "property and ancestral matters, pilgrimage, and the periods of the 4th and 9th lords", key_traits: ["inheritance", "faith", "place"] },
  { id: "sukha_karma_parivartana", name: "Sukha-Karma Parivartana Yoga", sanskrit: "सुख-कर्म परिवर्तन", category: "wealth", houseA: 4, houseB: 10, source: PARIVARTANA_SOURCE,
    description: "The 4th and 10th lords exchange houses.", effects: "Home and career trade places repeatedly: working from home, a family business, or a profession that keeps relocating the household. Neither settles without the other.", activation_timing: "relocations for work, and the periods of the 4th and 10th lords", key_traits: ["balance", "relocation", "family enterprise"] },
  { id: "vidya_karma_parivartana", name: "Vidya-Karma Parivartana Yoga", sanskrit: "विद्या-कर्म परिवर्तन", category: "wealth", houseA: 5, houseB: 10, source: PARIVARTANA_SOURCE,
    description: "The 5th and 10th lords exchange houses.", effects: "You are paid for what you invent. Career advances through original work rather than seniority, and the best professional years follow a creative risk rather than precede one.", activation_timing: "launches, publications, and the periods of the 5th and 10th lords", key_traits: ["originality", "advancement", "risk"] },
  { id: "vidya_labha_parivartana", name: "Vidya-Labha Parivartana Yoga", sanskrit: "विद्या-लाभ परिवर्तन", category: "wealth", houseA: 5, houseB: 11, source: PARIVARTANA_SOURCE,
    description: "The 5th and 11th lords exchange houses.", effects: "Creative work converts directly into gain and into a following. Audiences, students and communities form around what you make.", activation_timing: "the periods of the 5th and 11th lords, and stretches when an audience grows", key_traits: ["audience", "return", "invention"] },
  { id: "yuvati_karma_parivartana", name: "Yuvati-Karma Parivartana Yoga", sanskrit: "युवति-कर्म परिवर्तन", category: "wealth", houseA: 7, houseB: 10, source: PARIVARTANA_SOURCE,
    description: "The 7th and 10th lords exchange houses.", effects: "Career runs on partnership: a co-founder, a spouse who is also a colleague, or clients who become collaborators. Working alone underperforms the chart.", activation_timing: "partnership agreements, joint ventures, and the periods of the 7th and 10th lords", key_traits: ["collaboration", "negotiation", "joint work"] },
  { id: "bhagya_labha_parivartana", name: "Bhagya-Labha Parivartana Yoga", sanskrit: "भाग्य-लाभ परिवर्तन", category: "wealth", houseA: 9, houseB: 11, source: PARIVARTANA_SOURCE,
    description: "The 9th and 11th lords exchange houses.", effects: "Luck and gain feed each other. Mentors turn into opportunities and opportunities into income, often through a wider circle than the immediate one.", activation_timing: "the periods of the 9th and 11th lords, and stretches of travel or higher study", key_traits: ["opportunity", "mentorship", "gain"] },
  { id: "sukha_labha_parivartana", name: "Sukha-Labha Parivartana Yoga", sanskrit: "सुख-लाभ परिवर्तन", category: "wealth", houseA: 4, houseB: 11, source: PARIVARTANA_SOURCE,
    description: "The 4th and 11th lords exchange houses.", effects: "Comfort and income are linked: gains go into the home, and the home is itself a source of gain. Vehicles and property feature more than average.", activation_timing: "property and vehicle purchases, and the periods of the 4th and 11th lords", key_traits: ["comfort", "acquisition", "provision"] },

  // ── Khala parivartana -- the 3rd lord's exchanges ──
  { id: "parakrama_labha_parivartana", name: "Parakrama-Labha Parivartana Yoga", sanskrit: "पराक्रम-लाभ परिवर्तन", category: "benefic", houseA: 3, houseB: 11, source: PARIVARTANA_SOURCE,
    description: "The 3rd and 11th lords exchange houses -- a Khala exchange, where effort and gain are tied together but unevenly.", effects: "Gains come from initiative rather than position: self-started work, side ventures, siblings and peers. Rewards are real but arrive in steps rather than at once.", activation_timing: "the periods of the 3rd and 11th lords, and stretches of independent effort", key_traits: ["initiative", "enterprise", "incremental gain"] },

  // ── Dainya parivartana -- one lord from the difficult houses ──
  { id: "lagna_shatru_parivartana", name: "Lagna-Shatru Parivartana Yoga", sanskrit: "लग्न-शत्रु परिवर्तन", category: "viparita", houseA: 1, houseB: 6, source: PARIVARTANA_SOURCE,
    description: "The 1st and 6th lords exchange houses -- a Dainya exchange, read here as the viparita case rather than a plain loss.", effects: "You are defined partly by what you are up against. Health, debts and rivals demand attention early, and the competence built in handling them becomes the thing you are known for.", activation_timing: "the periods of the 1st and 6th lords, and stretches of open competition", key_traits: ["struggle", "competence", "endurance"] },
  { id: "lagna_vyaya_parivartana", name: "Lagna-Vyaya Parivartana Yoga", sanskrit: "लग्न-व्यय परिवर्तन", category: "viparita", houseA: 1, houseB: 12, source: PARIVARTANA_SOURCE,
    description: "The 1st and 12th lords exchange houses -- a Dainya exchange touching identity and release.", effects: "Identity is bound up with what is given away, withdrawn from or done elsewhere. Foreign places, solitude and behind-the-scenes work suit better than the front of the room.", activation_timing: "the periods of the 1st and 12th lords, foreign residence, and retreats", key_traits: ["retreat", "detachment", "foreign ground"] },
  { id: "dhana_randhra_parivartana", name: "Dhana-Randhra Parivartana Yoga", sanskrit: "धन-रन्ध्र परिवर्तन", category: "viparita", houseA: 2, houseB: 8, source: PARIVARTANA_SOURCE,
    description: "The 2nd and 8th lords exchange houses -- the classic Dainya exchange on the money axis.", effects: "Earned money and other people's money keep changing places: inheritance, joint accounts, insurance, debt. Fortunes shift suddenly in both directions, and what arrives unearned rarely stays unexamined.", activation_timing: "inheritance, settlements, and the periods of the 2nd and 8th lords", key_traits: ["upheaval", "inheritance", "reversal"] },
];

// --------------------------------------------------------------------------
// House-lord placements -- the bhava-phala material
// --------------------------------------------------------------------------
/*
 * The classical texts spend their longest chapters on one question: what
 * happens when the lord of house X sits in house Y. Nine of these are the
 * simplest and strongest case -- a lord in its own house, which every text
 * treats as a plain statement of that department working. The other six are
 * the cross-placements that carry a named, specific result.
 */

const BHAVA_PHALA_SOURCE = "BPHS bhava-phala chapters; Phaladeepika (effects of the house lords in the twelve houses)";

const CLASSICAL_HOUSE_LORD_RECIPES: HouseLordPlacementRecipe[] = [
  { id: "lagna_lord_own_house", name: "Lagna Swagruhi Yoga", sanskrit: "लग्न स्वगृही योग", category: "benefic", fromHouse: 1, targetHouses: [1], source: BHAVA_PHALA_SOURCE,
    description: "The 1st lord occupies the 1st house.", effects: "Self-possession that does not need propping up. Health and constitution are sound, and the sense of who you are stays stable through changes that unsettle other people.", activation_timing: "the period of the 1st lord, and any stretch demanding a clear sense of self", key_traits: ["self-possession", "vitality", "steadiness"] },
  { id: "dhana_lord_own_house", name: "Dhana Swagruhi Yoga", sanskrit: "धन स्वगृही योग", category: "wealth", fromHouse: 2, targetHouses: [2], source: BHAVA_PHALA_SOURCE,
    description: "The 2nd lord occupies the 2nd house.", effects: "Money stays where it is put. Savings accumulate without drama, family resources hold, and speech carries a weight that helps in negotiation.", activation_timing: "the period of the 2nd lord, and stretches of consolidation", key_traits: ["savings", "stability", "articulacy"] },
  { id: "parakrama_lord_own_house", name: "Parakrama Swagruhi Yoga", sanskrit: "पराक्रम स्वगृही योग", category: "benefic", fromHouse: 3, targetHouses: [3], source: BHAVA_PHALA_SOURCE,
    description: "The 3rd lord occupies the 3rd house.", effects: "Nerve and initiative are reliable rather than occasional. Siblings and peers are a genuine resource, and self-started effort usually finds its footing.", activation_timing: "the period of the 3rd lord, and any stretch requiring you to start something alone", key_traits: ["courage", "initiative", "stamina"] },
  { id: "sukha_lord_own_house", name: "Sukha Swagruhi Yoga", sanskrit: "सुख स्वगृही योग", category: "benefic", fromHouse: 4, targetHouses: [4], source: BHAVA_PHALA_SOURCE,
    description: "The 4th lord occupies the 4th house.", effects: "A secure base: home, land and the people in it hold steady. Peace of mind is available at home in a way it is not everywhere else.", activation_timing: "the period of the 4th lord, property matters, and family stretches", key_traits: ["security", "comfort", "belonging"] },
  { id: "vidya_lord_own_house", name: "Vidya Swagruhi Yoga", sanskrit: "विद्या स्वगृही योग", category: "benefic", fromHouse: 5, targetHouses: [5], source: BHAVA_PHALA_SOURCE,
    description: "The 5th lord occupies the 5th house.", effects: "Intelligence and creative capacity work without being forced. Learning comes readily, judgement is sound, and children and creative work both go well.", activation_timing: "the period of the 5th lord, study, and creative projects", key_traits: ["intelligence", "creativity", "judgement"] },
  { id: "yuvati_lord_own_house", name: "Yuvati Swagruhi Yoga", sanskrit: "युवति स्वगृही योग", category: "benefic", fromHouse: 7, targetHouses: [7], source: BHAVA_PHALA_SOURCE,
    description: "The 7th lord occupies the 7th house.", effects: "Partnership holds its shape. Agreements stick, the spouse or business partner is a genuine counterweight, and negotiation is a strength rather than a chore.", activation_timing: "the period of the 7th lord, marriage, and contract negotiations", key_traits: ["partnership", "agreement", "balance"] },
  { id: "bhagya_lord_own_house", name: "Bhagya Swagruhi Yoga", sanskrit: "भाग्य स्वगृही योग", category: "wealth", fromHouse: 9, targetHouses: [9], source: BHAVA_PHALA_SOURCE,
    description: "The 9th lord occupies the 9th house.", effects: "Good fortune is structural rather than lucky. Teachers, father and belief all support rather than complicate, and long journeys tend to repay themselves.", activation_timing: "the period of the 9th lord, higher study, and long journeys", key_traits: ["fortune", "conviction", "guidance"] },
  { id: "karma_lord_own_house", name: "Karma Swagruhi Yoga", sanskrit: "कर्म स्वगृही योग", category: "wealth", fromHouse: 10, targetHouses: [10], source: BHAVA_PHALA_SOURCE,
    description: "The 10th lord occupies the 10th house.", effects: "Professional standing is solid and self-sustaining. Work is recognised on its merits, and authority once given is not easily taken back.", activation_timing: "the period of the 10th lord, and the stretches that set professional direction", key_traits: ["standing", "competence", "authority"] },
  { id: "labha_lord_own_house", name: "Labha Swagruhi Yoga", sanskrit: "लाभ स्वगृही योग", category: "wealth", fromHouse: 11, targetHouses: [11], source: BHAVA_PHALA_SOURCE,
    description: "The 11th lord occupies the 11th house.", effects: "Income arrives reliably and from more than one direction. Friendships and networks are durable, and what you ask for is usually granted.", activation_timing: "the period of the 11th lord, and stretches of widening contact", key_traits: ["gain", "network", "fulfilment"] },

  { id: "sukha_lord_karma", name: "Sukha-Karma Sthana Yoga", sanskrit: "सुख-कर्म स्थान योग", category: "wealth", fromHouse: 4, targetHouses: [10], source: BHAVA_PHALA_SOURCE,
    description: "The 4th lord occupies the 10th house.", effects: "The home life is carried into the working one: a family trade, a profession built on property or land, or work that visibly provides for the household.", activation_timing: "the period of the 4th lord, and career stretches involving property", key_traits: ["provision", "enterprise", "duty"] },
  { id: "karma_lord_sukha", name: "Karma-Sukha Sthana Yoga", sanskrit: "कर्म-सुख स्थान योग", category: "benefic", fromHouse: 10, targetHouses: [4], source: BHAVA_PHALA_SOURCE,
    description: "The 10th lord occupies the 4th house.", effects: "Work is conducted from home, or for the sake of it. Career ambitions are measured against domestic peace, and the chart is content to trade some of the first for the second.", activation_timing: "the period of the 10th lord, and stretches of working from a home base", key_traits: ["contentment", "home enterprise", "balance"] },
  { id: "bhagya_lord_vidya", name: "Bhagya-Vidya Sthana Yoga", sanskrit: "भाग्य-विद्या स्थान योग", category: "wealth", fromHouse: 9, targetHouses: [5], source: BHAVA_PHALA_SOURCE,
    description: "The 9th lord occupies the 5th house.", effects: "Fortune comes through learning and through children. Advice given is taken, teaching pays, and the second half of life is the better half.", activation_timing: "the period of the 9th lord, teaching work, and matters concerning children", key_traits: ["wisdom", "merit", "teaching"] },
  { id: "vidya_lord_bhagya_placement", name: "Vidya-Bhagya Sthana Yoga", sanskrit: "विद्या-भाग्य स्थान योग", category: "wealth", fromHouse: 5, targetHouses: [9], source: BHAVA_PHALA_SOURCE,
    description: "The 5th lord occupies the 9th house.", effects: "What you make carries further than expected. Creative and intellectual work finds an audience beyond its origin, often abroad or across a generation.", activation_timing: "the period of the 5th lord, publication, and long journeys", key_traits: ["reach", "merit", "recognition"] },
  { id: "labha_lord_dhana", name: "Labha-Dhana Sthana Yoga", sanskrit: "लाभ-धन स्थान योग", category: "wealth", fromHouse: 11, targetHouses: [2], source: BHAVA_PHALA_SOURCE,
    description: "The 11th lord occupies the 2nd house.", effects: "Gains convert straight into holdings rather than being spent on the way. Income from several directions collects in one place.", activation_timing: "the period of the 11th lord, and stretches of consolidation", key_traits: ["accumulation", "income", "consolidation"] },
  { id: "dhana_lord_bhagya", name: "Dhana-Bhagya Sthana Yoga", sanskrit: "धन-भाग्य स्थान योग", category: "wealth", fromHouse: 2, targetHouses: [9], source: BHAVA_PHALA_SOURCE,
    description: "The 2nd lord occupies the 9th house.", effects: "Money follows belief and mentorship. Resources arrive through teachers, family tradition or work done far from home, and giving some of it away is part of how it grows.", activation_timing: "the period of the 2nd lord, patronage, and long journeys", key_traits: ["patronage", "prosperity", "generosity"] },
];

// --------------------------------------------------------------------------
// Directional strength and classical single-planet placements
// --------------------------------------------------------------------------
/*
 * Digbala -- directional strength -- is the oldest single-planet rule in the
 * system and the least ambiguous: each planet has one house where it is at
 * full power, and the four answers pair up. Mercury and Jupiter are strongest
 * rising, the Sun and Mars at the midheaven, the Moon and Venus at the nadir,
 * Saturn setting. Seven records, one per planet, plus four placements that
 * carry a distinct classical result of their own.
 */

const DIGBALA_SOURCE = "BPHS (Digbala, directional strength); Saravali";

const CLASSICAL_PLANET_HOUSE_RECIPES: PlanetHouseRecipe[] = [
  { id: "budha_digbala", name: "Budha Digbala Yoga", sanskrit: "बुध दिग्बल योग", category: "benefic", planet: "Mercury", targetHouses: [1], source: DIGBALA_SOURCE,
    description: "Mercury occupies the 1st house, its place of directional strength.", effects: "Thinking and speaking are the chart's sharpest instruments. Quick comprehension, fluency under pressure, and a manner that reads as younger than the age.", activation_timing: "Mercury periods, examinations, negotiations, and any work built on explanation", key_traits: ["intellect", "fluency", "quickness"] },
  { id: "guru_digbala", name: "Guru Digbala Yoga", sanskrit: "गुरु दिग्बल योग", category: "benefic", planet: "Jupiter", targetHouses: [1], source: DIGBALA_SOURCE,
    description: "Jupiter occupies the 1st house, its place of directional strength.", effects: "Protection that shows up in the person rather than the circumstances. Optimism, a settled moral sense, and the benefit of the doubt from people who barely know you.", activation_timing: "Jupiter periods, and stretches where reputation or goodwill decides the outcome", key_traits: ["protection", "optimism", "good faith"] },
  { id: "surya_digbala", name: "Surya Digbala Yoga", sanskrit: "सूर्य दिग्बल योग", category: "wealth", planet: "Sun", targetHouses: [10], source: DIGBALA_SOURCE,
    description: "The Sun occupies the 10th house, its place of directional strength.", effects: "Authority in the working life is the chart's clearest promise. Visible position, a name that carries, and the expectation of being in charge rather than consulted.", activation_timing: "Sun periods, promotions, and stretches of public responsibility", key_traits: ["authority", "visibility", "command"] },
  { id: "mangala_digbala", name: "Mangala Digbala Yoga", sanskrit: "मङ्गल दिग्बल योग", category: "wealth", planet: "Mars", targetHouses: [10], source: DIGBALA_SOURCE,
    description: "Mars occupies the 10th house, its place of directional strength.", effects: "Drive applied directly to work. Capacity for hard, technical or contested professions, and a habit of finishing what is started even when the cost rises.", activation_timing: "Mars periods, competitive appointments, and stretches of sustained effort", key_traits: ["drive", "execution", "competitiveness"] },
  { id: "chandra_digbala", name: "Chandra Digbala Yoga", sanskrit: "चन्द्र दिग्बल योग", category: "benefic", planet: "Moon", targetHouses: [4], source: DIGBALA_SOURCE,
    description: "The Moon occupies the 4th house, its place of directional strength.", effects: "Emotional footing is sound and home is genuinely restorative. Instinct about people is accurate, and the mother or the place you were raised remains a resource.", activation_timing: "Moon periods, domestic stretches, and any time the ground needs steadying", key_traits: ["contentment", "instinct", "nurture"] },
  { id: "shukra_digbala", name: "Shukra Digbala Yoga", sanskrit: "शुक्र दिग्बल योग", category: "benefic", planet: "Venus", targetHouses: [4], source: DIGBALA_SOURCE,
    description: "Venus occupies the 4th house, its place of directional strength.", effects: "Comfort and beauty gather at home: pleasant surroundings, vehicles, a household people want to be in. Taste is a real asset rather than a decoration.", activation_timing: "Venus periods, property and vehicle purchases, and domestic improvement", key_traits: ["comfort", "taste", "ease"] },
  { id: "shani_digbala", name: "Shani Digbala Yoga", sanskrit: "शनि दिग्बल योग", category: "benefic", planet: "Saturn", targetHouses: [7], source: DIGBALA_SOURCE,
    description: "Saturn occupies the 7th house, its place of directional strength.", effects: "Commitments are entered slowly and kept. Partnership matures late and lasts, and agreements carry a seriousness other people rely on.", activation_timing: "Saturn periods, long contracts, and marriage later rather than earlier", key_traits: ["durability", "commitment", "patience"] },

  { id: "guru_dhana_sthana", name: "Guru Dhana Sthana Yoga", sanskrit: "गुरु धन स्थान योग", category: "wealth", planet: "Jupiter", targetHouses: [2], source: BHAVA_PHALA_SOURCE,
    description: "Jupiter occupies the 2nd house.", effects: "Resources expand rather than merely accumulate, and speech carries authority. Family wealth and learning tend to arrive together.", activation_timing: "Jupiter periods, and stretches of family or financial expansion", key_traits: ["abundance", "authority", "learning"] },
  { id: "shukra_vyaya_sthana", name: "Shukra Vyaya Sthana Yoga", sanskrit: "शुक्र व्यय स्थान योग", category: "benefic", planet: "Venus", targetHouses: [12], source: BHAVA_PHALA_SOURCE,
    description: "Venus occupies the 12th house -- counted a strong placement for Venus specifically, where the same house weakens most planets.", effects: "Pleasure in solitude, in foreign places, and in what is given away. Private life is richer than the public one, and comfort abroad comes easily.", activation_timing: "Venus periods, foreign residence, and retreats", key_traits: ["privacy", "indulgence", "foreign comfort"] },
  { id: "chandra_bhagya_sthana", name: "Chandra Bhagya Sthana Yoga", sanskrit: "चन्द्र भाग्य स्थान योग", category: "benefic", planet: "Moon", targetHouses: [9], source: BHAVA_PHALA_SOURCE,
    description: "The Moon occupies the 9th house.", effects: "Belief is felt rather than argued. Long journeys settle the mind, teachers are found at the right moment, and the instinct about which direction to take is usually right.", activation_timing: "Moon periods, pilgrimage and long journeys, and stretches of study", key_traits: ["faith", "instinct", "journeying"] },
  { id: "guru_labha_sthana", name: "Guru Labha Sthana Yoga", sanskrit: "गुरु लाभ स्थान योग", category: "wealth", planet: "Jupiter", targetHouses: [11], source: BHAVA_PHALA_SOURCE,
    description: "Jupiter occupies the 11th house.", effects: "Gains arrive steadily and from people who mean well. Elder friends and patrons matter, and what is asked for is usually granted in some form.", activation_timing: "Jupiter periods, and stretches when a network widens", key_traits: ["gain", "patronage", "fulfilment"] },
];

// --------------------------------------------------------------------------
// Two-planet combinations
// --------------------------------------------------------------------------
/*
 * Saravali works through the pairs systematically -- what it means when any
 * two grahas share a sign. Five of those pairs are already above; these are
 * eleven more, including the two the tradition treats as genuinely difficult
 * rather than merely mixed (Moon with Saturn, Jupiter with Rahu).
 */

const CONJUNCTION_SOURCE = "Saravali (results of two planets in conjunction); BPHS";

const CLASSICAL_CONJUNCTION_RECIPES: ConjunctionRecipe[] = [
  { id: "surya_shani_yoga", name: "Surya-Shani Yoga", sanskrit: "सूर्य-शनि योग", category: "challenging", planets: ["Sun", "Saturn"], source: CONJUNCTION_SOURCE,
    description: "The Sun and Saturn are conjunct.", effects: "Authority and restraint pull against each other. Recognition comes late and has to be earned twice; the compensation is a capacity for responsibility that younger people do not have.", activation_timing: "Sun and Saturn periods, and stretches involving fathers, superiors or delayed recognition", key_traits: ["restraint", "delay", "responsibility"] },
  { id: "surya_guru_yoga", name: "Surya-Guru Yoga", sanskrit: "सूर्य-गुरु योग", category: "benefic", planets: ["Sun", "Jupiter"], source: CONJUNCTION_SOURCE,
    description: "The Sun and Jupiter are conjunct.", effects: "Standing and principle reinforce each other. Advice is sought, positions of trust arrive, and authority is exercised with a light enough hand to be accepted.", activation_timing: "Sun and Jupiter periods, advisory appointments, and teaching work", key_traits: ["integrity", "counsel", "standing"] },
  { id: "chandra_budha_yoga", name: "Chandra-Budha Yoga", sanskrit: "चन्द्र-बुध योग", category: "benefic", planets: ["Moon", "Mercury"], source: CONJUNCTION_SOURCE,
    description: "The Moon and Mercury are conjunct.", effects: "Feeling and articulation work together. What is sensed can be said, which makes for persuasive writing and speech and an unusually accurate read on a room.", activation_timing: "Moon and Mercury periods, writing and speaking work, and negotiations", key_traits: ["expression", "perception", "wit"] },
  { id: "chandra_shukra_yoga", name: "Chandra-Shukra Yoga", sanskrit: "चन्द्र-शुक्र योग", category: "benefic", planets: ["Moon", "Venus"], source: CONJUNCTION_SOURCE,
    description: "The Moon and Venus are conjunct.", effects: "Warmth that people are drawn to. Aesthetic instinct is strong, domestic life is pleasant, and affection is given freely enough to be returned.", activation_timing: "Moon and Venus periods, and stretches of domestic or artistic focus", key_traits: ["charm", "affection", "artistry"] },
  { id: "chandra_shani_yoga", name: "Chandra-Shani Yoga", sanskrit: "चन्द्र-शनि योग", category: "challenging", planets: ["Moon", "Saturn"], source: CONJUNCTION_SOURCE,
    description: "The Moon and Saturn are conjunct -- the combination the tradition calls Punarphoo.", effects: "A serious cast of mind and a habit of expecting less than is on offer. Decisions get revisited and commitments deferred; what it buys is realism and staying power once a choice is finally made.", activation_timing: "Moon and Saturn periods, and stretches where a decision is repeatedly postponed", key_traits: ["gravity", "hesitation", "realism"] },
  { id: "mangala_budha_yoga", name: "Mangala-Budha Yoga", sanskrit: "मङ्गल-बुध योग", category: "benefic", planets: ["Mars", "Mercury"], source: CONJUNCTION_SOURCE,
    description: "Mars and Mercury are conjunct.", effects: "Thinking with an edge on it: argument, debate, engineering, surgery, anything that rewards a quick mind used decisively. Sharpness in speech is worth watching.", activation_timing: "Mars and Mercury periods, technical work, and disputes", key_traits: ["acuity", "argument", "technical skill"] },
  { id: "mangala_shani_yoga", name: "Mangala-Shani Yoga", sanskrit: "मङ्गल-शनि योग", category: "challenging", planets: ["Mars", "Saturn"], source: CONJUNCTION_SOURCE,
    description: "Mars and Saturn are conjunct.", effects: "Drive and restriction in the same place: effort meets resistance, and frustration is the recurring note. The compensation is real -- hard, dangerous or grinding work gets done that others abandon.", activation_timing: "Mars and Saturn periods, and stretches of obstructed effort", key_traits: ["friction", "persistence", "hard work"] },
  { id: "guru_shani_yoga", name: "Guru-Shani Yoga", sanskrit: "गुरु-शनि योग", category: "benefic", planets: ["Jupiter", "Saturn"], source: CONJUNCTION_SOURCE,
    description: "Jupiter and Saturn are conjunct.", effects: "Expansion and discipline held together, which is rarer than either alone. Plans are large and also costed; growth is slow, structural and hard to reverse.", activation_timing: "Jupiter and Saturn periods, and the long build-out of an institution or practice", key_traits: ["structure", "prudence", "durability"] },
  { id: "guru_budha_yoga", name: "Guru-Budha Yoga", sanskrit: "गुरु-बुध योग", category: "benefic", planets: ["Jupiter", "Mercury"], source: CONJUNCTION_SOURCE,
    description: "Jupiter and Mercury are conjunct.", effects: "Breadth and precision in the same mind. Suited to scholarship, law, editing and advice -- work where being right and being clear are the same job.", activation_timing: "Jupiter and Mercury periods, study, publication, and advisory work", key_traits: ["scholarship", "clarity", "judgement"] },
  { id: "shukra_shani_yoga", name: "Shukra-Shani Yoga", sanskrit: "शुक्र-शनि योग", category: "benefic", planets: ["Venus", "Saturn"], source: CONJUNCTION_SOURCE,
    description: "Venus and Saturn are conjunct.", effects: "Affection is slow, deliberate and durable. Relationships form late and hold; taste runs to the spare and well-made rather than the abundant.", activation_timing: "Venus and Saturn periods, and commitments entered later than expected", key_traits: ["loyalty", "restraint", "craftsmanship"] },
  { id: "guru_chandala_yoga", name: "Guru-Chandala Yoga", sanskrit: "गुरु-चाण्डाल योग", category: "challenging", planets: ["Jupiter", "Rahu"], source: CONJUNCTION_SOURCE,
    description: "Jupiter and Rahu are conjunct -- the combination named Guru-Chandala.", effects: "Received wisdom is questioned rather than inherited, which cuts both ways: genuine originality in belief and learning, and a tendency to discard good advice along with bad. Teachers are outgrown quickly.", activation_timing: "Jupiter and Rahu periods, and stretches of breaking with a tradition or an institution", key_traits: ["unorthodoxy", "questioning", "restlessness"] },
];

// --------------------------------------------------------------------------
// Placements reckoned from a karaka
// --------------------------------------------------------------------------
/*
 * The same principle behind Sunapha, Anapha and Vesi: benefics and malefics
 * counted not from the ascendant but from the Sun or the Moon. Five more of
 * those, covering the cases the existing records leave out -- malefics
 * surrounding the Moon from the difficult houses, and the upachaya and
 * angular placements reckoned from each luminary.
 */

const KARAKA_RELATIVE_SOURCE = "BPHS and Saravali (benefic and malefic placements reckoned from the Sun and the Moon)";

const CLASSICAL_RELATIVE_RECIPES: RelativePlanetRecipe[] = [
  { id: "chandra_dusthana_papa", name: "Chandra Dusthana Papa Yoga", sanskrit: "चन्द्र दुःस्थान पाप योग", category: "challenging", basePlanet: "Moon", allowedPlanets: NATURAL_MALEFICS, relativeHouses: [6, 8, 12], minCount: 2, source: KARAKA_RELATIVE_SOURCE,
    description: "Two or more natural malefics occupy the 6th, 8th or 12th signs counted from the Moon.", effects: "The mind carries more weight than it shows. Worry is habitual and rest is hard to come by; the discipline that develops in response is genuine, but it is bought rather than given.", activation_timing: "the periods of the malefics involved, and stretches of sustained strain", key_traits: ["strain", "vigilance", "resilience"] },
  { id: "surya_kendra_shubha", name: "Surya Kendra Shubha Yoga", sanskrit: "सूर्य केन्द्र शुभ योग", category: "benefic", basePlanet: "Sun", allowedPlanets: NATURAL_BENEFICS, relativeHouses: [1, 4, 7, 10], minCount: 2, source: KARAKA_RELATIVE_SOURCE,
    description: "Two or more natural benefics occupy angular signs counted from the Sun.", effects: "Authority is cushioned by goodwill. Positions of responsibility come with allies attached, and the exercise of power attracts less resistance than it usually would.", activation_timing: "Sun periods, appointments, and stretches of public responsibility", key_traits: ["support", "standing", "goodwill"] },
  { id: "surya_upachaya_papa", name: "Surya Upachaya Papa Yoga", sanskrit: "सूर्य उपचय पाप योग", category: "benefic", basePlanet: "Sun", allowedPlanets: NATURAL_MALEFICS, relativeHouses: [3, 6, 11], minCount: 2, source: KARAKA_RELATIVE_SOURCE,
    description: "Two or more natural malefics occupy the 3rd, 6th or 11th signs counted from the Sun -- the growing houses, where malefics are read as an asset.", effects: "Difficulty is converted into capability. Rivals sharpen rather than obstruct, and the harder stretches of a career are the ones that end up paying.", activation_timing: "the periods of the malefics involved, and competitive stretches", key_traits: ["competitiveness", "grit", "advancement"] },
  { id: "chandra_upachaya_shubha", name: "Chandra Upachaya Shubha Yoga", sanskrit: "चन्द्र उपचय शुभ योग", category: "benefic", basePlanet: "Moon", allowedPlanets: NATURAL_BENEFICS, relativeHouses: [3, 6, 11], minCount: 2, source: KARAKA_RELATIVE_SOURCE,
    description: "Two or more natural benefics occupy the 3rd, 6th or 11th signs counted from the Moon.", effects: "Effort is met with help. Initiative attracts backing, and the people who turn up when something is being started tend to be the useful ones.", activation_timing: "the periods of the benefics involved, and stretches of independent effort", key_traits: ["encouragement", "enterprise", "gain"] },
  { id: "guru_kendra_shubha", name: "Guru Kendra Shubha Yoga", sanskrit: "गुरु केन्द्र शुभ योग", category: "benefic", basePlanet: "Jupiter", allowedPlanets: ["Mercury", "Venus", "Moon"], relativeHouses: [1, 4, 7, 10], minCount: 2, source: KARAKA_RELATIVE_SOURCE,
    description: "Two or more of Mercury, Venus and the Moon occupy angular signs counted from Jupiter.", effects: "Good judgement is kept company by the skills that make it useful -- articulacy, taste and instinct. Advice given is both sound and well received.", activation_timing: "Jupiter periods, advisory and teaching work, and stretches requiring persuasion", key_traits: ["judgement", "persuasion", "cultivation"] },
];

// --------------------------------------------------------------------------
// Named yogas written out in full
// --------------------------------------------------------------------------
/*
 * Six combinations that none of the recipe templates can express, because each
 * makes a claim about several houses at once with different conditions on each.
 *
 * The list is short on purpose. The literature names hundreds more, and the
 * famous ones that read the navamsa -- Kalpadruma, Parijata, Gauri, Bharathi
 * -- now have a section of their own below; they were added once it was clear
 * that calling the existing navamsa engine is not the same thing as
 * redefining a divisional chart here.
 */

function planetsInHouse(chart: YogaChartInput, house: number): PlanetPosition[] {
  return chart.planets.filter((planet) => planet.house === house);
}

function beneficsIn(chart: YogaChartInput, house: number): PlanetPosition[] {
  return planetsInHouse(chart, house).filter((planet) => NATURAL_BENEFICS.includes(planet.name));
}

function maleficsIn(chart: YogaChartInput, house: number): PlanetPosition[] {
  return planetsInHouse(chart, house).filter((planet) => NATURAL_MALEFICS.includes(planet.name));
}

const NAMED_CLASSICAL_YOGA_DEFINITIONS: YogaDefinition[] = [
  {
    id: "chatussagara",
    name: "Chatussagara Yoga",
    sanskrit: "चतुस्सागर योग",
    category: "wealth",
    source: "Jataka Parijata; Phaladeepika (all four angles occupied)",
    description: "All four angular houses -- the 1st, 4th, 7th and 10th -- are occupied by at least one planet each.",
    effects: "The four pillars of the chart all carry weight, so nothing important is left unsupported: self, home, partnership and work each have something standing in them.",
    detect: (chart) => {
      const angles = [1, 4, 7, 10];
      const occupants = angles.map((house) => planetsInHouse(chart, house));
      if (occupants.some((planets) => planets.length === 0)) return null;
      const involved = occupants.flat();
      return {
        yoga_id: "chatussagara",
        name: "Chatussagara Yoga",
        sanskrit: "चतुस्सागर योग",
        category: "wealth",
        present: true,
        strength: overallStrength(involved.map((planet) => planetStrength(planet.name, planet.sign))),
        involved_planets: uniquePlanetNames(involved),
        description: `All four angles are tenanted: ${angles.map((house, index) => `${ordinal(house)} by ${uniquePlanetNames(occupants[index]).join(", ")}`).join("; ")}.`,
        effects: "The four pillars of the chart all carry weight, so nothing important is left unsupported: self, home, partnership and work each have something standing in them. Reputation travels further than the circle it was earned in.",
        activation_timing: "the periods of the angular planets, which between them cover most of a life",
        key_traits: ["stability", "reach", "reputation"],
        source: "Jataka Parijata; Phaladeepika (all four angles occupied)",
        detailed_description: richYogaDetail(
          "Chatussagara Yoga",
          "Self, home, partnership and work each have a planet standing in them, so no pillar of the chart is left unsupported.",
          uniquePlanetNames(involved),
          "the periods of the angular planets",
          ["stability", "reach", "reputation"]
        ),
      };
    },
  },
  {
    id: "khadga",
    name: "Khadga Yoga",
    sanskrit: "खड्ग योग",
    category: "wealth",
    source: "Jataka Parijata; Phaladeepika (2nd and 9th lords exchanged, ascendant lord strong)",
    description: "The 2nd and 9th lords exchange houses while the 1st lord occupies an angle or a trine -- the exchange on its own is not enough.",
    effects: "Wealth and good fortune arrive together and are held by someone strong enough to keep them. Learning is broad, and the means to act on it are there.",
    detect: (chart) => {
      const second = houseLordPlanet(2, chart);
      const ninth = houseLordPlanet(9, chart);
      const first = houseLordPlanet(1, chart);
      if (!second.planet || !ninth.planet || !first.planet) return null;
      const exchanged = second.planet.house === 9 && ninth.planet.house === 2;
      if (!exchanged) return null;
      if (!isInKendra(first.planet.house) && !isInTrikona(first.planet.house)) return null;
      const involved = [second.planet, ninth.planet, first.planet];
      return {
        yoga_id: "khadga",
        name: "Khadga Yoga",
        sanskrit: "खड्ग योग",
        category: "wealth",
        present: true,
        strength: overallStrength(involved.map((planet) => planetStrength(planet.name, planet.sign))),
        involved_planets: uniquePlanetNames(involved),
        description: `The 2nd lord (${second.lordName}) and 9th lord (${ninth.lordName}) exchange houses, and the ascendant lord (${first.lordName}) holds house ${first.planet.house}.`,
        effects: "Wealth and good fortune arrive together and are held by someone strong enough to keep them. Learning is broad, the means to act on it are present, and what is earned tends to stay earned.",
        activation_timing: "the periods of the 1st, 2nd and 9th lords, and stretches combining study with earning",
        key_traits: ["prosperity", "learning", "capability"],
        source: "Jataka Parijata; Phaladeepika (2nd and 9th lords exchanged, ascendant lord strong)",
        detailed_description: richYogaDetail(
          "Khadga Yoga",
          "Wealth and fortune arrive together and are held by someone strong enough to keep them.",
          uniquePlanetNames(involved),
          "the periods of the 1st, 2nd and 9th lords",
          ["prosperity", "learning", "capability"]
        ),
      };
    },
  },
  {
    id: "kusuma",
    name: "Kusuma Yoga",
    sanskrit: "कुसुम योग",
    category: "wealth",
    source: "Jataka Parijata (Venus angular in a fixed sign, Moon in the 5th or 9th with benefic support, Saturn in the 10th)",
    description: "Venus occupies an angle in a fixed sign, the Moon holds the 5th or the 9th with a benefic conjunct or aspecting it, and Saturn occupies the 10th.",
    effects: "A rare arrangement, read as conferring standing that is given rather than fought for: patronage, an easy manner with those in authority, and comfort that does not have to be defended.",
    detect: (chart) => {
      const venus = findPlanet(chart.planets, "Venus");
      const moon = findPlanet(chart.planets, "Moon");
      const saturn = findPlanet(chart.planets, "Saturn");
      if (!venus || !moon || !saturn) return null;
      if (!isInKendra(venus.house) || !FIXED_SIGNS.includes(venus.sign)) return null;
      if (moon.house !== 5 && moon.house !== 9) return null;
      if (saturn.house !== 10) return null;
      /* "Under the influence of benefics" is read as the narrower of the two
         usual senses: a benefic sharing the sign or casting a full aspect. */
      const supporters = chart.planets.filter(
        (planet) =>
          NATURAL_BENEFICS.includes(planet.name) &&
          (planet.sign === moon.sign || hasFullAspect(planet, moon))
      );
      if (supporters.length === 0) return null;
      const involved = [venus, moon, saturn, ...supporters];
      return {
        yoga_id: "kusuma",
        name: "Kusuma Yoga",
        sanskrit: "कुसुम योग",
        category: "wealth",
        present: true,
        strength: overallStrength([venus, moon, saturn].map((planet) => planetStrength(planet.name, planet.sign))),
        involved_planets: uniquePlanetNames(involved),
        description: `Venus holds angular house ${venus.house} in ${venus.sign}, the Moon is in the ${ordinal(moon.house)} supported by ${uniquePlanetNames(supporters).join(", ")}, and Saturn holds the 10th.`,
        effects: "A rare arrangement, read as conferring standing that is given rather than fought for: patronage, an easy manner with people in authority, and comfort that does not have to be defended.",
        activation_timing: "Venus and Saturn periods, and stretches when a patron or an institution takes an interest",
        key_traits: ["patronage", "grace", "standing"],
        source: "Jataka Parijata (Venus angular in a fixed sign, Moon in the 5th or 9th with benefic support, Saturn in the 10th)",
        detailed_description: richYogaDetail(
          "Kusuma Yoga",
          "Standing that is conferred rather than fought for, with comfort that does not have to be defended.",
          uniquePlanetNames(involved),
          "Venus and Saturn periods",
          ["patronage", "grace", "standing"]
        ),
      };
    },
  },
  {
    id: "matsya",
    name: "Matsya Yoga",
    sanskrit: "मत्स्य योग",
    category: "benefic",
    source: "Jataka Parijata (malefics in the 1st and 9th, both kinds in the 5th, no benefic in the 4th or 8th)",
    description: "Malefics occupy the 1st and the 9th, the 5th holds both a benefic and a malefic, and neither the 4th nor the 8th holds a benefic.",
    effects: "An unusual reading: the difficult placements are what make it work. Sharp judgement of people, an instinct for what is being left unsaid, and a kindness that has been tested rather than assumed.",
    detect: (chart) => {
      const firstMalefics = maleficsIn(chart, 1);
      const ninthMalefics = maleficsIn(chart, 9);
      if (firstMalefics.length === 0 || ninthMalefics.length === 0) return null;
      const fifthBenefics = beneficsIn(chart, 5);
      const fifthMalefics = maleficsIn(chart, 5);
      if (fifthBenefics.length === 0 || fifthMalefics.length === 0) return null;
      /* "Only malefics in the 4th and 8th" -- an empty house satisfies it; a
         benefic in either does not. */
      if (beneficsIn(chart, 4).length > 0 || beneficsIn(chart, 8).length > 0) return null;
      const involved = [...firstMalefics, ...ninthMalefics, ...fifthBenefics, ...fifthMalefics];
      return {
        yoga_id: "matsya",
        name: "Matsya Yoga",
        sanskrit: "मत्स्य योग",
        category: "benefic",
        present: true,
        strength: overallStrength(involved.map((planet) => planetStrength(planet.name, planet.sign))),
        involved_planets: uniquePlanetNames(involved),
        description: `Malefics hold the 1st (${uniquePlanetNames(firstMalefics).join(", ")}) and the 9th (${uniquePlanetNames(ninthMalefics).join(", ")}), the 5th carries both ${uniquePlanetNames(fifthBenefics).join(", ")} and ${uniquePlanetNames(fifthMalefics).join(", ")}, and no benefic sits in the 4th or 8th.`,
        effects: "An unusual reading, in that the difficult placements are what make it work. Sharp judgement of people, an instinct for what is being left unsaid, and a kindness that has been tested rather than assumed.",
        activation_timing: "the periods of the planets in the 1st, 5th and 9th, and stretches that call for reading a situation quickly",
        key_traits: ["discernment", "compassion", "learning"],
        source: "Jataka Parijata (malefics in the 1st and 9th, both kinds in the 5th, no benefic in the 4th or 8th)",
        detailed_description: richYogaDetail(
          "Matsya Yoga",
          "Sharp judgement of people and an instinct for what is being left unsaid, built out of difficult placements rather than easy ones.",
          uniquePlanetNames(involved),
          "the periods of the planets in the 1st, 5th and 9th",
          ["discernment", "compassion", "learning"]
        ),
      };
    },
  },
  {
    id: "dhwaja",
    name: "Dhwaja Yoga",
    sanskrit: "ध्वज योग",
    category: "wealth",
    source: "Jataka Parijata (every malefic in the 8th, every benefic in the ascendant)",
    description: "Every natural malefic occupies the 8th house and every natural benefic occupies the 1st -- the whole chart sorted onto two houses by nature.",
    effects: "Read as the banner it is named for: orders given are followed. The difficult planets are quarantined in one place and the helpful ones all stand with the person.",
    detect: (chart) => {
      const benefics = chart.planets.filter((planet) => NATURAL_BENEFICS.includes(planet.name));
      const malefics = chart.planets.filter(
        (planet) => NATURAL_MALEFICS.includes(planet.name) && CLASSICAL_PLANETS.includes(planet.name)
      );
      if (benefics.length === 0 || malefics.length === 0) return null;
      if (!benefics.every((planet) => planet.house === 1)) return null;
      if (!malefics.every((planet) => planet.house === 8)) return null;
      const involved = [...benefics, ...malefics];
      return {
        yoga_id: "dhwaja",
        name: "Dhwaja Yoga",
        sanskrit: "ध्वज योग",
        category: "wealth",
        present: true,
        strength: overallStrength(benefics.map((planet) => planetStrength(planet.name, planet.sign))),
        involved_planets: uniquePlanetNames(involved),
        description: `Every benefic (${uniquePlanetNames(benefics).join(", ")}) stands in the 1st and every classical malefic (${uniquePlanetNames(malefics).join(", ")}) in the 8th.`,
        effects: "Read as the banner it is named for: orders given are followed. The difficult planets are quarantined in a single house and the helpful ones all stand with the person, which is why the tradition rates a configuration this lopsided so highly.",
        activation_timing: "the periods of the benefics in the ascendant, and any stretch conferring command",
        key_traits: ["command", "presence", "authority"],
        source: "Jataka Parijata (every malefic in the 8th, every benefic in the ascendant)",
        detailed_description: richYogaDetail(
          "Dhwaja Yoga",
          "Orders given are followed: the difficult planets are confined to one house and the helpful ones all stand with the person.",
          uniquePlanetNames(involved),
          "the periods of the benefics in the ascendant",
          ["command", "presence", "authority"]
        ),
      };
    },
  },
  {
    id: "kurma",
    name: "Kurma Yoga",
    sanskrit: "कूर्म योग",
    category: "benefic",
    source: "Jataka Parijata (benefics in the 5th/6th/7th, malefics in the 1st/3rd/11th, all dignified)",
    description: "Every benefic occupies the 5th, 6th or 7th, every classical malefic the 1st, 3rd or 11th, and all of them are exalted or in their own sign -- in the birth chart or in the navamsa, which is how the source states it.",
    effects: "The rarest combination in this file, and rated accordingly: steadiness that other people organise themselves around, a reputation for fairness, and work that serves more than the person doing it.",
    detect: (chart) => {
      const benefics = chart.planets.filter((planet) => NATURAL_BENEFICS.includes(planet.name));
      const malefics = chart.planets.filter(
        (planet) => NATURAL_MALEFICS.includes(planet.name) && CLASSICAL_PLANETS.includes(planet.name)
      );
      if (benefics.length === 0 || malefics.length === 0) return null;
      if (!benefics.every((planet) => [5, 6, 7].includes(planet.house))) return null;
      if (!malefics.every((planet) => [1, 3, 11].includes(planet.house))) return null;
      const involved = [...benefics, ...malefics];
      const dignified = involved.every((planet) => dignifiedInRasiOrNavamsa(chart, planet));
      if (!dignified) return null;
      return {
        yoga_id: "kurma",
        name: "Kurma Yoga",
        sanskrit: "कूर्म योग",
        category: "benefic",
        present: true,
        strength: "strong",
        involved_planets: uniquePlanetNames(involved),
        description: `The benefics (${uniquePlanetNames(benefics).join(", ")}) hold the 5th to 7th and the classical malefics (${uniquePlanetNames(malefics).join(", ")}) the 1st, 3rd and 11th, every one of them exalted or in its own sign in the birth chart or the navamsa.`,
        effects: "The rarest combination in this file, and rated accordingly: steadiness that other people organise themselves around, a reputation for fairness that survives contact with power, and work that serves more than the person doing it.",
        activation_timing: "any period, since every planet involved is dignified; most visibly in stretches of public responsibility",
        key_traits: ["steadiness", "integrity", "renown"],
        source: "Jataka Parijata (benefics in the 5th/6th/7th, malefics in the 1st/3rd/11th, all dignified)",
        detailed_description: richYogaDetail(
          "Kurma Yoga",
          "Steadiness that others organise themselves around, and a reputation for fairness that survives contact with power.",
          uniquePlanetNames(involved),
          "stretches of public responsibility",
          ["steadiness", "integrity", "renown"]
        ),
      };
    },
  },
];

/**
 * The hundred combinations added on 2026-09-25, in the order the sections
 * above introduce them: 30 Nabhasa, 22 parivartana, 15 house-lord placements,
 * 11 single-planet placements, 11 conjunctions, 5 reckoned from a karaka, and
 * 6 named yogas written out in full.
 */
const CLASSICAL_2026_YOGA_DEFINITIONS: YogaDefinition[] = [
  ...NABHASA_YOGA_RECIPES.map(createNabhasaYoga),
  ...CLASSICAL_MUTUAL_LORD_RECIPES.map(createMutualHouseLordYoga),
  ...CLASSICAL_HOUSE_LORD_RECIPES.map(createHouseLordPlacementYoga),
  ...CLASSICAL_PLANET_HOUSE_RECIPES.map(createPlanetHouseYoga),
  ...CLASSICAL_CONJUNCTION_RECIPES.map(createConjunctionYoga),
  ...CLASSICAL_RELATIVE_RECIPES.map(createRelativePlanetYoga),
  ...NAMED_CLASSICAL_YOGA_DEFINITIONS,
];

// --------------------------------------------------------------------------
// Navamsa yogas
// --------------------------------------------------------------------------
/*
 * The combinations that read the D9 as well as the rasi chart.
 *
 * These were left out when the catalogue doubled, on the grounds that
 * computing a navamsa here would put a second definition of a divisional
 * chart in this file. That objection was about *recomputing* it. Calling
 * `calculateNavamsa`, which is the engine the rest of the app already uses,
 * raises no such problem -- and it needs nothing that `YogaChartInput` was not
 * already carrying, since the D9 sign of a planet follows from its rasi sign
 * and its degree within that sign.
 *
 * The one thing the input did lack is the ascendant's degree. `ascendantSign`
 * alone cannot yield a navamsa, so `ascendantDegreeInSign` is a new optional
 * field and Lagna Vargottama is the only record that requires it; every other
 * yoga in this file behaves exactly as before when it is absent.
 *
 * A note on which navamsa. There are two implementations in the tree --
 * `navamsa-engine.calculateNavamsa` and `divisional-engine.computeD9` -- and
 * as of 2026-09-26 they agree exactly, which they did not before (see the
 * comment on NAVAMSA_SPAN). This file uses the former, because life-domain
 * rules already do, so a yoga and a life-area reading cannot disagree about
 * the same planet.
 */

/* One chart is put through every definition in the catalogue, so the D9 is
   computed once per chart rather than once per navamsa yoga. Keyed on the
   planets array itself, which detectYogas passes through unchanged. */
const navamsaCache = new WeakMap<PlanetPosition[], Map<string, string>>();

function navamsaSigns(chart: YogaChartInput): Map<string, string> {
  const cached = navamsaCache.get(chart.planets);
  if (cached) return cached;
  const signs = new Map<string, string>();
  for (const position of calculateNavamsa(chart.planets)) {
    signs.set(position.name, position.navamsa_sign);
  }
  navamsaCache.set(chart.planets, signs);
  return signs;
}

/** The lord of the sign a planet holds in the D9. */
function navamsaDispositor(chart: YogaChartInput, planetName: string): string | null {
  const sign = navamsaSigns(chart).get(planetName);
  return sign ? getSignLord(sign) : null;
}

/** The ascendant's own D9 sign, which needs a degree the caller may not supply. */
function ascendantNavamsaSign(chart: YogaChartInput): string | null {
  const degree = chart.ascendantDegreeInSign;
  if (degree === undefined || !Number.isFinite(degree) || degree < 0 || degree >= 30) {
    return null;
  }
  const [position] = calculateNavamsa([
    { name: "Ascendant", longitude: 0, sign: chart.ascendantSign, degree_in_sign: degree, house: 1 },
  ]);
  return position?.navamsa_sign ?? null;
}

/** Dignity counted in either chart, which is how the texts state it. */
function dignifiedInRasiOrNavamsa(chart: YogaChartInput, planet: PlanetPosition): boolean {
  if (isExalted(planet.name, planet.sign) || isOwnSign(planet.name, planet.sign)) return true;
  const navamsa = navamsaSigns(chart).get(planet.name);
  if (!navamsa) return false;
  return isExalted(planet.name, navamsa) || isOwnSign(planet.name, navamsa);
}

const NAVAMSA_YOGA_DEFINITIONS: YogaDefinition[] = [
  {
    id: "vargottama",
    name: "Vargottama Yoga",
    sanskrit: "वर्गोत्तम योग",
    category: "benefic",
    source: "BPHS and Saravali (a graha holding the same sign in rasi and navamsa)",
    description: "One or more of the seven classical planets hold the same sign in the birth chart and in the navamsa.",
    effects: "A planet that repeats its sign in the D9 is doing the same thing at both levels, and the tradition reads that as doubled strength.",
    detect: (chart) => {
      const navamsa = navamsaSigns(chart);
      const repeated = chart.planets.filter(
        (planet) =>
          CLASSICAL_PLANETS.includes(planet.name) && navamsa.get(planet.name) === planet.sign
      );
      if (repeated.length === 0) return null;
      const names = uniquePlanetNames(repeated);
      /* Graded by how many repeat rather than by dignity: vargottama is
         itself a strength claim, and one planet repeating is a much smaller
         statement than three doing it. */
      const strength = repeated.length >= 3 ? "strong" : repeated.length === 2 ? "moderate" : "weak";
      const effects =
        repeated.length >= 3
          ? "Three or more planets carry the same sign in both charts, so the chart says the same thing twice over. What these planets govern is unusually consistent -- it holds up under pressure instead of shifting when circumstances do."
          : "What this planet governs is stable rather than situational: the outer life and the inner one point the same way, and the trait shows up again under pressure rather than falling away.";
      const timing = `the periods of ${names.join(", ")}, when the doubling is most visible`;
      const traits = ["consistency", "strength", "reliability"];
      return {
        yoga_id: "vargottama",
        name: "Vargottama Yoga",
        sanskrit: "वर्गोत्तम योग",
        category: "benefic",
        present: true,
        strength,
        involved_planets: names,
        description:
          names.length === 1
            ? `${names[0]} holds ${navamsa.get(names[0])} in both the birth chart and the navamsa.`
            : `${names.join(", ")} each hold the same sign in the birth chart and the navamsa (${names.map((name) => navamsa.get(name)).join(", ")}).`,
        effects,
        activation_timing: timing,
        key_traits: traits,
        source: "BPHS and Saravali (a graha holding the same sign in rasi and navamsa)",
        detailed_description: richYogaDetail("Vargottama Yoga", effects, names, timing, traits),
      };
    },
  },
  {
    id: "lagna_vargottama",
    name: "Lagna Vargottama Yoga",
    sanskrit: "लग्न वर्गोत्तम योग",
    category: "benefic",
    source: "BPHS and Saravali (the ascendant holding the same sign in rasi and navamsa)",
    description: "The ascendant falls in the same sign in the birth chart and in the navamsa. Needs the ascendant's exact degree, so it is only assessed when the caller supplies one.",
    effects: "The rising sign is reinforced rather than reinterpreted, so the way you come across and the way you actually are do not pull in different directions.",
    detect: (chart) => {
      const navamsaSign = ascendantNavamsaSign(chart);
      if (!navamsaSign || navamsaSign !== chart.ascendantSign) return null;
      const lord = houseLordPlanet(1, chart);
      if (!lord.planet) return null;
      const effects =
        "The rising sign is reinforced rather than reinterpreted. How you come across and how you actually are do not pull in different directions, which makes first impressions unusually accurate and the whole chart harder to knock off its footing.";
      const timing = `the period of the ascendant lord (${lord.lordName}), and any stretch that tests the chart as a whole`;
      const traits = ["integrity", "steadiness", "self-consistency"];
      return {
        yoga_id: "lagna_vargottama",
        name: "Lagna Vargottama Yoga",
        sanskrit: "लग्न वर्गोत्तम योग",
        category: "benefic",
        present: true,
        strength: "strong",
        involved_planets: [lord.lordName],
        description: `The ascendant falls in ${chart.ascendantSign} in both the birth chart and the navamsa.`,
        effects,
        activation_timing: timing,
        key_traits: traits,
        source: "BPHS and Saravali (the ascendant holding the same sign in rasi and navamsa)",
        detailed_description: richYogaDetail("Lagna Vargottama Yoga", effects, [lord.lordName], timing, traits),
      };
    },
  },
  {
    id: "kalpadruma",
    name: "Kalpadruma Yoga",
    sanskrit: "कल्पद्रुम योग",
    category: "wealth",
    source: "Jataka Parijata (also called Parijata Yoga: the ascendant lord, its dispositor, that dispositor's dispositor, and the last one's navamsa dispositor)",
    description: "Four planets in a chain -- the ascendant lord, the lord of the sign it occupies, the lord of the sign that planet occupies, and the navamsa dispositor of the third -- with every one of them both angular or trinal and either exalted or in its own sign.",
    effects: "Named for the wish-fulfilling tree. Support arrives at every level the chart is examined at, so what is attempted tends to find backing from some direction.",
    detect: (chart) => {
      const first = houseLordPlanet(1, chart);
      if (!first.planet) return null;
      const dispositorOne = findPlanet(chart.planets, getSignLord(first.planet.sign));
      if (!dispositorOne) return null;
      const dispositorTwo = findPlanet(chart.planets, getSignLord(dispositorOne.sign));
      if (!dispositorTwo) return null;
      const navamsaLord = navamsaDispositor(chart, dispositorTwo.name);
      if (!navamsaLord) return null;
      const fourth = findPlanet(chart.planets, navamsaLord);
      if (!fourth) return null;

      const chain = [first.planet, dispositorOne, dispositorTwo, fourth];
      /*
       * Both conditions, not either. The rule is quoted loosely often enough
       * that "in kendras or trikonas, or exalted" reads as a choice, and taken
       * that way it fires on a quarter of all charts -- which cannot be right
       * for a combination the texts hold up as exceptional. Jataka Parijata
       * asks for both: each of the four well placed *and* well dignified.
       *
       * The source also admits a friendly sign alongside exaltation and own
       * sign. There is a natural-friendship table in shadbala-engine, but it
       * is private to that file, and importing it to widen a rule would be the
       * wrong trade -- omitting it makes this stricter, which is the only
       * direction a definition here is allowed to differ in.
       */
      const supported = chain.every(
        (planet) =>
          (isInKendra(planet.house) || isInTrikona(planet.house)) &&
          (isExalted(planet.name, planet.sign) || isOwnSign(planet.name, planet.sign))
      );
      if (!supported) return null;

      const names = uniquePlanetNames(chain);
      /* A planet in its own sign disposes itself, so the raw chain can read
         "through Moon and Moon". Collapsing repeats keeps the sentence honest
         about the path without pretending there are four distinct planets. */
      const chainPath = [first.lordName, dispositorOne.name, dispositorTwo.name, fourth.name]
        .filter((name, index, all) => index === 0 || name !== all[index - 1]);
      const effects =
        "Named for the wish-fulfilling tree, and the reason is structural rather than poetic: the chain that defines the chart's own ruler holds up at every link. Support arrives at whichever level the chart is examined at, so what is attempted tends to find backing from some direction.";
      const timing = `the periods of ${names.join(", ")}, which between them cover the chain`;
      const traits = ["support", "abundance", "resilience"];
      return {
        yoga_id: "kalpadruma",
        name: "Kalpadruma Yoga",
        sanskrit: "कल्पद्रुम योग",
        category: "wealth",
        present: true,
        strength: overallStrength(chain.map((planet) => planetStrength(planet.name, planet.sign))),
        involved_planets: names,
        description: `The ascendant lord ${first.lordName} leads a dispositor chain ${chainPath.join(" -> ")}, the last step taken in the navamsa; every link is angular or trinal and either exalted or in its own sign.`,
        effects,
        activation_timing: timing,
        key_traits: traits,
        source: "Jataka Parijata (also called Parijata Yoga: the ascendant lord, its dispositor, that dispositor's dispositor, and the last one's navamsa dispositor)",
        detailed_description: richYogaDetail("Kalpadruma Yoga", effects, names, timing, traits),
      };
    },
  },
  {
    id: "gauri",
    name: "Gauri Yoga",
    sanskrit: "गौरी योग",
    category: "wealth",
    source: "Jataka Parijata (navamsa dispositor of the 10th lord exalted in the 10th with the ascendant lord)",
    description: "The navamsa dispositor of the 10th lord is exalted and stands in the 10th house together with the ascendant lord.",
    effects: "Standing that is both earned and acknowledged: the work and the person doing it are recognised together rather than one at the expense of the other.",
    detect: (chart) => {
      const tenth = houseLordPlanet(10, chart);
      const first = houseLordPlanet(1, chart);
      if (!tenth.planet || !first.planet) return null;
      const dispositorName = navamsaDispositor(chart, tenth.lordName);
      if (!dispositorName) return null;
      const dispositor = findPlanet(chart.planets, dispositorName);
      if (!dispositor) return null;
      if (!isExalted(dispositor.name, dispositor.sign)) return null;
      if (dispositor.house !== 10 || first.planet.house !== 10) return null;
      /* "Joins the ascendant lord" needs two planets. When the navamsa
         dispositor turns out to be the ascendant lord, the condition is
         satisfied by one planet standing next to itself. */
      if (dispositor.name === first.lordName) return null;

      const involved = uniquePlanetNames([dispositor, first.planet, tenth.planet]);
      const effects =
        "Standing that is both earned and acknowledged. The work and the person doing it are recognised together rather than one at the expense of the other, and the reputation that results is difficult to dislodge.";
      const timing = `the periods of ${dispositor.name} and ${first.lordName}, and the stretches that confer public position`;
      const traits = ["renown", "merit", "position"];
      return {
        yoga_id: "gauri",
        name: "Gauri Yoga",
        sanskrit: "गौरी योग",
        category: "wealth",
        present: true,
        strength: "strong",
        involved_planets: involved,
        description: `The 10th lord (${tenth.lordName}) has ${dispositor.name} as its navamsa dispositor; ${dispositor.name} is exalted in ${dispositor.sign} in the 10th, alongside the ascendant lord ${first.lordName}.`,
        effects,
        activation_timing: timing,
        key_traits: traits,
        source: "Jataka Parijata (navamsa dispositor of the 10th lord exalted in the 10th with the ascendant lord)",
        detailed_description: richYogaDetail("Gauri Yoga", effects, involved, timing, traits),
      };
    },
  },
  {
    id: "bharathi",
    name: "Bharathi Yoga",
    sanskrit: "भारती योग",
    category: "benefic",
    source: "Jataka Parijata (navamsa dispositor of the 2nd, 5th or 11th lord exalted and joined to the 9th lord)",
    description: "The navamsa dispositor of the 2nd, 5th or 11th lord is exalted and shares a sign with the 9th lord.",
    effects: "Learning that is recognised: command of a subject, a name attached to it, and an ease of expression that makes the knowledge travel.",
    detect: (chart) => {
      const ninth = houseLordPlanet(9, chart);
      if (!ninth.planet) return null;
      for (const house of [2, 5, 11]) {
        const lord = houseLordPlanet(house, chart);
        if (!lord.planet) continue;
        const dispositorName = navamsaDispositor(chart, lord.lordName);
        if (!dispositorName) continue;
        const dispositor = findPlanet(chart.planets, dispositorName);
        if (!dispositor) continue;
        if (!isExalted(dispositor.name, dispositor.sign)) continue;
        /* Conjunction with the 9th lord, which a planet cannot form with
           itself -- without this the rule collapses to "the 9th lord is
           exalted" whenever it is its own navamsa dispositor. */
        if (dispositor.name === ninth.lordName) continue;
        if (dispositor.sign !== ninth.planet.sign) continue;

        const involved = uniquePlanetNames([dispositor, ninth.planet, lord.planet]);
        const effects =
          "Learning that is recognised rather than merely held: command of a subject, a name attached to it, and an ease of expression that makes the knowledge travel further than the person does.";
        const timing = `the periods of ${dispositor.name} and ${ninth.lordName}, and stretches of study, teaching or publication`;
        const traits = ["eloquence", "scholarship", "renown"];
        return {
          yoga_id: "bharathi",
          name: "Bharathi Yoga",
          sanskrit: "भारती योग",
          category: "benefic",
          present: true,
          strength: "strong",
          involved_planets: involved,
          description: `The ${ordinal(house)} lord (${lord.lordName}) has ${dispositor.name} as its navamsa dispositor; ${dispositor.name} is exalted in ${dispositor.sign} and shares that sign with the 9th lord ${ninth.lordName}.`,
          effects,
          activation_timing: timing,
          key_traits: traits,
          source: "Jataka Parijata (navamsa dispositor of the 2nd, 5th or 11th lord exalted and joined to the 9th lord)",
          detailed_description: richYogaDetail("Bharathi Yoga", effects, involved, timing, traits),
        };
      }
      return null;
    },
  },
];

const YOGA_DEFINITIONS: YogaDefinition[] = [
  // ── Pancha Mahapurusha Yogas ──
  {
    id: "ruchaka",
    name: "Ruchaka Yoga",
    sanskrit: "रुचक योग",
    category: "mahapurusha",
    description: "Mars in own sign or exalted and placed in a kendra house (1/4/7/10).",
    effects: "Bestows courage, leadership ability, military prowess, athletic build, and commanding presence.",
    detect: (chart) =>
      detectMahapurusha(
        "Mars", "ruchaka", "Ruchaka Yoga", "रुचक योग",
        "Mars is in own sign or exalted and placed in a kendra house (1/4/7/10).",
        "Bestows courage, leadership ability, military prowess, athletic build, and commanding presence.",
        chart
      ),
  },
  {
    id: "bhadra",
    name: "Bhadra Yoga",
    sanskrit: "भद्र योग",
    category: "mahapurusha",
    description: "Mercury in own sign or exalted and placed in a kendra house (1/4/7/10).",
    effects: "Grants sharp intelligence, communication mastery, business acumen, and scholarly pursuits.",
    detect: (chart) =>
      detectMahapurusha(
        "Mercury", "bhadra", "Bhadra Yoga", "भद्र योग",
        "Mercury is in own sign or exalted and placed in a kendra house (1/4/7/10).",
        "Grants sharp intelligence, communication mastery, business acumen, and scholarly pursuits.",
        chart
      ),
  },
  {
    id: "hamsa",
    name: "Hamsa Yoga",
    sanskrit: "हंस योग",
    category: "mahapurusha",
    description: "Jupiter in own sign or exalted and placed in a kendra house (1/4/7/10).",
    effects: "Confers wisdom, spiritual knowledge, righteousness, respect from society, and good fortune.",
    detect: (chart) =>
      detectMahapurusha(
        "Jupiter", "hamsa", "Hamsa Yoga", "हंस योग",
        "Jupiter is in own sign or exalted and placed in a kendra house (1/4/7/10).",
        "Confers wisdom, spiritual knowledge, righteousness, respect from society, and good fortune.",
        chart
      ),
  },
  {
    id: "malavya",
    name: "Malavya Yoga",
    sanskrit: "मालव्य योग",
    category: "mahapurusha",
    description: "Venus in own sign or exalted and placed in a kendra house (1/4/7/10).",
    effects: "Brings beauty, luxury, artistic talent, romantic fulfillment, and material comfort.",
    detect: (chart) =>
      detectMahapurusha(
        "Venus", "malavya", "Malavya Yoga", "मालव्य योग",
        "Venus is in own sign or exalted and placed in a kendra house (1/4/7/10).",
        "Brings beauty, luxury, artistic talent, romantic fulfillment, and material comfort.",
        chart
      ),
  },
  {
    id: "shasha",
    name: "Shasha Yoga",
    sanskrit: "शश योग",
    category: "mahapurusha",
    description: "Saturn in own sign or exalted and placed in a kendra house (1/4/7/10).",
    effects: "Grants discipline, authority, longevity, success through hard work, and organizational power.",
    detect: (chart) =>
      detectMahapurusha(
        "Saturn", "shasha", "Shasha Yoga", "शश योग",
        "Saturn is in own sign or exalted and placed in a kendra house (1/4/7/10).",
        "Grants discipline, authority, longevity, success through hard work, and organizational power.",
        chart
      ),
  },

  // ── Wealth & Raja Yogas ──
  {
    id: "gajakesari",
    name: "Gajakesari Yoga",
    sanskrit: "गजकेसरी योग",
    category: "wealth",
    description: "Jupiter in a kendra (1/4/7/10) from the Moon.",
    effects: "Confers wisdom, fame, lasting wealth, and the ability to overcome obstacles with grace.",
    detect: (chart) => {
      const moon = findPlanet(chart.planets, "Moon");
      const jupiter = findPlanet(chart.planets, "Jupiter");
      if (!moon || !jupiter) return null;

      const dist = signDistance(moon.sign, jupiter.sign);
      if ([1, 4, 7, 10].includes(dist)) {
        const str = planetStrength("Jupiter", jupiter.sign);
        return {
          yoga_id: "gajakesari",
          name: "Gajakesari Yoga",
          sanskrit: "गजकेसरी योग",
          category: "wealth",
          present: true,
          strength: str,
          involved_planets: ["Moon", "Jupiter"],
          description: `Jupiter is ${dist} signs from the Moon, forming a kendra relationship.`,
          effects: "Confers wisdom, fame, lasting wealth, and the ability to overcome obstacles with grace.",
        };
      }
      return null;
    },
  },
  {
    id: "budhaditya",
    name: "Budhaditya Yoga",
    sanskrit: "बुधादित्य योग",
    category: "wealth",
    description: "Sun and Mercury in the same sign.",
    effects: "Grants intelligence, eloquence, fame through communication, and sharp analytical ability.",
    detect: (chart) => {
      const sun = findPlanet(chart.planets, "Sun");
      const mercury = findPlanet(chart.planets, "Mercury");
      if (!sun || !mercury) return null;

      if (sun.sign === mercury.sign) {
        // Combustion check: if Mercury is too close to Sun, weaker
        const angleDiff = Math.abs(sun.longitude - mercury.longitude);
        const isCombusted = angleDiff < 3;
        return {
          yoga_id: "budhaditya",
          name: "Budhaditya Yoga",
          sanskrit: "बुधादित्य योग",
          category: "wealth",
          present: true,
          strength: isCombusted ? "weak" : "moderate",
          involved_planets: ["Sun", "Mercury"],
          description: `Sun and Mercury are conjunct in ${sun.sign}.${isCombusted ? " Mercury is combust (within 3 degrees), reducing effectiveness." : ""}`,
          effects: "Grants intelligence, eloquence, fame through communication, and sharp analytical ability.",
          cancellation: isCombusted ? "Mercury is combust due to close proximity to the Sun, weakening this yoga." : undefined,
        };
      }
      return null;
    },
  },
  {
    id: "dhana",
    name: "Dhana Yoga",
    sanskrit: "धन योग",
    category: "wealth",
    description: "Lord of the 2nd house in a kendra or trikona, or lord of the 11th in the 2nd house.",
    effects: "Indicates wealth accumulation, financial stability, and material prosperity.",
    detect: (chart) => {
      const lord2Name = getHouseLord(2, chart.houses, chart.ascendantSign);
      const lord11Name = getHouseLord(11, chart.houses, chart.ascendantSign);
      const lord2 = findPlanet(chart.planets, lord2Name);
      const lord11 = findPlanet(chart.planets, lord11Name);

      const involved: string[] = [];
      let formed = false;
      let desc = "";

      if (lord2 && (isInKendra(lord2.house) || isInTrikona(lord2.house))) {
        formed = true;
        involved.push(lord2Name);
        desc = `Lord of the 2nd house (${lord2Name}) is placed in house ${lord2.house}, a ${isInKendra(lord2.house) ? "kendra" : "trikona"} position.`;
      }

      if (lord11 && lord11.house === 2) {
        formed = true;
        if (!involved.includes(lord11Name)) involved.push(lord11Name);
        desc += (desc ? " Additionally, " : "") + `Lord of the 11th house (${lord11Name}) is placed in the 2nd house.`;
      }

      if (formed) {
        return {
          yoga_id: "dhana",
          name: "Dhana Yoga",
          sanskrit: "धन योग",
          category: "wealth",
          present: true,
          strength: overallStrength(involved.map((n) => {
            const p = findPlanet(chart.planets, n);
            return p ? planetStrength(n, p.sign) : "moderate";
          })),
          involved_planets: involved,
          description: desc,
          effects: "Indicates wealth accumulation, financial stability, and material prosperity.",
        };
      }
      return null;
    },
  },
  {
    id: "raja",
    name: "Raja Yoga",
    sanskrit: "राज योग",
    category: "wealth",
    description: "Lord of a trikona (1/5/9) conjunct lord of a kendra (1/4/7/10).",
    effects: "Bestows power, authority, social status, and success in public life.",
    detect: (chart) => {
      const trikonaHouses = [1, 5, 9];
      const kendraHouses = [1, 4, 7, 10];

      const trikonaLords = trikonaHouses.map((h) => ({
        house: h,
        lord: getHouseLord(h, chart.houses, chart.ascendantSign),
      }));
      const kendraLords = kendraHouses.map((h) => ({
        house: h,
        lord: getHouseLord(h, chart.houses, chart.ascendantSign),
      }));

      for (const tl of trikonaLords) {
        for (const kl of kendraLords) {
          if (tl.lord === kl.lord && tl.house !== kl.house) {
            // Same planet rules both a trikona and kendra — automatic raja yoga
            const planet = findPlanet(chart.planets, tl.lord);
            if (planet) {
              return {
                yoga_id: "raja",
                name: "Raja Yoga",
                sanskrit: "राज योग",
                category: "wealth",
                present: true,
                strength: planetStrength(tl.lord, planet.sign),
                involved_planets: [tl.lord],
                description: `${tl.lord} rules both the ${ordinal(tl.house)} house (trikona) and ${ordinal(kl.house)} house (kendra), forming Raja Yoga.`,
                effects: "Bestows power, authority, social status, and success in public life.",
              };
            }
          }

          if (tl.lord !== kl.lord && arePlanetsConjunct(tl.lord, kl.lord, chart.planets)) {
            const p1 = findPlanet(chart.planets, tl.lord);
            const p2 = findPlanet(chart.planets, kl.lord);
            if (p1 && p2) {
              return {
                yoga_id: "raja",
                name: "Raja Yoga",
                sanskrit: "राज योग",
                category: "wealth",
                present: true,
                strength: overallStrength([planetStrength(tl.lord, p1.sign), planetStrength(kl.lord, p2.sign)]),
                involved_planets: [tl.lord, kl.lord],
                description: `Lord of the ${ordinal(tl.house)} (${tl.lord}) is conjunct lord of the ${ordinal(kl.house)} (${kl.lord}) in ${p1.sign}.`,
                effects: "Bestows power, authority, social status, and success in public life.",
              };
            }
          }
        }
      }
      return null;
    },
  },
  {
    id: "lakshmi",
    name: "Lakshmi Yoga",
    sanskrit: "लक्ष्मी योग",
    category: "wealth",
    description: "Lord of the 9th house is strong, and Venus is in own or exalted sign in a kendra or trikona.",
    effects: "Brings great fortune, prosperity, beauty, and divine grace in material and spiritual matters.",
    detect: (chart) => {
      const lord9Name = getHouseLord(9, chart.houses, chart.ascendantSign);
      const lord9 = findPlanet(chart.planets, lord9Name);
      const venus = findPlanet(chart.planets, "Venus");
      if (!lord9 || !venus) return null;

      const lord9Strong = isExalted(lord9Name, lord9.sign) || isOwnSign(lord9Name, lord9.sign);
      const venusStrong = isExalted("Venus", venus.sign) || isOwnSign("Venus", venus.sign);
      const venusInGoodHouse = isInKendra(venus.house) || isInTrikona(venus.house);

      if (lord9Strong && venusStrong && venusInGoodHouse) {
        return {
          yoga_id: "lakshmi",
          name: "Lakshmi Yoga",
          sanskrit: "लक्ष्मी योग",
          category: "wealth",
          present: true,
          strength: "strong",
          involved_planets: [lord9Name, "Venus"].filter((v, i, a) => a.indexOf(v) === i),
          description: `Lord of the 9th (${lord9Name}) is ${isExalted(lord9Name, lord9.sign) ? "exalted" : "in own sign"}, and Venus is ${isExalted("Venus", venus.sign) ? "exalted" : "in own sign"} in house ${venus.house}.`,
          effects: "Brings great fortune, prosperity, beauty, and divine grace in material and spiritual matters.",
        };
      }
      return null;
    },
  },

  // ── Benefic Yogas ──
  {
    id: "chandra_mangal",
    name: "Chandra-Mangal Yoga",
    sanskrit: "चन्द्र-मंगल योग",
    category: "benefic",
    description: "Moon and Mars in the same sign.",
    effects: "Generates wealth through enterprise, courage, and bold action. Strong emotional drive.",
    detect: (chart) => {
      const moon = findPlanet(chart.planets, "Moon");
      const mars = findPlanet(chart.planets, "Mars");
      if (!moon || !mars) return null;

      if (moon.sign === mars.sign) {
        return {
          yoga_id: "chandra_mangal",
          name: "Chandra-Mangal Yoga",
          sanskrit: "चन्द्र-मंगल योग",
          category: "benefic",
          present: true,
          strength: overallStrength([planetStrength("Moon", moon.sign), planetStrength("Mars", mars.sign)]),
          involved_planets: ["Moon", "Mars"],
          description: `Moon and Mars are conjunct in ${moon.sign} (house ${moon.house}).`,
          effects: "Generates wealth through enterprise, courage, and bold action. Strong emotional drive.",
        };
      }
      return null;
    },
  },
  {
    id: "guru_mangal",
    name: "Guru-Mangal Yoga",
    sanskrit: "गुरु-मंगल योग",
    category: "benefic",
    description: "Jupiter and Mars in conjunction (same sign).",
    effects: "Combines energy with wisdom, producing righteous action, courage with judgment, and success in competitive fields.",
    detect: (chart) => {
      const jupiter = findPlanet(chart.planets, "Jupiter");
      const mars = findPlanet(chart.planets, "Mars");
      if (!jupiter || !mars) return null;

      if (jupiter.sign === mars.sign) {
        return {
          yoga_id: "guru_mangal",
          name: "Guru-Mangal Yoga",
          sanskrit: "गुरु-मंगल योग",
          category: "benefic",
          present: true,
          strength: overallStrength([planetStrength("Jupiter", jupiter.sign), planetStrength("Mars", mars.sign)]),
          involved_planets: ["Jupiter", "Mars"],
          description: `Jupiter and Mars are conjunct in ${jupiter.sign} (house ${jupiter.house}).`,
          effects: "Combines energy with wisdom, producing righteous action, courage with judgment, and success in competitive fields.",
        };
      }
      return null;
    },
  },
  {
    id: "amala",
    name: "Amala Yoga",
    sanskrit: "अमल योग",
    category: "benefic",
    description: "A natural benefic planet (Jupiter, Venus, or Mercury) in the 10th house from the Lagna or Moon.",
    effects: "Indicates pure character, fame, spotless reputation, and success through virtuous conduct.",
    detect: (chart) => {
      const moon = findPlanet(chart.planets, "Moon");
      if (!moon) return null;

      for (const benefic of NATURAL_BENEFICS) {
        const planet = findPlanet(chart.planets, benefic);
        if (!planet) continue;

        // 10th from lagna
        if (planet.house === 10) {
          return {
            yoga_id: "amala",
            name: "Amala Yoga",
            sanskrit: "अमल योग",
            category: "benefic",
            present: true,
            strength: planetStrength(benefic, planet.sign),
            involved_planets: [benefic],
            description: `${benefic} (a natural benefic) is in the 10th house from the Lagna.`,
            effects: "Indicates pure character, fame, spotless reputation, and success through virtuous conduct.",
          };
        }

        // 10th from Moon
        const distFromMoon = signDistance(moon.sign, planet.sign);
        if (distFromMoon === 10) {
          return {
            yoga_id: "amala",
            name: "Amala Yoga",
            sanskrit: "अमल योग",
            category: "benefic",
            present: true,
            strength: planetStrength(benefic, planet.sign),
            involved_planets: [benefic, "Moon"],
            description: `${benefic} (a natural benefic) is in the 10th sign from the Moon.`,
            effects: "Indicates pure character, fame, spotless reputation, and success through virtuous conduct.",
          };
        }
      }
      return null;
    },
  },
  {
    id: "saraswati",
    name: "Saraswati Yoga",
    sanskrit: "सरस्वती योग",
    category: "benefic",
    description: "Jupiter, Venus, and Mercury in kendras, trikonas, or 2nd house, with Jupiter strong.",
    effects: "Bestows learning, artistic talent, eloquence, mastery of scriptures, and academic excellence.",
    detect: (chart) => {
      const jupiter = findPlanet(chart.planets, "Jupiter");
      const venus = findPlanet(chart.planets, "Venus");
      const mercury = findPlanet(chart.planets, "Mercury");
      if (!jupiter || !venus || !mercury) return null;

      const goodHouse = (h: number) => isInKendra(h) || isInTrikona(h) || h === 2;
      const jupiterStrong = isExalted("Jupiter", jupiter.sign) || isOwnSign("Jupiter", jupiter.sign);

      if (goodHouse(jupiter.house) && goodHouse(venus.house) && goodHouse(mercury.house) && jupiterStrong) {
        return {
          yoga_id: "saraswati",
          name: "Saraswati Yoga",
          sanskrit: "सरस्वती योग",
          category: "benefic",
          present: true,
          strength: "strong",
          involved_planets: ["Jupiter", "Venus", "Mercury"],
          description: `Jupiter (${jupiter.sign}, house ${jupiter.house}), Venus (${venus.sign}, house ${venus.house}), and Mercury (${mercury.sign}, house ${mercury.house}) are all in favorable positions with Jupiter strong.`,
          effects: "Bestows learning, artistic talent, eloquence, mastery of scriptures, and academic excellence.",
        };
      }
      return null;
    },
  },
  {
    id: "adhi",
    name: "Adhi Yoga",
    sanskrit: "अधि योग",
    category: "benefic",
    description: "Benefic planets in the 6th, 7th, and 8th houses from the Moon.",
    effects: "Grants leadership ability, prosperity, good health, and the capacity to overcome adversaries.",
    detect: (chart) => {
      const moon = findPlanet(chart.planets, "Moon");
      if (!moon) return null;

      const positions6_7_8: string[] = [];

      for (const benefic of NATURAL_BENEFICS) {
        const planet = findPlanet(chart.planets, benefic);
        if (!planet) continue;
        const dist = signDistance(moon.sign, planet.sign);
        if ([6, 7, 8].includes(dist)) {
          positions6_7_8.push(benefic);
        }
      }

      if (positions6_7_8.length >= 2) {
        return {
          yoga_id: "adhi",
          name: "Adhi Yoga",
          sanskrit: "अधि योग",
          category: "benefic",
          present: true,
          strength: positions6_7_8.length === 3 ? "strong" : "moderate",
          involved_planets: ["Moon", ...positions6_7_8],
          description: `${positions6_7_8.join(", ")} occupy the 6th, 7th, or 8th signs from the Moon, forming Adhi Yoga.`,
          effects: "Grants leadership ability, prosperity, good health, and the capacity to overcome adversaries.",
        };
      }
      return null;
    },
  },

  // ── Challenging Yogas ──
  {
    id: "kemadruma",
    name: "Kemadruma Yoga",
    sanskrit: "केमद्रुम योग",
    category: "challenging",
    description: "No planets in the 2nd or 12th house from the Moon (excluding Sun, Rahu, Ketu).",
    effects: "Can indicate periods of poverty, loneliness, emotional isolation, and lack of support.",
    detect: (chart) => {
      const moon = findPlanet(chart.planets, "Moon");
      const jupiter = findPlanet(chart.planets, "Jupiter");
      if (!moon) return null;

      const classicalPlanets = chart.planets.filter(
        (p) => !["Sun", "Moon", "Rahu", "Ketu"].includes(p.name)
      );

      const dist2 = classicalPlanets.some(
        (p) => signDistance(moon.sign, p.sign) === 2
      );
      const dist12 = classicalPlanets.some(
        (p) => signDistance(moon.sign, p.sign) === 12
      );

      if (!dist2 && !dist12) {
        // Check cancellation: Moon in kendra
        const moonInKendra = isInKendra(moon.house);
        // Check cancellation: Jupiter aspects Moon (same sign or aspect)
        const jupiterAspectsMoon = jupiter
          ? jupiter.sign === moon.sign || signDistance(jupiter.sign, moon.sign) === 7
          : false;

        if (moonInKendra || jupiterAspectsMoon) {
          return {
            yoga_id: "kemadruma",
            name: "Kemadruma Yoga",
            sanskrit: "केमद्रुम योग",
            category: "challenging",
            present: true,
            strength: "weak",
            involved_planets: ["Moon"],
            description: "No classical planets flank the Moon in the 2nd or 12th signs from it.",
            effects: "Can indicate periods of poverty, loneliness, emotional isolation, and lack of support.",
            cancellation: moonInKendra
              ? "Cancelled: Moon is in a kendra house, providing angular strength."
              : "Mitigated: Jupiter aspects or is conjunct the Moon, offering protection.",
          };
        }

        return {
          yoga_id: "kemadruma",
          name: "Kemadruma Yoga",
          sanskrit: "केमद्रुम योग",
          category: "challenging",
          present: true,
          strength: "strong",
          involved_planets: ["Moon"],
          description: "No classical planets flank the Moon in the 2nd or 12th signs from it, and no cancellation applies.",
          effects: "Can indicate periods of poverty, loneliness, emotional isolation, and lack of support.",
        };
      }
      return null;
    },
  },
  {
    id: "vish",
    name: "Vish Yoga",
    sanskrit: "विष योग",
    category: "challenging",
    description: "Moon conjunct Saturn in the same sign.",
    effects: "Creates emotional hardship, tendency toward melancholy, delays in happiness, and heaviness in relationships.",
    detect: (chart) => {
      const moon = findPlanet(chart.planets, "Moon");
      const saturn = findPlanet(chart.planets, "Saturn");
      const jupiter = findPlanet(chart.planets, "Jupiter");
      if (!moon || !saturn) return null;

      if (moon.sign === saturn.sign) {
        const jupiterAspects = jupiter
          ? jupiter.sign === moon.sign || signDistance(jupiter.sign, moon.sign) === 7
          : false;

        return {
          yoga_id: "vish",
          name: "Vish Yoga",
          sanskrit: "विष योग",
          category: "challenging",
          present: true,
          strength: jupiterAspects ? "weak" : "moderate",
          involved_planets: ["Moon", "Saturn"],
          description: `Moon and Saturn are conjunct in ${moon.sign} (house ${moon.house}).`,
          effects: "Creates emotional hardship, tendency toward melancholy, delays in happiness, and heaviness in relationships.",
          cancellation: jupiterAspects
            ? "Mitigated by Jupiter's aspect, which softens Saturn's harshness on the Moon."
            : undefined,
        };
      }
      return null;
    },
  },
  {
    id: "daridra",
    name: "Daridra Yoga",
    sanskrit: "दरिद्र योग",
    category: "challenging",
    description: "Lord of the 11th house placed in the 6th, 8th, or 12th house.",
    effects: "Indicates financial difficulties, loss of gains, struggles with income, and obstacles to prosperity.",
    detect: (chart) => {
      const lord11Name = getHouseLord(11, chart.houses, chart.ascendantSign);
      const lord11 = findPlanet(chart.planets, lord11Name);
      if (!lord11) return null;

      if (isInDusthana(lord11.house)) {
        return {
          yoga_id: "daridra",
          name: "Daridra Yoga",
          sanskrit: "दरिद्र योग",
          category: "challenging",
          present: true,
          strength: planetStrength(lord11Name, lord11.sign) === "strong" ? "weak" : "moderate",
          involved_planets: [lord11Name],
          description: `Lord of the 11th house (${lord11Name}) is placed in house ${lord11.house}, a dusthana position.`,
          effects: "Indicates financial difficulties, loss of gains, struggles with income, and obstacles to prosperity.",
        };
      }
      return null;
    },
  },
  {
    id: "grahan",
    name: "Grahan Yoga",
    sanskrit: "ग्रहण योग",
    category: "challenging",
    description: "Sun or Moon conjunct Rahu or Ketu.",
    effects: "Eclipsed luminaries create identity challenges (Sun) or emotional confusion (Moon), requiring conscious self-work.",
    detect: (chart) => {
      const sun = findPlanet(chart.planets, "Sun");
      const moon = findPlanet(chart.planets, "Moon");
      const rahu = findPlanet(chart.planets, "Rahu");
      const ketu = findPlanet(chart.planets, "Ketu");
      if (!rahu || !ketu) return null;

      const involved: string[] = [];
      const descriptions: string[] = [];

      if (sun && (sun.sign === rahu.sign || sun.sign === ketu.sign)) {
        involved.push("Sun");
        involved.push(sun.sign === rahu.sign ? "Rahu" : "Ketu");
        descriptions.push(`Sun is conjunct ${sun.sign === rahu.sign ? "Rahu" : "Ketu"} in ${sun.sign}`);
      }

      if (moon && (moon.sign === rahu.sign || moon.sign === ketu.sign)) {
        involved.push("Moon");
        const node = moon.sign === rahu.sign ? "Rahu" : "Ketu";
        if (!involved.includes(node)) involved.push(node);
        descriptions.push(`Moon is conjunct ${node} in ${moon.sign}`);
      }

      if (involved.length >= 2) {
        return {
          yoga_id: "grahan",
          name: "Grahan Yoga",
          sanskrit: "ग्रहण योग",
          category: "challenging",
          present: true,
          strength: involved.includes("Sun") && involved.includes("Moon") ? "strong" : "moderate",
          involved_planets: [...new Set(involved)],
          description: descriptions.join(". ") + ".",
          effects: "Eclipsed luminaries create identity challenges (Sun) or emotional confusion (Moon), requiring conscious self-work.",
        };
      }
      return null;
    },
  },

  // ── Viparita Raja Yoga ──
  {
    id: "viparita_raja",
    name: "Viparita Raja Yoga",
    sanskrit: "विपरीत राज योग",
    category: "viparita",
    description: "Lord of a dusthana (6/8/12) placed in another dusthana house.",
    effects: "Unexpected gains through adversity, resilience that converts hardship into advantage and hidden strength.",
    detect: (chart) => {
      const dusthanas = [6, 8, 12];
      const found: { lord: string; fromHouse: number; inHouse: number }[] = [];

      for (const dh of dusthanas) {
        const lordName = getHouseLord(dh, chart.houses, chart.ascendantSign);
        const lord = findPlanet(chart.planets, lordName);
        if (!lord) continue;

        if (isInDusthana(lord.house) && lord.house !== dh) {
          found.push({ lord: lordName, fromHouse: dh, inHouse: lord.house });
        }
      }

      if (found.length > 0) {
        const involved = [...new Set(found.map((f) => f.lord))];
        return {
          yoga_id: "viparita_raja",
          name: "Viparita Raja Yoga",
          sanskrit: "विपरीत राज योग",
          category: "viparita",
          present: true,
          strength: found.length >= 2 ? "strong" : "moderate",
          involved_planets: involved,
          description: found
            .map((f) => `Lord of the ${ordinal(f.fromHouse)} house (${f.lord}) is placed in the ${ordinal(f.inHouse)} house`)
            .join(". ") + ".",
          effects: "Unexpected gains through adversity, resilience that converts hardship into advantage and hidden strength.",
        };
      }
      return null;
    },
  },

  // ── Nabhasa Yogas ──
  {
    id: "kedara",
    name: "Kedara Yoga",
    sanskrit: "केदार योग",
    category: "nabhasa",
    description: "All seven classical planets occupy exactly four signs.",
    effects: "Indicates agricultural or land-based wealth, practical success, and grounded prosperity.",
    detect: (chart) => {
      const classical = chart.planets.filter((p) =>
        ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"].includes(p.name)
      );
      const uniqueSigns = new Set(classical.map((p) => p.sign));

      if (uniqueSigns.size === 4) {
        return {
          yoga_id: "kedara",
          name: "Kedara Yoga",
          sanskrit: "केदार योग",
          category: "nabhasa",
          present: true,
          strength: "moderate",
          involved_planets: classical.map((p) => p.name),
          description: `All seven classical planets are distributed across exactly 4 signs: ${[...uniqueSigns].join(", ")}.`,
          effects: "Indicates agricultural or land-based wealth, practical success, and grounded prosperity.",
        };
      }
      return null;
    },
  },
  {
    id: "yava",
    name: "Yava Yoga",
    sanskrit: "यव योग",
    category: "nabhasa",
    description: "All planets arranged in pairs of signs (every occupied sign has exactly two planets).",
    effects: "Moderate wealth, charitable disposition, and balanced approach to material life.",
    detect: (chart) => {
      const classical = chart.planets.filter((p) =>
        ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"].includes(p.name)
      );
      const signCounts: Record<string, number> = {};
      for (const p of classical) {
        signCounts[p.sign] = (signCounts[p.sign] || 0) + 1;
      }

      // Check: with 7 planets, perfect pairing is impossible (odd number).
      // Classical interpretation: planets arranged such that most signs have pairs.
      // Check if at least 3 signs have exactly 2 planets (6 of 7 paired).
      const pairCount = Object.values(signCounts).filter((c) => c === 2).length;

      if (pairCount >= 3) {
        return {
          yoga_id: "yava",
          name: "Yava Yoga",
          sanskrit: "यव योग",
          category: "nabhasa",
          present: true,
          strength: pairCount >= 3 ? "moderate" : "weak",
          involved_planets: classical.map((p) => p.name),
          description: `Classical planets form ${pairCount} pairs across signs, creating a barley-grain pattern.`,
          effects: "Moderate wealth, charitable disposition, and balanced approach to material life.",
        };
      }
      return null;
    },
  },
  ...GENERATED_YOGA_DEFINITIONS,
  ...ADDITIONAL_YOGA_DEFINITIONS,
  ...CLASSICAL_2026_YOGA_DEFINITIONS,
  ...NAVAMSA_YOGA_DEFINITIONS,
];

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

export function detectYogas(chart: YogaChartInput): YogaDetectionResult[] {
  const results: YogaDetectionResult[] = [];

  for (const definition of YOGA_DEFINITIONS) {
    try {
      const result = definition.detect(chart);
      const scoredResult = result ? withOccurrenceChance(result) : null;
      if (
        scoredResult &&
        scoredResult.present &&
        scoredResult.occurrence_chance >= YOGA_OCCURRENCE_THRESHOLD
      ) {
        results.push(scoredResult);
      }
    } catch {
      // Skip any yoga that fails detection gracefully
    }
  }

  // Sort: strong first, then moderate, then highest probability within each band.
  const strengthOrder: Record<string, number> = { strong: 0, moderate: 1, weak: 2 };
  results.sort((a, b) => {
    const strengthDelta = strengthOrder[a.strength] - strengthOrder[b.strength];
    if (strengthDelta !== 0) return strengthDelta;
    return b.occurrence_chance - a.occurrence_chance;
  });

  return results;
}

export { YOGA_DEFINITIONS };
