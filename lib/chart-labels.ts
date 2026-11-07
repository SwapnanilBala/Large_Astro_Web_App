/**
 * A chart's vocabulary in the reader's language: the planets, the signs and
 * the nakshatras, by name and as a chart cell abbreviates them.
 *
 * The engine names all three in English -- "Saturn", "Gemini",
 * "Shatabhisha" -- and that name is also what the code matches on, so it
 * stays the data; only what is printed goes through the catalogs. The
 * translations live in:
 * - planetNames, for the seven planets (the desktop baseline);
 * - strength.planets, for the two nodes, which planetNames has no entry for;
 * - lagnaChart, for the hand-written abbreviations and the retrograde mark
 *   (the North Indian card);
 * - zodiacSigns, for the twelve signs;
 * - nakshatraNames, for the twenty-seven nakshatras, whose English is in
 *   messages/en.mobile-insights.json.
 *
 * A translator answers a key it cannot resolve with the key itself. When it
 * does, the engine's English is the answer. That is how English reads on /m,
 * whose baseline carries none of these namespaces, so English needs no catalog
 * entry of its own. lib/__tests__/chart-labels.test.ts checks that every other
 * language has all of them.
 */
import { SIGN_ORDER } from "@/lib/constellation-geometry";

type Translate = (key: string, params?: Record<string, string>) => string;

function resolve(tr: Translate, key: string | null, english: string): string {
  if (!key) return english;
  const text = tr(key);
  return text === key ? english : text;
}

/* ── Planets ── */

/* The nine, with the abbreviation astrologers write by hand in English. */
const ENGLISH_ABBREVIATIONS = {
  sun: "Su",
  moon: "Mo",
  mars: "Ma",
  mercury: "Me",
  jupiter: "Ju",
  venus: "Ve",
  saturn: "Sa",
  rahu: "Ra",
  ketu: "Ke",
} as const;

type PlanetId = keyof typeof ENGLISH_ABBREVIATIONS;

export const PLANET_IDS = Object.keys(ENGLISH_ABBREVIATIONS) as PlanetId[];

const NODES: ReadonlySet<PlanetId> = new Set(["rahu", "ketu"]);

function planetId(planet: string): PlanetId | null {
  const id = planet.toLowerCase();
  return id in ENGLISH_ABBREVIATIONS ? (id as PlanetId) : null;
}

/** The catalog key for a planet's name, or null for a name the engine does not use. */
export function planetNameKey(planet: string): string | null {
  const id = planetId(planet);
  if (!id) return null;
  return NODES.has(id) ? `strength.planets.${id}` : `planetNames.${id}`;
}

/** The catalog key for a planet's chart abbreviation. */
export function planetAbbreviationKey(planet: string): string | null {
  const id = planetId(planet);
  return id ? `lagnaChart.abbrev.${id}` : null;
}

export const RETROGRADE_MARK_KEY = "lagnaChart.retrogradeShort";

/** "Saturn" as the reader reads it: शनि, Saturno, Saturne. */
export function planetName(planet: string, tr: Translate): string {
  return resolve(tr, planetNameKey(planet), planet);
}

/* The ascendant, which the engine's position tables list beside the planets
   as "Ascendant". */
export const ASCENDANT_NAME_KEY = "lagnaChart.ascendant";

/** A row of a position table: a planet, or the ascendant. */
export function pointName(point: string, tr: Translate): string {
  return point === "Ascendant" ? resolve(tr, ASCENDANT_NAME_KEY, point) : planetName(point, tr);
}

/*
 * A value from an engine's evidence list (lib/rules/paths.ts formatClaimValue,
 * the life-domain claims): a sign, a planet or the ascendant, an "Nth house",
 * or a comma list of those. Anything else -- degrees, counts, a dignity word, a
 * phrase -- passes through as the engine wrote it. The house names are the
 * life-areas catalog's (lifeAreas.claims.houses.h1 to h12); English falls
 * back to the engine's own "7th house".
 */
export function chartValue(value: string, tr: Translate): string {
  if (value.includes(", ")) return value.split(", ").map((part) => chartValue(part, tr)).join(", ");
  const house = /^(\d{1,2})(?:st|nd|rd|th) house$/.exec(value);
  if (house) return resolve(tr, `lifeAreas.claims.houses.h${house[1]}`, value);
  return signName(pointName(value, tr), tr);
}

/** A planet as it is written in a chart cell: Su, Mo, Ma; सू, चं, मं in Hindi. */
export function planetAbbreviation(planet: string, tr: Translate): string {
  const id = planetId(planet);
  return resolve(tr, planetAbbreviationKey(planet), id ? ENGLISH_ABBREVIATIONS[id] : planet.slice(0, 2));
}

/** The mark beside a retrograde planet's abbreviation: R, or व in Hindi. */
export function retrogradeMark(tr: Translate): string {
  return resolve(tr, RETROGRADE_MARK_KEY, "R");
}

/* ── Signs ── */

const SIGN_IDS: ReadonlySet<string> = new Set(SIGN_ORDER.map((sign) => sign.toLowerCase()));

/** The catalog key for a sign's name: zodiacSigns keys them in lower case. */
export function signNameKey(sign: string): string | null {
  const id = sign.toLowerCase();
  return SIGN_IDS.has(id) ? `zodiacSigns.${id}` : null;
}

/** "Gemini" as the reader reads it: मिथुन, Géminis, Gémeaux. */
export function signName(sign: string, tr: Translate): string {
  return resolve(tr, signNameKey(sign), sign);
}

/**
 * A sign as a chart cell labels it. A name in the Latin alphabet is cut to
 * three letters, as the English chart always was: Pis, Gém, Poi. Devanagari
 * and Bengali names are short enough to write whole (मीन, वृश्चिक), and cutting
 * one by character would split a conjunct.
 */
export function signAbbreviation(sign: string, tr: Translate): string {
  const name = signName(sign, tr);
  return /^\p{Script=Latin}/u.test(name) ? Array.from(name).slice(0, 3).join("") : name;
}

/* ── Aspects ── */

/* The five every engine here names: lib/engines/aspect-engine.ts and the
   compatibility service's ASPECT_DEFS. Their translations were made for the
   compatibility page and sit in the desktop baseline. */
const ASPECT_IDS: ReadonlySet<string> = new Set(["conjunction", "opposition", "trine", "square", "sextile"]);

/** The catalog key for an aspect's name. */
export function aspectNameKey(aspect: string): string | null {
  const id = aspect.toLowerCase();
  return ASPECT_IDS.has(id) ? `compatibility.aspectTypes.${id}` : null;
}

/** "Square" as the reader reads it: Quadrat, केंद्र. */
export function aspectName(aspect: string, tr: Translate): string {
  return resolve(tr, aspectNameKey(aspect), aspect);
}

/* ── Nakshatras ── */

/* The twenty-seven as the engine names them, in order. The test holds this
   list to the engine's own. */
export const NAKSHATRA_NAMES = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni",
  "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha",
  "Jyeshtha", "Moola", "Purva Ashadha", "Uttara Ashadha", "Shravana",
  "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
] as const;

/* "Purva Phalguni" -> "purvaPhalguni", the camelCase the catalogs' keys use. */
const camelCase = (name: string) =>
  name
    .split(" ")
    .map((word, index) => (index ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word.toLowerCase()))
    .join("");

const NAKSHATRA_IDS: ReadonlyMap<string, string> = new Map(
  NAKSHATRA_NAMES.map((name) => [name.toLowerCase(), camelCase(name)]),
);

/** The catalog key for a nakshatra's name. */
export function nakshatraNameKey(name: string): string | null {
  const id = NAKSHATRA_IDS.get(name.toLowerCase());
  return id ? `nakshatraNames.${id}` : null;
}

/** "Shatabhisha" as the reader reads it: शतभिषा, শতভিষা. */
export function nakshatraName(name: string, tr: Translate): string {
  return resolve(tr, nakshatraNameKey(name), name);
}

/* ── The chart's one-line summary ── */

const ELEMENT_KEYS: Readonly<Record<string, string>> = {
  Fire: "zodiacElements.fire",
  Earth: "zodiacElements.earth",
  Air: "zodiacElements.air",
  Water: "zodiacElements.water",
};

type SummaryFacts = {
  ascendant: string;
  sun: string;
  moon: string;
  element: string;
  strongest: string[];
};

/**
 * "Chart core: Cancer Lagna with Sun in Taurus and Moon in Capricorn. ..." in
 * the reader's language, rebuilt from the facts the rule engine sends beside
 * its English sentence (generateRules' summaryFacts). `namespace` is where
 * the page keeps `chartCore` and `chartCoreStrongest`: the desktop and the
 * phone each hold their own copy. With no facts (a payload cached before
 * they shipped) or no catalog entry, the engine's English is the answer;
 * lib/__tests__/chart-summary-text.test.ts holds the English to the engine's.
 */
export function chartSummaryText(
  facts: SummaryFacts | null | undefined,
  english: string,
  tr: Translate,
  namespace: string,
): string {
  if (!facts) return english;
  const coreKey = `${namespace}.chartCore`;
  const core = tr(coreKey, {
    ascendant: signName(facts.ascendant, tr),
    sun: signName(facts.sun, tr),
    moon: signName(facts.moon, tr),
    element: resolve(tr, ELEMENT_KEYS[facts.element] ?? null, facts.element),
  });
  if (core === coreKey) return english;
  if (facts.strongest.length === 0) return core;
  const strongestKey = `${namespace}.chartCoreStrongest`;
  const strongest = tr(strongestKey, {
    planets: facts.strongest.map((planet) => planetName(planet, tr)).join(", "),
  });
  return strongest === strongestKey ? english : `${core} ${strongest}`;
}

/* ── How common a finding is ── */

type RarityFacts = { fire_rate: number; low_confidence: boolean };

/**
 * A finding's "Shows up in about 8 of every 100 charts" in the reader's
 * language. The bands are lib/rules/rarity.ts rarityLabel's, which writes the
 * English the payload carries; that module reads the rarity dataset, so it is
 * not imported here, and the test holds the two to the same English.
 */
export function rarityText(
  rarity: RarityFacts | null | undefined,
  english: string,
  tr: Translate,
  namespace: string,
): string {
  if (!rarity) return english;
  let band: string;
  let count: number | undefined;
  const perHundred = Math.round(rarity.fire_rate * 100);
  const perThousand = Math.round(rarity.fire_rate * 1000);
  if (rarity.low_confidence) band = "unusual";
  else if (perHundred >= 100) band = "everyChart";
  else if (perHundred >= 1) [band, count] = ["perHundred", perHundred];
  else if (perThousand >= 1) [band, count] = ["perThousand", perThousand];
  else band = "underThousand";
  const key = `${namespace}.rarity.${band}`;
  const text = tr(key, count === undefined ? undefined : { count: String(count) });
  return text === key ? english : text;
}
