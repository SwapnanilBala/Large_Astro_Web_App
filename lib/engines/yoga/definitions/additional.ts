import type { PlanetPosition } from "../../swiss-ephemeris-engine";
import type { YogaDefinition } from "../types";
import {
  CLASSICAL_PLANETS,
  NATURAL_BENEFICS,
  NATURAL_MALEFICS,
  PLANET_EXALTATIONS,
} from "../tables";
import {
  findPlanet,
  getSignLord,
  hasFullAspect,
  houseLordPlanet,
  isDebilitated,
  isInDusthana,
  isInKendra,
  isInTrikona,
  overallStrength,
  planetStrength,
  planetsInRelativeHouse,
  planetsInRelativeHouses,
  signDistance,
  uniquePlanetNames,
} from "../helpers";

// --------------------------------------------------------------------------
// Yoga definitions
// --------------------------------------------------------------------------

export const ADDITIONAL_YOGA_DEFINITIONS: YogaDefinition[] = [
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
