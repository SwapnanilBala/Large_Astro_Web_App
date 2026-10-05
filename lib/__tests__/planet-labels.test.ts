/**
 * Planet names and chart abbreviations in every language.
 *
 * lib/planet-labels builds its keys from the engine's English planet names at
 * runtime -- `planetNames.${id}`, `strength.planets.${id}`,
 * `lagnaChart.abbrev.${id}` -- which no scan of tr("...") literals can see. A
 * key missing from a catalog would not show as a raw key, since the helper
 * falls back to the engine's English, but as an English word on a translated
 * page: the gap this helper was written to close on /m.
 */
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import enStrength from "@/messages/en.strength.json";
import es from "@/messages/es.json";
import bn from "@/messages/bn.json";
import hi from "@/messages/hi.json";
import it_ from "@/messages/it.json";
import fr from "@/messages/fr.json";
import {
  PLANET_IDS,
  RETROGRADE_MARK_KEY,
  planetAbbreviation,
  planetAbbreviationKey,
  planetName,
  planetNameKey,
  retrogradeMark,
} from "@/lib/planet-labels";

type Tree = Record<string, unknown>;

const lookup = (tree: Tree, key: string): unknown =>
  key.split(".").reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], tree);

/* A translator over one catalog that, like the app's, answers a miss with the key. */
const translator = (tree: Tree) => (key: string) => {
  const text = lookup(tree, key);
  return typeof text === "string" ? text : key;
};
const missing = (key: string) => key;

/* The names the engine gives the nine grahas. */
const ENGINE_NAMES = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
const TRANSLATIONS: Record<string, Tree> = { es, bn, hi, it: it_, fr };

describe("planet labels", () => {
  it("read the reader's language when the catalog has the key", () => {
    const tr = translator(hi as Tree);
    expect(planetName("Saturn", tr)).toBe("शनि");
    expect(planetName("Rahu", tr)).toBe("राहु");
    expect(planetAbbreviation("Sun", tr)).toBe("सू");
    expect(retrogradeMark(tr)).toBe("व");
  });

  it("fall back to the engine's English when it does not, as English does on /m", () => {
    expect(ENGINE_NAMES.map((planet) => planetName(planet, missing))).toEqual(ENGINE_NAMES);
    expect(planetAbbreviation("Saturn", missing)).toBe("Sa");
    expect(retrogradeMark(missing)).toBe("R");
  });

  it("pass a name the engine does not use through unchanged", () => {
    const tr = translator(hi as Tree);
    expect(planetName("Lagna", tr)).toBe("Lagna");
    expect(planetAbbreviation("Lagna", tr)).toBe("La");
  });

  it("cover every name the engine uses", () => {
    expect(ENGINE_NAMES.map((planet) => planetNameKey(planet))).not.toContain(null);
    expect(ENGINE_NAMES.map((planet) => planetAbbreviationKey(planet))).not.toContain(null);
  });

  it("print the same English on /m as the desktop catalogs hold", () => {
    /* /m prints the fallback; the desktop prints en.json and en.strength.json.
       Neither may drift from the other. */
    const english = translator({ ...(en as Tree), ...(enStrength as Tree) });
    for (const planet of ENGINE_NAMES) {
      expect(planetName(planet, english), planet).toBe(planetName(planet, missing));
      expect(planetAbbreviation(planet, english), planet).toBe(planetAbbreviation(planet, missing));
    }
    expect(retrogradeMark(english)).toBe(retrogradeMark(missing));
  });

  it.each(Object.keys(TRANSLATIONS))("are all translated into %s", (lang) => {
    const keys = [
      ...PLANET_IDS.map((planet) => planetNameKey(planet)!),
      ...PLANET_IDS.map((planet) => planetAbbreviationKey(planet)!),
      RETROGRADE_MARK_KEY,
    ];
    for (const key of keys) {
      const text = lookup(TRANSLATIONS[lang], key);
      expect(typeof text === "string" && text.trim() !== "", `${lang}: ${key}`).toBe(true);
    }
  });
});
