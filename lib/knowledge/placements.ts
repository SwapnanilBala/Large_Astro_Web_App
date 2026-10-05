import { BIRTH_SEXES, type BirthSex } from "../birth-sex";
import { NAKSHATRAS } from "../engines/panchanga";
import type { PlanetPosition } from "../engines/swiss-ephemeris-engine";
import { getSignLord, isDebilitated, isExalted, isOwnSign, signDistance } from "../engines/yoga/helpers";
import { ZODIAC_SIGNS } from "../engines/yoga/tables";

/*
 * What a passage's claim needs from a chart, as keys a chart can be checked
 * against.
 *
 * The house and sign chapters of the Brihat Jataka are a long run of
 * conditions -- "the Sun in the 10th", "the Moon in Taurus aspected by
 * Jupiter" -- and a reading may quote one only for a chart that meets it. So
 * the build tags each such passage with every condition its claim requires,
 * in this closed vocabulary, and retrieval asks one question: are all of the
 * passage's keys among the chart's, and, where the claim offers alternatives
 * ("Mars in Taurus or Libra"), is at least one of those? A passage whose
 * condition the vocabulary cannot state (a navamsa lord, a waxing Moon) gets
 * no keys, and is never matched to a chart by placement.
 *
 *   Sun.house.10          the Sun in the 10th house from the ascendant
 *   Moon.sign.Taurus      the Moon in Taurus
 *   Moon.navamsa.Aries    the Moon in the navamsa of Aries
 *   Jupiter.dignity.own   Jupiter in its own sign (also exalted, debilitated)
 *   Jupiter.aspects.Moon  Jupiter casts a full aspect on the Moon
 *   ascendant.sign.Leo    Leo rising
 *   reader.sex.female     the reader said she is a woman (for the chapters on women's charts)
 *
 * The books on women's charts lean on four more kinds of condition, added for
 * them on 2026-10-05:
 *
 *   Venus.fromMoon.7      Venus in the 7th house counted from the Moon ("the 7th from Chandra")
 *   lord7.house.1         the lord of the 7th house in the 1st
 *   lord7.dignity.exalted the lord of the 7th exalted (also debilitated, own)
 *   Venus.aspects.lord7   Venus casts a full aspect on the lord of the 7th
 *   Moon.signtype.odd     the Moon in an odd sign (also even; for the ascendant too)
 *   Moon.nakshatra.Rohini the Moon in Rohini, the birth star
 *
 * Houses are whole signs counted from the rising sign, as Varahamihira counts
 * them and as the yoga engine does, never `planet.house`: that follows the
 * chart's house system, and under a quadrant system a planet near a cusp sits
 * in a different house from the one the book means. A house's lord is the
 * ruler of its sign; Rahu and Ketu rule none.
 */

export const PLACEMENT_PLANETS = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
  "Rahu",
  "Ketu",
] as const;

const DIGNITIES = ["exalted", "debilitated", "own"] as const;

const HOUSES = Array.from({ length: 12 }, (_, index) => index + 1);

/** `lord7`: the lord of the 7th house, as a subject of a key. */
export const houseLord = (house: number): string => `lord${house}`;

/** Odd signs (Aries, Gemini, ...) are the masculine ones; Rahu and Ketu have no say in it. */
const SIGN_TYPE_SUBJECTS = ["ascendant", "Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"] as const;

export const signType = (sign: string): "odd" | "even" => (ZODIAC_SIGNS.indexOf(sign) % 2 === 0 ? "odd" : "even");

/** A birth star as a key spells it: "Purva Phalguni" is PurvaPhalguni. */
export const nakshatraKey = (name: string): string => name.replace(/\s+/g, "");

/** The birth star's name as printed, from its key spelling. */
export function nakshatraName(key: string): string | undefined {
  return NAKSHATRAS.find((name) => nakshatraKey(name) === key);
}

/**
 * Full aspects in signs counted from the planet (its own sign is 1): every
 * planet the 7th; Mars also the 4th and 8th, Jupiter the 5th and 9th, Saturn
 * the 3rd and 10th. Varahamihira's rule, and the one the aspects chapter uses.
 */
const SPECIAL_ASPECTS: Record<string, number[]> = { Mars: [4, 7, 8], Jupiter: [5, 7, 9], Saturn: [3, 7, 10] };

export function aspectsSign(planet: string, fromSign: string, toSign: string): boolean {
  return (SPECIAL_ASPECTS[planet] ?? [7]).includes(signDistance(fromSign, toSign));
}

const isPlacementPlanet = (name: string): boolean => (PLACEMENT_PLANETS as readonly string[]).includes(name);

/** Every key the vocabulary has, in a fixed order. */
export const PLACEMENT_KEYS: readonly string[] = [
  ...PLACEMENT_PLANETS.flatMap((planet) => Array.from({ length: 12 }, (_, index) => `${planet}.house.${index + 1}`)),
  ...PLACEMENT_PLANETS.flatMap((planet) => ZODIAC_SIGNS.map((sign) => `${planet}.sign.${sign}`)),
  ...PLACEMENT_PLANETS.flatMap((planet) => ZODIAC_SIGNS.map((sign) => `${planet}.navamsa.${sign}`)),
  ...PLACEMENT_PLANETS.flatMap((planet) => DIGNITIES.map((dignity) => `${planet}.dignity.${dignity}`)),
  ...PLACEMENT_PLANETS.flatMap((planet) =>
    PLACEMENT_PLANETS.filter((other) => other !== planet).map((other) => `${planet}.aspects.${other}`),
  ),
  ...ZODIAC_SIGNS.map((sign) => `ascendant.sign.${sign}`),
  ...BIRTH_SEXES.map((sex) => `reader.sex.${sex}`),
  ...PLACEMENT_PLANETS.filter((planet) => planet !== "Moon").flatMap((planet) =>
    HOUSES.map((house) => `${planet}.fromMoon.${house}`),
  ),
  ...HOUSES.flatMap((lord) => HOUSES.map((house) => `${houseLord(lord)}.house.${house}`)),
  ...HOUSES.flatMap((lord) => DIGNITIES.map((dignity) => `${houseLord(lord)}.dignity.${dignity}`)),
  ...PLACEMENT_PLANETS.flatMap((planet) => HOUSES.map((lord) => `${planet}.aspects.${houseLord(lord)}`)),
  ...SIGN_TYPE_SUBJECTS.flatMap((subject) => [`${subject}.signtype.odd`, `${subject}.signtype.even`]),
  ...NAKSHATRAS.map((name) => `Moon.nakshatra.${nakshatraKey(name)}`),
];

/** A chart as the vocabulary reads it. */
export type PlacementChart = {
  planets: readonly Pick<PlanetPosition, "name" | "sign">[];
  ascendantSign: string;
  /** Each planet's navamsa sign. Without them, no navamsa key holds. */
  navamsa?: readonly { name: string; navamsa_sign: string }[] | null;
  /** Sex at birth, when the reader gave it: the chapters on women's charts need it. */
  sex?: BirthSex;
  /** The Moon's nakshatra at birth, by name ("Purva Phalguni"). Without it, no nakshatra key holds. */
  moonNakshatra?: string | null;
};

/** Every key that holds for a chart. */
export function chartPlacementKeys(chart: PlacementChart): Set<string> {
  const keys = new Set<string>([`ascendant.sign.${chart.ascendantSign}`]);
  const placed = chart.planets.filter((planet) => isPlacementPlanet(planet.name));
  const moon = placed.find((planet) => planet.name === "Moon");
  for (const planet of placed) {
    keys.add(`${planet.name}.house.${signDistance(chart.ascendantSign, planet.sign)}`);
    keys.add(`${planet.name}.sign.${planet.sign}`);
    if (isExalted(planet.name, planet.sign)) keys.add(`${planet.name}.dignity.exalted`);
    if (isDebilitated(planet.name, planet.sign)) keys.add(`${planet.name}.dignity.debilitated`);
    if (isOwnSign(planet.name, planet.sign)) keys.add(`${planet.name}.dignity.own`);
    for (const other of placed) {
      if (other !== planet && aspectsSign(planet.name, planet.sign, other.sign)) {
        keys.add(`${planet.name}.aspects.${other.name}`);
      }
    }
    if (moon && planet !== moon) keys.add(`${planet.name}.fromMoon.${signDistance(moon.sign, planet.sign)}`);
    if ((SIGN_TYPE_SUBJECTS as readonly string[]).includes(planet.name)) {
      keys.add(`${planet.name}.signtype.${signType(planet.sign)}`);
    }
  }
  keys.add(`ascendant.signtype.${signType(chart.ascendantSign)}`);

  /* Each house's lord: where it sits, its dignity, and who aspects it. */
  const ascendantIndex = ZODIAC_SIGNS.indexOf(chart.ascendantSign);
  for (const house of HOUSES) {
    const lordName = getSignLord(ZODIAC_SIGNS[(ascendantIndex + house - 1) % 12]);
    const lord = placed.find((planet) => planet.name === lordName);
    if (!lord) continue;
    const subject = houseLord(house);
    keys.add(`${subject}.house.${signDistance(chart.ascendantSign, lord.sign)}`);
    if (isExalted(lord.name, lord.sign)) keys.add(`${subject}.dignity.exalted`);
    if (isDebilitated(lord.name, lord.sign)) keys.add(`${subject}.dignity.debilitated`);
    if (isOwnSign(lord.name, lord.sign)) keys.add(`${subject}.dignity.own`);
    for (const other of placed) {
      if (other !== lord && aspectsSign(other.name, other.sign, lord.sign)) keys.add(`${other.name}.aspects.${subject}`);
    }
  }

  for (const position of chart.navamsa ?? []) {
    if (isPlacementPlanet(position.name)) keys.add(`${position.name}.navamsa.${position.navamsa_sign}`);
  }
  if (chart.moonNakshatra && nakshatraName(nakshatraKey(chart.moonNakshatra))) {
    keys.add(`Moon.nakshatra.${nakshatraKey(chart.moonNakshatra)}`);
  }
  if (chart.sex) keys.add(`reader.sex.${chart.sex}`);
  return keys;
}

/**
 * The houses a key is about, for ranking a passage under the area that reads
 * those houses: "Venus.house.7", "Venus.fromMoon.7", "lord7.house.1" (both the
 * 7th and the 1st) and "Saturn.aspects.lord7" all concern the 7th.
 */
export function housesOf(key: string): number[] {
  const [subject, kind, value] = key.split(".");
  const lordOf = (name: string) => (/^lord\d+$/.test(name) ? [Number(name.slice(4))] : []);
  if (kind === "house") return [...lordOf(subject), Number(value)];
  if (kind === "fromMoon") return [Number(value)];
  if (kind === "aspects") return lordOf(value);
  return lordOf(subject);
}

/**
 * A passage's conditions: every key in `placements`, and, when
 * `placementsAny` is not empty, at least one of its keys -- the one either/or
 * a claim can carry ("Mars in Taurus or Libra").
 */
export type PlacementConditions = {
  placements: readonly string[];
  placementsAny: readonly string[];
};

/** Whether a passage's conditions hold for a chart. A passage with none never matches by placement. */
export function placementsHold(conditions: PlacementConditions, chartKeys: ReadonlySet<string>): boolean {
  const { placements, placementsAny } = conditions;
  if (placements.length === 0 && placementsAny.length === 0) return false;
  return (
    placements.every((key) => chartKeys.has(key)) &&
    (placementsAny.length === 0 || placementsAny.some((key) => chartKeys.has(key)))
  );
}

/** The passage's keys that hold for this chart: all of `placements`, and whichever alternatives it meets. */
export function heldPlacements(conditions: PlacementConditions, chartKeys: ReadonlySet<string>): string[] {
  return [...conditions.placements, ...conditions.placementsAny.filter((key) => chartKeys.has(key))];
}
