/**
 * What the corpus builds share: the check that a transcription still reads
 * like its scan, and the normalising of a record's placement conditions. Each
 * book has its own build script (its chapters, its prompt, its overrides); the
 * rules that decide whether a passage may be written are the same for all.
 */

import { LONG_PASSAGE_WORDS, scanWords } from "../../lib/knowledge/corpus";
import { PLACEMENT_KEYS } from "../../lib/knowledge/placements";

export function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[b.length];
}

/**
 * The same word, or one an OCR slip away from it: "venns" is "venus",
 * "oomraeotator" is "commentator". Up to 40% of the letters may differ, and
 * only in words of four letters or more, so "fo" never stands in for "to".
 */
export function sameWord(clean: string, raw: string): boolean {
  if (clean === raw) return true;
  if (clean.length < 4 || Math.abs(clean.length - raw.length) > 3) return false;
  return editDistance(clean, raw) <= Math.floor(clean.length * 0.4);
}

/**
 * How much of a passage reads, in order, like the scan: the share of its runs
 * of consecutive words that also occur as consecutive words somewhere in the
 * raw chapter, each word allowed an OCR slip (see lib/knowledge/corpus.ts for
 * the run lengths and the floors). Exact matching marked a short note down to
 * 0.5 for repairing six damaged words in sixteen; a rewording still scores low,
 * because its runs do not occur in the scan in any spelling.
 */
export function ocrAgreement(clean: string, rawWords: string[], positionsOf: Map<string, number[]>): number {
  const list = scanWords(clean);
  const size = list.length >= LONG_PASSAGE_WORDS ? 3 : 2;
  if (list.length < size) return 1;
  const positions = (word: string) => {
    let found = positionsOf.get(word);
    if (!found) {
      found = rawWords.flatMap((raw, index) => (sameWord(word, raw) ? [index] : []));
      positionsOf.set(word, found);
    }
    return found;
  };
  let matched = 0;
  for (let start = 0; start + size <= list.length; start++) {
    const found = positions(list[start]).some((at) => {
      for (let step = 1; step < size; step++) {
        if (at + step >= rawWords.length || !sameWord(list[start + step], rawWords[at + step])) return false;
      }
      return true;
    });
    if (found) matched++;
  }
  return matched / (list.length - size + 1);
}

/**
 * The letter-level check (lib/knowledge/corpus.ts, LETTER_CHECKED): one minus
 * the fewest edits that turn the passage's letters into some run of the
 * scan's letters, over the passage's length. Both arguments are already
 * reduced to letters (scanLetters).
 */
export function letterAgreement(passageLetters: string, scanLetters: string): number {
  if (passageLetters.length === 0) return 1;
  let previous = new Int32Array(scanLetters.length + 1);
  let current = new Int32Array(scanLetters.length + 1);
  for (let i = 1; i <= passageLetters.length; i++) {
    current[0] = i;
    const letter = passageLetters.charCodeAt(i - 1);
    for (let j = 1; j <= scanLetters.length; j++) {
      const substitute = previous[j - 1] + (letter === scanLetters.charCodeAt(j - 1) ? 0 : 1);
      const drop = previous[j] + 1;
      const insert = current[j - 1] + 1;
      current[j] = Math.min(substitute, drop, insert);
    }
    [previous, current] = [current, previous];
  }
  let fewest = Infinity;
  for (let j = 0; j <= scanLetters.length; j++) fewest = Math.min(fewest, previous[j]);
  return 1 - fewest / passageLetters.length;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function inOrder<T extends string>(values: T[], order: readonly T[]): T[] {
  return order.filter((value) => values.includes(value));
}

export type Conditions = { placements: string[]; placementsAny: string[] };

/**
 * A record's two placement lists, normalised. A lone alternative is a plain
 * condition. An alternative that is also required makes the either/or always
 * met, so the alternatives say nothing and are dropped.
 */
export function conditionsOf(answered: { placements?: string[]; placements_any?: string[] }): Conditions {
  const all = new Set(answered.placements ?? []);
  let any = [...new Set(answered.placements_any ?? [])];
  if (any.some((key) => all.has(key))) any = [];
  if (any.length === 1) {
    all.add(any[0]);
    any = [];
  }
  return { placements: inOrder([...all], PLACEMENT_KEYS), placementsAny: inOrder(any, PLACEMENT_KEYS) };
}

/** A chapter's required keys, added only to passages that have a condition of their own. */
export function withRequired(conditions: Conditions, required: readonly string[]): Conditions {
  if (required.length === 0 || conditions.placements.length + conditions.placementsAny.length === 0) {
    return conditions;
  }
  return {
    ...conditions,
    placements: inOrder([...new Set([...conditions.placements, ...required])], PLACEMENT_KEYS),
  };
}

const VOCABULARY = new Set(PLACEMENT_KEYS);

/**
 * A record's conditions, checked against the vocabulary. The answer schemas no
 * longer enumerate the keys (there are over 800), so a key the model made up
 * is caught here, and it empties the whole condition: half a condition shows a
 * passage to charts it does not describe. `unknown` collects them for the log.
 */
export function checkedConditions(
  ref: string,
  answered: { placements?: string[]; placements_any?: string[] },
  required: readonly string[],
  unknown: string[],
): Conditions {
  const strange = [...(answered.placements ?? []), ...(answered.placements_any ?? [])].filter((key) => !VOCABULARY.has(key));
  if (strange.length > 0) {
    unknown.push(`${ref}: ${strange.join(", ")}`);
    return { placements: [], placementsAny: [] };
  }
  return withRequired(conditionsOf(answered), required);
}

/* ------------------------------------------------------ the owner's wording */

/*
 * The owner's line on words about people, set on 2026-10-05 while the
 * Strijataka was built, and held to in every book since:
 *
 *   - The words for a prostitute are printed as "multiple illicit
 *     relationships", in square brackets ("calling prostitute is a bit too bold
 *     and some people might get hurt"). The model transcribes faithfully into
 *     `text` and rewords into `reworded_text`; shownText checks the rewording.
 *   - Adultery may be said plainly ("Adultery is fine, not too bad, same do it
 *     for men as well"), and so may "free with other men", and the book's
 *     other words for it, "going wrong" and "free in her sexual intercourse"
 *     ("these sound alright", the same day).
 *   - Any other word that brands a person for their sexual conduct or for
 *     having no children waits, withheld, until the owner picks its wording
 *     ("if you find similar stuff let me know I will recommend").
 */
export const REWORDED = /\b(prostitut\w*|whores?|harlots?|courtesans?|strumpets?|public\s+wom[ae]n)\b/i;
export const OWNERS_WORDING = "multiple illicit relationships";
/** Words a rewording may drop with the label: its article and its verb. */
const DROPPABLE =
  /^(a|an|the|of|is|are|be|been|being|become|becomes|became|turn|turns|prostitut\w*|whores?|harlots?|courtesans?|strumpets?|public|women|woman)$/;

/**
 * Labels the owner has cleared since a book was read (2026-10-05). The
 * cached answers still list them in `harsh_labels`; they are dropped wherever
 * labels are read, so no rebuild is needed to show them. A passage with any
 * other label as well still waits for that one.
 */
const CLEARED_LABELS = /^(adulter\w*|free with other men|going wrong|free in her sexual intercourse)$/i;

/** A record's labels still waiting for the owner's wording, trimmed, once each. */
export function pendingLabels(labels: readonly string[]): string[] {
  return [...new Set(labels.map((label) => label.trim()).filter((label) => label && !CLEARED_LABELS.test(label)))];
}

export const awaitingWording = (labels: readonly string[]) =>
  `awaiting the owner's wording for ${labels.map((label) => `"${label}"`).join(", ")}`;

const brackets = (text: string) => [...text.matchAll(/\[([^\]]*)\]/g)].map((match) => match[1]);
const wordsOutsideBrackets = (text: string) => scanWords(text.replace(/\[[^\]]*\]/g, " "));

/**
 * A record's text as shown: the owner's rewording when it has one, checked to
 * have changed only the words it may. Throws on anything else, since a
 * rewording that strays is a misquotation with the book's name on it. A
 * rewording written by hand (`byHand`, from a build's PASSAGE_OVERRIDES) was
 * read before it went in, so only its brackets are checked.
 */
export function shownText(
  ref: string,
  printedText: string,
  rewordedText: string,
  byHand?: string,
): { text: string; printedText: string | null } {
  const printed = printedText.trim();
  const reworded = (byHand ?? rewordedText).trim();
  if (!reworded) {
    if (REWORDED.test(printed)) throw new Error(`${ref}: "${printed.match(REWORDED)?.[0]}" left unreworded.`);
    return { text: printed, printedText: null };
  }
  if (!REWORDED.test(printed)) throw new Error(`${ref}: reworded, but has none of the words the owner asked to reword.`);
  if (REWORDED.test(reworded)) throw new Error(`${ref}: the rewording still has "${reworded.match(REWORDED)?.[0]}".`);
  const kept = new Set(brackets(printed));
  const added = brackets(reworded).filter((inside) => !kept.has(inside));
  if (added.length === 0 || added.some((inside) => !inside.toLowerCase().includes(OWNERS_WORDING))) {
    throw new Error(`${ref}: a bracket in the rewording lacks the owner's wording: ${JSON.stringify(added)}.`);
  }
  if (byHand) return { text: reworded, printedText: printed };
  /* Outside the brackets, the rewording may only drop words, and only the label and its article or verb. */
  const original = wordsOutsideBrackets(printed);
  const rewritten = wordsOutsideBrackets(reworded);
  const dropped: string[] = [];
  let at = 0;
  for (const word of original) {
    if (at < rewritten.length && rewritten[at] === word) at++;
    else dropped.push(word);
  }
  if (at < rewritten.length) throw new Error(`${ref}: the rewording adds or reorders words outside its brackets.`);
  const stray = dropped.filter((word) => !DROPPABLE.test(word));
  if (stray.length > 0) throw new Error(`${ref}: the rewording drops ${JSON.stringify(stray)}, not only the label.`);
  return { text: reworded, printedText: printed };
}

/**
 * The prompt section that asks for the two fields the owner's wording needs,
 * `reworded_text` and `harsh_labels`. (The Strijataka's prompt has its own
 * copy, frozen with its cached answers, which predates the adultery line.)
 */
export const LABELS_PROMPT = `<labels>
The app's owner has decided how some words about people are handled. \`text\` stays faithful either way.

1. The book's words for a prostitute -- prostitute, harlot, courtesan, whore, public woman -- are too harsh to print. For a record that has any of them, \`reworded_text\` is the record's text with only those words replaced, in square brackets, by wording built on the owner's phrase "${OWNERS_WORDING}", fitted to the grammar:
   "will be fond of harlots" -> "will be fond of [${OWNERS_WORDING}]"
   "she will become a prostitute" -> "she will become [prone to ${OWNERS_WORDING}]"
   Drop at most the label's article ("a", "the") and its verb ("be", "become") with it; change nothing else. \`reworded_text\` is an empty string for every other record.

2. Adultery, desire for or relations with another's spouse, and being "free with other men" may be said plainly: they are not labels, and they do not withhold a record.

3. Other words that brand a person for their sexual conduct or for having no children -- "unchaste", "immoral", "wanton", "bad women", "a woman of low deeds", "of bad character" when it means morals, "barren", and the like -- wait for the owner to choose their wording. List each such word or phrase in \`harsh_labels\`, exactly as \`text\` has it. Do not reword them. Where a record lists several results, split the clause that holds such a word into a part of its own, so only that part waits. \`harsh_labels\` is empty when there are none.

\`summary\` must never use any of these words: use the owner's phrase for the first kind and a plain, neutral description for the third.
</labels>`;
