import type { YogaDefinition } from "../types";
import { CLASSICAL_PLANETS } from "../tables";
import { houseLordPlanet, overallStrength, planetStrength, richYogaDetail, uniquePlanetNames } from "../helpers";
import { getSignLord, findPlanet, isExalted, isOwnSign, isInKendra, isInTrikona } from "../helpers";
import { ascendantNavamsaSign, navamsaDispositor, navamsaSigns } from "../navamsa";
import { ordinal } from "../factories";

export const NAVAMSA_YOGA_DEFINITIONS: YogaDefinition[] = [
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
