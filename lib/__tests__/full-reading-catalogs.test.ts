/**
 * Every label the full reading can show is in English and in the other five
 * languages, with the same blanks.
 *
 * The page reads three catalogs, mostly through the room builders in
 * app/components/reading-room that /m shares: its own route catalog (fullReading.*), the
 * yoga panel's (strength.*, for family, strength and trait labels) and the
 * desktop baseline (planetNames.*). The literal keys are read straight out of
 * the page's files. The yoga room also builds three families at runtime from
 * the engine's closed sets -- strength labels, family names and planet names
 * -- which no scan can see, so those are listed here. A missing key renders on
 * screen as itself.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import en from "@/messages/en.json";
import enFullReading from "@/messages/en.full-reading.json";
import enStrength from "@/messages/en.strength.json";
import es from "@/messages/es.json";
import bn from "@/messages/bn.json";
import hi from "@/messages/hi.json";
import it_ from "@/messages/it.json";
import fr from "@/messages/fr.json";
import { FINDING_THEMES, FINDING_THEME_KEYS } from "@/app/components/reading-room/findings";
import { YOGA_FAMILIES, YOGA_STRENGTHS } from "@/app/components/reading-room/yogas";
import { PLANET_IDS, planetNameKey } from "@/lib/chart-labels";

type Tree = Record<string, unknown>;

function lookup(tree: Tree, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], tree);
}

const placeholders = (text: string) => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();

/* The provider's English: the baseline, plus the two route catalogs the page
   hands to useRouteMessages. */
const ENGLISH: Tree = { ...(en as Tree), ...(enFullReading as Tree), ...(enStrength as Tree) };

/* The page, and the room builders it shares with /m, which hold most of the
   keys. */
const SOURCE_DIRS = [
  join(process.cwd(), "app", "(desktop)", "insights", "full-reading"),
  join(process.cwd(), "app", "components", "reading-room"),
];
const NAMESPACES = new Set(["fullReading", "strength", "planetNames"]);
const LITERAL_KEYS = [
  ...new Set(
    SOURCE_DIRS.flatMap((dir) =>
      readdirSync(dir)
        .filter((file) => /\.tsx?$/.test(file))
        .map((file) => readFileSync(join(dir, file), "utf8")),
    )
      .flatMap((source) => [...source.matchAll(/["'](\w+(?:\.\w+)+)["']/g)])
      .map((match) => match[1])
      .filter((key) => NAMESPACES.has(key.split(".")[0])),
  ),
];

/* Built by the yoga room from the engine's closed sets. Planet names are
   lib/chart-labels' keys: planetNames for the seven, strength.planets for the
   two nodes the baseline does not carry. */
const RUNTIME_KEYS = [
  ...YOGA_STRENGTHS.map((strength) => `strength.yogas.strengthLabels.${strength}`),
  ...YOGA_FAMILIES.map((family) => `strength.yogas.categories.${family}`),
  ...PLANET_IDS.map((planet) => planetNameKey(planet)!),
];

const TRANSLATIONS: Record<string, Tree> = { es, bn, hi, it: it_, fr };

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

describe("the full reading's catalog keys", () => {
  it("finds the literals it reads", () => {
    /* A guard on the scan itself: one key from each room and one from the page. */
    expect(LITERAL_KEYS).toEqual(
      expect.arrayContaining([
        "fullReading.patternsLead",
        "fullReading.whyThisReading",
        "fullReading.yogaForms",
        "fullReading.karmaSignals",
        "strength.yogas.traitsAriaLabel",
      ]),
    );
  });

  it("covers every theme the rule engine files a finding under", () => {
    for (const theme of FINDING_THEMES) {
      expect(LITERAL_KEYS, theme).toContain(FINDING_THEME_KEYS[theme]);
    }
  });

  it("are all in English", () => {
    for (const key of [...LITERAL_KEYS, ...RUNTIME_KEYS]) {
      expect(typeof lookup(ENGLISH, key), key).toBe("string");
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
        placeholders(lookup(ENGLISH, key) as string),
      );
    }
  });

  it("drops nothing the catalogs still carry for this page", () => {
    /* Keys the five catalogs hold under fullReading that English no longer
       has would be dead weight nobody can see. */
    for (const [lang, catalog] of Object.entries(TRANSLATIONS)) {
      const flat = (node: Tree, prefix: string): string[] =>
        Object.entries(node).flatMap(([k, v]) =>
          typeof v === "string" ? [`${prefix}${k}`] : flat(v as Tree, `${prefix}${k}.`),
        );
      for (const key of flat(catalog.fullReading as Tree, "fullReading.")) {
        expect(typeof lookup(ENGLISH, key), `${lang}: ${key}`).toBe("string");
      }
    }
  });
});
