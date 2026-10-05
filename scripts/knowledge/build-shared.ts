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
