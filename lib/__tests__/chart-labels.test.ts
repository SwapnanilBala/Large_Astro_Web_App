/**
 * Planet, sign and nakshatra names, and their chart abbreviations, in every
 * language.
 *
 * lib/chart-labels builds its keys from the engine's English names at
 * runtime -- `planetNames.${id}`, `strength.planets.${id}`,
 * `lagnaChart.abbrev.${id}`, `zodiacSigns.${id}`, `nakshatraNames.${id}` --
 * which no scan of tr("...") literals can see. A key missing from a catalog
 * would not show as a raw key, since the helper falls back to the engine's
 * English, but as an English word on a translated page: the gap the helper
 * was written to close on /m.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import en from "@/messages/en.json";
import enStrength from "@/messages/en.strength.json";
import enMobileInsights from "@/messages/en.mobile-insights.json";
import es from "@/messages/es.json";
import bn from "@/messages/bn.json";
import hi from "@/messages/hi.json";
import it_ from "@/messages/it.json";
import fr from "@/messages/fr.json";
import { SIGN_ORDER } from "@/lib/constellation-geometry";
import { NAKSHATRA_SPAN, calculateNakshatra } from "@/lib/engines/nakshatra-engine";
import {
  NAKSHATRA_NAMES,
  PLANET_IDS,
  RETROGRADE_MARK_KEY,
  nakshatraName,
  nakshatraNameKey,
  planetAbbreviation,
  planetAbbreviationKey,
  planetName,
  planetNameKey,
  retrogradeMark,
  signAbbreviation,
  signName,
  signNameKey,
} from "@/lib/chart-labels";

type Tree = Record<string, unknown>;

const lookup = (tree: Tree, key: string): unknown =>
  key.split(".").reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], tree);

/* Translations staged for the fold count as well as folded ones. */
const FRAGMENT_DIR = join(process.cwd(), "messages", "fragments");
const FRAGMENTS: Tree[] = existsSync(FRAGMENT_DIR)
  ? readdirSync(FRAGMENT_DIR)
      .filter((file) => file.endsWith(".json"))
      .map((file) => JSON.parse(readFileSync(join(FRAGMENT_DIR, file), "utf8")) as Tree)
  : [];

const TRANSLATIONS: Record<string, Tree> = { es, bn, hi, it: it_, fr };

function translated(lang: string, key: string): unknown {
  const folded = lookup(TRANSLATIONS[lang], key);
  if (folded !== undefined) return folded;
  return FRAGMENTS.map((fragment) => lookup(fragment, `${lang}.${key}`)).find((value) => value !== undefined);
}

/* A translator for one language that, like the app's, answers a miss with the key. */
const translator = (lang: string) => (key: string) => {
  const text = translated(lang, key);
  return typeof text === "string" ? text : key;
};
const missing = (key: string) => key;

/* The names the engine gives the nine grahas. */
const PLANETS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];

describe("planet labels", () => {
  it("read the reader's language when the catalog has the key", () => {
    const tr = translator("hi");
    expect(planetName("Saturn", tr)).toBe("शनि");
    expect(planetName("Rahu", tr)).toBe("राहु");
    expect(planetAbbreviation("Sun", tr)).toBe("सू");
    expect(retrogradeMark(tr)).toBe("व");
  });

  it("fall back to the engine's English when it does not, as English does on /m", () => {
    expect(PLANETS.map((planet) => planetName(planet, missing))).toEqual(PLANETS);
    expect(planetAbbreviation("Saturn", missing)).toBe("Sa");
    expect(retrogradeMark(missing)).toBe("R");
  });

  it("pass a name the engine does not use through unchanged", () => {
    const tr = translator("hi");
    expect(planetName("Lagna", tr)).toBe("Lagna");
    expect(planetAbbreviation("Lagna", tr)).toBe("La");
  });

  it("cover every name the engine uses", () => {
    expect(PLANETS.map((planet) => planetNameKey(planet))).not.toContain(null);
    expect(PLANETS.map((planet) => planetAbbreviationKey(planet))).not.toContain(null);
  });
});

describe("sign labels", () => {
  it("read the reader's language", () => {
    expect(signName("Gemini", translator("hi"))).toBe("मिथुन");
    expect(signName("Gemini", translator("es"))).toBe("Géminis");
    expect(signName("Pisces", translator("fr"))).toBe("Poissons");
  });

  it("cut a Latin-alphabet name to three letters and write the others whole", () => {
    expect(signAbbreviation("Gemini", translator("es"))).toBe("Gém");
    expect(signAbbreviation("Pisces", translator("fr"))).toBe("Poi");
    expect(signAbbreviation("Scorpio", translator("hi"))).toBe("वृश्चिक");
    expect(signAbbreviation("Cancer", translator("bn"))).toBe("কর্কট");
  });

  it("label the English chart exactly as before", () => {
    for (const sign of SIGN_ORDER) {
      expect(signName(sign, missing)).toBe(sign);
      expect(signAbbreviation(sign, missing)).toBe(sign.slice(0, 3));
    }
  });

  it("cover every sign the engine uses", () => {
    expect(SIGN_ORDER.map((sign) => signNameKey(sign))).not.toContain(null);
    expect(signName("Ophiuchus", translator("hi"))).toBe("Ophiuchus");
  });
});

describe("nakshatra labels", () => {
  it("are the engine's twenty-seven, in order", () => {
    /* The engine keeps its list to itself; ask it for each nakshatra's name at
       the middle of its span. */
    const engine = Array.from({ length: 27 }, (_, index) => calculateNakshatra((index + 0.5) * NAKSHATRA_SPAN).name);
    expect([...NAKSHATRA_NAMES]).toEqual(engine);
    expect(NAKSHATRA_NAMES.map((name) => nakshatraNameKey(name))).not.toContain(null);
  });

  it("read the reader's language", () => {
    expect(nakshatraName("Shatabhisha", translator("hi"))).toBe("शतभिषा");
    expect(nakshatraName("Purva Phalguni", translator("bn"))).toBe("পূর্বফাল্গুনী");
    expect(nakshatraName("Shatabhisha", translator("es"))).toBe("Shatabhisha");
  });

  it("fall back to the engine's English", () => {
    expect(NAKSHATRA_NAMES.map((name) => nakshatraName(name, missing))).toEqual([...NAKSHATRA_NAMES]);
  });
});

describe("chart labels in English", () => {
  it("print the same words on /m as the English catalogs hold", () => {
    /* /m prints the fallback where its catalogs have no entry; the desktop
       prints en.json and en.strength.json, and the nakshatra names are in the
       mobile reading's own catalog. None may drift from the engine's English. */
    const tree = { ...(en as Tree), ...(enStrength as Tree), ...(enMobileInsights as Tree) };
    const english = (key: string) => {
      const text = lookup(tree, key);
      return typeof text === "string" ? text : key;
    };
    for (const planet of PLANETS) {
      expect(planetName(planet, english), planet).toBe(planetName(planet, missing));
      expect(planetAbbreviation(planet, english), planet).toBe(planetAbbreviation(planet, missing));
    }
    expect(retrogradeMark(english)).toBe(retrogradeMark(missing));
    for (const sign of SIGN_ORDER) expect(signName(sign, english), sign).toBe(sign);
    for (const name of NAKSHATRA_NAMES) expect(nakshatraName(name, english), name).toBe(name);
  });
});

describe("chart labels in the other languages", () => {
  const KEYS = [
    ...PLANET_IDS.map((planet) => planetNameKey(planet)!),
    ...PLANET_IDS.map((planet) => planetAbbreviationKey(planet)!),
    RETROGRADE_MARK_KEY,
    ...SIGN_ORDER.map((sign) => signNameKey(sign)!),
    ...NAKSHATRA_NAMES.map((name) => nakshatraNameKey(name)!),
  ];

  it.each(Object.keys(TRANSLATIONS))("are all translated into %s", (lang) => {
    for (const key of KEYS) {
      const text = translated(lang, key);
      expect(typeof text === "string" && text.trim() !== "", `${lang}: ${key}`).toBe(true);
      if (lang === "hi" || lang === "bn") {
        expect(text, `${lang}: ${key} is not NFC`).toBe((text as string).normalize("NFC"));
      }
    }
  });
});
