/**
 * The date forecast's sentences, re-worded on the desktop card.
 *
 * buildForecast keeps writing English (the Android app and the caches read
 * it); lib/forecast-text.ts says the same sentences through the catalog from
 * the pieces the engine sends beside them. Two things can drift silently, and
 * these tests pin both: the English catalog against the engine's tables, and
 * the rebuilt English against the engine's own sentences on real charts --
 * so a wording change in either place fails here rather than leaving one
 * language saying something the others do not.
 *
 * Then every key, in every language: the catalog or the staged fragment, with
 * the English blanks.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { aspectTone, buildForecast, forecastAspectInterpretation } from "@/lib/engines/chart-service";
import type { BirthDetailsInput } from "@/lib/engines/compatibility-service";
import {
  DASHA_FORECAST_THEMES,
  FORECAST_PLANET_THEME_FALLBACK,
  FORECAST_PLANET_THEMES,
} from "@/lib/engines/forecast-copy";
import { HOUSE_THEMES } from "@/lib/rules/tables";
import { FORECAST_PLANETS, forecastText, transitInterpretation } from "@/lib/forecast-text";
import type { ForecastAspectInsight } from "@/lib/astro-types";
import en from "@/messages/en.json";
import enTiming from "@/messages/en.timing.json";
import enStrength from "@/messages/en.strength.json";
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

const ENGLISH: Tree = { ...(en as Tree), ...(enTiming as Tree), ...(enStrength as Tree) };

/* What the card's `tr` does in English: the catalog, blanks filled, the key itself when missing. */
const english = (key: string, params?: Record<string, string>) => {
  let text = lookup(ENGLISH, key);
  if (typeof text !== "string") return key;
  for (const [name, value] of Object.entries(params ?? {})) text = (text as string).split(`{${name}}`).join(value);
  return text as string;
};

const BIRTHS: BirthDetailsInput[] = [
  {
    name: "Bengaluru",
    birth_date: "1990-05-15",
    birth_time: "10:30",
    timezone_offset_minutes: 330,
    latitude: 12.9716,
    longitude: 77.5946,
    engine_id: "lahiri_classic",
  } as BirthDetailsInput,
  {
    name: "New York",
    birth_date: "1984-11-02",
    birth_time: "21:10",
    timezone_offset_minutes: -300,
    latitude: 40.7128,
    longitude: -74.006,
    engine_id: "lahiri_classic",
  } as BirthDetailsInput,
];

/* Every 23 days for three years: long enough to cross several pratyantars, so
   both the layered and the plain sentences come up. */
const DATES = Array.from({ length: 48 }, (_, index) =>
  new Date(Date.UTC(2026, 0, 1) + index * 23 * 86_400_000).toISOString().slice(0, 10),
);

describe("the forecast's English catalog", () => {
  it("words each period lord as the engine's table does", () => {
    for (const [planet, row] of Object.entries(DASHA_FORECAST_THEMES)) {
      const id = planet.toLowerCase();
      expect(english(`timing.forecast.text.periodFocus.${id}`), planet).toBe(row.focus);
      expect(english(`timing.forecast.text.opportunities.${id}`), planet).toBe(row.opportunity);
      expect(english(`timing.forecast.text.cautions.${id}`), planet).toBe(row.caution);
    }
    expect(Object.keys(DASHA_FORECAST_THEMES).sort()).toEqual([...FORECAST_PLANETS].sort());
  });

  it("words each natal planet as the engine's table does", () => {
    for (const [planet, theme] of Object.entries(FORECAST_PLANET_THEMES)) {
      expect(english(`timing.forecast.text.natalThemes.${planet.toLowerCase()}`), planet).toBe(theme);
    }
    expect(english("timing.forecast.text.natalThemeFallback")).toBe(FORECAST_PLANET_THEME_FALLBACK);
    expect(Object.keys(FORECAST_PLANET_THEMES).sort()).toEqual([...FORECAST_PLANETS].sort());
  });

  it("borrows the strength page's house themes, which are the engine's", () => {
    for (const [house, theme] of Object.entries(HOUSE_THEMES)) {
      expect(english(`strength.houseThemes.${house}`), house).toBe(theme);
    }
  });
});

describe("the card's English is the engine's", () => {
  const forecasts = BIRTHS.flatMap((birth) => DATES.map((date) => buildForecast(birth, date)));

  it("says the headline, overview and every list as the engine wrote them", () => {
    for (const forecast of forecasts) {
      expect(forecast.parts, forecast.target_date).toBeDefined();
      const text = forecastText(forecast, english, (date) => date);
      expect(text.headline).toBe(forecast.headline);
      expect(text.overview).toBe(forecast.overview);
      for (const [lines, source] of [
        [text.focusAreas, forecast.focus_areas],
        [text.opportunities, forecast.opportunities],
        [text.cautions, forecast.cautions],
      ] as const) {
        expect(lines.map((line) => line.text)).toEqual(source);
        expect(lines.map((line) => line.english)).toEqual(source);
      }
    }
  });

  it("met both the layered and the plain wording", () => {
    const layered = forecasts.filter((forecast) => forecast.parts?.pratyantar).length;
    expect(layered).toBeGreaterThan(0);
    expect(layered).toBeLessThan(forecasts.length);
  });

  it("says every transit line as the engine does", () => {
    const natal = [...FORECAST_PLANETS, "Uranus"];
    for (const transit of FORECAST_PLANETS) {
      for (const aspect of ["Conjunction", "Opposition", "Trine", "Square", "Sextile"]) {
        for (const natalPlanet of natal) {
          const signal: ForecastAspectInsight = {
            transit_planet: transit,
            natal_planet: natalPlanet,
            aspect_type: aspect,
            orb: 1,
            tone: aspectTone(transit, aspect) as ForecastAspectInsight["tone"],
            interpretation: forecastAspectInterpretation(transit, aspect, natalPlanet),
          };
          expect(transitInterpretation({ ...signal, interpretation: "" }, english, "en")).toBe(signal.interpretation);
        }
      }
    }
  });

  it("falls back to the English when a cached payload has no parts", () => {
    const forecast = { ...buildForecast(BIRTHS[0], DATES[0]), parts: undefined };
    const text = forecastText(forecast, () => "x", (date) => date);
    expect(text.headline).toBe(forecast.headline);
    expect(text.focusAreas.map((line) => line.text)).toEqual(forecast.focus_areas);
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

const KEYS = leaves(lookup(ENGLISH, "timing.forecast.text") as Tree, "timing.forecast.text.");

describe("the forecast's sentences in every language", () => {
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
