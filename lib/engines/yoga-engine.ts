
import type { PlanetPosition, HousePlacement } from "./swiss-ephemeris-engine";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface YogaChartInput {
  planets: PlanetPosition[];
  houses: HousePlacement[];
  ascendantSign: string;
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
}

type YogaCandidateResult = Omit<YogaDetectionResult, "occurrence_chance"> | YogaDetectionResult;

interface YogaDefinition {
  id: string;
  name: string;
  sanskrit: string;
  category: YogaDetectionResult["category"];
  description: string;
  effects: string;
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

function createHouseLordPlacementYoga(recipe: HouseLordPlacementRecipe): YogaDefinition {
  return {
    id: recipe.id,
    name: recipe.name,
    sanskrit: recipe.sanskrit,
    category: recipe.category,
    description: recipe.description,
    effects: recipe.effects,
    detect: (chart) => {
      const lord = houseLordPlanet(recipe.fromHouse, chart);
      if (!lord.planet || !recipe.targetHouses.includes(lord.planet.house)) return null;
      return generatedYogaResult(
        recipe,
        planetStrength(lord.lordName, lord.planet.sign),
        [lord.lordName],
        `The ${recipe.fromHouse}th lord (${lord.lordName}) is placed in house ${lord.planet.house}, matching the ${houseList(recipe.targetHouses)} house condition.`
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
        `The ${recipe.houseA}th lord (${lordA.lordName}) and ${recipe.houseB}th lord (${lordB.lordName}) exchange houses.`
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
    detect: (chart) => {
      const planet = findPlanet(chart.planets, recipe.planet);
      if (!planet || !recipe.targetHouses.includes(planet.house)) return null;
      return generatedYogaResult(
        recipe,
        planetStrength(recipe.planet, planet.sign),
        [recipe.planet],
        `${recipe.planet} is placed in house ${planet.house}, matching the ${houseList(recipe.targetHouses)} house condition.`
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
                description: `${tl.lord} rules both the ${tl.house}th house (trikona) and ${kl.house}th house (kendra), forming Raja Yoga.`,
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
                description: `Lord of the ${tl.house}th (${tl.lord}) is conjunct lord of the ${kl.house}th (${kl.lord}) in ${p1.sign}.`,
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
            .map((f) => `Lord of the ${f.fromHouse}th house (${f.lord}) is placed in the ${f.inHouse}th house`)
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
