import type { BirthSex } from "../birth-sex";
import type { DashaSpan, DashaStatus } from "../dasha-periods";
import { spanDays } from "../dasha-periods";
import { housesRuledBy, isNode, type LordFacts, type PeriodFacts } from "../dasha-reading-facts";
import {
  HOUSE_MEANINGS,
  LEVEL_NAMES,
  STOCK_PHRASES,
  describeFocus,
  describeLord,
  describeRelation,
  housesNamed,
  houseList,
  levelList,
  nameList,
  ordinal,
} from "../dasha-period-words";
import { YOGA_DEFINITIONS } from "../engines/yoga-engine";
import { COMMENTARY_LANGUAGES } from "../varga-commentary";
import { READER_LINES, countedByAnyArea, describePlacement, type AreaChart, type ChartYoga } from "./area-classics-reading";
import { heldPlacements, placementsHold } from "./placements";
import type { ClassicalReading, ClassicalSource } from "./classical-reading";
import { BRIHAT_JATAKA_1885, KNOWLEDGE_SOURCES, STRIJATAKA_1931 } from "./sources";
import { stripInlineMarkdown } from "../prompt-input";
import {
  CLASSICAL_NOTE_RULES,
  CLOSING_REMINDERS,
  NOTE_PREFIX,
  modelText,
  passageRef,
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

export { HOUSE_MEANINGS, LEVEL_NAMES, describeLord, describeRelation };

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

/**
 * The chosen passages as the model reads them: numbered, grouped by the
 * planet each was chosen for and its book, each group saying which chart
 * conditions and yogas its passages rest on. The model marks a classical
 * result with its passage's number, [2] or [1,3], and readingFromMarkers turns
 * the marks into the reading's sources.
 *
 * Numbered text rather than the citations feature, measured on 2026-10-14.
 * With citations on, Haiku 5.5 now and then wrote its paraphrase and then the
 * cited verse itself as the next block -- "... doing other people's work" and
 * then "will be independent, fierce, poor, will do the work of other people"
 * -- or made the verse the object of its sentence ("the book holds that [the
 * verse]"), in about half of sixteen readings. Asked to mark numbers instead,
 * eight readings of the same periods pasted nothing and read the same.
 *
 * Every string here comes from the corpus, the catalogue, the chart or
 * lib/knowledge/sources.ts, never from the browser.
 */
export function periodPassageListing(groups: readonly PeriodDocumentGroup[], facts: PeriodFacts): string {
  let number = 0;
  return groups
    .map(({ lord, source, passages, conditions, yogaNames }) => {
      const book = KNOWLEDGE_SOURCES[source] ?? BRIHAT_JATAKA_1885;
      const lordFacts = facts.lords.find((entry) => entry.lord === lord);
      const voices = lordFacts ? voicesOf(lordFacts).filter((voice) => voice !== lord) : [];
      const header =
        `Chosen for ${lord}, the ${lordFacts ? levelList(lordFacts.levels) : "period"} lord of this period` +
        (voices.length > 0 ? `, whose results it gives through ${voices.join(" and ")}; the passages may concern them` : "") +
        `, from ${book.title}. ` +
        (conditions.length > 0 ? `Conditions met in the chart: ${conditions.map(describePlacement).join("; ")}. ` : "") +
        (yogaNames.length > 0 ? `Yogas the chart has that passages speak of: ${yogaNames.join(", ")}.` : "");
      const lines = passages.map((passage) => {
        number += 1;
        const text = passage.kind === "note" ? `${NOTE_PREFIX}${modelText(passage.text)}` : modelText(passage.text);
        return `[${number}] (${passageRef(passage)}) ${text}`;
      });
      return [header.trim(), ...lines].join("\n");
    })
    .join("\n\n");
}

/** A source mark the model writes after the words it supports: [2] or [1, 3]. */
const MARK = /\[(\d+(?:\s*,\s*\d+)*)\]/g;

/**
 * The reading the model wrote, with its marks turned into sources: segments of
 * text, each carrying the numbers of the passages after its words, the sources
 * numbered in the order the reading first cites them, as on the other
 * classical notes. A mark for a passage it was not given is dropped and
 * counted.
 */
export function readingFromMarkers(
  text: string,
  groups: readonly PeriodDocumentGroup[],
): { reading: ClassicalReading; strayMarks: number } {
  const passages = groups.flatMap((group) => group.passages);
  const numbers = new Map<number, number>();
  const sources: ClassicalSource[] = [];
  const segments: ClassicalReading["segments"] = [];
  let strayMarks = 0;
  const clean = stripInlineMarkdown(text);
  let cursor = 0;
  for (const match of clean.matchAll(MARK)) {
    const before = clean.slice(cursor, match.index).replace(/[ \t]+$/, "");
    cursor = (match.index ?? 0) + match[0].length;
    const cited: number[] = [];
    for (const given of match[1].split(",").map((value) => Number(value.trim()))) {
      const passage = passages[given - 1];
      if (!passage) {
        strayMarks += 1;
        continue;
      }
      let number = numbers.get(given);
      if (number === undefined) {
        number = sources.length + 1;
        numbers.set(given, number);
        sources.push({ number, book: passage.source, ref: passageRef(passage), kind: passage.kind, text: passage.text });
      }
      if (!cited.includes(number)) cited.push(number);
    }
    segments.push({ text: before, sources: cited });
  }
  const rest = clean.slice(cursor);
  if (rest.length > 0) segments.push({ text: rest, sources: [] });
  return {
    reading: { segments: segments.filter((segment) => segment.text.length > 0 || segment.sources.length > 0), sources },
    strayMarks,
  };
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

/**
 * The period and its planets, in words, for the model: the deepest period,
 * the levels it sits inside, each planet's place in the chart, how each
 * stands to the one above, what the houses named stand for, and what makes
 * the period itself -- the houses its planets share, what its own planet adds,
 * and how those houses show up in ordinary life (lib/dasha-period-words.ts).
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
    `What makes this period itself:\n${describeFocus(facts, deepest.planet)}`,
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

You are given the period and the levels it sits inside; the chart facts for each of its planets; how each planet stands to the one above it; what the houses named stand for; what makes the period itself; and numbered passages from the classical books, grouped by the planet each was chosen for. Each passage was chosen because its condition holds in the reader's chart and it concerns one of the period's planets; each group says which planet, and the chart conditions and yogas its passages rest on. The books are ${BRIHAT_JATAKA_1885.described}, or, for a woman's chart, also ${STRIJATAKA_1931.described}.

Write the reading:
- Two short paragraphs, 100 to 140 words in all and never more than 150; a single paragraph of up to 110 words when the period is a Maha Dasha on its own. The reading sits in a card under the timeline; a long reading is one that gets cut.
- The card beside the reading already lists each planet's sign, house, rulerships and dignity, so never recite them. Use a fact only to explain something, in a clause, and never list houses with their meanings.
- Open with what is distinctive about this period: the one or two parts of life it concentrates on (the houses its planets share, given to you) and what its own planet newly brings.
- Make it concrete. Say how this tends to show up in ordinary life, choosing one or two of the everyday examples given for those houses, as tendencies, not events.
- Give the ease or friction between the levels in one sentence, from how each planet stands to the one above. Counting from one planet to another is not a house of the chart: never read a house's meaning into it.
- Bring in the books' view where a passage bears on the period: put it in your own words, attribute it to its book, and mark it with the passage's number in square brackets right after the words it supports, like [2] or [1,3]. Every classical result carries its number, nothing else carries one, and never write a number you were not given. Never present your own reading of a fact as the books' view. A passage that lists results of several kinds may be used only for the results that fit this period's planets and houses.
- Name a planet's period by its level the first time ("your Saturn Maha Dasha", "its Mercury sub-period"). Do not repeat the dates: the card shows them.
- Avoid stock astrology phrasing. Never write ${STOCK_PHRASES.map((phrase) => `"${phrase}"`).join(", ")}.
- Never promise an event, never give a date or an age, and never say that something will certainly happen. For a period already over, write in the past tense; for one still to come, say what it is set to bring forward.
- Words in square brackets inside a passage are the app's, not the book's: the opening words a passage needs to read alone, or a wording chosen in place of one too harsh to print. Follow them, and never restore what they replace.
- Speak of the 6th house as rivals, debts and daily work, the 8th as sudden change and what is hidden, and the 12th as spending, foreign places and retreat, never as illness, lifespan or loss of life.
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
      ? "one paragraph on what it concentrates on, how that tends to show up, and the books' view."
      : "two short paragraphs: what it concentrates on and how that tends to show up, then the ease or friction between the levels and the books' view.") +
    (sex ? READER_LINES[sex] : "") +
    " Mark every classical result with its passage's number, say in your own plain words what the book ties to the placement, and never quote the passage's sentence:" +
    ' not "will be indifferent to work and will be merciless[1]" but "a cool, detached attitude to work[1]".' +
    " Do not recite the planets' signs, houses or rulerships, which the card shows; do not repeat the dates; give no advice or warnings of your own; stay under 150 words; and do not end with a summary." +
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

/* ── Copied verses, and readings cut short ─────────────────────────────────── */

/** Words in a row that count as a passage copied rather than put in the reading's own words. */
export const COPY_RUN_WORDS = 8;

const copyWords = (text: string) =>
  text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\[\]]/g, " ")
    .split(/[^\p{L}\p{N}']+/u)
    .filter(Boolean);

/**
 * Runs of COPY_RUN_WORDS or more words the reading shares with one of its
 * passages, as the book or as the app's rewording of it: a verse copied into
 * the reading instead of said in its own words.
 *
 * The prompt asks for its own words, with examples, and Haiku mostly obeys; but
 * with citations on it now and then pastes the cited verse inline -- "will be
 * indifferent to work and will be merciless" -- which the content check cannot
 * see, since none of those words is banned. The verse is printed under the
 * reading anyway, word for word, for anyone who wants it.
 */
export function copiedPassages(reading: ClassicalReading, passages: readonly PassageRow[]): string[] {
  const runs = new Set<string>();
  for (const passage of passages) {
    for (const text of [passage.text, modelText(passage.text)]) {
      const words = copyWords(text);
      for (let start = 0; start + COPY_RUN_WORDS <= words.length; start++) {
        runs.add(words.slice(start, start + COPY_RUN_WORDS).join(" "));
      }
    }
  }
  const words = copyWords(reading.segments.map((segment) => segment.text).join(" "));
  const copied: string[] = [];
  for (let start = 0; start + COPY_RUN_WORDS <= words.length; start++) {
    const run = words.slice(start, start + COPY_RUN_WORDS).join(" ");
    if (runs.has(run)) {
      copied.push(run);
      start += COPY_RUN_WORDS - 1;
    }
  }
  return copied;
}

/** Whether a reading stops mid-sentence: its last words end without a full stop, in any of the seven languages. */
export function endsMidSentence(reading: ClassicalReading): boolean {
  const last = [...reading.segments].reverse().find((segment) => segment.text.trim().length > 0);
  return !last || !/[.!?।॥…)"'”’]$/u.test(last.text.trim());
}
