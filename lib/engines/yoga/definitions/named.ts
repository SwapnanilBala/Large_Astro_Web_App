import type { PlanetPosition } from "../../swiss-ephemeris-engine";
import type { YogaChartInput, YogaDefinition } from "../types";
import { CLASSICAL_PLANETS, FIXED_SIGNS, NATURAL_BENEFICS, NATURAL_MALEFICS } from "../tables";
import {
  findPlanet,
  hasFullAspect,
  houseLordPlanet,
  isInKendra,
  isInTrikona,
  overallStrength,
  planetStrength,
  richYogaDetail,
  uniquePlanetNames,
} from "../helpers";
import { ordinal } from "../factories";
import { dignifiedInRasiOrNavamsa } from "../navamsa";

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

export const NAMED_CLASSICAL_YOGA_DEFINITIONS: YogaDefinition[] = [
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
