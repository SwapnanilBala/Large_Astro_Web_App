/**
 * Every string the "From the classics" card can show is in the strength
 * catalog's English and in the other five languages, folded or staged.
 *
 * The card's keys are literals, read straight out of its source here, so a key
 * added to the card without its strings fails this rather than rendering on
 * screen as itself.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import en from "@/messages/en.strength.json";
import es from "@/messages/es.json";
import bn from "@/messages/bn.json";
import hi from "@/messages/hi.json";
import it_ from "@/messages/it.json";
import fr from "@/messages/fr.json";

type Tree = Record<string, unknown>;

function lookup(tree: Tree, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], tree);
}

const placeholders = (text: string) => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();

const CARD = join(process.cwd(), "app", "(desktop)", "insights", "components", "yoga-classics-card.tsx");
const KEYS = [
  ...new Set(
    [...readFileSync(CARD, "utf8").matchAll(/["'](strength\.yogas\.classics\.\w+)["']/g)].map((match) => match[1]),
  ),
];

const TRANSLATIONS: Record<string, Tree> = { es, bn, hi, it: it_, fr };

const FRAGMENT_DIR = join(process.cwd(), "messages", "fragments");
const FRAGMENTS: Tree[] = existsSync(FRAGMENT_DIR)
  ? readdirSync(FRAGMENT_DIR)
      .filter((file) => file.endsWith(".json"))
      .map((file) => JSON.parse(readFileSync(join(FRAGMENT_DIR, file), "utf8")) as Tree)
  : [];

function staged(lang: string, key: string): unknown[] {
  return FRAGMENTS.map((fragment) => lookup(fragment, `${lang}.${key}`)).filter((value) => value !== undefined);
}

describe("the classical yoga card's catalog keys", () => {
  it("finds the literals it reads", () => {
    expect(KEYS).toEqual(
      expect.arrayContaining([
        "strength.yogas.classics.heading",
        "strength.yogas.classics.sourceRef",
        "strength.yogas.classics.credit",
      ]),
    );
  });

  it("are all in the strength catalog's English", () => {
    for (const key of KEYS) {
      expect(typeof lookup(en as Tree, key), key).toBe("string");
    }
  });

  it.each(Object.keys(TRANSLATIONS))("are translated into %s, once, with the same blanks", (lang) => {
    for (const key of KEYS) {
      const folded = lookup(TRANSLATIONS[lang], key);
      const pending = staged(lang, key);
      expect(Number(folded !== undefined) + pending.length, `${lang}: ${key}`).toBe(1);
      const translated = folded ?? pending[0];
      expect(typeof translated, `${lang}: ${key}`).toBe("string");
      expect(placeholders(translated as string), `${lang}: ${key}`).toEqual(
        placeholders(lookup(en as Tree, key) as string),
      );
    }
  });

  it("stores Bengali and Hindi in NFC, the form the catalogs use", () => {
    for (const lang of ["bn", "hi"]) {
      for (const key of KEYS) {
        const value = (lookup(TRANSLATIONS[lang], key) ?? staged(lang, key)[0]) as string;
        expect(value, `${lang}: ${key}`).toBe(value.normalize("NFC"));
      }
    }
  });
});
