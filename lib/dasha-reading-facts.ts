import type { DashaLevel } from "./dasha-periods";
import { getSignLord, isDebilitated, isExalted, isOwnSign, signDistance } from "./engines/yoga/helpers";
import { NATURAL_ENEMIES, NATURAL_FRIENDS, ZODIAC_SIGNS } from "./engines/yoga/tables";
import { aspectsSign } from "./knowledge/placements";

/*
 * Where a period's planets stand in the reader's chart: the facts a dasha
 * reading is written from besides the books, and the facts the panel prints
 * under the period before anything is paid for. One module for both, so the
 * card shows exactly what the reading was given.
 *
 * Houses are whole signs counted from the rising sign, as the books count
 * them and as the passages' conditions are tagged (lib/knowledge/placements.ts),
 * never `planet.house`, which follows the chart's house system. A house's lord
 * is the ruler of its sign. Rahu and Ketu own no sign: they give the results
 * of the lord of the sign they occupy and of the planets with them, the rule
 * the classical commentators apply to the nodes' periods.
 */

/** The planets as the chart lists them, in the order the books name them. */
export const PERIOD_PLANETS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"] as const;

const NODES: ReadonlySet<string> = new Set(["Rahu", "Ketu"]);

export const isNode = (planet: string): boolean => NODES.has(planet);

/** A planet's standing in its sign: the classical dignities, then its regard for the sign's lord. */
export const DIGNITIES = ["exalted", "debilitated", "own", "friend", "neutral", "enemy"] as const;
export type Dignity = (typeof DIGNITIES)[number];

/**
 * How a period's planet stands to the planet of the period above it, counted
 * in signs from that planet: the same planet again; the same sign; an angle
 * (4th, 7th, 10th); a trine (5th, 9th); the 3rd or 11th; the 2nd or 12th; the
 * 6th or 8th.
 */
export const RELATION_KINDS = ["self", "same", "angle", "trine", "growth", "adjacent", "strained"] as const;
export type RelationKind = (typeof RELATION_KINDS)[number];

export type Friendship = "friend" | "neutral" | "enemy";

export type FactPlanet = { name: string; sign: string; is_retrograde?: boolean; is_combust?: boolean };

export type FactChart = { ascendantSign: string; planets: readonly FactPlanet[] };

export type LordFacts = {
  lord: string;
  /** The levels of this period the planet rules: the Maha Dasha lord can rule a sub-period too. */
  levels: DashaLevel[];
  sign: string;
  house: number;
  /** Null for Rahu and Ketu, which own no sign. */
  dignity: Dignity | null;
  retrograde: boolean;
  combust: boolean;
  /** The houses whose signs it rules, in order; none for Rahu and Ketu. */
  rules: number[];
  /** The other planets in its sign, in the books' order. */
  with: string[];
  /** The planets casting a full aspect on its sign, in the books' order. */
  aspectedBy: string[];
  /** For Rahu and Ketu, the lord of the sign they sit in, whose results they give. */
  actsThrough: { lord: string; sign: string; house: number } | null;
};

export type LordRelation = {
  /** The level of the period whose planet this is; its parent is one level up. */
  level: DashaLevel;
  lord: string;
  parent: string;
  /** Signs from the parent's sign to this planet's, counting the parent's as 1. */
  distance: number;
  kind: RelationKind;
  /** How the parent planet regards this one by nature; null when either is a node, or they are the same planet. */
  friendship: Friendship | null;
};

export type PeriodFacts = {
  ascendantSign: string;
  /** Each planet of the period once, in the order its first level comes. */
  lords: LordFacts[];
  /** One for each level below the Maha Dasha. */
  relations: LordRelation[];
};

const byBookOrder = (a: string, b: string) =>
  (PERIOD_PLANETS as readonly string[]).indexOf(a) - (PERIOD_PLANETS as readonly string[]).indexOf(b);

/** The houses a planet rules for this rising sign. */
export function housesRuledBy(planet: string, ascendantSign: string): number[] {
  const start = ZODIAC_SIGNS.indexOf(ascendantSign);
  if (start < 0 || isNode(planet)) return [];
  return Array.from({ length: 12 }, (_, index) => index + 1).filter(
    (house) => getSignLord(ZODIAC_SIGNS[(start + house - 1) % 12]) === planet,
  );
}

/** How a planet regards another by nature; null for the nodes, which the table leaves out. */
export function friendshipOf(planet: string, other: string): Friendship | null {
  if (isNode(planet) || isNode(other) || planet === other) return null;
  if (NATURAL_FRIENDS[planet]?.includes(other)) return "friend";
  if (NATURAL_ENEMIES[planet]?.includes(other)) return "enemy";
  return "neutral";
}

/** A planet's dignity in a sign; null for Rahu and Ketu. */
export function dignityOf(planet: string, sign: string): Dignity | null {
  if (isNode(planet) || !ZODIAC_SIGNS.includes(sign)) return null;
  if (isExalted(planet, sign)) return "exalted";
  if (isDebilitated(planet, sign)) return "debilitated";
  if (isOwnSign(planet, sign)) return "own";
  return friendshipOf(planet, getSignLord(sign)) ?? "neutral";
}

export function relationKind(distance: number): Exclude<RelationKind, "self"> {
  if (distance === 1) return "same";
  if (distance === 4 || distance === 7 || distance === 10) return "angle";
  if (distance === 5 || distance === 9) return "trine";
  if (distance === 3 || distance === 11) return "growth";
  if (distance === 2 || distance === 12) return "adjacent";
  return "strained";
}

/** One planet's facts in a chart, or null when the chart does not place it. */
export function lordFacts(chart: FactChart, lord: string, levels: DashaLevel[] = []): LordFacts | null {
  const position = chart.planets.find((planet) => planet.name === lord);
  if (!position || !ZODIAC_SIGNS.includes(position.sign) || !ZODIAC_SIGNS.includes(chart.ascendantSign)) return null;
  const house = signDistance(chart.ascendantSign, position.sign);
  const others = chart.planets.filter(
    (planet) => planet.name !== lord && (PERIOD_PLANETS as readonly string[]).includes(planet.name),
  );
  let actsThrough: LordFacts["actsThrough"] = null;
  if (isNode(lord)) {
    const dispositor = getSignLord(position.sign);
    const placed = chart.planets.find((planet) => planet.name === dispositor);
    if (placed && ZODIAC_SIGNS.includes(placed.sign)) {
      actsThrough = { lord: dispositor, sign: placed.sign, house: signDistance(chart.ascendantSign, placed.sign) };
    }
  }
  return {
    lord,
    levels,
    sign: position.sign,
    house,
    dignity: dignityOf(lord, position.sign),
    /* The nodes always move backwards; saying so of them says nothing. */
    retrograde: !isNode(lord) && position.is_retrograde === true,
    combust: position.is_combust === true,
    rules: housesRuledBy(lord, chart.ascendantSign),
    with: others.filter((planet) => planet.sign === position.sign).map((planet) => planet.name).sort(byBookOrder),
    /* Rahu and Ketu always stand opposite each other, so their mutual aspect says nothing. */
    aspectedBy: others
      .filter((planet) => !(isNode(lord) && isNode(planet.name)))
      .filter((planet) => planet.sign !== position.sign && aspectsSign(planet.name, planet.sign, position.sign))
      .map((planet) => planet.name)
      .sort(byBookOrder),
    actsThrough,
  };
}

/**
 * The facts for a period's chain of lords, Maha Dasha first, or null when the
 * chart cannot place one of them. A planet that rules two levels appears once,
 * with both.
 */
export function periodFacts(chart: FactChart, chain: readonly string[]): PeriodFacts | null {
  const lords: LordFacts[] = [];
  for (const [index, lord] of chain.entries()) {
    const level = (index + 1) as DashaLevel;
    const known = lords.find((facts) => facts.lord === lord);
    if (known) {
      known.levels.push(level);
      continue;
    }
    const facts = lordFacts(chart, lord, [level]);
    if (!facts) return null;
    lords.push(facts);
  }

  const signOf = (lord: string) => lords.find((facts) => facts.lord === lord)?.sign ?? "";
  const relations: LordRelation[] = chain.slice(1).map((lord, index) => {
    const parent = chain[index];
    const distance = signDistance(signOf(parent), signOf(lord));
    return {
      level: (index + 2) as DashaLevel,
      lord,
      parent,
      distance,
      kind: lord === parent ? "self" : relationKind(distance),
      friendship: friendshipOf(parent, lord),
    };
  });

  return { ascendantSign: chart.ascendantSign, lords, relations };
}
