/**
 * Every string the mobile results page can show is translated into the other
 * five languages, with the same blanks.
 *
 * messages/en.mobile-insights.json is the only English source for the
 * mobileInsights namespace, and i18n-mobile-coverage.test.ts already checks
 * that every key the page renders is in it. This checks the other direction:
 * each of its keys is translated into es, bn, hi, it and fr, either folded
 * into that language's catalog or still staged in messages/fragments. Exactly
 * one of the two, because the fold reports a staged key the catalog already
 * has as a clash. Bengali and Hindi must be in NFC, the form their catalogs
 * store.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import en from "@/messages/en.mobile-insights.json";
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

function leaves(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : leaves(value as Tree, `${prefix}${key}.`)
  );
}

const placeholders = (text: string) => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();

const KEYS = leaves(en as Tree);
const TRANSLATIONS: Record<string, Tree> = { es, bn, hi, it: it_, fr, de };

const FRAGMENT_DIR = join(process.cwd(), "messages", "fragments");
const FRAGMENTS: Tree[] = existsSync(FRAGMENT_DIR)
  ? readdirSync(FRAGMENT_DIR)
      .filter((file) => file.endsWith(".json"))
      .map((file) => JSON.parse(readFileSync(join(FRAGMENT_DIR, file), "utf8")) as Tree)
  : [];

describe("the mobileInsights catalog", () => {
  it("covers the page's house-system keys", () => {
    /* A guard on the source of KEYS: the strings the chart and table use to
       give a planet's bhava beside its sign house. */
    expect(KEYS).toEqual(
      expect.arrayContaining([
        "mobileInsights.chartPlacementBhava",
        "mobileInsights.colBhava",
        "mobileInsights.bhavaLegend",
        "mobileInsights.systemPorphyry",
      ])
    );
  });

  it.each(Object.keys(TRANSLATIONS))("is translated into %s, once, with the same blanks", (lang) => {
    for (const key of KEYS) {
      const folded = lookup(TRANSLATIONS[lang], key);
      const pending = FRAGMENTS.map((fragment) => lookup(fragment, `${lang}.${key}`)).filter(
        (value) => value !== undefined
      );
      expect(Number(folded !== undefined) + pending.length, `${lang}: ${key}`).toBe(1);

      const translated = (folded ?? pending[0]) as string;
      expect(typeof translated, `${lang}: ${key}`).toBe("string");
      expect(placeholders(translated), `${lang}: ${key}`).toEqual(placeholders(lookup(en as Tree, key) as string));
      if (lang === "bn" || lang === "hi") {
        expect(translated, `${lang}: ${key} is not NFC`).toBe(translated.normalize("NFC"));
      }
    }
  });
});
