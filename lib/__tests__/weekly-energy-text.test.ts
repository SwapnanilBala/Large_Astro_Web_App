/**
 * The weekly-energy panel's words, re-said on the client.
 *
 * computeWeeklyEnergy keeps sending English; lib/weekly-energy-text.ts says
 * the same card titles and advice, headline, peak label and chart text
 * through the catalog. These pin the English catalog to the engine's copy
 * tables and the rebuilt English to the engine's own strings over real weeks,
 * then check every key is in every language with the English blanks.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getChartPayload, readChartParams } from "@/lib/chart-params";
import { computeWeeklyEnergy } from "@/lib/engines/weekly-energy-engine";
import {
  HEADLINE_GUIDANCE,
  HEADLINE_NOUNS,
  HEADLINE_OPENERS,
  HEADLINE_VERBS,
  INTENT_COPY,
} from "@/lib/engines/weekly-energy-copy";
import { addWeeks } from "@/lib/format-week";
import {
  weeklyCardText,
  weeklyChartAltText,
  weeklyHeadlineText,
  weeklyPeakLabel,
} from "@/lib/weekly-energy-text";
import enShared from "@/messages/en.shared.json";
import es from "@/messages/es.json";
import bn from "@/messages/bn.json";
import hi from "@/messages/hi.json";
import it_ from "@/messages/it.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";

type Tree = Record<string, unknown>;

const lookup = (tree: unknown, key: string): unknown =>
  key.split(".").reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], tree);

function leaves(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    value && typeof value === "object" ? leaves(value as Tree, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

const english = (key: string, params?: Record<string, string>) => {
  let text = lookup(enShared, key);
  if (typeof text !== "string") return key;
  for (const [name, value] of Object.entries(params ?? {})) text = (text as string).split(`{${name}}`).join(value);
  return text as string;
};

const COPY = "shared.weeklyEnergyCopy";
const SHAPES = Object.keys(HEADLINE_VERBS) as Array<keyof typeof HEADLINE_VERBS>;

const CHARTS = [
  { name: "Chart A", birthDate: "1992-02-20", birthTime: "08:30", timezoneOffsetMinutes: "-300", latitude: "40.7128", longitude: "-74.0060" },
  { name: "Chart B", birthDate: "1975-11-03", birthTime: "23:45", timezoneOffsetMinutes: "330", latitude: "19.0760", longitude: "72.8777" },
  { name: "Chart C", birthDate: "2001-07-14", birthTime: "05:05", timezoneOffsetMinutes: "60", latitude: "48.8566", longitude: "2.3522" },
];

function weekFor(chart: (typeof CHARTS)[number], weekStart: string) {
  const payload = getChartPayload(
    readChartParams({ ...chart, country: "X", state: "Y", city: "Z", engineId: "lahiri_classic", birthTimeAccuracy: "exact" }),
  );
  return computeWeeklyEnergy({
    weekStart,
    latitude: Number(chart.latitude),
    longitude: Number(chart.longitude),
    timezoneOffsetMinutes: Number(chart.timezoneOffsetMinutes),
    engineId: "lahiri_classic",
    natalPlanets: payload.chart.planets,
    ascendantSign: payload.chart.ascendant.sign,
  });
}

describe("the weekly panel's English catalog", () => {
  it("names and advises each card as the engine's table does", () => {
    for (const [intent, copy] of Object.entries(INTENT_COPY)) {
      expect(english(`${COPY}.cards.${intent}.title`), intent).toBe(copy.title);
      for (const [quality, body] of Object.entries(copy.bodies)) {
        expect(english(`${COPY}.cards.${intent}.${quality}`), `${intent}.${quality}`).toBe(body);
      }
    }
  });

  it("words the headline and the peak as the engine composes them", () => {
    for (const [kind, noun] of Object.entries(HEADLINE_NOUNS)) {
      expect(english(`${COPY}.peak.${kind}`), kind).toBe(`Peak ${noun}`);
      for (const shape of SHAPES) {
        expect(english(`${COPY}.titles.${kind}.${shape}`), `${kind}.${shape}`).toBe(`${noun} ${HEADLINE_VERBS[shape]}`);
        expect(english(`${COPY}.openers.${kind}.${shape}`), `${kind}.${shape}`).toBe(HEADLINE_OPENERS[noun][shape]);
      }
    }
    for (const [key, row] of Object.entries(HEADLINE_GUIDANCE)) {
      for (const shape of SHAPES) {
        expect(english(`${COPY}.guidance.${key}.${shape}`), `${key}.${shape}`).toBe(row[shape]);
      }
    }
  });
});

describe("the panel's English is the engine's", () => {
  const weeks = CHARTS.flatMap((chart) =>
    Array.from({ length: 12 }, (_, index) => weekFor(chart, addWeeks("2026-01-03", index * 5))),
  );

  it("says every card, the headline, the peak and the chart text as the engine did", () => {
    for (const week of weeks) {
      expect(week.headline.noun_kind).toBeDefined();
      for (const card of week.cards) {
        expect(weeklyCardText(card, english, "en-US")).toEqual({ title: card.title, body: card.body });
      }
      expect(weeklyHeadlineText(week.headline, english)).toEqual({
        title: week.headline.title,
        paragraph: week.headline.paragraph,
      });
      if (week.peak.is_significant) expect(weeklyPeakLabel(week, english)).toBe(week.peak.label);
      expect(weeklyChartAltText(week, english, "en-US")).toBe(week.chart_alt_text);
    }
  });

  it("falls back to the English for a response cached without the headline's parts", () => {
    const week = weeks[0];
    const headline = { title: week.headline.title, paragraph: week.headline.paragraph, quote_key: week.headline.quote_key };
    expect(weeklyHeadlineText(headline, () => "x")).toEqual({ title: headline.title, paragraph: headline.paragraph });
    expect(weeklyPeakLabel({ ...week, headline }, english)).toBe(week.peak.is_significant ? week.peak.label : "Steady week");
  });
});

/* ── Every language ── */

const TRANSLATIONS: Record<string, Tree> = { es, bn, hi, it: it_, fr, de };
const FRAGMENT_DIR = join(process.cwd(), "messages", "fragments");
const FRAGMENTS: Tree[] = existsSync(FRAGMENT_DIR)
  ? readdirSync(FRAGMENT_DIR)
      .filter((file) => file.endsWith(".json"))
      .map((file) => JSON.parse(readFileSync(join(FRAGMENT_DIR, file), "utf8")) as Tree)
  : [];

const placeholders = (text: string) => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();

const KEYS = leaves(lookup(enShared, COPY) as Tree, `${COPY}.`);

describe("the weekly panel's words in every language", () => {
  it.each(Object.keys(TRANSLATIONS))("are in %s, once, with the English blanks", (lang) => {
    for (const key of KEYS) {
      const folded = lookup(TRANSLATIONS[lang], key);
      const staged = FRAGMENTS.map((fragment) => lookup(fragment, `${lang}.${key}`)).filter((value) => value !== undefined);
      expect(Number(folded !== undefined) + staged.length, `${lang}: ${key}`).toBe(1);
      const text = (folded ?? staged[0]) as string;
      expect(typeof text, `${lang}: ${key}`).toBe("string");
      expect(placeholders(text), `${lang}: ${key}`).toEqual(placeholders(english(key)));
      if (lang === "hi" || lang === "bn") expect(text, `${lang}: ${key}`).toBe(text.normalize("NFC"));
    }
  });
});
