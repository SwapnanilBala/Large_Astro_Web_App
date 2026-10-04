import type { PlanetPosition } from "../../swiss-ephemeris-engine";
import type { GeneratedYogaRecipe, YogaChartInput, YogaDefinition } from "../types";
import {
  CLASSICAL_PLANETS,
  DUAL_SIGNS,
  FIXED_SIGNS,
  MOVABLE_SIGNS,
  NATURAL_BENEFICS,
  NATURAL_MALEFICS,
} from "../tables";
import {
  generatedYogaResult,
  isInKendra,
  overallStrength,
  planetStrength,
  uniquePlanetNames,
} from "../helpers";
import { houseList } from "../factories";
import { NABHASA_SOURCE } from "./sources";

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
  /*
   * Vajra and Yava almost never occur, and the texts know it. Both put Mercury
   * and Venus a quarter of the way round from the Sun -- the fourth sign from
   * it or the tenth, at least 60 degrees away -- and Mercury never strays more
   * than about 28 degrees from the Sun, Venus about 47. Varahamihira raises
   * exactly this in the next verse (Brihat Jataka 12.6) and keeps the pair only
   * because earlier writers gave it. By whole-sign houses they cannot happen
   * at all. With unequal house cusps at high latitudes they can, which is how
   * the 1885 translator defends them, and `house` here comes from whichever
   * system the chart uses. Neither fired once in 50,000 sampled charts on any
   * of the six systems, so the reachability test builds a chart for each.
   */
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
    id: "yava", name: "Yava Yoga", sanskrit: "यव योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "beneficMaleficSplit", beneficHouses: [4, 10], maleficHouses: [1, 7] },
    description: "The malefics hold the 1st and 7th houses while the natural benefics hold the 4th and 10th -- Vajra reversed, hard at the ends and full through the middle, like the barley grain it is named for.",
    effects: "Harder at the beginning and end of life and best through the middle. Strength and capacity are marked, and the working years are where comfort and standing gather.",
    activation_timing: "the middle decades of life, and the periods of the benefics in the 4th and 10th",
    key_traits: ["strength", "capacity", "mid-life peak"],
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
    id: "kedara", name: "Kedara Yoga", sanskrit: "केदार योग", category: "nabhasa",
    source: NABHASA_SOURCE,
    pattern: { kind: "signCount", count: 4 },
    description: "The seven classical planets are spread across four signs.",
    effects: "Gives a cultivator's temperament -- the field in the old reading, any patiently tended enterprise in the modern one. Means come from steady work, and being useful to others is a settled habit.",
    activation_timing: "long stretches of steady productive work, land and property matters, and the periods of the 4th lord",
    key_traits: ["cultivation", "usefulness", "steadiness"],
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

/** The 32 Nabhasa figures, built from the patterns above. */
export const NABHASA_YOGA_DEFINITIONS: YogaDefinition[] =
  NABHASA_YOGA_RECIPES.map(createNabhasaYoga);
