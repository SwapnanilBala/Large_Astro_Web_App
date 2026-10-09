/**
 * Every string a "From the classics" card can show is in its route catalog's
 * English and in the other five languages, folded or staged.
 *
 * Both cards are ClassicalNote, which reads `${prefix}.${key}` for the keys in
 * CLASSICAL_NOTE_KEYS. So the test reads the card's own source for the keys it
 * builds and each page's source for the prefix it passes, and a key added to
 * the card, or a card given a new prefix, fails here rather than rendering on
 * screen as itself.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { CLASSICAL_NOTE_KEYS, WOMENS_BOOK_NOTE_KEYS } from "@/lib/knowledge/classical-reading";
import enStrength from "@/messages/en.strength.json";
import enLifeAreas from "@/messages/en.life-areas.json";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import bn from "@/messages/bn.json";
import hi from "@/messages/hi.json";
import it_ from "@/messages/it.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";

type Tree = Record<string, unknown>;

function lookup(tree: Tree, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], tree);
}

const placeholders = (text: string) => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();
const source = (...path: string[]) => readFileSync(join(process.cwd(), ...path), "utf8");

const TRANSLATIONS: Record<string, Tree> = { es, bn, hi, it: it_, fr, de };

const FRAGMENT_DIR = join(process.cwd(), "messages", "fragments");
const FRAGMENTS: Tree[] = existsSync(FRAGMENT_DIR)
  ? readdirSync(FRAGMENT_DIR)
      .filter((file) => file.endsWith(".json"))
      .map((file) => JSON.parse(readFileSync(join(FRAGMENT_DIR, file), "utf8")) as Tree)
  : [];

function staged(lang: string, key: string): unknown[] {
  return FRAGMENTS.map((fragment) => lookup(fragment, `${lang}.${key}`)).filter((value) => value !== undefined);
}

const CARDS = [
  {
    name: "the yoga section's note",
    page: ["app", "(desktop)", "insights", "components", "yoga-classics-card.tsx"],
    prefix: "strength.yogas.classics",
    english: enStrength as Tree,
    /* Its passages are the yoga chapters' only: the book on women's charts carries no yoga ids. */
    keys: [...CLASSICAL_NOTE_KEYS],
  },
  {
    name: "the life areas' note",
    page: ["app", "(desktop)", "insights", "life-areas", "life-areas-client.tsx"],
    prefix: "lifeAreas.classics",
    english: enLifeAreas as Tree,
    keys: [...CLASSICAL_NOTE_KEYS, ...WOMENS_BOOK_NOTE_KEYS],
  },
  {
    name: "the dasha period's reading",
    page: ["app", "(desktop)", "insights", "components", "dasha-period-card.tsx"],
    prefix: "dasha.reading.note",
    english: en as Tree,
    /* A woman's period reading can quote the book on women's charts. */
    keys: [...CLASSICAL_NOTE_KEYS, ...WOMENS_BOOK_NOTE_KEYS],
  },
];

describe("the classical note card", () => {
  it("reads exactly the keys CLASSICAL_NOTE_KEYS and WOMENS_BOOK_NOTE_KEYS list", () => {
    const card = source("app", "(desktop)", "insights", "components", "classical-note.tsx");
    const read = new Set([...card.matchAll(/`\$\{prefix\}\.(\w+)`/g)].map((match) => match[1]));
    expect([...read].sort()).toEqual([...CLASSICAL_NOTE_KEYS, ...WOMENS_BOOK_NOTE_KEYS].sort());
  });
});

describe.each(CARDS)("$name", ({ page, prefix, english, keys: own }) => {
  const keys = own.map((key) => `${prefix}.${key}`);

  it("passes its prefix to the card", () => {
    expect(source(...page)).toContain(`prefix="${prefix}"`);
  });

  it("has every string in its catalog's English", () => {
    for (const key of keys) {
      expect(typeof lookup(english, key), key).toBe("string");
    }
  });

  it.each(Object.keys(TRANSLATIONS))("is translated into %s, once, with the same blanks", (lang) => {
    for (const key of keys) {
      const folded = lookup(TRANSLATIONS[lang], key);
      const pending = staged(lang, key);
      expect(Number(folded !== undefined) + pending.length, `${lang}: ${key}`).toBe(1);
      const translated = folded ?? pending[0];
      expect(typeof translated, `${lang}: ${key}`).toBe("string");
      expect(placeholders(translated as string), `${lang}: ${key}`).toEqual(
        placeholders(lookup(english, key) as string),
      );
    }
  });

  it("stores Bengali and Hindi in NFC, the form the catalogs use", () => {
    for (const lang of ["bn", "hi"]) {
      for (const key of keys) {
        const value = (lookup(TRANSLATIONS[lang], key) ?? staged(lang, key)[0]) as string;
        expect(value, `${lang}: ${key}`).toBe(value.normalize("NFC"));
      }
    }
  });

  it("never says AI", () => {
    for (const key of keys) {
      expect(lookup(english, key) as string, key).not.toMatch(/\bAI\b/);
    }
  });
});
