/**
 * The intake's sex-at-birth strings: the same English in the desktop and
 * mobile catalogs, and every one translated into the other five languages,
 * folded or staged, once, in the form the catalogs use.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { BIRTH_SEX_CHOICES } from "@/lib/birth-sex";
import en from "@/messages/en.json";
import enMobile from "@/messages/en.mobile.json";
import es from "@/messages/es.json";
import bn from "@/messages/bn.json";
import hi from "@/messages/hi.json";
import it_ from "@/messages/it.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";

type Tree = Record<string, unknown>;

const lookup = (tree: Tree, key: string): unknown =>
  key.split(".").reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], tree);

const KEYS = ["home.birthSexLabel", "home.birthSexHint", ...BIRTH_SEX_CHOICES.map((choice) => choice.labelKey)];

const TRANSLATIONS: Record<string, Tree> = { es, bn, hi, it: it_, fr, de };
const FRAGMENT_DIR = join(process.cwd(), "messages", "fragments");
const FRAGMENTS: Tree[] = existsSync(FRAGMENT_DIR)
  ? readdirSync(FRAGMENT_DIR)
      .filter((file) => file.endsWith(".json"))
      .map((file) => JSON.parse(readFileSync(join(FRAGMENT_DIR, file), "utf8")) as Tree)
  : [];
const staged = (lang: string, key: string) =>
  FRAGMENTS.map((fragment) => lookup(fragment, `${lang}.${key}`)).filter((value) => value !== undefined);

describe("the intake's sex-at-birth strings", () => {
  it("are the same English on desktop and mobile", () => {
    for (const key of KEYS) {
      expect(typeof lookup(en as Tree, key), key).toBe("string");
      expect(lookup(enMobile as Tree, key), key).toBe(lookup(en as Tree, key));
    }
  });

  it.each(Object.keys(TRANSLATIONS))("are translated into %s, once, in NFC", (lang) => {
    for (const key of KEYS) {
      const folded = lookup(TRANSLATIONS[lang], key);
      const pending = staged(lang, key);
      expect(Number(folded !== undefined) + pending.length, `${lang}: ${key}`).toBe(1);
      const value = (folded ?? pending[0]) as string;
      expect(typeof value, `${lang}: ${key}`).toBe("string");
      expect(value, `${lang}: ${key}`).toBe(value.normalize("NFC"));
    }
  });
});
