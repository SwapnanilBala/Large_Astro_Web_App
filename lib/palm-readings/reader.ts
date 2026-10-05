/*
 * Whose hand a palm reading is for, and so which hand the tradition reads.
 *
 * Classical palmistry reads a woman's left hand and a man's right; the Brihat
 * Samhita says so in its chapter on women's features ("in the case of a
 * woman, the left hand and in the case of a man the right hand shall be
 * examined"). The reader chooses; someone who would rather not say is read
 * from their writing hand, which is what every reading did before the choice
 * existed. Shared by the panel, which asks and tells the reader which hand to
 * photograph, and the route, which tells the model -- so it holds no Node or
 * server import.
 */

import type { BirthSex } from "../birth-sex";

export const PALM_READERS = ["woman", "man", "unspecified"] as const;
export type PalmReader = (typeof PALM_READERS)[number];

/** Anything the browser sends that is not one of the two choices is "unspecified". */
export function parsePalmReader(value: unknown): PalmReader {
  return value === "woman" || value === "man" ? value : "unspecified";
}

/** The hand the tradition reads for this reader, or null when they did not say. */
export function traditionalHand(reader: PalmReader): "left" | "right" | null {
  if (reader === "woman") return "left";
  if (reader === "man") return "right";
  return null;
}

/** The palm choice a chart's sex at birth implies, so the panel can start from it. */
export function readerFromBirthSex(sex: BirthSex | undefined): PalmReader {
  if (sex === "female") return "woman";
  if (sex === "male") return "man";
  return "unspecified";
}

/** The line the model is given, or null when the reader did not say. */
export function readerLine(reader: PalmReader): string | null {
  const hand = traditionalHand(reader);
  if (!hand) return null;
  return `[READER: a ${reader}. Classical palmistry reads the ${hand} hand for a ${reader}.]`;
}
