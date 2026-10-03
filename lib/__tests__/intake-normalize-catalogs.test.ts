/**
 * Every note the intake normaliser can write exists in the catalogs, with the
 * blanks it fills.
 *
 * lib/intake-normalize hands back catalog keys rather than sentences, and the
 * forms pass them to `t` as variables, which no scan of `t("...")` literals
 * can see; a key that goes missing renders on screen as itself. So they are
 * checked here: in both English baselines, because the forms that show them
 * live in both trees; against the placeholders the normaliser actually fills;
 * and translated, in the language's catalog or still staged for the fold in a
 * fragment, with those same placeholders.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import en from "@/messages/en.json";
import enMobile from "@/messages/en.mobile.json";
import es from "@/messages/es.json";
import bn from "@/messages/bn.json";
import hi from "@/messages/hi.json";
import it_ from "@/messages/it.json";
import fr from "@/messages/fr.json";
import {
  INTAKE_MESSAGE_KEYS,
  normalizeBirthDate,
  normalizeBirthTime,
  normalizeCoordinate,
  normalizePersonName,
  normalizePlaceName,
  normalizeUtcOffsetMinutes,
  suggestionTaken,
  type IntakeFieldResult,
} from "../intake-normalize";

type Tree = Record<string, unknown>;

function lookup(tree: Tree, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], tree);
}

const placeholders = (text: string) => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();

/* Inputs that between them make the normaliser say everything it can say. */
const dateOptions = { today: new Date(2026, 7, 17) };
const SAMPLES: IntakeFieldResult[] = [
  ...[
    "noon", "midnight", "hello", "7:15", "13:00 PM", "13:45 AM", "12:00 AM", "24:00",
    "25:00", "25 pm", "0 pm", "2:5 pm", "9 pm", "14:30:45", "14:75",
  ].map((raw) => normalizeBirthTime(raw)),
  ...[
    "hello", "15/05/90", "05/22/1990", "08/09/2026", "15051990", "19900515", "31/02/1990",
    "1990-13-45", "15/05/2030", "15/05/1850", "05/06/1990",
  ].map((raw) => normalizeBirthDate(raw, dateOptions)),
  normalizePersonName("A"),
  normalizePersonName("  ada   lovelace "),
  normalizePlaceName("  new   delhi "),
  normalizeCoordinate("somewhere", "latitude"),
  normalizeCoordinate("40,7128", "latitude"),
  normalizeCoordinate("40 75 N", "latitude"),
  normalizeCoordinate("40 42 46 N", "latitude"),
  normalizeCoordinate("120.5", "latitude"),
  normalizeCoordinate("200", "latitude"),
  normalizeCoordinate("200", "longitude"),
  normalizeCoordinate("74.006 W", "longitude"),
  ...["nonsense", "5:75", "+05:30", "5.5", "900"].map((raw) => normalizeUtcOffsetMinutes(raw)),
  suggestionTaken({ value: "19:15", label: { kind: "time", value: "19:15" } }),
];

const emitted = SAMPLES.flatMap((result) => result.messages ?? []);

/* What the forms render around those notes: the chip-row label, the
   fallbacks, and the success badge's accessible name. */
const FORM_KEYS = [
  ...INTAKE_MESSAGE_KEYS,
  "home.fieldNoteDidYouMean",
  "home.fieldNoteReadAs",
  "home.fieldNoteReadsAs",
  "home.fieldComplete",
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

describe("the intake normaliser's catalog keys", () => {
  it("are all in both English baselines, saying the same thing", () => {
    for (const key of FORM_KEYS) {
      expect(typeof lookup(en, key), key).toBe("string");
      expect(lookup(enMobile, key), key).toBe(lookup(en, key));
    }
  });

  it("are each said by some input, so none is listed for nothing", () => {
    const said = new Set(emitted.map((message) => message.key));
    expect(INTAKE_MESSAGE_KEYS.filter((key) => !said.has(key))).toEqual([]);
  });

  it("fill exactly the blanks their English sentence has", () => {
    for (const { key, params } of emitted) {
      const filled = Object.keys(params ?? {}).map((name) => `{${name}}`).sort();
      expect(filled, key).toEqual(placeholders(lookup(en, key) as string));
    }
  });

  it.each(Object.keys(TRANSLATIONS))("are translated into %s, with the same blanks", (lang) => {
    for (const key of FORM_KEYS) {
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
