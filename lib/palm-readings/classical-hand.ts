import "server-only";

import samhita from "@/lib/knowledge/corpus/brihat-samhita-1884.json";
import { knowledgeCorpusSchema } from "@/lib/knowledge/corpus";
import type { PalmReader } from "./reader";

/*
 * The classical hand marks the palm reading draws on: what the Brihat Samhita
 * says about the hand -- its palm lines and their shapes, the fingers, the
 * thumb, the nails, the wrist -- in N. Chidambaram Iyer's 1884 translation.
 * Chapter 68 describes a man's features and chapter 70 a woman's, so a man's
 * reading gets the first, a woman's the second, and a reader who did not say
 * gets both. Only shown passages, after the same content line as every
 * reading (scripts/knowledge/build-brihat-samhita.ts).
 *
 * All of them, uncited, rather than a search: there are a few dozen, they fit
 * in a cached prompt, and with nothing to choose there is nothing to choose
 * wrongly. The owner's call (2026-10-05) is that the palm reading names no
 * text, chapter or verse, so the model is told to put them in its own words.
 */

const MEN = 68;
const WOMEN = 70;

const PASSAGES = knowledgeCorpusSchema
  .parse(samhita)
  .passages.filter((passage) => passage.hand && !passage.withheld)
  .sort((a, b) => a.chapter - b.chapter || a.verse - b.verse || a.part - b.part);

/** The hand passages a reader's palm reading may draw on, in the book's order. */
export function classicalHandPassages(reader: PalmReader): string[] {
  const chapters = reader === "man" ? [MEN] : reader === "woman" ? [WOMEN] : [MEN, WOMEN];
  return PASSAGES.filter((passage) => chapters.includes(passage.chapter)).map((passage) => passage.text);
}

const WHOSE: Record<PalmReader, string> = {
  man: "a man's hand",
  woman: "a woman's hand",
  unspecified: "a man's hand and a woman's (the reader did not say which this is)",
};

/**
 * The prompt section, appended to the system prompt: one fixed text per kind
 * of reader, so each stays cacheable. Empty when the library has nothing.
 */
export function classicalHandSection(reader: PalmReader): string {
  const passages = classicalHandPassages(reader);
  if (passages.length === 0) return "";
  return `

Classical hand marks. The statements below are what a classical Samudrika text says about the marks of ${WHOSE[reader]}, in an old English translation. Use them as a palmist uses the tradition:
- Draw on a statement only where the photo clearly shows the mark it describes, and say what you see that matches. Never claim a mark the photo does not show.
- Put it in your own words. Do not name, cite or quote the text, its chapter or its verse, and do not say that a statement comes from a book.
- They are the tradition's tendencies, not fixed fate, and the guidelines above still hold: no lifespan, no diagnoses.
- Words in square brackets were added so that a statement reads on its own.

<hand_marks>
${passages.map((text) => `- ${text}`).join("\n")}
</hand_marks>`;
}
