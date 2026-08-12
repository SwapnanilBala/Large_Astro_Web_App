import type {
  DomainRuleHit,
  DomainSignalProfile,
  DivisionalChartInfo,
  LifeDomainKey,
  ShadbalaResult,
  AshtakavargaData,
  YogaDetectionResult,
} from "@/lib/astro-types";
import {
  planetDignity,
} from "@/lib/rules/context";
import type {
  HousePlacement,
  PlanetPosition,
} from "./swiss-ephemeris-engine";

export const LIFE_DOMAIN_RULES_VERSION = "2026-08-domain-v3";

type LifeDomainRuleInput = {
  key: LifeDomainKey;
  label: string;
  primaryHouse: HousePlacement;
  secondaryHouse: HousePlacement;
  primaryLord: PlanetPosition;
  secondaryLord: PlanetPosition;
  anchorPlanet: PlanetPosition;
  planets: PlanetPosition[];
  houses: HousePlacement[];
  evidence?: LifeDomainExtendedEvidence;
};

export type LifeDomainExtendedEvidence = {
  divisionalCharts?: Record<number, DivisionalChartInfo> | null;
  shadbala?: ShadbalaResult[] | null;
  ashtakavarga?: AshtakavargaData | null;
  yogas?: YogaDetectionResult[] | null;
  timingLords?: string[];
  transits?: Array<{ name: string; sign: string }>;
};

type DomainEvidenceConfig = {
  houses: number[];
  planets: string[];
  divisions: number[];
  yogaCategories: YogaDetectionResult["category"][];
};

export const LIFE_DOMAIN_EVIDENCE_CONFIG: Record<LifeDomainKey, DomainEvidenceConfig> = {
  love_life: { houses: [5, 7, 8, 12], planets: ["Venus", "Jupiter", "Moon"], divisions: [9], yogaCategories: ["benefic"] },
  career: { houses: [2, 6, 10, 11], planets: ["Saturn", "Mercury", "Sun", "Jupiter"], divisions: [10], yogaCategories: ["wealth", "mahapurusha"] },
  family: { houses: [2, 4], planets: ["Moon", "Jupiter"], divisions: [4, 7, 12], yogaCategories: ["benefic"] },
  inheritance: { houses: [2, 8], planets: ["Jupiter", "Saturn"], divisions: [2], yogaCategories: ["wealth", "viparita"] },
  influence: { houses: [3, 10, 11], planets: ["Sun", "Mercury", "Jupiter"], divisions: [5, 10, 11], yogaCategories: ["wealth", "benefic", "mahapurusha"] },
  life_cycle: { houses: [1, 8, 12], planets: ["Moon", "Saturn"], divisions: [8, 27, 30], yogaCategories: ["viparita", "benefic"] },
  travel_destinations: { houses: [3, 4, 9, 12], planets: ["Jupiter", "Moon"], divisions: [4, 12], yogaCategories: ["benefic"] },
};

type RuleDraft = Omit<DomainRuleHit, "weight"> & { weight: number };

const NATURAL_BENEFICS = new Set(["Jupiter", "Venus"]);
const NATURAL_MALEFICS = new Set(["Mars", "Saturn", "Rahu", "Ketu"]);
const ANGULAR_HOUSES = new Set([1, 4, 7, 10]);
const TRINAL_HOUSES = new Set([1, 5, 9]);
const GROWTH_HOUSES = new Set([3, 6, 10, 11]);
const PRESSURE_HOUSES = new Set([6, 8, 12]);
const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

function domainName(label: string): string {
  return label.toLowerCase();
}

function dignityOf(planet: PlanetPosition) {
  return planetDignity(planet.name, planet.sign);
}

function wholeSignDistance(fromHouse: number, toHouse: number): number {
  return ((toHouse - fromHouse + 12) % 12) + 1;
}

function aspectDistances(planetName: string): number[] {
  if (planetName === "Mars") return [4, 7, 8];
  if (planetName === "Jupiter") return [5, 7, 9];
  if (planetName === "Saturn") return [3, 7, 10];
  return [7];
}

function aspectsHouse(planet: PlanetPosition, houseNumber: number): boolean {
  return aspectDistances(planet.name).includes(
    wholeSignDistance(planet.house, houseNumber)
  );
}

function uniquePlanetNames(planets: PlanetPosition[]): string[] {
  return [...new Set(planets.map((planet) => planet.name))];
}

function addRule(rules: RuleDraft[], rule: RuleDraft): void {
  if (rules.some((candidate) => candidate.id === rule.id)) return;
  rules.push(rule);
}

function addDignityRule(
  rules: RuleDraft[],
  role: "primary" | "supporting" | "anchor",
  planet: PlanetPosition,
  label: string
): void {
  const dignity = dignityOf(planet);
  const topic = domainName(label);
  const roleLabel =
    role === "primary"
      ? "main delivery planet"
      : role === "supporting"
        ? "supporting planet"
        : "instinct planet";

  if (dignity === "exalted" || dignity === "own_sign") {
    addRule(rules, {
      id: `${role}_dignity_strong`,
      label: `${planet.name} is well supported`,
      impact: "support",
      weight: role === "primary" ? 0.14 : role === "anchor" ? 0.1 : 0.08,
      summary: `${planet.name} is strongly placed, giving ${topic} a more coherent and repeatable route to results.`,
      technical_note: `${planet.name}, the ${roleLabel}, is ${dignity.replace("_", " ")} in ${planet.sign}.`,
    });
  } else if (dignity === "debilitated") {
    addRule(rules, {
      id: `${role}_dignity_weak`,
      label: `${planet.name} needs deliberate support`,
      impact: "pressure",
      weight: role === "primary" ? 0.14 : role === "anchor" ? 0.1 : 0.07,
      summary: `${planet.name} needs more structure here, so ${topic} improves through correction, pacing, and better safeguards.`,
      technical_note: `${planet.name}, the ${roleLabel}, is debilitated in ${planet.sign}.`,
    });
  } else {
    addRule(rules, {
      id: `${role}_dignity_neutral`,
      label: `${planet.name} depends on context`,
      impact: "context",
      weight: 0.02,
      summary: `${planet.name} is neutral by dignity, making consistent choices more important than a single favorable placement.`,
      technical_note: `${planet.name}, the ${roleLabel}, is neutral by dignity in ${planet.sign}.`,
    });
  }

  if (planet.is_retrograde) {
    addRule(rules, {
      id: `${role}_retrograde`,
      label: `${planet.name} works through revision`,
      impact: "pressure",
      weight: role === "primary" ? 0.06 : 0.04,
      summary: `${planet.name} is retrograde, so ${topic} tends to mature through review, returns, and decisions that improve on a second pass.`,
      technical_note: `${planet.name}, the ${roleLabel}, is retrograde in house ${planet.house}.`,
    });
  }

  if (planet.is_combust) {
    addRule(rules, {
      id: `${role}_combust`,
      label: `${planet.name} can be overshadowed`,
      impact: "pressure",
      weight: role === "primary" ? 0.07 : 0.045,
      summary: `${planet.name} is close to the Sun, so visibility or urgency can drown out the quieter conditions ${topic} needs.`,
      technical_note: `${planet.name}, the ${roleLabel}, is marked combust in house ${planet.house}.`,
    });
  }
}

function addDeliveryRule(
  rules: RuleDraft[],
  primaryLord: PlanetPosition,
  label: string
): void {
  const topic = domainName(label);
  if (PRESSURE_HOUSES.has(primaryLord.house)) {
    addRule(rules, {
      id: "delivery_pressure_house",
      label: "Results require more processing",
      impact: "pressure",
      weight: 0.09,
      summary: `${topic[0].toUpperCase()}${topic.slice(1)} develops through work, restructuring, or release before the result feels settled.`,
      technical_note: `The primary lord ${primaryLord.name} delivers through pressure house ${primaryLord.house}.`,
    });
  } else if (ANGULAR_HOUSES.has(primaryLord.house)) {
    addRule(rules, {
      id: "delivery_angular_house",
      label: "Results become visible",
      impact: "activation",
      weight: 0.1,
      summary: `${topic[0].toUpperCase()}${topic.slice(1)} tends to create visible decisions and concrete changes rather than staying in the background.`,
      technical_note: `The primary lord ${primaryLord.name} occupies angular house ${primaryLord.house}.`,
    });
  } else if (TRINAL_HOUSES.has(primaryLord.house)) {
    addRule(rules, {
      id: "delivery_trinal_house",
      label: "The delivery path has natural support",
      impact: "support",
      weight: 0.08,
      summary: `${topic[0].toUpperCase()}${topic.slice(1)} benefits from learning, judgement, creativity, or well-timed guidance.`,
      technical_note: `The primary lord ${primaryLord.name} occupies trinal house ${primaryLord.house}.`,
    });
  } else if (GROWTH_HOUSES.has(primaryLord.house)) {
    addRule(rules, {
      id: "delivery_growth_house",
      label: "Results improve with repetition",
      impact: "activation",
      weight: 0.07,
      summary: `${topic[0].toUpperCase()}${topic.slice(1)} strengthens through practice, useful effort, and responsibilities that compound over time.`,
      technical_note: `The primary lord ${primaryLord.name} occupies growth house ${primaryLord.house}.`,
    });
  }
}

function addOccupancyAndAspectRules(
  rules: RuleDraft[],
  input: LifeDomainRuleInput
): void {
  const { label, primaryHouse, planets } = input;
  const topic = domainName(label);
  const occupants = primaryHouse.planets
    .map((name) => planets.find((planet) => planet.name === name))
    .filter((planet): planet is PlanetPosition => Boolean(planet));
  const beneficOccupants = occupants.filter((planet) => NATURAL_BENEFICS.has(planet.name));
  const maleficOccupants = occupants.filter((planet) => NATURAL_MALEFICS.has(planet.name));
  const beneficAspects = planets.filter(
    (planet) => NATURAL_BENEFICS.has(planet.name) && aspectsHouse(planet, primaryHouse.house_number)
  );
  const maleficAspects = planets.filter(
    (planet) => NATURAL_MALEFICS.has(planet.name) && aspectsHouse(planet, primaryHouse.house_number)
  );

  if (occupants.length > 0) {
    const names = uniquePlanetNames(occupants);
    addRule(rules, {
      id: "primary_house_occupied",
      label: "This area is foregrounded",
      impact: "activation",
      weight: Math.min(0.13, 0.065 + occupants.length * 0.02),
      summary: `${names.join(" and ")} make ${topic} harder to ignore; choices here tend to produce visible consequences.`,
      technical_note: `${names.join(", ")} occupy the primary house ${primaryHouse.house_number}.`,
    });
  } else {
    addRule(rules, {
      id: "primary_house_unoccupied",
      label: "The result depends on its ruler",
      impact: "context",
      weight: 0.02,
      summary: `${topic[0].toUpperCase()}${topic.slice(1)} is not defined by a direct occupant, so the delivery planet and timing periods carry more weight.`,
      technical_note: `Primary house ${primaryHouse.house_number} is unoccupied.`,
    });
  }

  if (beneficOccupants.length > 0 || beneficAspects.length > 0) {
    const names = uniquePlanetNames([...beneficOccupants, ...beneficAspects]);
    addRule(rules, {
      id: "benefic_support",
      label: "Protective planets reinforce the area",
      impact: "support",
      weight: Math.min(0.12, 0.055 + names.length * 0.025),
      summary: `${names.join(" and ")} add protection, counsel, or easier recovery to ${topic}.`,
      technical_note: `${names.join(", ")} occupy or cast a whole-sign aspect to primary house ${primaryHouse.house_number}.`,
    });
  }

  if (maleficOccupants.length > 0 || maleficAspects.length > 0) {
    const names = uniquePlanetNames([...maleficOccupants, ...maleficAspects]);
    addRule(rules, {
      id: "malefic_pressure",
      label: "Pressure planets demand maturity",
      impact: "pressure",
      weight: Math.min(0.13, 0.055 + names.length * 0.025),
      summary: `${names.join(" and ")} make ${topic} more demanding; boundaries, preparation, and recovery time are part of the result.`,
      technical_note: `${names.join(", ")} occupy or cast a whole-sign aspect to primary house ${primaryHouse.house_number}.`,
    });
  }
}

function addConnectionRules(rules: RuleDraft[], input: LifeDomainRuleInput): void {
  const {
    label,
    primaryHouse,
    secondaryHouse,
    primaryLord,
    secondaryLord,
    anchorPlanet,
  } = input;
  const topic = domainName(label);
  const isExchange =
    primaryLord.house === secondaryHouse.house_number &&
    secondaryLord.house === primaryHouse.house_number;
  const sameLord = primaryLord.name === secondaryLord.name;
  const oneWayLink =
    primaryLord.house === secondaryHouse.house_number ||
    secondaryLord.house === primaryHouse.house_number;

  if (isExchange) {
    addRule(rules, {
      id: "primary_secondary_exchange",
      label: "The main and supporting paths exchange roles",
      impact: "activation",
      weight: 0.15,
      summary: `${topic[0].toUpperCase()}${topic.slice(1)} is tightly tied to its supporting life area; movement in either one quickly affects the other.`,
      technical_note: `${primaryLord.name} and ${secondaryLord.name} exchange houses ${primaryHouse.house_number} and ${secondaryHouse.house_number}.`,
    });
  } else if (sameLord) {
    addRule(rules, {
      id: "shared_domain_lord",
      label: "One planet carries both pathways",
      impact: "activation",
      weight: 0.11,
      summary: `${primaryLord.name} carries both the main and supporting pathways, concentrating ${topic} around one set of choices and timing periods.`,
      technical_note: `${primaryLord.name} rules both houses ${primaryHouse.house_number} and ${secondaryHouse.house_number}.`,
    });
  } else if (oneWayLink) {
    addRule(rules, {
      id: "primary_secondary_link",
      label: "The supporting area feeds the result",
      impact: "activation",
      weight: 0.075,
      summary: `${topic[0].toUpperCase()}${topic.slice(1)} and its supporting area are directly linked, so progress rarely happens in only one of them.`,
      technical_note: `A domain lord occupies the other domain house: ${primaryLord.name} in ${primaryLord.house}, ${secondaryLord.name} in ${secondaryLord.house}.`,
    });
  }

  if (anchorPlanet.house === primaryHouse.house_number) {
    addRule(rules, {
      id: "anchor_in_primary",
      label: `${anchorPlanet.name} directly activates the area`,
      impact: "activation",
      weight: 0.1,
      summary: `${anchorPlanet.name} sits directly in this area, making instinct, preference, and timing unusually central to ${topic}.`,
      technical_note: `${anchorPlanet.name}, the anchor planet, occupies primary house ${primaryHouse.house_number}.`,
    });
  }

  if (
    anchorPlanet.name !== primaryLord.name &&
    (anchorPlanet.house === primaryLord.house ||
      aspectsHouse(anchorPlanet, primaryLord.house) ||
      aspectsHouse(primaryLord, anchorPlanet.house))
  ) {
    addRule(rules, {
      id: "anchor_primary_connection",
      label: "Instinct and delivery are connected",
      impact: "support",
      weight: 0.065,
      summary: `${anchorPlanet.name} and ${primaryLord.name} are connected, helping instinct and practical delivery inform one another in ${topic}.`,
      technical_note: `${anchorPlanet.name} and ${primaryLord.name} are conjunct or linked by a whole-sign graha aspect.`,
    });
  }
}

function addMatrixNatalRules(rules: RuleDraft[], input: LifeDomainRuleInput): void {
  const config = LIFE_DOMAIN_EVIDENCE_CONFIG[input.key];
  const relevantHouses = config.houses
    .map((houseNumber) => input.houses.find((house) => house.house_number === houseNumber))
    .filter((house): house is HousePlacement => Boolean(house));
  const occupiedHouses = relevantHouses.filter((house) => house.planets.length > 0);
  const relevantPlanets = input.planets.filter((planet) => config.planets.includes(planet.name));
  const strongPlanets = relevantPlanets.filter((planet) => {
    const dignity = dignityOf(planet);
    return dignity === "exalted" || dignity === "own_sign";
  });
  const pressuredPlanets = relevantPlanets.filter((planet) =>
    dignityOf(planet) === "debilitated" || planet.is_combust
  );

  if (occupiedHouses.length >= 2) {
    addRule(rules, {
      id: "matrix_primary_houses_active",
      label: "Several domain houses are activated",
      impact: "activation",
      weight: Math.min(0.12, 0.055 + occupiedHouses.length * 0.018),
      summary: `Multiple houses central to ${domainName(input.label)} are occupied, so this area carries more than one active route to results.`,
      technical_note: `Relevant occupied houses: ${occupiedHouses.map((house) => `H${house.house_number} (${house.planets.join(", ")})`).join("; ")}.`,
    });
  }

  if (strongPlanets.length > 0) {
    addRule(rules, {
      id: "matrix_support_planets_strong",
      label: "Domain planets reinforce the promise",
      impact: "support",
      weight: Math.min(0.1, 0.055 + strongPlanets.length * 0.02),
      summary: `${strongPlanets.map((planet) => planet.name).join(" and ")} give this domain additional natal support beyond its main ruler.`,
      technical_note: `${strongPlanets.map((planet) => `${planet.name} ${dignityOf(planet).replace("_", " ")} in ${planet.sign}`).join(", ")}.`,
    });
  }

  if (pressuredPlanets.length > 0) {
    addRule(rules, {
      id: "matrix_support_planets_pressured",
      label: "A domain planet creates a delivery condition",
      impact: "pressure",
      weight: Math.min(0.1, 0.055 + pressuredPlanets.length * 0.02),
      summary: `${pressuredPlanets.map((planet) => planet.name).join(" and ")} add a real delivery constraint that should be weighed against the stronger indicators.`,
      technical_note: `${pressuredPlanets.map((planet) => `${planet.name}: ${dignityOf(planet)}${planet.is_combust ? ", combust" : ""}`).join("; ")}.`,
    });
  }
}

function divisionalDignity(planetName: string, sign: string): "strong" | "weak" | "neutral" {
  const dignity = planetDignity(planetName, sign);
  if (dignity === "exalted" || dignity === "own_sign") return "strong";
  if (dignity === "debilitated") return "weak";
  return "neutral";
}

function addExtendedEvidenceRules(rules: RuleDraft[], input: LifeDomainRuleInput): void {
  const evidence = input.evidence;
  if (!evidence) return;

  const config = LIFE_DOMAIN_EVIDENCE_CONFIG[input.key];
  const relevantPlanets = uniquePlanetNames([
    input.primaryLord,
    input.secondaryLord,
    input.anchorPlanet,
    ...input.planets.filter((planet) => config.planets.includes(planet.name)),
  ]);
  const divisionalReadings = config.divisions.flatMap((division) => {
    const chart = evidence.divisionalCharts?.[division];
    if (!chart) return [];
    return relevantPlanets.flatMap((planetName) => {
      const position = chart.positions.find((item) => item.name === planetName);
      if (!position) return [];
      return [{ division, planetName, sign: position.divisional_sign, dignity: divisionalDignity(planetName, position.divisional_sign) }];
    });
  });
  const strongDivisional = divisionalReadings.filter((item) => item.dignity === "strong");
  const weakDivisional = divisionalReadings.filter((item) => item.dignity === "weak");

  if (strongDivisional.length > 0) {
    const lead = strongDivisional[0];
    addRule(rules, {
      id: "divisional_confirmation",
      label: `D${lead.division} reinforces delivery`,
      impact: "support",
      weight: 0.09,
      summary: `The natal promise receives confirmation in D${lead.division}, where ${lead.planetName} has strong sign support.`,
      technical_note: `${lead.planetName} is ${lead.sign} in D${lead.division}; divisional evidence is used as confirmation, not an override.`,
    });
  }
  if (weakDivisional.length > 0) {
    const lead = weakDivisional[0];
    addRule(rules, {
      id: "divisional_qualification",
      label: `D${lead.division} qualifies delivery`,
      impact: "pressure",
      weight: 0.085,
      summary: `The natal promise is present, but D${lead.division} shows that delivery needs more maturity and support.`,
      technical_note: `${lead.planetName} is debilitated in ${lead.sign} in D${lead.division}; this qualifies rather than erases the natal indication.`,
    });
  }

  const shadbalaResults = (evidence.shadbala ?? []).filter((item) =>
    relevantPlanets.includes(item.planet)
  );
  const strongStrength = shadbalaResults.filter((item) => item.strengthRatio >= 1);
  const weakStrength = shadbalaResults.filter((item) => item.strengthRatio < 0.85);
  if (strongStrength.length > 0) {
    addRule(rules, {
      id: "shadbala_delivery_strength",
      label: "Delivery planets have measured capacity",
      impact: "support",
      weight: 0.08,
      summary: `${strongStrength.map((item) => item.planet).join(" and ")} have enough measured strength to deliver more of the natal promise.`,
      technical_note: `${strongStrength.map((item) => `${item.planet} ${item.strengthRatio.toFixed(2)}x`).join(", ")} their Shadbala minimum.`,
    });
  }
  if (weakStrength.length > 0) {
    addRule(rules, {
      id: "shadbala_delivery_limit",
      label: "A delivery planet needs reinforcement",
      impact: "pressure",
      weight: 0.075,
      summary: `${weakStrength.map((item) => item.planet).join(" and ")} show limited measured capacity, so the promise needs stronger conditions to become consistent.`,
      technical_note: `${weakStrength.map((item) => `${item.planet} ${item.strengthRatio.toFixed(2)}x`).join(", ")} their Shadbala minimum.`,
    });
  }

  const sav = evidence.ashtakavarga?.sarvashtakavarga;
  if (sav) {
    const houseScores = config.houses.map((house) => ({
      house,
      sign: input.primaryHouse.house_number === house
        ? input.primaryHouse.sign
        : undefined,
      score: sav[(SIGN_INDEX_FOR_EVIDENCE(input, house))],
    }));
    const average = houseScores.reduce((sum, item) => sum + item.score, 0) / houseScores.length;
    addRule(rules, {
      id: average >= 28 ? "ashtakavarga_house_support" : average <= 25 ? "ashtakavarga_house_pressure" : "ashtakavarga_house_mixed",
      label: average >= 28 ? "Relevant houses have strong point support" : average <= 25 ? "Relevant houses need better activation conditions" : "Relevant houses have mixed point support",
      impact: average >= 28 ? "support" : average <= 25 ? "pressure" : "context",
      weight: average >= 28 || average <= 25 ? 0.075 : 0.025,
      summary: average >= 28
        ? "The relevant houses have above-average Ashtakavarga support, improving delivery conditions."
        : average <= 25
          ? "The relevant houses have lighter Ashtakavarga support, so timing and preparation matter more than promise alone."
          : "The relevant houses have mixed Ashtakavarga support, making outcomes more conditional than automatic.",
      technical_note: `Relevant-house Sarvashtakavarga average: ${average.toFixed(1)} bindus (${houseScores.map((item) => `H${item.house}:${item.score}`).join(", ")}).`,
    });
  }

  const matchingYogas = (evidence.yogas ?? []).filter(
    (yoga) => yoga.present && config.yogaCategories.includes(yoga.category) &&
      yoga.involved_planets.some((planet) => relevantPlanets.includes(planet))
  );
  if (matchingYogas.length > 0) {
    const lead = matchingYogas.sort((left, right) => {
      const rank = { strong: 3, moderate: 2, weak: 1 };
      return rank[right.strength] - rank[left.strength];
    })[0];
    addRule(rules, {
      id: "domain_yoga_support",
      label: `${lead.name} adds a supporting pattern`,
      impact: "support",
      weight: lead.strength === "strong" ? 0.075 : 0.05,
      summary: `${lead.name} reinforces this area, but it remains supporting evidence rather than a standalone verdict.`,
      technical_note: `${lead.name} (${lead.category}, ${lead.strength}) involves ${lead.involved_planets.join(", ")}.`,
    });
  }

  const activeTimingLords = uniquePlanetNames(
    input.planets.filter((planet) => (evidence.timingLords ?? []).includes(planet.name))
  );
  const alignedTiming = activeTimingLords.filter((planet) => relevantPlanets.includes(planet));
  if (alignedTiming.length > 0) {
    addRule(rules, {
      id: "timing_alignment",
      label: "The active period aligns with this domain",
      impact: "activation",
      weight: 0.075,
      summary: `${alignedTiming.join(" and ")} timing directly activates one of this domain's delivery planets.`,
      technical_note: `Active dasha lords ${activeTimingLords.join(", ")} overlap the domain planet set ${relevantPlanets.join(", ")}.`,
    });
  } else if (activeTimingLords.length > 0) {
    addRule(rules, {
      id: "timing_indirect",
      label: "Current timing is indirect",
      impact: "context",
      weight: 0.02,
      summary: "The current period does not directly activate a main delivery planet, so this domain needs clearer external triggers.",
      technical_note: `Active dasha lords ${activeTimingLords.join(", ")} do not overlap the domain planet set ${relevantPlanets.join(", ")}.`,
    });
  }

  const ascendantSign = input.houses.find((house) => house.house_number === 1)?.sign;
  const ascendantIndex = ascendantSign ? ZODIAC_SIGNS.indexOf(ascendantSign) : -1;
  const transitSignals = (evidence.transits ?? [])
    .filter((transit) => ["Jupiter", "Saturn"].includes(transit.name))
    .map((transit) => {
      const transitIndex = ZODIAC_SIGNS.indexOf(transit.sign);
      const transitHouse = ascendantIndex >= 0 && transitIndex >= 0
        ? ((transitIndex - ascendantIndex + 12) % 12) + 1
        : 0;
      const activatedHouses = config.houses.filter((house) =>
        house === transitHouse || aspectDistances(transit.name).includes(wholeSignDistance(transitHouse, house))
      );
      return {
        ...transit,
        transitHouse,
        activatedHouses,
        bindus: evidence.ashtakavarga?.sarvashtakavarga[transitIndex],
      };
    })
    .filter((transit): transit is {
      name: string;
      sign: string;
      transitHouse: number;
      activatedHouses: number[];
      bindus: number;
    } =>
      transit.transitHouse > 0 &&
      transit.activatedHouses.length > 0 &&
      typeof transit.bindus === "number"
    );
  if (transitSignals.length > 0) {
    const transitAverage = transitSignals.reduce((sum, item) => sum + item.bindus, 0) / transitSignals.length;
    addRule(rules, {
      id: transitAverage >= 28 ? "timing_transit_support" : transitAverage <= 25 ? "timing_transit_pressure" : "timing_transit_mixed",
      label: transitAverage >= 28 ? "Current transit signs are well supported" : transitAverage <= 25 ? "Current transit support is light" : "Current transit support is mixed",
      impact: transitAverage >= 28 ? "support" : transitAverage <= 25 ? "pressure" : "context",
      weight: transitAverage >= 28 || transitAverage <= 25 ? 0.065 : 0.02,
      summary: transitAverage >= 28
        ? "Current Jupiter and Saturn transit signs have favorable Ashtakavarga support for activation."
        : transitAverage <= 25
          ? "The natal promise may be stronger than current Jupiter and Saturn transit support, so timing should remain conservative."
          : "Current Jupiter and Saturn transit support is mixed, so external timing is neither a clear accelerator nor a veto.",
      technical_note: `${transitSignals.map((item) => `${item.name} in ${item.sign} (H${item.transitHouse}) activates H${item.activatedHouses.join("/H")}: ${item.bindus}`).join(", ")} SAV bindus; average ${transitAverage.toFixed(1)}.`,
    });
  }
}

function SIGN_INDEX_FOR_EVIDENCE(input: LifeDomainRuleInput, houseNumber: number): number {
  const offset = houseNumber - input.primaryHouse.house_number;
  const primaryIdx = ZODIAC_SIGNS.indexOf(input.primaryHouse.sign);
  return (primaryIdx + offset + 12) % 12;
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function bounded(value: number): number {
  return rounded(Math.max(0.2, Math.min(0.96, value)));
}

function boundedActivity(value: number): number {
  return rounded(Math.max(0.55, Math.min(0.94, value)));
}

function buildSignalProfile(
  rules: DomainRuleHit[],
  input: LifeDomainRuleInput
): DomainSignalProfile {
  const supportWeight = rules
    .filter((rule) => rule.impact === "support")
    .reduce((sum, rule) => sum + rule.weight, 0);
  const pressureWeight = rules
    .filter((rule) => rule.impact === "pressure")
    .reduce((sum, rule) => sum + rule.weight, 0);
  const activationWeight = rules
    .filter((rule) => rule.impact === "activation")
    .reduce((sum, rule) => sum + rule.weight, 0);

  const supportScore = bounded(0.34 + supportWeight);
  const pressureScore = bounded(0.22 + pressureWeight);
  const activityScore = boundedActivity(
    0.57 +
      activationWeight +
      supportWeight * 0.42 -
      pressureWeight * 0.35
  );
  const activityBand =
    activityScore >= 0.78
      ? "prominent"
      : activityScore >= 0.58
        ? "active"
        : "developing";

  return {
    activity_score: activityScore,
    support_score: supportScore,
    pressure_score: pressureScore,
    activity_band: activityBand,
    activation_planets: uniquePlanetNames([
      input.primaryLord,
      input.secondaryLord,
      input.anchorPlanet,
    ]),
  };
}

export function evaluateLifeDomainRules(input: LifeDomainRuleInput): {
  rules: DomainRuleHit[];
  profile: DomainSignalProfile;
} {
  const rules: RuleDraft[] = [];

  addDignityRule(rules, "primary", input.primaryLord, input.label);
  addDignityRule(rules, "supporting", input.secondaryLord, input.label);
  addDignityRule(rules, "anchor", input.anchorPlanet, input.label);
  addDeliveryRule(rules, input.primaryLord, input.label);
  addOccupancyAndAspectRules(rules, input);
  addConnectionRules(rules, input);
  addMatrixNatalRules(rules, input);
  addExtendedEvidenceRules(rules, input);

  const ordered = [...rules].sort((left, right) => {
    const impactOrder = { support: 0, pressure: 1, activation: 2, context: 3 };
    return (
      impactOrder[left.impact] - impactOrder[right.impact] ||
      right.weight - left.weight ||
      left.id.localeCompare(right.id)
    );
  });

  return {
    rules: ordered,
    profile: buildSignalProfile(ordered, input),
  };
}
