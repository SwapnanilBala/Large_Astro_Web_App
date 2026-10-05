import type Anthropic from "@anthropic-ai/sdk";
import type { LifeDomainKey } from "../astro-types";
import type { BirthSex } from "../birth-sex";
import { LIFE_DOMAIN_EVIDENCE_CONFIG } from "../engines/life-domain-rules";
import { YOGA_DEFINITIONS } from "../engines/yoga-engine";
import type { ClassicalReading } from "./classical-reading";
import type { KNOWLEDGE_LIFE_AREAS } from "./corpus";
import { heldPlacements, housesOf, nakshatraName, placementsHold } from "./placements";
import { BRIHAT_JATAKA_1885, KNOWLEDGE_SOURCES, STRIJATAKA_1931 } from "./sources";
import { CLASSICAL_NOTE_RULES, NOTE_PREFIX, readingFrom, speaksToChart, type PassageRow } from "./yoga-classics-reading";

/*
 * "From the classics" on the life-areas page: what the Brihat Jataka says
 * about each area of the reader's life, from the passages whose conditions
 * hold in their chart. The server half that touches neither the database nor
 * the network, so it can be tested directly.
 *
 * A passage reaches an area when it is tagged with one of the area's topics
 * and it applies to the chart, by either of two routes: every placement key it
 * carries holds (the house and sign chapters), or the chart has a yoga it is
 * tagged with, in the form it speaks of (the yoga chapters).
 *
 * One call writes every area's note, as the life-area briefs do, so moving
 * between areas never spends the reader's daily allowance again. Each area is
 * its own document, and each paragraph of the answer opens with its area's
 * marker, which is how the answer is cut back into one reading per area.
 */

type Topic = (typeof KNOWLEDGE_LIFE_AREAS)[number];

/** Which of the corpus's topics serve each of the app's seven areas, in the order the documents are sent. */
export const AREA_TOPICS: Record<LifeDomainKey, Topic[]> = {
  love_life: ["relationships"],
  career: ["career"],
  family: ["family", "children"],
  inheritance: ["wealth"],
  influence: ["status"],
  life_cycle: ["character", "spirituality"],
  travel_destinations: ["travel"],
};

export const AREA_KEYS = Object.keys(AREA_TOPICS) as LifeDomainKey[];

/** Every topic some area reads, for the one query that serves them all. */
export const AREA_TOPIC_LIST: Topic[] = [...new Set(Object.values(AREA_TOPICS).flat())];

/** How the prompt names each area. */
export const AREA_NAMES: Record<LifeDomainKey, string> = {
  love_life: "love and marriage",
  career: "work and career",
  family: "family and home",
  inheritance: "inheritance and shared wealth",
  influence: "standing and influence",
  life_cycle: "temperament and the course of life",
  travel_destinations: "travel and the places of a life",
};

/**
 * Passages per area. Six short passages is about 500 input tokens, and seven
 * areas at that is a prompt the size of the yoga note's, for seven notes.
 */
export const AREA_PASSAGE_LIMIT = 6;

/** A yoga the chart has, as the selection needs it. */
export type ChartYoga = { id: string; planets: string[] };

export type AreaChart = {
  /** Every placement key that holds for the chart (chartPlacementKeys). */
  keys: ReadonlySet<string>;
  yogas: readonly ChartYoga[];
};

export type AreaSelection = {
  area: LifeDomainKey;
  passages: PassageRow[];
  /** The placement keys these passages were chosen for that hold in the chart. */
  conditions: string[];
  /** The chart's yogas these passages were chosen for, by catalogue name. */
  yogaNames: string[];
};

const DEFINITIONS = new Map(YOGA_DEFINITIONS.map((definition) => [definition.id, definition]));

function bookOrder(a: PassageRow, b: PassageRow): number {
  return a.chapter - b.chapter || a.verse - b.verse || a.part - b.part;
}

const countsFor = (area: LifeDomainKey, id: string): boolean =>
  LIFE_DOMAIN_EVIDENCE_CONFIG[area].yogaIdPrefixes.some((prefix) => id === prefix || id.startsWith(prefix));

/**
 * The chart's yogas that a passage is tagged with, in the form it speaks of,
 * and that the area counts as its own evidence. The last test is what keeps
 * the yoga section's material in the yoga section: Kemadruma's verse names
 * wealth and standing, but no area counts Kemadruma, so it is quoted once,
 * there, and not again under every area it touches. The marriage yogas are on
 * Love Life's list, so their verses reach it.
 */
function yogasFor(passage: PassageRow, chart: AreaChart, area: LifeDomainKey): ChartYoga[] {
  return chart.yogas.filter(
    (yoga) => passage.yogaIds.includes(yoga.id) && speaksToChart(passage, yoga) && countsFor(area, yoga.id),
  );
}

/** Whether a passage applies to the chart for an area: by its placements, or by a yoga the area counts. */
export function appliesToChart(passage: PassageRow, chart: AreaChart, area: LifeDomainKey): boolean {
  return placementsHold(passage, chart.keys) || yogasFor(passage, chart, area).length > 0;
}

/**
 * Which passages an area gets for a chart, in the book's order.
 *
 * Rows arrive from the database already narrowed; this keeps only those that
 * truly apply and carry one of the area's topics, then ranks: a condition in
 * one of the area's own houses first (Venus in the 7th for love, or the 7th
 * house's lord), then one about the area's planets, then one written for the
 * reader's sex (the chapters on women's charts), then one reached through a
 * yoga, then the rest; the verse before the translator's note; then the book's
 * order.
 */
export function selectAreaPassages(
  rows: readonly PassageRow[],
  area: LifeDomainKey,
  chart: AreaChart,
  limit: number = AREA_PASSAGE_LIMIT,
): PassageRow[] {
  const config = LIFE_DOMAIN_EVIDENCE_CONFIG[area];
  const topics = new Set<string>(AREA_TOPICS[area]);
  const houses = new Set(config.houses);
  const planets = new Set(config.planets);
  const score = (passage: PassageRow): number => {
    const held = heldPlacements(passage, chart.keys);
    const inAreaHouse = held.some((key) => housesOf(key).some((house) => houses.has(house)));
    const ofAreaPlanet = held.some((key) => planets.has(key.split(".")[0]));
    const forReader = held.some((key) => key.startsWith("reader.sex."));
    const areaYoga = yogasFor(passage, chart, area).length > 0;
    return (
      (inAreaHouse ? 16 : 0) +
      (ofAreaPlanet ? 8 : 0) +
      (forReader ? 4 : 0) +
      (areaYoga ? 2 : 0) +
      (passage.kind === "verse" ? 1 : 0)
    );
  };
  return rows
    .filter((passage) => passage.lifeAreas.some((topic) => topics.has(topic)) && appliesToChart(passage, chart, area))
    .sort((a, b) => score(b) - score(a) || bookOrder(a, b))
    .slice(0, limit)
    .sort(bookOrder);
}

/**
 * Every area the book has something to say about for this chart, in
 * AREA_KEYS order. An area with no passage is left out rather than sent empty,
 * so the model is never asked to write about nothing.
 */
export function selectAreas(
  rows: readonly PassageRow[],
  chart: AreaChart,
  limit: number = AREA_PASSAGE_LIMIT,
): AreaSelection[] {
  return AREA_KEYS.flatMap((area) => {
    const passages = selectAreaPassages(rows, area, chart, limit);
    if (passages.length === 0) return [];
    const conditions = [...new Set(passages.flatMap((passage) => heldPlacements(passage, chart.keys)))];
    const ids = new Set(passages.flatMap((passage) => yogasFor(passage, chart, area).map((yoga) => yoga.id)));
    const yogaNames = [...ids].map((id) => DEFINITIONS.get(id)?.name ?? id);
    return [{ area, passages, conditions, yogaNames }];
  });
}

const ORDINAL_SUFFIX = (n: number) =>
  n % 100 >= 11 && n % 100 <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
const ordinal = (value: string | number) => `${value}${ORDINAL_SUFFIX(Number(value))}`;
/** A key's subject in prose: "the Sun", "Venus", "the lord of the 7th house". */
const inProse = (subject: string) => {
  if (subject === "Sun" || subject === "Moon") return `the ${subject}`;
  const lord = /^lord(\d+)$/.exec(subject);
  return lord ? `the lord of the ${ordinal(lord[1])} house` : subject;
};

/** A placement key in plain words, for the model's context: "Venus in the 7th house". */
export function describePlacement(key: string): string {
  const [subject, kind, value] = key.split(".");
  if (kind === "sign") return subject === "ascendant" ? `${value} rising` : `${inProse(subject)} in ${value}`;
  if (kind === "navamsa") return `${inProse(subject)} in the navamsa of ${value}`;
  if (kind === "house") return `${inProse(subject)} in the ${ordinal(value)} house`;
  if (kind === "fromMoon") return `${inProse(subject)} in the ${ordinal(value)} house from the Moon`;
  if (kind === "dignity") return `${inProse(subject)} ${value === "own" ? "in its own sign" : value}`;
  if (kind === "aspects") return `${inProse(subject)} aspecting ${inProse(value)}`;
  if (kind === "signtype") return subject === "ascendant" ? `an ${value} sign rising` : `${inProse(subject)} in an ${value} sign`;
  if (kind === "nakshatra") return `${inProse(subject)} in the nakshatra ${nakshatraName(value) ?? value}`;
  if (kind === "sex") return `the reader is ${value === "female" ? "a woman" : "a man"}`;
  return key;
}

/** How each area's paragraph opens in the answer, e.g. "[love_life]". */
export const areaMarker = (area: LifeDomainKey) => `[${area}]`;

/** The books, in the order an area's documents are sent: the Brihat Jataka first, then the book on women's charts. */
const BOOK_ORDER = [BRIHAT_JATAKA_1885.slug, STRIJATAKA_1931.slug];
const bookRank = (slug: string) => (BOOK_ORDER.includes(slug) ? BOOK_ORDER.indexOf(slug) : BOOK_ORDER.length);

/** One document's worth: an area's passages from one book, in the book's order. */
export type AreaDocumentGroup = { area: LifeDomainKey; source: string; passages: PassageRow[]; conditions: string[] };

/**
 * An area's passages split by book, since a citation names a document and the
 * reader is owed the right book's name: one group per area and book, areas in
 * the selection's order, books in BOOK_ORDER. The documents are sent in this
 * order, and citations are read back against it.
 */
export function areaDocumentGroups(selection: readonly AreaSelection[]): AreaDocumentGroup[] {
  return selection.flatMap(({ area, passages, conditions }) => {
    const books = [...new Set(passages.map((passage) => passage.source))].sort((a, b) => bookRank(a) - bookRank(b));
    return books.map((source) => {
      const own = passages.filter((passage) => passage.source === source);
      const held = new Set(own.flatMap((passage) => [...passage.placements, ...passage.placementsAny]));
      return { area, source, passages: own, conditions: conditions.filter((key) => held.has(key)) };
    });
  });
}

/**
 * One citable document per area and book: each passage a content block, so a
 * citation names whole passages; the chart conditions they were chosen for go
 * in `context`, which the model reads but cannot cite. Every string here comes
 * from the corpus, the catalogue, the vocabulary or lib/knowledge/sources.ts,
 * never from the browser.
 */
export function areaDocuments(selection: readonly AreaSelection[]): Anthropic.DocumentBlockParam[] {
  const yogaNamesOf = new Map(selection.map(({ area, yogaNames }) => [area, yogaNames]));
  return areaDocumentGroups(selection).map(({ area, source, passages, conditions }) => {
    const book = KNOWLEDGE_SOURCES[source] ?? BRIHAT_JATAKA_1885;
    const yogaNames = source === BRIHAT_JATAKA_1885.slug ? (yogaNamesOf.get(area) ?? []) : [];
    return {
      type: "document",
      title: `${areaMarker(area)} ${book.title}, on ${AREA_NAMES[area]}`,
      context:
        "Each passage was chosen because its condition holds in the reader's chart. " +
        (conditions.length > 0 ? `Conditions met by placement: ${conditions.map(describePlacement).join("; ")}. ` : "") +
        (yogaNames.length > 0 ? `Yogas the chart has that passages speak of: ${yogaNames.join(", ")}. ` : "") +
        `The passages are from ${book.described}.`,
      source: {
        type: "content",
        content: passages.map((passage) => ({
          type: "text",
          text: passage.kind === "note" ? `${NOTE_PREFIX}${passage.text}` : passage.text,
        })),
      },
      citations: { enabled: true },
    };
  });
}

/* Frozen, so it is the cacheable prefix; the documents and the language follow in the user turn. */
export const AREA_CLASSICS_SYSTEM_PROMPT = `You write the "From the classics" notes for the life areas of a Vedic astrology report.

You are given documents for each life area, each holding passages from one book: ${BRIHAT_JATAKA_1885.described}; or, for a woman's chart, also ${STRIJATAKA_1931.described}. Each passage was chosen because its condition holds in the reader's chart, and each document's context lists those conditions. A document's title opens with its area's marker and names its book.

For each area, tell the reader what the books say about that part of their life.

- One paragraph per area, in the order the instruction gives. Open each paragraph with the area's marker exactly as given, such as [love_life], and nothing else before it.
- Two or three sentences per area, no more than 70 words. Each note is shown alone, in a card on its area's page; a long note is a note that gets cut.
- Write each area's paragraph from the documents titled with its marker. A passage that lists results of several kinds may be used only for its results about that area.
- Ground every statement in the passages and cite the passage it comes from. Say nothing the passages do not say.
- Say which condition in the chart a statement rests on ("with Venus in your 7th house, ...").
- Words in square brackets inside a passage are the app's, not the book's: the opening words a passage needs to read alone, or a wording chosen in place of one too harsh to print. Follow them, and never restore what they replace.
${CLASSICAL_NOTE_RULES}`;

/** The user turn's closing instruction: which language, which areas, in what order, under which markers. */
/*
 * The Brihat Jataka writes for men, and says how to read it for a woman: the
 * same rules hold, and what concerns a wife concerns her husband (ch. 24,
 * v. 1). So for a woman the verses about a wife describe her partner, and the
 * Strijataka, written about women, calls the partner her husband. The note
 * still says "your partner" either way, by the owner's choice.
 */
const NO_SPOUSE_WORDS = ' Call the partner "your partner", and never write "husband", "wife" or "wives".';
const READER_LINES: Record<BirthSex, string> = {
  female:
    " The reader is a woman. The Brihat Jataka writes for men: where its passages speak of a wife or of women, " +
    "they describe the reader's partner. The Strijataka writes about women, and its husband is the reader's partner." +
    NO_SPOUSE_WORDS,
  male: " The reader is a man." + NO_SPOUSE_WORDS,
};

export function areaClassicsInstruction(
  selection: readonly AreaSelection[],
  languageName: string,
  sex?: BirthSex,
): string {
  const areas = selection.map(({ area }) => `${areaMarker(area)} ${AREA_NAMES[area]}`);
  return (
    `Write the notes in ${languageName}, one paragraph for each of these ${areas.length} areas, ` +
    `in this order, each opening with its marker: ${areas.join("; ")}.` +
    (sex ? READER_LINES[sex] : "")
  );
}

const MARKER = new RegExp(`\\[(${AREA_KEYS.join("|")})\\]`, "g");

/**
 * The answer cut back into one reading per area.
 *
 * Text belongs to the area whose marker last opened, wherever in a block the
 * marker falls. A block's citations stay with its last piece, as in
 * readingParagraphs, since a marker after the cited words would be a model
 * writing out of order. Text before the first marker, or under a marker for an
 * area that was not sent, belongs to nothing and is dropped. Sources are
 * numbered per area, because each area's note is read on its own.
 *
 * An area whose paragraph cites nothing gets no reading: an uncited note is
 * what this section exists not to print.
 */
export function areaReadingsFrom(
  content: Anthropic.ContentBlock[],
  selection: readonly AreaSelection[],
): Partial<Record<LifeDomainKey, ClassicalReading>> {
  const sent = new Set<string>(selection.map(({ area }) => area));
  const blocks = new Map<LifeDomainKey, Anthropic.TextBlock[]>();
  let current: LifeDomainKey | null = null;

  for (const block of content) {
    if (block.type !== "text") continue;
    const pieces: { area: LifeDomainKey | null; text: string }[] = [];
    let start = 0;
    let area: LifeDomainKey | null = current;
    for (const match of block.text.matchAll(MARKER)) {
      pieces.push({ area, text: block.text.slice(start, match.index) });
      area = sent.has(match[1]) ? (match[1] as LifeDomainKey) : null;
      start = match.index + match[0].length;
    }
    pieces.push({ area, text: block.text.slice(start) });
    current = area;

    pieces.forEach((piece, index) => {
      const last = index === pieces.length - 1;
      if (piece.area === null || (!last && piece.text.length === 0)) return;
      const list = blocks.get(piece.area) ?? [];
      list.push({ ...block, text: piece.text, citations: last ? block.citations : null });
      blocks.set(piece.area, list);
    });
  }

  const documents = areaDocumentGroups(selection);
  const readings: Partial<Record<LifeDomainKey, ClassicalReading>> = {};
  for (const [area, areaBlocks] of blocks) {
    const reading = readingFrom(areaBlocks, documents);
    if (reading.sources.length > 0) readings[area] = reading;
  }
  return readings;
}
