/**
 * Every string of the palm panel's "whose hand?" choice is in the palm
 * catalog's English and in the other five languages, folded or staged. The
 * keys are literals in the panel's source, read from it here, so a key added
 * without its strings fails this rather than rendering as itself.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import en from "@/messages/en.palm.json";
import es from "@/messages/es.json";
import bn from "@/messages/bn.json";
import hi from "@/messages/hi.json";
import it_ from "@/messages/it.json";
import fr from "@/messages/fr.json";

type Tree = Record<string, unknown>;

const lookup = (tree: Tree, key: string): unknown =>
  key.split(".").reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], tree);

const PANEL = join(process.cwd(), "app", "(desktop)", "insights", "components", "palm-reading-panel.tsx");
const KEYS = [...new Set([...readFileSync(PANEL, "utf8").matchAll(/["'](palm\.panel\.reader\w+)["']/g)].map((m) => m[1]))];

const TRANSLATIONS: Record<string, Tree> = { es, bn, hi, it: it_, fr };
const FRAGMENT_DIR = join(process.cwd(), "messages", "fragments");
const FRAGMENTS: Tree[] = existsSync(FRAGMENT_DIR)
  ? readdirSync(FRAGMENT_DIR)
      .filter((file) => file.endsWith(".json"))
      .map((file) => JSON.parse(readFileSync(join(FRAGMENT_DIR, file), "utf8")) as Tree)
  : [];
const staged = (lang: string, key: string) =>
  FRAGMENTS.map((fragment) => lookup(fragment, `${lang}.${key}`)).filter((value) => value !== undefined);

describe("the palm panel's hand choice", () => {
  it("reads its seven keys out of the panel", () => {
    expect(KEYS.sort()).toEqual(
      [
        "palm.panel.readerLegend",
        "palm.panel.readerWoman",
        "palm.panel.readerMan",
        "palm.panel.readerUnspecified",
        "palm.panel.readerHintWoman",
        "palm.panel.readerHintMan",
        "palm.panel.readerHintUnspecified",
      ].sort(),
    );
  });

  it("has every string in the palm catalog's English", () => {
    for (const key of KEYS) expect(typeof lookup(en as Tree, key), key).toBe("string");
  });

  it.each(Object.keys(TRANSLATIONS))("is translated into %s, once, in NFC", (lang) => {
    for (const key of KEYS) {
      const folded = lookup(TRANSLATIONS[lang], key);
      const pending = staged(lang, key);
      expect(Number(folded !== undefined) + pending.length, `${lang}: ${key}`).toBe(1);
      const value = (folded ?? pending[0]) as string;
      expect(typeof value, `${lang}: ${key}`).toBe("string");
      expect(value, `${lang}: ${key}`).toBe(value.normalize("NFC"));
    }
  });

  it("no longer tells anyone to photograph their dominant hand", () => {
    expect(lookup(en as Tree, "palm.panel.tipHandFlat")).not.toMatch(/dominant/i);
  });
});
