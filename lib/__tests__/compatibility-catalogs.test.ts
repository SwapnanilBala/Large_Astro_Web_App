/**
 * Every string the compatibility page can show is in the desktop English
 * baseline and translated into the other five languages.
 *
 * Most of the page's keys are literals, which are read straight out of the
 * source here. The verdict tiles and the aspect graph also build two families
 * at runtime from the engine's English names -- `planetNames.${planet}` and
 * `compatibility.aspectTypes.${type}` -- which no scan can see, so those are
 * listed against the engine's closed sets. A missing key renders on screen as
 * itself.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import en from "@/messages/en.json";
import es from "@/messages/es.json";
import bn from "@/messages/bn.json";
import hi from "@/messages/hi.json";
import it_ from "@/messages/it.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import type { SynastryAspectInfo } from "@/lib/engines/compatibility-service";
import { aspectLabel, planetLabel } from "@/app/(desktop)/insights/compatibility/aspect-labels";

type Tree = Record<string, unknown>;

function lookup(tree: Tree, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], tree);
}

function merge(base: Tree, extra: Tree): Tree {
  const out: Tree = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    out[key] =
      value && typeof value === "object" && out[key] && typeof out[key] === "object"
        ? merge(out[key] as Tree, value as Tree)
        : value;
  }
  return out;
}

const placeholders = (text: string) => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();

/* The page and its siblings, scanned for "namespace.key" literals -- which
   catches t("...") and the keys a ternary hands to t alike. */
const PAGE_DIR = join(process.cwd(), "app", "(desktop)", "insights", "compatibility");
const NAMESPACES = new Set(Object.keys(en));
const LITERAL_KEYS = [
  ...new Set(
    readdirSync(PAGE_DIR)
      .filter((file) => /\.tsx?$/.test(file))
      .flatMap((file) => [...readFileSync(join(PAGE_DIR, file), "utf8").matchAll(/["'](\w+(?:\.\w+)+)["']/g)])
      .map((match) => match[1])
      .filter((key) => NAMESPACES.has(key.split(".")[0])),
  ),
];

/* PRIORITY_PLANETS and ASPECT_DEFS in lib/engines/compatibility-service.ts:
   the only names a synastry aspect can carry. */
const PLANETS = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
const ASPECT_TYPES = ["Conjunction", "Opposition", "Trine", "Square", "Sextile"];

const RUNTIME_KEYS = [
  ...PLANETS.map((planet) => `planetNames.${planet.toLowerCase()}`),
  ...ASPECT_TYPES.map((type) => `compatibility.aspectTypes.${type.toLowerCase()}`),
];

const TRANSLATIONS: Record<string, Tree> = { es, bn, hi, it: it_, fr, de };

/* Translations staged for the fold, each shaped { lang: { namespace: ... } }.
   The fold deletes them and the catalogs carry the keys from then on, so
   either place counts. */
const FRAGMENT_DIR = join(process.cwd(), "messages", "fragments");
const FRAGMENTS: Tree[] = existsSync(FRAGMENT_DIR)
  ? readdirSync(FRAGMENT_DIR)
      .filter((file) => file.endsWith(".json"))
      .map((file) => JSON.parse(readFileSync(join(FRAGMENT_DIR, file), "utf8")) as Tree)
  : [];

function staged(lang: string, key: string): unknown[] {
  return FRAGMENTS.map((fragment) => lookup(fragment, `${lang}.${key}`)).filter(
    (value) => value !== undefined,
  );
}

/* What a reader of `lang` would get: the catalog with anything still staged
   folded in, over the English baseline -- the provider's own resolution order. */
function translator(lang: string | null) {
  const messages = lang
    ? FRAGMENTS.reduce<Tree>((tree, fragment) => merge(tree, (fragment[lang] as Tree) ?? {}), TRANSLATIONS[lang])
    : (en as Tree);
  return (key: string, params?: Record<string, string>): string => {
    const found = lookup(messages, key) ?? lookup(en, key);
    let text = typeof found === "string" ? found : key;
    for (const [name, value] of Object.entries(params ?? {})) {
      text = text.replace(new RegExp(`\\{${name}\\}`, "g"), () => value);
    }
    return text;
  };
}

const aspect = (primary: string, type: string, partner: string): SynastryAspectInfo => ({
  primary_planet: primary,
  partner_planet: partner,
  aspect_type: type,
  orb: 1.5,
  harmonious: true,
});

describe("the compatibility page's catalog keys", () => {
  it("finds the literals it reads", () => {
    /* A guard on the scan itself: one key from each of the three files. */
    expect(LITERAL_KEYS).toEqual(
      expect.arrayContaining(["home.formBirthDate", "compatibility.balance", "compatibility.noAspects"]),
    );
  });

  it("are all in the desktop English baseline", () => {
    for (const key of [...LITERAL_KEYS, ...RUNTIME_KEYS]) {
      expect(typeof lookup(en, key), key).toBe("string");
    }
  });

  it.each(Object.keys(TRANSLATIONS))("are translated into %s, with the same blanks", (lang) => {
    for (const key of [...LITERAL_KEYS, ...RUNTIME_KEYS]) {
      const folded = lookup(TRANSLATIONS[lang], key);
      const pending = staged(lang, key);
      /* One home or the other: the fold reports a staged key the catalog
         already has as a clash, and two staged copies leave it guessing. */
      expect(Number(folded !== undefined) + pending.length, `${lang}: ${key}`).toBe(1);

      const translated = folded ?? pending[0];
      expect(typeof translated, `${lang}: ${key}`).toBe("string");
      expect(placeholders(translated as string), `${lang}: ${key}`).toEqual(
        placeholders(lookup(en, key) as string),
      );
    }
  });
});

describe("aspect and planet labels", () => {
  it("read as the engine wrote them in English", () => {
    const t = translator(null);
    expect(aspectLabel(t, aspect("Venus", "Trine", "Mars"))).toBe("Venus Trine Mars");
    expect(planetLabel(t, "Jupiter")).toBe("Jupiter");
  });

  it("are written in the reader's language", () => {
    expect(aspectLabel(translator("es"), aspect("Venus", "Trine", "Mars"))).toBe("Venus trígono Marte");
    expect(aspectLabel(translator("hi"), aspect("Sun", "Conjunction", "Moon"))).toBe("सूर्य युति चंद्र");
    expect(planetLabel(translator("fr"), "Saturn")).toBe("Saturne");
  });

  it("fall back to the engine's name rather than a raw key", () => {
    const t = translator("it");
    expect(aspectLabel(t, aspect("Ascendant", "Quincunx", "Pluto"))).toBe("Ascendant Quincunx Pluto");
  });
});
