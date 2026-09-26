import type { PlanetPosition, HousePlacement } from "../swiss-ephemeris-engine";

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

export type YogaCandidateResult = Omit<YogaDetectionResult, "occurrence_chance"> | YogaDetectionResult;

export interface YogaDefinition {
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
// Recipe shapes
// --------------------------------------------------------------------------
/*
 * The inputs to the factories in factories.ts. They live here rather than
 * beside the factories so that helpers.ts can type `generatedYogaResult`
 * against GeneratedYogaRecipe without importing the module that imports it.
 */
export type GeneratedYogaRecipe = {
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

export type HouseLordPlacementRecipe = GeneratedYogaRecipe & {
  fromHouse: number;
  targetHouses: number[];
};

export type MutualHouseLordRecipe = GeneratedYogaRecipe & {
  houseA: number;
  houseB: number;
};

export type PlanetHouseRecipe = GeneratedYogaRecipe & {
  planet: string;
  targetHouses: number[];
};

export type RelativePlanetRecipe = GeneratedYogaRecipe & {
  basePlanet: string;
  allowedPlanets: string[];
  relativeHouses: number[];
  minCount: number;
};

export type ConjunctionRecipe = GeneratedYogaRecipe & {
  planets: string[];
};
