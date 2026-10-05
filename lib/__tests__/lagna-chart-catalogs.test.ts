/**
 * Every string the results page's chart card can show exists in all six
 * catalogs.
 *
 * The card builds several keys at runtime -- `planetNames.${name}`,
 * `zodiacSigns.${sign}`, `zodiacElements.${element}`,
 * `lagnaChart.abbrev.${name}` -- which no scan of `t("...")` literals can see,
 * and a missing one renders as the raw key on screen. This lists them out.
 */
import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import es from "@/messages/es.json";
import bn from "@/messages/bn.json";
import hi from "@/messages/hi.json";
import it_ from "@/messages/it.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";

type Tree = Record<string, unknown>;
const CATALOGS: Record<string, Tree> = { en, es, bn, hi, it: it_, fr, de };

function lookup(tree: Tree, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], tree);
}

function leaves(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    value && typeof value === "object" ? leaves(value as Tree, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(",");

const SIGNS = ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"];
const PLANETS = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn"];

const RUNTIME_KEYS = [
  ...PLANETS.map((p) => `planetNames.${p}`),
  ...SIGNS.map((s) => `zodiacSigns.${s}`),
  ...["fire", "earth", "air", "water"].map((e) => `zodiacElements.${e}`),
  ...[...PLANETS, "rahu", "ketu", "ascendant"].map((p) => `lagnaChart.abbrev.${p}`),
  "lagnaChart.rahu",
  "lagnaChart.ketu",
  "insights.house",
  "dasha.degree",
  "navamsa.planet",
];

describe("the chart card's strings", () => {
  const englishKeys = leaves(en.lagnaChart as Tree, "lagnaChart.");

  it.each(Object.keys(CATALOGS))("%s has every lagnaChart key, with the same placeholders", (lang) => {
    for (const key of englishKeys) {
      const value = lookup(CATALOGS[lang], key);
      expect(typeof value, `${lang}: ${key}`).toBe("string");
      expect(placeholders(value as string), `${lang}: ${key}`).toBe(placeholders(lookup(en, key) as string));
    }
  });

  it.each(Object.keys(CATALOGS))("%s has every key the card builds at runtime", (lang) => {
    for (const key of RUNTIME_KEYS) {
      expect(typeof lookup(CATALOGS[lang], key), `${lang}: ${key}`).toBe("string");
    }
  });

  it("has nothing left staged for the fold", async () => {
    const { existsSync } = await import("node:fs");
    expect(existsSync("messages/fragments/lagnaChart.json")).toBe(false);
  });
});
