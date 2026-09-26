import type { PlanetPosition, HousePlacement } from "../swiss-ephemeris-engine";
import type {
  GeneratedYogaRecipe,
  YogaCandidateResult,
  YogaChartInput,
  YogaDetectionResult,
} from "./types";
import {
  PLANET_DEBILITATIONS,
  PLANET_EXALTATIONS,
  PLANET_OWN_SIGNS,
  SIGN_RULERS,
  ZODIAC_SIGNS,
} from "./tables";

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

export function findPlanet(planets: PlanetPosition[], name: string): PlanetPosition | undefined {
  return planets.find((p) => p.name === name);
}

export function signDistance(fromSign: string, toSign: string): number {
  const fi = ZODIAC_SIGNS.indexOf(fromSign);
  const ti = ZODIAC_SIGNS.indexOf(toSign);
  return ((ti - fi + 12) % 12) + 1;
}

export function planetStrength(planet: string, sign: string): "strong" | "moderate" | "weak" {
  if (isExalted(planet, sign)) return "strong";
  if (isOwnSign(planet, sign)) return "strong";
  if (isDebilitated(planet, sign)) return "weak";
  return "moderate";
}

export function overallStrength(strengths: Array<"strong" | "moderate" | "weak">): "strong" | "moderate" | "weak" {
  if (strengths.includes("strong") && !strengths.includes("weak")) return "strong";
  if (strengths.includes("weak") && !strengths.includes("strong")) return "weak";
  return "moderate";
}

export function planetsInRelativeHouse(
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

export function planetsInRelativeHouses(
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

export function uniquePlanetNames(planets: PlanetPosition[]): string[] {
  return [...new Set(planets.map((planet) => planet.name))];
}

export function houseLordPlanet(
  houseNum: number,
  chart: YogaChartInput
): { lordName: string; planet?: PlanetPosition } {
  const lordName = getHouseLord(houseNum, chart.houses, chart.ascendantSign);
  return { lordName, planet: findPlanet(chart.planets, lordName) };
}

export function hasFullAspect(from: PlanetPosition, to: PlanetPosition): boolean {
  return [1, 5, 7, 9].includes(signDistance(from.sign, to.sign));
}

export function calculateOccurrenceChance(yoga: Omit<YogaDetectionResult, "occurrence_chance">): number {
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

export function withOccurrenceChance(
  yoga: YogaCandidateResult
): YogaDetectionResult {
  if ("occurrence_chance" in yoga) return yoga;
  return {
    ...yoga,
    occurrence_chance: calculateOccurrenceChance(yoga),
  };
}

export function richYogaDetail(
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

export function generatedYogaResult(
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
