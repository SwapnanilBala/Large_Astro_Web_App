/*
 * Sex at birth, as the reader gives it at intake: female, male, or not given.
 *
 * Readings use it only where the tradition reads the sexes differently: the
 * partner's significator (Venus for a man's partner, Jupiter for a woman's),
 * the hand a palm reading reads, and the Brihat Jataka's chapter on women's
 * horoscopes. Not given reads exactly as every chart did before the question
 * existed. Shared by the intake, the URL, the engines and the routes, so it
 * holds no Node or server import.
 */

export const BIRTH_SEXES = ["female", "male"] as const;
export type BirthSex = (typeof BIRTH_SEXES)[number];

/** Anything that is not one of the two values is "not given". */
export function parseBirthSex(value: unknown): BirthSex | undefined {
  return value === "female" || value === "male" ? value : undefined;
}

/**
 * The planet the tradition reads for the reader's partner: Venus in a man's
 * chart, Jupiter in a woman's. A later convention than the Brihat Jataka,
 * which reads a woman's husband from her 7th house without naming a planet;
 * adopted by the owner on 2026-10-05. Null when the reader did not say.
 */
export function partnerSignificator(sex: BirthSex | undefined): "Venus" | "Jupiter" | null {
  if (sex === "female") return "Jupiter";
  if (sex === "male") return "Venus";
  return null;
}
