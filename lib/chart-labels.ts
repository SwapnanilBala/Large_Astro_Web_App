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
