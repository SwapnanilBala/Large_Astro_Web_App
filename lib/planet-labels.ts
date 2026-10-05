/**
 * A planet's name, and its chart abbreviation, in the reader's language.
 *
 * The engine names the nine grahas in English -- "Sun" through "Ketu" -- and
 * that name is also what the code matches on, so it stays the data; only what
 * is printed goes through the catalogs. Every translation already exists: the
 * seven planets under planetNames (the desktop baseline), the two nodes under
 * strength.planets (planetNames has no entry for them), and the hand-written
 * abbreviations and retrograde mark under lagnaChart (the North Indian card).
 *
 * A translator answers a key it cannot resolve with the key itself. When it
 * does, the engine's English is the answer -- which is how English reads on
 * /m, whose baseline carries none of these namespaces, so English needs no
 * catalog entry of its own. lib/__tests__/planet-labels.test.ts checks that
 * every other language has all of them.
 */

type Translate = (key: string, params?: Record<string, string>) => string;

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

function resolve(tr: Translate, key: string | null, english: string): string {
  if (!key) return english;
  const text = tr(key);
  return text === key ? english : text;
}

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
