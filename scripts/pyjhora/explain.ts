/**
 * Why a same-definition pair disagrees on one chart.
 *
 * Each explainer tests the specific ways PyJHora's code was found to read a
 * rule differently from ours (by reading its source, PyJHora 4.8.7). It returns
 * the first of those reasons that holds for this chart, in the order written,
 * or null when none does. The report
 * counts both: a disagreement no known reason covers is the interesting kind,
 * because it is either a new difference or a bug.
 *
 * The explainers restate PyJHora's reading, not ours, so they are checked
 * against every chart on each run -- if PyJHora changes, reasons stop matching
 * and the unexplained count rises instead of the report quietly going stale.
 */

import { calculateNavamsa } from "../../lib/engines/navamsa-engine";
import type { PlanetPosition } from "../../lib/engines/swiss-ephemeris-engine";
import type { YogaChartInput } from "../../lib/engines/yoga-engine";

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];
const RULERS = ["Mars", "Venus", "Mercury", "Moon", "Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Saturn", "Jupiter"];
const PYJHORA_IDS: Record<string, number> = {
  Sun: 0, Moon: 1, Mars: 2, Mercury: 3, Jupiter: 4, Venus: 5, Saturn: 6, Rahu: 7, Ketu: 8,
};
const SCORPIO = 7;
const AQUARIUS = 10;
const NODES = ["Rahu", "Ketu"];
const CLASSICAL = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
const OWN_OR_EXALTED: Record<string, number[]> = {
  Sun: [4, 0], Moon: [3, 1], Mercury: [2, 5], Venus: [1, 6, 11], Mars: [0, 7, 9], Jupiter: [8, 11, 3], Saturn: [9, 10, 6],
};
const EXALTED: Record<string, number> = {
  Sun: 0, Moon: 1, Mercury: 5, Venus: 11, Mars: 9, Jupiter: 3, Saturn: 6,
};

export type StrengthTable = { table: number[][]; friend: number };

/** PyJHora's pick of lord for [Scorpio, Aquarius], as planet ids, per chart. */
export type CoLords = { rasi: [number, number]; navamsa: [number, number] };

type Basis = keyof CoLords;
type Facts = ReturnType<typeof facts>;

const NAME_BY_ID = Object.fromEntries(Object.entries(PYJHORA_IDS).map(([name, id]) => [id, name]));

function facts(chart: YogaChartInput, strength: StrengthTable, coLords: CoLords) {
  const asc = SIGNS.indexOf(chart.ascendantSign);
  const sign = (name: string) => SIGNS.indexOf((chart.planets.find((p) => p.name === name) as PlanetPosition).sign);
  const houseSign = (house: number) => (asc + house - 1) % 12;
  const from = (base: number, n: number) => (base + n - 1) % 12;
  const inSign = (s: number) => chart.planets.filter((p) => SIGNS.indexOf(p.sign) === s).map((p) => p.name);
  const lordOf = (house: number) => RULERS[houseSign(house)];
  /** True when PyJHora took Ketu or Rahu as the lord of one of these signs. */
  const nodeLordsAny = (signs: number[], basis: Basis) =>
    signs.some((s) => {
      const pick = s === SCORPIO ? coLords[basis][0] : s === AQUARIUS ? coLords[basis][1] : undefined;
      return pick !== undefined && NAME_BY_ID[pick] !== RULERS[s];
    });
  const coLorded = (...houses: number[]) => nodeLordsAny(houses.map(houseSign), "rasi");
  const pyStrong = (name: string) => strength.table[PYJHORA_IDS[name]][sign(name)] >= strength.friend;
  const ownOrExalted = (name: string) => OWN_OR_EXALTED[name]?.includes(sign(name)) ?? false;
  /** PyJHora's _is_mercury_benefic: with Jupiter or Venus, or alone in its sign. */
  const mercuryBenefic = () => {
    const company = inSign(sign("Mercury"));
    return company.includes("Jupiter") || company.includes("Venus") || company.length === 1;
  };
  const pyBenefics = () => ["Jupiter", "Venus", ...(mercuryBenefic() ? ["Mercury"] : [])];
  const planet = (name: string) => chart.planets.find((p) => p.name === name) as PlanetPosition;
  /** Navamsa sign index, from the same calculateNavamsa our yoga engine uses. */
  const navamsaSign = (name: string) => SIGNS.indexOf(calculateNavamsa([planet(name)])[0].navamsa_sign);
  const navamsaLord = (name: string) => RULERS[navamsaSign(name)];
  const exalted = (name: string) => EXALTED[name] === sign(name);
  return {
    asc, sign, houseSign, from, inSign, lordOf, coLorded, nodeLordsAny, pyStrong, ownOrExalted, pyBenefics,
    navamsaSign, navamsaLord, exalted,
  };
}

const CO_LORD_NAVAMSA =
  "a house or navamsa sign this yoga uses is Scorpio or Aquarius, and PyJHora took Ketu or Rahu as its lord (the stronger of each pair) where ours takes Mars or Saturn";
/* PyJHora's strength scale puts own sign (5) above exaltation (4), so its
   `>= _EXALTED_UCCHAM` test, meant as "exalted", also passes own sign. */
const OWN_AS_EXALTED =
  "the navamsa dispositor is in its own sign, not exalted; PyJHora's exaltation test also passes own sign, because its scale ranks own sign above exaltation";

/** Gauri and Bharathi: a navamsa dispositor that must be exalted and join another planet. */
function navamsaDispositorReason(
  f: Facts,
  ours: boolean,
  houses: number[],
  sourceLords: string[],
  partner: string,
  /** Which positions PyJHora judges the navamsa sign's co-lord from. */
  navamsaBasis: Basis
): string | null {
  if (f.coLorded(...houses) || f.nodeLordsAny(sourceLords.map((l) => f.navamsaSign(l)), navamsaBasis)) {
    return CO_LORD_NAVAMSA;
  }
  if (ours) return null;
  const dispositors = sourceLords.map((l) => f.navamsaLord(l));
  if (dispositors.includes(partner) && f.ownOrExalted(partner)) {
    return `the navamsa dispositor is the ${partner === f.lordOf(1) ? "1st" : "9th"} lord itself; PyJHora counts a planet as joining itself, ours needs two planets`;
  }
  if (dispositors.some((d) => f.ownOrExalted(d) && !f.exalted(d))) return OWN_AS_EXALTED;
  return null;
}

/* PyJHora gives Scorpio and Aquarius a second lord (Ketu, Rahu) and takes the
   stronger of the pair, the Jaimini convention; ours uses Mars and Saturn. */
const CO_LORD =
  "a house this yoga uses is Scorpio or Aquarius, and PyJHora took Ketu or Rahu as its lord (the stronger of each pair) where ours takes Mars or Saturn";

/** The 2nd or 12th sign from the Sun or Moon: Vesi, Vosi, Sunapha, Anapha. */
function flankReason(f: Facts, base: string, n: number, excluded: string, ours: boolean): string | null {
  const target = f.from(f.sign(base), n);
  const there = f.inSign(target);
  const classical = there.filter((name) => CLASSICAL.includes(name) && name !== base && name !== excluded);
  if (ours) {
    return there.includes(excluded) ? `${excluded} is also there, and PyJHora cancels the yoga when ${excluded} is present` : null;
  }
  if (classical.length > 0) return null;
  if (there.some((name) => NODES.includes(name))) return "only Rahu or Ketu is there, and PyJHora counts the nodes";
  if (target === f.asc) return "only the ascendant is there, and PyJHora counts the ascendant as a planet";
  return null;
}

function bothFlanks(f: Facts, base: string, excluded: string, ours: boolean): string | null {
  return flankReason(f, base, 2, excluded, ours) ?? flankReason(f, base, 12, excluded, ours);
}

const HOUSE_SETS: Record<string, number[][]> = {
  kamala: [[1, 4, 7, 10]],
  vapi: [[2, 5, 8, 11], [3, 6, 9, 12]],
  yupa: [[1, 2, 3, 4]],
  shara: [[4, 5, 6, 7]],
  shakti_nabhasa: [[7, 8, 9, 10]],
  danda: [[10, 11, 12, 1]],
};

type Explainer = (f: Facts, ours: boolean) => string | null;

const EXPLAINERS: Record<string, Explainer> = {
  vesi: (f, ours) => flankReason(f, "Sun", 2, "Moon", ours),
  vosi: (f, ours) => flankReason(f, "Sun", 12, "Moon", ours),
  ubhayachari: (f, ours) => bothFlanks(f, "Sun", "Moon", ours),
  sunapha: (f, ours) => flankReason(f, "Moon", 2, "Sun", ours),
  anapha: (f, ours) => flankReason(f, "Moon", 12, "Sun", ours),
  durudhara: (f, ours) => bothFlanks(f, "Moon", "Sun", ours),

  adhi: (f, ours) => {
    if (!ours) return null;
    const moon = f.sign("Moon");
    const zone = [6, 7, 8].map((n) => f.from(moon, n));
    const missing = f.pyBenefics().filter((name) => !zone.includes(f.sign(name)));
    return missing.length > 0
      ? `PyJHora needs every benefic in the 6th to 8th from the Moon; ${missing.join(" and ")} is not`
      : null;
  },

  vasumati: (f, ours) => {
    if (!ours) return null;
    const lagna = [3, 6, 10, 11].map((n) => f.houseSign(n));
    const moon = [3, 6, 10, 11].map((n) => f.from(f.sign("Moon"), n));
    const missing = f.pyBenefics().filter((name) => !lagna.includes(f.sign(name)) && !moon.includes(f.sign(name)));
    return missing.length > 0 ? `PyJHora needs every benefic in a growth house; ${missing.join(" and ")} is not` : null;
  },

  sankha: (f, ours) => {
    if (f.coLorded(1, 5, 6, 9, 10)) return CO_LORD;
    if (ours) {
      return !f.pyStrong(f.lordOf(1))
        ? "the 1st lord is only in a neutral sign; PyJHora needs a friend's sign or better, ours only needs it not debilitated"
        : null;
    }
    /* PyJHora's second rule, as its code computes it. It adds the ascendant's
       sign index to the 1st lord's sign index -- already absolute -- before
       testing for a movable sign, so for any ascendant but Aries it tests the
       wrong sign. Reproduced as written so the explanation matches. */
    const firstLordSign = f.sign(f.lordOf(1));
    const secondRule =
      f.pyStrong(f.lordOf(9)) &&
      firstLordSign === f.sign(f.lordOf(10)) &&
      [0, 3, 6, 9].includes((f.asc + firstLordSign) % 12);
    return secondRule
      ? "PyJHora also accepts a second rule: a strong 9th lord, with the 1st and 10th lords together in a movable sign (its code tests the wrong sign unless the ascendant is Aries)"
      : null;
  },

  daridra: (f, ours) => {
    if (ours) return f.coLorded(11) ? CO_LORD : null;
    const secondLordHouse = ((f.sign(f.lordOf(2)) - f.asc + 12) % 12) + 1;
    if ([6, 8, 12].includes(secondLordHouse)) return "the 2nd lord is in the 6th, 8th or 12th; PyJHora counts the 2nd lord as well as the 11th";
    return f.coLorded(2, 11) ? CO_LORD : null;
  },

  saraswati: (f, ours) =>
    !ours && f.pyStrong("Jupiter") && !f.ownOrExalted("Jupiter")
      ? "Jupiter is in a friend's sign; PyJHora counts that as strong, ours needs its own or exaltation sign"
      : null,

  mala: (f, ours) => {
    if (!ours) return null;
    const angles = [1, 4, 7, 10].map((n) => f.houseSign(n));
    const held = angles.filter((a) => f.pyBenefics().some((name) => f.sign(name) === a)).length;
    return held !== 3
      ? `PyJHora's Srik runs its Maalaa rule, which needs benefics in exactly three separate angles; here ${held}`
      : null;
  },

  vajra: (f, ours) =>
    !ours ? "PyJHora needs one benefic in each of the 1st and 7th and one malefic in each of the 4th and 10th; ours needs every one of them placed" : null,

  rajju: (f, ours) =>
    ours && ![0, 3, 6, 9].includes(f.sign("Rahu"))
      ? "Rahu and Ketu are not in movable signs; PyJHora includes the nodes, ours uses the seven planets"
      : null,

  khadga: (f) => (f.coLorded(1, 2, 9) ? CO_LORD : null),

  gauri: (f, ours) => navamsaDispositorReason(f, ours, [1, 10], [f.lordOf(10)], f.lordOf(1), "rasi"),

  bharathi: (f, ours) =>
    navamsaDispositorReason(f, ours, [2, 5, 9, 11], [2, 5, 11].map((h) => f.lordOf(h)), f.lordOf(9), "navamsa"),
};

for (const [id, sets] of Object.entries(HOUSE_SETS)) {
  EXPLAINERS[id] = (f, ours) => {
    if (ours) return null;
    const occupied = new Set(CLASSICAL.map((name) => ((f.sign(name) - f.asc + 12) % 12) + 1));
    const incomplete = sets.some((set) => [...occupied].every((h) => set.includes(h)) && set.some((h) => !occupied.has(h)));
    return incomplete ? "not every house in the set is occupied; ours requires that, PyJHora does not" : null;
  };
}

export function explain(
  ours: string,
  chart: YogaChartInput,
  strength: StrengthTable,
  coLords: CoLords,
  oursPresent: boolean
): string | null {
  const explainer = EXPLAINERS[ours];
  return explainer ? explainer(facts(chart, strength, coLords), oursPresent) : null;
}
