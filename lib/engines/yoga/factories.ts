import type { PlanetPosition } from "../swiss-ephemeris-engine";
import type {
  ConjunctionRecipe,
  HouseLordPlacementRecipe,
  MutualHouseLordRecipe,
  PlanetHouseRecipe,
  RelativePlanetRecipe,
  YogaDefinition,
} from "./types";
import {
  findPlanet,
  generatedYogaResult,
  houseLordPlanet,
  overallStrength,
  planetStrength,
  planetsInRelativeHouses,
  uniquePlanetNames,
} from "./helpers";

export function houseList(houses: number[]): string {
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
export function placementClause(subject: string, house: number, targets: number[]): string {
  if (targets.length === 1) return `${subject} occupies the ${ordinal(house)} house.`;
  return `${subject} is placed in house ${house}, matching the ${houseList(targets)} house condition.`;
}

/**
 * House numbers reach the reader inside sentences, and a bare `th` produced
 * "the 1th lord" for every combination involving the ascendant, the 2nd or the
 * 3rd. Only twelve values ever pass through here, but the general rule is no
 * longer to write than the special case would be.
 */
export function ordinal(house: number): string {
  const teens = house % 100;
  if (teens >= 11 && teens <= 13) return house + "th";
  switch (house % 10) {
    case 1: return house + "st";
    case 2: return house + "nd";
    case 3: return house + "rd";
    default: return house + "th";
  }
}

export function createHouseLordPlacementYoga(recipe: HouseLordPlacementRecipe): YogaDefinition {
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

export function createMutualHouseLordYoga(recipe: MutualHouseLordRecipe): YogaDefinition {
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

export function createPlanetHouseYoga(recipe: PlanetHouseRecipe): YogaDefinition {
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

export function createRelativePlanetYoga(recipe: RelativePlanetRecipe): YogaDefinition {
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

export function createConjunctionYoga(recipe: ConjunctionRecipe): YogaDefinition {
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
