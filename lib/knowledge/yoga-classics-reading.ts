import type Anthropic from "@anthropic-ai/sdk";
import { YOGA_DEFINITIONS } from "../engines/yoga-engine";
import { stripInlineMarkdown } from "../prompt-input";
import { BRIHAT_JATAKA_1885 } from "./sources";
import type {
  YogaClassicsReading,
  YogaClassicsSegment,
  YogaClassicsSource,
  YogaClassicsYoga,
} from "./yoga-classics";

/*
 * The server half of "From the classics" that touches neither the database nor
 * the network, kept apart so it can be tested directly: which passages a chart
 * gets, the documents the model reads them in, and how its citations become
 * the numbered sources under the reading.
 */

/** A knowledge_passages row as the route reads it. Withheld rows never get this far. */
export type PassageRow = {
  id: string;
  /** The book's slug in lib/knowledge/sources.ts. */
  source: string;
  chapter: number;
  verse: number;
  part: number;
  kind: "verse" | "note";
  text: string;
  yogaIds: string[];
  planets: string[];
  lifeAreas: string[];
  /** Chart conditions the passage needs; see lib/knowledge/placements.ts. */
  placements: string[];
  /** Its one either/or, when it has one: at least one of these must hold too. */
  placementsAny: string[];
};

export type YogaWithPassages = { yoga: YogaClassicsYoga; passages: PassageRow[] };

/**
 * Five yogas at four passages each is about twenty short verses, roughly 1,500
 * input tokens, and a reading that still fits a card at two sentences a yoga.
 */
export const CLASSICS_LIMITS = { yogas: 5, perYoga: 4 } as const;

const DEFINITIONS = new Map(YOGA_DEFINITIONS.map((definition) => [definition.id, definition]));

/** How a translator's note is marked in the text the model reads; the prompt names it. */
export const NOTE_PREFIX = "Translator's note: ";

/*
 * Phrases the model reads in other words than the book's. "Free from
 * diseases" is how the books promise good health, and a model shown it writes
 * it back, even when told not to (measured on Haiku and on the Opus retry
 * alike): the content line keeps illness out of every note, even as an
 * absence. So the copy the model reads says it as a note may, in square
 * brackets, which the prompt already reads as the app's words; the passage
 * printed under the note keeps the book's. Every classical note reads
 * passages through it: the yoga section's, each life area's, and "Ask the
 * classics".
 *
 * The books' words for a spouse and their "king" go the same way, for the
 * same reason (2026-10-07). Told to write "your partner" and "someone with
 * standing", Haiku 5.5 still quoted the verse inline -- "will have a mean
 * wife", "you will be a king" -- in 9 of 27 English life-area notes across
 * four charts, every one a note the check then sends to Opus. A model cannot
 * copy a word it was never shown. For a woman's chart this is also what
 * READER_LINES asks for: the Brihat Jataka's wife is her partner.
 */
const MODEL_WORDING: readonly (readonly [RegExp, string])[] = [
  [/\bfree from (?:all |serious )?(?:diseases?|ailments?|sickness|illness(?:es)?)\b/gi, "[of robust health]"],
  [/\b(?:wives|husbands)\b/gi, "[partners]"],
  [/\b(?:wife|husband)'s\b/gi, "[partner's]"],
  [/\b(?:wife|husband)\b/gi, "[partner]"],
  [/\b(?:(?:the|a) )?kingdoms?\b/gi, "[a position of power]"],
  [/\b(?:the )?kings\b/gi, "[people of standing]"],
  [/\b(?:(?:the|a) )?king's\b/gi, "[someone with standing's]"],
  [/\b(?:(?:the|a) )?king\b/gi, "[someone with standing]"],
  [/\b(?:(?:the|a) )?queens?\b/gi, "[a woman of standing]"],
];

/** A passage as the model reads it: the book's words, but for MODEL_WORDING. */
export function modelText(text: string): string {
  return MODEL_WORDING.reduce((current, [pattern, wording]) => current.replace(pattern, wording), text);
}

/**
 * Said again at the very end of every classical note's instruction, where
 * Haiku reads it last. In the system prompt alone it still wrote "wife",
 * "the king" and "you will be poor" now and then, in English, which most
 * readers use; classical-note-check.ts catches what still slips.
 */
export const CLOSING_REMINDERS =
  ' Say "your partner", never "husband", "wife" or "wives"; say "someone with standing", never "king";' +
  ' put a harsh verdict in one neutral phrase ("the book warns of lean years"), never as "you will be poor".';

/**
 * The rules every classical note follows, whatever it is about: the yoga
 * section's and each life area's. One constant, so the two prompts cannot
 * drift apart on attribution, tone or what is never said.
 */
export const CLASSICAL_NOTE_RULES = `- Attribute each claim to the book it comes from, as its document's title names it ("The Brihat Jataka holds that ...", "Varahamihira counts this among ..."). This is the classical view, not a prediction about the reader.
- A passage that begins "${NOTE_PREFIX.trim()}" is the 1885 translator's own note, often quoting other authorities. Attribute it that way ("the translator's notes add ...", "other authorities quoted in the notes hold ..."), never to Varahamihira.
- Plain modern language for a reader who knows no astrology. The book's "king" means someone with standing and authority; say that rather than "king".
- Where a passage's verdict is harsh, name what the book warned of in one neutral phrase. Never describe the reader with its insults.
- Never mention death, lifespan, illness, caste or birth status, crime, or harm to a parent, spouse or child, even if a passage does. A spouse leaving, a marriage ending, marrying late or more than once, and having few children or none may be said plainly, for either partner, without blame.
- The books write for one sex ("his wife", "fond of women", "her husband"). Write for a reader of any gender: "your partner", "marriage", "romance".
- Put every claim in your own plain words; the passages are printed under the note, word for word, for anyone who wants them. Above all, never write a book's word for a spouse, even in a quotation: not "fond of husband[2]" but "devoted to your partner[2]"; not "will possess several wives[1]" but "more than one marriage[1]".
- Speak of sexual matters only as romance, warmth or attraction, never explicitly.
- No advice, no disclaimers, no headings, no lists, no markdown.
- Address the reader as "you".`;

/*
 * Frozen, so it is the cacheable prefix; the documents and the language vary
 * per request and follow it in the user turn. Kept here rather than in the
 * route, which may export only its handlers, so a script can send exactly
 * what ships.
 */
export const YOGA_CLASSICS_SYSTEM_PROMPT = `You write the "From the classics" note in the yoga section of a Vedic astrology report.

You are given one document per yoga found in the reader's chart. Each holds passages from the Brihat Jataka, Varahamihira's classical text on birth charts, in N. Chidambaram Iyer's 1885 English translation. Each document's context says how the yoga is formed in this chart.

Tell the reader what the Brihat Jataka says about their yogas.

- One short paragraph per yoga, in the order given, one or two sentences each, and no more than 170 words in all. The note sits in a card above the yoga list; a long note is a note that gets cut.
- Ground every statement in the passages and cite the passage it comes from. Say nothing about a yoga that its passages do not say. Where a verse gives results planet by planet, use the one for the planet named in the document's context.
${CLASSICAL_NOTE_RULES}
- Use the yoga names exactly as given.`;

/** The user turn's closing instruction, after the documents: which language, which yogas, in what order. */
export function yogaClassicsInstruction(names: string[], languageName: string): string {
  return (
    `Write the note in ${languageName}, about these ${names.length} yogas in this order: ` +
    `${names.join(", ")}. Keep the yoga names as written here.` +
    CLOSING_REMINDERS
  );
}

/** Results before bare definitions, the verse before the translator's note, then the book's order. */
function usefulness(a: PassageRow, b: PassageRow): number {
  const results = Number(b.lifeAreas.length > 0) - Number(a.lifeAreas.length > 0);
  if (results !== 0) return results;
  const kind = Number(a.kind === "note") - Number(b.kind === "note");
  if (kind !== 0) return kind;
  return bookOrder(a, b);
}

function bookOrder(a: PassageRow, b: PassageRow): number {
  return a.chapter - b.chapter || a.verse - b.verse || a.part - b.part;
}

/**
 * Whether a passage tagged with a yoga speaks to the way the yoga is formed in
 * this chart.
 *
 * The Brihat Jataka gives some results planet by planet: Sunapha formed by
 * Mercury is one verse, by Jupiter another (13.7). Those variants are the
 * passages that name a single planet, and one about a planet that does not
 * form the yoga here is about someone else's chart. Passages naming several
 * planets are not filtered, because there the planets are usually a list of
 * alternatives ("the rising Navamsa or the Moon", "Jupiter, the lord of the
 * Moon's sign or the lord of the ascendant") rather than a requirement that
 * all of them take part. A yoga that reports no planets is not filtered at all.
 */
export function speaksToChart(passage: PassageRow, yoga: Pick<YogaClassicsYoga, "planets">): boolean {
  if (yoga.planets.length === 0 || passage.planets.length !== 1) return true;
  return yoga.planets.includes(passage.planets[0]);
}

/**
 * Which passages a chart's yogas get, in the yogas' own rank order.
 *
 * Yogas the library has nothing for are skipped rather than counted, so the
 * five covered are the five highest-ranked that the book speaks to. A passage
 * already given to one yoga is not repeated under another.
 */
export function selectYogaPassages(
  rows: PassageRow[],
  yogas: YogaClassicsYoga[],
  limits: { yogas: number; perYoga: number } = CLASSICS_LIMITS,
): YogaWithPassages[] {
  const used = new Set<string>();
  const chosen: YogaWithPassages[] = [];
  for (const yoga of yogas) {
    if (chosen.length >= limits.yogas) break;
    const fitting = rows.filter(
      (row) => !used.has(row.id) && row.yogaIds.includes(yoga.id) && speaksToChart(row, yoga),
    );
    if (fitting.length === 0) continue;
    const passages = [...fitting].sort(usefulness).slice(0, limits.perYoga).sort(bookOrder);
    for (const passage of passages) used.add(passage.id);
    chosen.push({ yoga, passages });
  }
  return chosen;
}

/**
 * Books with no numbered verses, cited by chapter alone: the Strijataka is
 * prose, and its passages' "verse" is the build's paragraph count, which no
 * reader could find in the printed book.
 */
const CITED_BY_CHAPTER = new Set(["strijataka-1931"]);

/** What a reader can look up: chapter and verse, e.g. "13.5", or the chapter, e.g. "9". */
export function passageRef(passage: Pick<PassageRow, "chapter" | "verse" | "source">): string {
  return CITED_BY_CHAPTER.has(passage.source) ? String(passage.chapter) : `${passage.chapter}.${passage.verse}`;
}

/**
 * One citable document per yoga. Each passage is its own content block, so a
 * citation names whole passages and maps straight back to a row; the yoga's
 * chart facts go in `context`, which the model reads but cannot cite.
 *
 * Every string here comes from the catalogue, the corpus or a closed set the
 * route has already checked. Nothing the browser wrote reaches the model.
 */
export function yogaDocuments(selection: YogaWithPassages[]): Anthropic.DocumentBlockParam[] {
  return selection.map(({ yoga, passages }) => {
    const definition = DEFINITIONS.get(yoga.id);
    const name = definition?.name ?? yoga.id;
    return {
      type: "document",
      title: `${name}: ${BRIHAT_JATAKA_1885.title}`,
      context:
        `Found in the reader's chart, at ${yoga.strength} strength, formed by ${yoga.planets.join(", ")}. ` +
        `The app's rule for it: ${definition?.description ?? "not given"} ` +
        `The passages are from the ${BRIHAT_JATAKA_1885.year} English translation by ${BRIHAT_JATAKA_1885.translator}.`,
      source: {
        type: "content",
        /* The translator's notes often quote other authorities, so the model
           has to know which blocks are notes to attribute them honestly. */
        content: passages.map((passage) => ({
          type: "text",
          text: passage.kind === "note" ? `${NOTE_PREFIX}${modelText(passage.text)}` : modelText(passage.text),
        })),
      },
      citations: { enabled: true },
    };
  });
}

/**
 * The model's answer as segments and numbered sources.
 *
 * With citations on, the answer arrives as a run of text blocks, each carrying
 * the passages it rests on. Sources are numbered in the order the reading
 * first cites them, which is the order a reader meets the markers in.
 */
export function readingFrom(
  content: Anthropic.ContentBlock[],
  /** The documents in the order they were sent, each with its passages in block order. */
  selection: readonly { passages: PassageRow[] }[],
): YogaClassicsReading {
  const numbers = new Map<string, number>();
  const sources: YogaClassicsSource[] = [];
  const segments: YogaClassicsSegment[] = [];

  for (const block of content) {
    if (block.type !== "text") continue;
    const cited: number[] = [];
    for (const citation of block.citations ?? []) {
      if (citation.type !== "content_block_location") continue;
      const document = selection[citation.document_index];
      if (!document) continue;
      for (let index = citation.start_block_index; index < citation.end_block_index; index++) {
        const passage = document.passages[index];
        if (!passage) continue;
        let number = numbers.get(passage.id);
        if (number === undefined) {
          number = sources.length + 1;
          numbers.set(passage.id, number);
          sources.push({ number, book: passage.source, ref: passageRef(passage), kind: passage.kind, text: passage.text });
        }
        if (!cited.includes(number)) cited.push(number);
      }
    }
    const text = stripInlineMarkdown(block.text);
    if (text.length > 0) segments.push({ text, sources: cited });
  }

  return { segments, sources };
}
