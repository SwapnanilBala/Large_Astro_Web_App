import type Anthropic from "@anthropic-ai/sdk";
import type { BirthSex } from "../birth-sex";
import type { DashaLevel, DashaSpan, DashaStatus } from "../dasha-periods";
import { spanDays } from "../dasha-periods";
import { housesRuledBy, isNode, type LordFacts, type LordRelation, type PeriodFacts } from "../dasha-reading-facts";
import { YOGA_DEFINITIONS } from "../engines/yoga-engine";
import { COMMENTARY_LANGUAGES } from "../varga-commentary";
import { READER_LINES, countedByAnyArea, describePlacement, type AreaChart, type ChartYoga } from "./area-classics-reading";
import { heldPlacements, placementsHold } from "./placements";
import { BRIHAT_JATAKA_1885, KNOWLEDGE_SOURCES, STRIJATAKA_1931 } from "./sources";
import {
  CLASSICAL_NOTE_RULES,
  CLOSING_REMINDERS,
  NOTE_PREFIX,
  modelText,
  speaksToChart,
  type PassageRow,
} from "./yoga-classics-reading";

/*
 * The reading for one Vimshottari period, from the Maha Dasha down to a
 * Sookshma: the server half that touches neither the database nor the
 * network, so it can be tested directly.
 *
 * A period brings forward what the chart promises through its planets, and the
 * Brihat Jataka says as much: the results it gives for houses, signs, aspects
 * and yogas come in the period of the planet that produces them (8.20). So a
 * period's reading is written from two things about its planets: where they
 * stand in this chart (lib/dasha-reading-facts.ts), and the passages of the
 * books that apply to this chart and concern them.
 *
 * Retrieval is hybrid, as for "Ask the classics". The chart decides which
 * passages may be used -- their conditions hold, or the chart has a yoga they
 * speak of -- and the period's planets narrow them to the ones about those
 * planets. A description of the period, embedded, then orders each planet's
 * candidates by meaning (passagesForPeriod in retrieve.ts). Every planet of
 * the period gets its share, so a reading for a Sookshma still rests on its
 * own planet as well as on the Maha Dasha's.
 */

/** Passages sent with a period: about 900 input tokens, enough for two short paragraphs to cite. */
export const PERIOD_PASSAGE_LIMIT = 10;

/** No planet takes more than half: the others are part of the period too. */
export const PERIOD_PER_LORD_LIMIT = 5;

/** Parts of one verse a planet may take: a verse split into its results is still one voice. */
export const PERIOD_PARTS_PER_VERSE = 2;

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

/** Topics a period's reading never draws on: lifespan, and health, which the content line all but closes. */
const LEFT_OUT_TOPICS = new Set(["longevity", "health"]);

/** The books a period's reading quotes, in the order their documents are sent. */
const BOOK_ORDER = [BRIHAT_JATAKA_1885.slug, STRIJATAKA_1931.slug];
const bookRank = (slug: string) => (BOOK_ORDER.includes(slug) ? BOOK_ORDER.indexOf(slug) : BOOK_ORDER.length);

const DEFINITIONS = new Map(YOGA_DEFINITIONS.map((definition) => [definition.id, definition]));

/** A passage as the selection takes it: scored by the search, or unscored in the fallback. */
export type PeriodCandidate = PassageRow & { similarity?: number };

/** How a passage concerns a period's planet, nearest first. */
export const CONCERNS = ["placement", "yoga", "lordship", "aspect"] as const;
export type Concern = (typeof CONCERNS)[number];

export type PeriodPassage = { passage: PeriodCandidate; lord: string; concern: Concern };

const ordinal = (n: number) => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
};

function bookOrder(a: PassageRow, b: PassageRow): number {
  return bookRank(a.source) - bookRank(b.source) || a.chapter - b.chapter || a.verse - b.verse || a.part - b.part;
}

/**
 * The planets whose results a period's planet gives: itself, and for Rahu and
 * Ketu also the lord of the sign they occupy and the planets with them.
 */
export function voicesOf(facts: LordFacts): string[] {
  if (!isNode(facts.lord)) return [facts.lord];
  const voices = [facts.lord];
  if (facts.actsThrough) voices.push(facts.actsThrough.lord);
  for (const planet of facts.with) if (!isNode(planet) && !voices.includes(planet)) voices.push(planet);
  return voices;
}

/** The subjects of a placement key that stand for the houses these planets rule: `lord7` for the 7th's lord, `ascendant` for the 1st's. */
function lordshipSubjects(voices: readonly string[], ascendantSign: string): Set<string> {
  const subjects = new Set<string>();
  for (const voice of voices) {
    for (const house of housesRuledBy(voice, ascendantSign)) {
      subjects.add(`lord${house}`);
      if (house === 1) subjects.add("ascendant");
    }
  }
  return subjects;
}

/** The chart's yogas a passage speaks of, in the form the chart has them, that some life area counts (Kemadruma stays out). */
function yogasFor(passage: PassageRow, chart: AreaChart): ChartYoga[] {
  return chart.yogas.filter(
    (yoga) => passage.yogaIds.includes(yoga.id) && speaksToChart(passage, yoga) && countedByAnyArea(yoga.id),
  );
}

/** Whether a passage may be used in any period's reading for this chart, before it is matched to a planet. */
export function usableForPeriod(passage: PassageRow, chart: AreaChart): boolean {
  if (!BOOK_ORDER.includes(passage.source)) return false;
  if (passage.lifeAreas.length === 0 || passage.lifeAreas.some((topic) => LEFT_OUT_TOPICS.has(topic))) return false;
  return placementsHold(passage, chart.keys) || yogasFor(passage, chart).length > 0;
}

/**
 * How a passage concerns one of the period's planets, or null if it does not:
 * a condition on the planet itself (or, for a node, on a planet whose results
 * it gives); a yoga it helps form; a condition on a house it rules; or an
 * aspect it receives. A passage that only names the planet -- "the Moon in the
 * navamsa of Mars", which is about Mars's sign, not Mars -- does not concern it.
 */
export function concernFor(passage: PassageRow, chart: AreaChart, facts: LordFacts, ascendantSign: string): Concern | null {
  const voices = voicesOf(facts);
  const subjects = new Set(voices);
  const held = heldPlacements(passage, chart.keys).map((key) => key.split("."));
  if (held.some(([subject]) => subjects.has(subject))) return "placement";
  if (yogasFor(passage, chart).some((yoga) => yoga.planets.some((planet) => subjects.has(planet)))) return "yoga";
  const houses = lordshipSubjects(voices, ascendantSign);
  if (held.some(([subject]) => houses.has(subject))) return "lordship";
  if (held.some(([, kind, target]) => kind === "aspects" && (subjects.has(target) || houses.has(target)))) return "aspect";
  return null;
}

/**
 * The passages a period gets, each under the planet it was chosen for.
 *
 * Every planet of the period draws in turn, Maha Dasha first, each taking its
 * nearest remaining passage: by how directly the passage concerns it, then by
 * the search's similarity, then the verse before the translator's note, then
 * the book's order. A passage two planets share goes to the first to draw it.
 * Turns continue while any planet has passages left, up to the limit, and no
 * planet takes more than PERIOD_PER_LORD_LIMIT.
 *
 * A verse the build split into parts (one per result) is drawn a part at a
 * time like any other passage, but a planet takes a second part of a verse it
 * already has only when it has nothing from another verse left, and never a
 * third: three parts of "Mercury in Aries or Scorpio" would otherwise crowd
 * out everything else the books say about the period's planets.
 */
export function selectPeriodPassages(
  rows: readonly PeriodCandidate[],
  chart: AreaChart,
  facts: PeriodFacts,
  limit: number = PERIOD_PASSAGE_LIMIT,
): PeriodPassage[] {
  const usable = rows.filter((passage) => usableForPeriod(passage, chart));
  const queues = facts.lords.map((lord) =>
    usable
      .map((passage) => ({ passage, concern: concernFor(passage, chart, lord, facts.ascendantSign) }))
      .filter((entry): entry is { passage: PeriodCandidate; concern: Concern } => entry.concern !== null)
      .sort(
        (a, b) =>
          CONCERNS.indexOf(a.concern) - CONCERNS.indexOf(b.concern) ||
          (b.passage.similarity ?? 0) - (a.passage.similarity ?? 0) ||
          Number(a.passage.kind === "note") - Number(b.passage.kind === "note") ||
          bookOrder(a.passage, b.passage),
      ),
  );

  const chosen: PeriodPassage[] = [];
  const used = new Set<string>();
  const verseOf = (passage: PassageRow) => `${passage.source}:${passage.chapter}.${passage.verse}`;
  const verses = facts.lords.map(() => new Map<string, number>());
  const taken = facts.lords.map(() => 0);
  let drew = true;
  while (chosen.length < limit && drew) {
    drew = false;
    for (const [index, queue] of queues.entries()) {
      if (chosen.length >= limit) break;
      if (taken[index] >= PERIOD_PER_LORD_LIMIT) continue;
      const parts = verses[index];
      const open = queue.filter(
        (entry) => !used.has(entry.passage.id) && (parts.get(verseOf(entry.passage)) ?? 0) < PERIOD_PARTS_PER_VERSE,
      );
      const next = open.find((entry) => !parts.has(verseOf(entry.passage))) ?? open[0];
      if (!next) continue;
      used.add(next.passage.id);
      parts.set(verseOf(next.passage), (parts.get(verseOf(next.passage)) ?? 0) + 1);
      taken[index] += 1;
      chosen.push({ passage: next.passage, lord: facts.lords[index].lord, concern: next.concern });
      drew = true;
    }
  }
  return chosen;
}

/** One document's worth: the passages chosen for one planet from one book, and what in the chart they rest on. */
export type PeriodDocumentGroup = {
  lord: string;
  source: string;
  passages: PassageRow[];
  conditions: string[];
  yogaNames: string[];
};

/**
 * The chosen passages split by planet, then by book, since a citation names a
 * document and the model is owed which planet a passage was chosen for, and
 * the reader the right book's name. The documents are sent in this order, and
 * citations are read back against it.
 */
export function periodDocumentGroups(
  chosen: readonly PeriodPassage[],
  chart: AreaChart,
  facts: PeriodFacts,
): PeriodDocumentGroup[] {
  return facts.lords.flatMap(({ lord }) => {
    const own = chosen.filter((entry) => entry.lord === lord).map((entry) => entry.passage);
    const books = [...new Set(own.map((passage) => passage.source))].sort((a, b) => bookRank(a) - bookRank(b));
    return books.map((source) => {
      const passages = own.filter((passage) => passage.source === source).sort(bookOrder);
      const conditions = [...new Set(passages.flatMap((passage) => heldPlacements(passage, chart.keys)))];
      const ids = new Set(passages.flatMap((passage) => yogasFor(passage, chart).map((yoga) => yoga.id)));
      const yogaNames = [...ids].map((id) => DEFINITIONS.get(id)?.name ?? id);
      return { lord, source, passages, conditions, yogaNames };
    });
  });
}

const levelList = (levels: readonly DashaLevel[]) =>
  levels.map((level) => LEVEL_NAMES[level]).join(" and ");

/**
 * One citable document per planet and book: each passage a content block, so
 * a citation names whole passages; which planet they were chosen for, and the
 * chart conditions they rest on, go in `context`, which the model reads but
 * cannot cite. Every string here comes from the corpus, the catalogue, the
 * chart or lib/knowledge/sources.ts, never from the browser.
 */
export function periodDocuments(groups: readonly PeriodDocumentGroup[], facts: PeriodFacts): Anthropic.DocumentBlockParam[] {
  return groups.map(({ lord, source, passages, conditions, yogaNames }) => {
    const book = KNOWLEDGE_SOURCES[source] ?? BRIHAT_JATAKA_1885;
    const lordFacts = facts.lords.find((entry) => entry.lord === lord);
    const voices = lordFacts ? voicesOf(lordFacts).filter((voice) => voice !== lord) : [];
    return {
      type: "document",
      title: `${book.title}: on ${lord}`,
      context:
        `Chosen for ${lord}, the ${lordFacts ? levelList(lordFacts.levels) : "period"} lord of this period` +
        (voices.length > 0 ? `, whose results it gives through ${voices.join(" and ")}; the passages may concern them` : "") +
        ". Each passage's condition holds in the reader's chart. " +
        (conditions.length > 0 ? `Conditions met by placement: ${conditions.map(describePlacement).join("; ")}. ` : "") +
        (yogaNames.length > 0 ? `Yogas the chart has that passages speak of: ${yogaNames.join(", ")}. ` : "") +
        `The passages are from ${book.described}.`,
      source: {
        type: "content",
        content: passages.map((passage) => ({
          type: "text",
          text: passage.kind === "note" ? `${NOTE_PREFIX}${modelText(passage.text)}` : modelText(passage.text),
        })),
      },
      citations: { enabled: true },
    };
  });
}

/* ── The facts, in words ─────────────────────────────────────────────────── */

const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const monthYear = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** A period's window as the facts give it: to the day for a short one, to the month for a long one. */
function windowOf(span: DashaSpan): string {
  const days = spanDays(span);
  const date = days <= 120 ? longDate : monthYear;
  return `${date(span.start)} to ${date(span.end)}`;
}

export function durationOf(span: DashaSpan): string {
  const days = spanDays(span);
  if (days < 60) return `${days} days`;
  if (days < 730) return `${Math.round(days / 30.44)} months`;
  return `${Math.round((days / 365.25) * 10) / 10} years`;
}

const STATUS_WORDS: Record<DashaStatus, string> = {
  past: "already over",
  now: "running now",
  upcoming: "still to come",
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

const houseList = (houses: readonly number[]) => {
  const words = houses.map((house) => `the ${ordinal(house)}`);
  return words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
};

const nameList = (names: readonly string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/** A planet as a sentence names it: "the Sun", "the Moon", "Mars". */
const inProse = (planet: string) => (planet === "Sun" || planet === "Moon" ? `the ${planet}` : planet);

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

/** Every house the facts name, in order: where the planets sit, what they rule, and where a node's lord sits. */
function housesNamed(facts: PeriodFacts): number[] {
  const houses = new Set<number>();
  for (const lord of facts.lords) {
    houses.add(lord.house);
    for (const house of lord.rules) houses.add(house);
    if (lord.actsThrough) houses.add(lord.actsThrough.house);
  }
  return [...houses].sort((a, b) => a - b);
}

/**
 * The period and its planets, in words, for the model: the deepest period,
 * the levels it sits inside, each planet's place in the chart, how each
 * stands to the one above, and what the houses named stand for.
 */
export function describePeriod(path: readonly DashaSpan[], facts: PeriodFacts, status: DashaStatus): string {
  const deepest = path[path.length - 1];
  const inside = path.slice(0, -1).map((span) => `the ${LEVEL_NAMES[span.level]} of ${span.planet} (${windowOf(span)})`);
  return [
    `The period: the ${LEVEL_NAMES[deepest.level]} of ${deepest.planet}, ${windowOf(deepest)} (${durationOf(deepest)}), ${STATUS_WORDS[status]}.` +
      (inside.length > 0 ? `\nIt sits inside ${nameList(inside)}.` : ""),
    `The chart rises in ${facts.ascendantSign}; houses are whole signs counted from it.\n` +
      facts.lords.map(describeLord).join("\n"),
    facts.relations.length > 0
      ? `How each planet stands to the one above it:\n${facts.relations.map(describeRelation).join("\n")}`
      : "",
    `What the houses named here stand for: ${housesNamed(facts)
      .map((house) => `the ${ordinal(house)}: ${HOUSE_MEANINGS[house]}`)
      .join("; ")}.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * A description of the period to search the passages with: its planets, where
 * they sit and rule, and what those houses stand for. Embedded with the model
 * the passages were embedded with, it orders each planet's candidates by how
 * nearly they speak to this period rather than to the planet in general.
 */
export function periodQueryText(facts: PeriodFacts): string {
  const [maha, ...rest] = facts.lords;
  const lines = facts.lords.map((lord) => {
    const rules = lord.rules.length > 0 ? `, ruling ${houseList(lord.rules)} house${lord.rules.length > 1 ? "s" : ""}` : "";
    const through = lord.actsThrough
      ? `, acting through ${lord.actsThrough.lord} in ${lord.actsThrough.sign} in the ${ordinal(lord.actsThrough.house)} house`
      : "";
    return `${lord.lord} in ${lord.sign} in the ${ordinal(lord.house)} house${rules}${through}`;
  });
  const topics = [...new Set(housesNamed(facts).flatMap((house) => HOUSE_MEANINGS[house].split(", ")))].slice(0, 12);
  return (
    `What the period of ${maha.lord}` +
    (rest.length > 0 ? `, with the sub-periods of ${nameList(rest.map((lord) => lord.lord))},` : "") +
    ` brings for a chart with ${lines.join("; ")}: ${topics.join(", ")}.`
  );
}

/* ── The prompt ───────────────────────────────────────────────────────────── */

/* Frozen, so it is the cacheable prefix; the documents, the facts and the language follow in the user turn. */
export const DASHA_READING_SYSTEM_PROMPT = `You write the reading for one planetary period in a Vedic astrology report: a period of the Vimshottari dasha that the reader has chosen on their timeline.

How the periods work, for your own understanding: the Vimshottari dasha divides a life into periods ruled by planets, nested in levels. The Maha Dasha runs for years; it divides into Antardashas of months to years, those into Pratyantardashas of weeks to months, and those into Sookshma dashas of days to weeks. A period brings forward what the birth chart promises through its planet: the matters of the house it sits in and of the houses it rules, coloured by its sign, its dignity and the planets with it, and the classical results of its placements and yogas. The Brihat Jataka itself holds that the results it gives for houses, signs, aspects and yogas come in the period of the planet that produces them. Rahu and Ketu own no sign, and give the results of the lord of the sign they occupy and of the planets with them. Each level works inside the one above it: the deepest level named is the period this reading is for, and its planet is what sets it apart from the periods around it; the levels above it are its backdrop.

You are given the period and the levels it sits inside; the chart facts for each of its planets; how each planet stands to the one above it; what the houses named stand for; and documents of passages from the classical books. Each document holds passages chosen because their condition holds in the reader's chart and they concern one of the period's planets, which the document's context names: ${BRIHAT_JATAKA_1885.described}, or, for a woman's chart, also ${STRIJATAKA_1931.described}.

Write the reading:
- Two short paragraphs, 100 to 140 words in all and never more than 150; a single paragraph of up to 110 words when the period is a Maha Dasha on its own. The reading sits in a card under the timeline; a long reading is one that gets cut.
- First paragraph: the backdrop, what the planets of the higher levels bring forward in this chart. Second paragraph: what the period's own planet focuses within it, and how it stands to the planet above it.
- Build it from both kinds of material. State a chart fact plainly and say which fact a statement rests on ("with Saturn ruling your 4th and 5th houses, ..."); interpret a house only through what it stands for, as given. Every classical result comes from a passage: cite it and attribute it to its book. Never present your own reading of a fact as the books' view.
- Name each planet's period by its level the first time ("your Saturn Maha Dasha", "its Mercury sub-period"), plainly after that. Do not repeat the dates: the card shows them.
- Describe what the period emphasises and favours, as tendencies. Never promise an event, never give a date or an age, and never say that something will certainly happen. For a period already over, write in the past tense; for one still to come, say what it is set to bring forward.
- A planet in the same sign as the planet above it, or in an angle or a trine from it, or its natural friend, works with it; one 6th or 8th from it, or its natural enemy, pulls against it. Say so once, in plain words, where it matters. Counting from one planet to another is not a house of the chart: never read a house's meaning into it.
- A passage that lists results of several kinds may be used only for the results that fit this period's planets and houses.
- Words in square brackets inside a passage are the app's, not the book's: the opening words a passage needs to read alone, or a wording chosen in place of one too harsh to print. Follow them, and never restore what they replace.
- Speak of the 6th house as rivals, debts and daily work, the 8th as sudden change and what is hidden, and the 12th as expenses, foreign places and retreat, never as illness, lifespan or loss of life.
${CLASSICAL_NOTE_RULES}`;

/**
 * The user turn's closing text: the facts, the language and who the reader
 * is. The reading is written straight in the reader's language from English
 * facts and passages, as the other classical notes are, so its citations stay
 * on its own words. An unknown language code is English.
 */
export function dashaReadingInstruction(
  path: readonly DashaSpan[],
  facts: PeriodFacts,
  status: DashaStatus,
  sex?: BirthSex,
  languageCode = "en",
): string {
  const english = !Object.hasOwn(COMMENTARY_LANGUAGES, languageCode) || languageCode === "en";
  const language = english ? COMMENTARY_LANGUAGES.en : COMMENTARY_LANGUAGES[languageCode];
  const single = path.length === 1;
  return (
    `${describePeriod(path, facts, status)}\n\n` +
    `Write the reading for this period in ${language}: ` +
    (single
      ? "one paragraph on what its planet brings forward in this chart."
      : `two short paragraphs, the backdrop of the ${nameList(path.slice(0, -1).map((span) => `${span.planet} ${LEVEL_NAMES[span.level]}`))}, then what the ${path[path.length - 1].planet} ${LEVEL_NAMES[path[path.length - 1].level]} focuses within it.`) +
    (sex ? READER_LINES[sex] : "") +
    " Cite a passage for every classical result, but say in your own plain words what the book ties to the placement, never in the passage's sentence:" +
    ' not "a person born with Saturn in sign Scorpio will be indifferent to work and will be merciless[1]" but "the Brihat Jataka ties Saturn in Scorpio to a cool, detached attitude to work[1]";' +
    ' not "if he occupy the 2nd house, the person will be wealthy[2]" but "it links Mercury in your 2nd house with wealth[2]".' +
    " Do not repeat the dates, give no advice or warnings of your own, stay under 150 words, and do not end with a summary." +
    CLOSING_REMINDERS +
    (english ? "" : ` Write every sentence in ${language}, although the facts and the passages are in English.`)
  );
}

/** What two requests must share to be the same reading: everything the model is sent but the language and the reader, which the route adds. */
export function periodCanonical(
  path: readonly DashaSpan[],
  facts: PeriodFacts,
  status: DashaStatus,
  groups: readonly PeriodDocumentGroup[],
): string {
  return [
    describePeriod(path, facts, status),
    groups
      .map(({ lord, source, passages, conditions, yogaNames }) =>
        [lord, source, passages.map((passage) => passage.id).join(","), [...conditions].sort().join(","), [...yogaNames].sort().join(",")].join("|"),
      )
      .join(";"),
  ].join("#");
}
