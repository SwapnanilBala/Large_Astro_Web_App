/**
 * The palm panel's error messages, the photo check's refusals among them,
 * are in the palm catalog's English and in the other six languages, folded
 * or staged. The keys are read out of the panel's source, so a key added
 * without its strings fails this rather than rendering as itself; and the
 * panel knows every reason the route's photo check can refuse for.
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
import de from "@/messages/de.json";
import { PALM_PHOTO_REFUSAL_MESSAGES, PALM_PHOTO_VERDICTS } from "@/lib/palm-readings/photo-check";

type Tree = Record<string, unknown>;

const lookup = (tree: Tree, key: string): unknown =>
  key.split(".").reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], tree);

const PANEL_SOURCE = readFileSync(
  join(process.cwd(), "app", "(desktop)", "insights", "components", "palm-reading-panel.tsx"),
  "utf8",
);
/* The Q&A panel's sign-in ask is the same refusal on the other palm route, so it is checked here too. */
const QA_PANEL_SOURCE = readFileSync(
  join(process.cwd(), "app", "(desktop)", "insights", "components", "palm-qa-panel.tsx"),
  "utf8",
);
const KEYS = [
  ...new Set([
    ...[...PANEL_SOURCE.matchAll(/["'](palm\.errors\.\w+)["']/g)].map((m) => m[1]),
    ...[...QA_PANEL_SOURCE.matchAll(/["'](palm\.qa\.signInRequired)["']/g)].map((m) => m[1]),
  ]),
];

const TRANSLATIONS: Record<string, Tree> = { es, bn, hi, it: it_, fr, de };
const FRAGMENT_DIR = join(process.cwd(), "messages", "fragments");
const FRAGMENTS: Tree[] = existsSync(FRAGMENT_DIR)
  ? readdirSync(FRAGMENT_DIR)
      .filter((file) => file.endsWith(".json"))
      .map((file) => JSON.parse(readFileSync(join(FRAGMENT_DIR, file), "utf8")) as Tree)
  : [];
const staged = (lang: string, key: string) =>
  FRAGMENTS.map((fragment) => lookup(fragment, `${lang}.${key}`)).filter((value) => value !== undefined);

describe("the palm panel's error messages", () => {
  it("include one for every reason the photo check refuses", () => {
    const refusals = PALM_PHOTO_VERDICTS.filter((verdict) => verdict !== "palm");
    expect(Object.keys(PALM_PHOTO_REFUSAL_MESSAGES).sort()).toEqual([...refusals].sort());
    for (const reason of refusals) expect(PANEL_SOURCE).toMatch(new RegExp(`\\b${reason}: "palm\\.errors\\.\\w+"`));
    expect(KEYS).toEqual(
      expect.arrayContaining([
        "palm.errors.notAPalm",
        "palm.errors.backOfHand",
        "palm.errors.unclearPhoto",
        "palm.errors.weeklyLimit",
        "palm.errors.signInRequired",
        "palm.qa.signInRequired",
      ]),
    );
  });

  it("are all in the palm catalog's English", () => {
    for (const key of KEYS) expect(typeof lookup(en as Tree, key), key).toBe("string");
  });

  it.each(Object.keys(TRANSLATIONS))("are translated into %s, once, in NFC", (lang) => {
    for (const key of KEYS) {
      const folded = lookup(TRANSLATIONS[lang], key);
      const pending = staged(lang, key);
      expect(Number(folded !== undefined) + pending.length, `${lang}: ${key}`).toBe(1);
      const value = (folded ?? pending[0]) as string;
      expect(typeof value, `${lang}: ${key}`).toBe("string");
      expect(value, `${lang}: ${key}`).toBe(value.normalize("NFC"));
      const english = lookup(en as Tree, key) as string;
      expect([...value.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort(), `${lang}: ${key}`).toEqual(
        [...english.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort(),
      );
    }
  });

  it("never say AI, paid or free", () => {
    /* The catalogs too: once the fragments are folded and deleted, that is where the strings live. */
    const trees = [en as Tree, ...Object.values(TRANSLATIONS), ...FRAGMENTS.flatMap((f) => Object.values(f) as Tree[])];
    for (const tree of trees) {
      for (const key of KEYS) {
        const value = lookup(tree, key);
        if (typeof value !== "string") continue;
        expect(value).not.toMatch(/\bAI\b|\bIA\b|\bKI\b/);
        expect(value).not.toMatch(/paid|free|expensive|gratis|gratuit|kostenlos/i);
      }
    }
  });
});
