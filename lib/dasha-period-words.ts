import type { DashaLevel } from "./dasha-periods";
import { isNode, type LordFacts, type LordRelation, type PeriodFacts } from "./dasha-reading-facts";

/*
 * A period's chart facts in English words, for the models that write about
 * dasha periods: the period reading (lib/knowledge/dasha-reading.ts) and the
 * current-period paragraph (lib/current-period-reading.ts). Imports nothing
 * the browser cannot load, because the second is bundled with the panel.
 *
 * Beside the plain facts it says what makes a period itself, worked out here
 * rather than left to the model: the houses several of its planets share,
 * which is where a period's weight falls, and what its own planet adds that
 * the levels above it do not touch. Handed only "Saturn in Scorpio, the 2nd
 * house", a model writes "Saturn asks you to build steadiness" for every
 * reader; handed "the 2nd is touched by both Saturn and Mercury", it writes
 * about money and speech for this one.
 */

export const LEVEL_NAMES: Record<DashaLevel, string> = {
  1: "Maha Dasha",
  2: "Antardasha",
  3: "Pratyantardasha",
  4: "Sookshma Dasha",
};

/**
 * What each house stands for, as the reading may interpret it. Worded inside
 * the content line: the 6th as rivals and daily work rather than illness, the
 * 8th as sudden change rather than lifespan, the 12th as expenses and retreat.
 */
export const HOUSE_MEANINGS: Record<number, string> = {
  1: "the self, the body and vitality, one's outlook",
  2: "money and savings, family, speech, food",
  3: "courage and initiative, siblings, short journeys, communication",
  4: "home and mother, property and vehicles, inner contentment",
  5: "children, intelligence and learning, creativity, romance",
  6: "rivals and competition, debts, daily work and service",
  7: "partnership and marriage, contracts, dealings with others",
  8: "sudden change, shared and inherited money, research, what is hidden",
  9: "fortune, father and teachers, faith, long journeys, higher learning",
  10: "career and standing, authority, public work",
  11: "gains and income, friends and networks, wishes fulfilled",
  12: "expenses, foreign places, retreat and rest, letting go",
};

/**
 * How each house tends to show up in an ordinary week, for the model to pick
 * from: the concrete half of a reading that HOUSE_MEANINGS alone left abstract.
 * Inside the content line too.
 */
export const HOUSE_LIFE: Record<number, string> = {
  1: "how you come across, your energy and self-care, fresh personal starts",
  2: "the money you keep and spend, family talk and meals, speaking up for yourself",
  3: "your own initiatives, writing and messages, siblings and neighbours, short trips",
  4: "home and property, your mother, vehicles, feeling settled where you live",
  5: "children, study and exams, creative projects, romance, risk-taking with money",
  6: "workload and competition, debts and loans, daily routines, serving others",
  7: "your partner and close partnerships, contracts and deals, dealing with the public",
  8: "sudden changes, joint money, inheritance and insurance, research, what you keep private",
  9: "teachers and mentors, beliefs, long journeys, higher studies, your father",
  10: "career moves, recognition, responsibility at work, your public role",
  11: "income and gains, friends and networks, wishes coming through, elder siblings",
  12: "spending, foreign places, rest and retreat, sleep, letting things go",
};

/**
 * The stock phrases a reading falls into when it has nothing particular to
 * say. The prompts name them as phrases never to write.
 */
export const STOCK_PHRASES = [
  "backdrop",
  "sets the stage",
  "draws attention",
  "asks you to",
  "invites you to",
  "journey",
  "energy",
  "theme",
  "chapter",
  "tested",
  "steadiness",
  "depth",
] as const;

export const ordinal = (n: number) => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
};

const DIGNITY_WORDS: Record<string, string> = {
  exalted: "exalted",
  debilitated: "debilitated",
  own: "in its own sign",
  friend: "in the sign of a natural friend",
  neutral: "in the sign of a planet it is neutral to",
  enemy: "in the sign of a natural enemy",
};

const RELATION_WORDS: Record<string, string> = {
  same: "in the same sign",
  angle: "in an angle from it, so the two support each other",
  trine: "in a trine from it, so the two work together",
  growth: "3rd and 11th from each other, a relation of effort that grows",
  adjacent: "2nd and 12th from each other, a neighbouring pull",
  strained: "6th and 8th from each other, so the two are at odds",
};

export const houseList = (houses: readonly number[]) => {
  const words = houses.map((house) => `the ${ordinal(house)}`);
  return words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
};

export const nameList = (names: readonly string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/** A planet as a sentence names it: "the Sun", "the Moon", "Mars". */
export const inProse = (planet: string) => (planet === "Sun" || planet === "Moon" ? `the ${planet}` : planet);

export const levelList = (levels: readonly DashaLevel[]) => levels.map((level) => LEVEL_NAMES[level]).join(" and ");

/** One planet's line: "Saturn (Maha Dasha lord): in Scorpio, the 2nd house; ...". */
export function describeLord(facts: LordFacts): string {
  const parts = [`in ${facts.sign}, the ${ordinal(facts.house)} house`];
  if (facts.dignity) parts.push(DIGNITY_WORDS[facts.dignity]);
  if (facts.retrograde) parts.push("retrograde");
  if (facts.combust) parts.push("close to the Sun (combust)");
  if (facts.rules.length > 0) parts.push(`rules ${houseList(facts.rules)} house${facts.rules.length > 1 ? "s" : ""}`);
  if (isNode(facts.lord)) {
    parts.push(
      facts.actsThrough
        ? `owns no sign, so gives the results of ${inProse(facts.actsThrough.lord)}, the lord of ${facts.sign}, which sits in ${facts.actsThrough.sign}, the ${ordinal(facts.actsThrough.house)} house` +
            (facts.with.length > 0 ? `, and of the planets with it` : "")
        : "owns no sign",
    );
  }
  if (facts.with.length > 0) parts.push(`with ${nameList(facts.with.map(inProse))}`);
  if (facts.aspectedBy.length > 0) parts.push(`aspected by ${nameList(facts.aspectedBy.map(inProse))}`);
  return `${facts.lord} (${levelList(facts.levels)} lord): ${parts.join("; ")}.`;
}

/** How one level's planet stands to the planet above it. */
export function describeRelation(relation: LordRelation): string {
  const level = LEVEL_NAMES[relation.level];
  const parentLevel = LEVEL_NAMES[(relation.level - 1) as DashaLevel];
  if (relation.kind === "self") {
    return `${relation.lord} rules both the ${parentLevel} and its ${level}: its own sub-period, the planet at its fullest.`;
  }
  const where =
    relation.kind === "same"
      ? `in the same sign as ${inProse(relation.parent)} (${parentLevel})`
      : `${ordinal(relation.distance)} from ${inProse(relation.parent)} (${parentLevel}), ${RELATION_WORDS[relation.kind]}`;
  const regard =
    relation.friendship === "neutral"
      ? `; ${inProse(relation.parent)} is neutral to ${inProse(relation.lord)} by nature`
      : relation.friendship
        ? `; ${inProse(relation.parent)} counts ${inProse(relation.lord)} a natural ${relation.friendship}`
        : "";
  const subject = inProse(relation.lord);
  return `${subject.charAt(0).toUpperCase()}${subject.slice(1)} (${level}) is ${where}${regard}.`;
}

/** The houses a planet brings into its period: where it sits, what it rules, and for a node where its sign's lord sits. */
export function housesTouched(lord: LordFacts): number[] {
  return [...new Set([lord.house, ...lord.rules, ...(lord.actsThrough ? [lord.actsThrough.house] : [])])];
}

/** Every house the facts name, in order. */
export function housesNamed(facts: PeriodFacts): number[] {
  return [...new Set(facts.lords.flatMap(housesTouched))].sort((a, b) => a - b);
}

export type PeriodFocus = {
  /** Houses two or more of the period's planets touch, most-shared first: where its weight falls. */
  shared: { house: number; lords: string[] }[];
  /** Houses the period's own planet touches and no level above it does; empty for a Maha Dasha alone. */
  added: number[];
};

/** What makes a period itself, from its planets' houses. */
export function periodFocus(facts: PeriodFacts): PeriodFocus {
  const lordsOf = new Map<number, string[]>();
  for (const lord of facts.lords) {
    for (const house of housesTouched(lord)) lordsOf.set(house, [...(lordsOf.get(house) ?? []), lord.lord]);
  }
  const shared = [...lordsOf.entries()]
    .filter(([, lords]) => lords.length > 1)
    .map(([house, lords]) => ({ house, lords }))
    .sort((a, b) => b.lords.length - a.lords.length || a.house - b.house);
  if (facts.lords.length < 2) return { shared, added: [] };
  const own = facts.lords[facts.lords.length - 1];
  const above = new Set(facts.lords.slice(0, -1).flatMap(housesTouched));
  return { shared, added: housesTouched(own).filter((house) => !above.has(house)).sort((a, b) => a - b) };
}

/**
 * The focus in words, then how each house named shows up in ordinary life.
 * `ownLord` is the period's own planet, which the chain's last level names; a
 * planet ruling two levels is listed once in `facts`, so it cannot be read
 * from there.
 */
export function describeFocus(facts: PeriodFacts, ownLord: string): string {
  const { shared, added } = periodFocus(facts);
  const lines = [
    shared.length > 0
      ? `Houses several of the period's planets touch (by sitting in them or ruling them), so where its weight falls: ${shared
          .map(({ house, lords }) => `the ${ordinal(house)} (${nameList(lords.map(inProse))})`)
          .join("; ")}.`
      : "No house is touched by more than one of the period's planets.",
  ];
  if (facts.lords.length > 1) {
    lines.push(
      added.length > 0
        ? `What the period's own planet, ${inProse(ownLord)}, brings that the levels above do not touch: ${houseList(added)}.`
        : `The period's own planet, ${inProse(ownLord)}, brings no house the levels above do not already touch, so it sharpens them.`,
    );
  }
  lines.push(
    `Everyday ways the houses named tend to show up: ${housesNamed(facts)
      .map((house) => `the ${ordinal(house)}: ${HOUSE_LIFE[house]}`)
      .join("; ")}.`,
  );
  return lines.join("\n");
}
