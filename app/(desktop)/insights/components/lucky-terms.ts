/*
 * The lucky-elements engine's vocabulary in the reader's language.
 *
 * lib/engines/lucky-elements-engine.ts names its colours, gemstones, metals,
 * directions, unlucky items, omens and fortune domains in English, from fixed
 * tables. They print through insights.lucky.<kind>.<slug>, built from that
 * English; one the catalog has not met prints as the engine wrote it. The
 * engine itself stays out of the browser bundle: only its words come here.
 */

type Translate = (key: string, params?: Record<string, string>) => string;

export type LuckyTermKind =
  | "colors"
  | "gems"
  | "metals"
  | "directions"
  | "items"
  | "omens"
  | "domainTitles"
  | "domainFocus"
  | "domainBasis";

/* "Cat's Eye" -> "cat_s_eye", "9th-house lord" -> "9th_house_lord". */
export function luckySlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function luckyTermKey(kind: LuckyTermKind, english: string): string {
  return `insights.lucky.${kind}.${luckySlug(english)}`;
}

export function luckyTerm(kind: LuckyTermKind, english: string, t: Translate): string {
  const key = luckyTermKey(kind, english);
  const text = t(key);
  return text === key ? english : text;
}

/* The gemstone's purpose, by the planet that governs it (the engine's
   PLANET_GEMSTONE_INTENTIONS). */
export function gemstoneIntention(planet: string, english: string, t: Translate): string {
  const key = `insights.lucky.intentions.${planet.toLowerCase()}`;
  const text = t(key);
  return text === key ? english : text;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/** The engine's English weekday ("Wednesday") in the reader's language. */
export function weekdayName(day: string, locale: string): string {
  const index = WEEKDAY_INDEX[day];
  if (index === undefined) return day;
  /* 7 January 2024 was a Sunday. */
  return new Date(Date.UTC(2024, 0, 7 + index)).toLocaleDateString(locale, {
    weekday: "long",
    timeZone: "UTC",
  });
}

/** The weekday's index, Sunday first, or undefined for a name the engine never sends. */
export function weekdayIndex(day: string): number | undefined {
  return WEEKDAY_INDEX[day];
}

/* A fortune domain's focus line, keyed by its title, which is the one fixed
   handle the engine gives it. */
export function domainFocusText(title: string, english: string, t: Translate): string {
  const key = luckyTermKey("domainFocus", title);
  const text = t(key);
  return text === key ? english : text;
}
