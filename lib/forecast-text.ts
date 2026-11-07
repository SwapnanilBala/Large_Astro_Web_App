/**
 * The date forecast's sentences, in the reader's language.
 *
 * buildForecast (lib/engines/chart-service.ts) writes its headline, overview,
 * focus areas, opportunities, cautions and transit lines in English, and that
 * English stays as it is: it is data the Android app and the caches read. It
 * also sends the pieces those sentences are made of -- `parts` for the period
 * lords and their houses, and each transit's planets, aspect and tone -- and
 * this module says the same sentences again through the catalog, under
 * `timing.forecast.text`. Planets, aspects and house themes come through
 * lib/chart-labels.ts and `strength.houseThemes`, never as the engine's
 * English names.
 *
 * Each list comes back paired with the engine's English for the same item,
 * because the card's life-area filter matches English keywords. When the
 * pieces are missing -- a payload cached before `parts` existed -- or do not
 * line up with the English, the English is what prints.
 *
 * Browser-safe: imported by the forecast card, so it must not reach the
 * engine. lib/__tests__/forecast-text.test.ts holds the English catalog to the
 * engine's tables and the rebuilt English to the engine's own sentences.
 */
import type { ForecastAspectInsight, ForecastParts, ForecastReading } from "@/lib/astro-types";
import { aspectName, planetName } from "@/lib/chart-labels";

type Translate = (key: string, params?: Record<string, string>) => string;

/** One line as printed, and the engine's English for it (for the life-area filter). */
export type ForecastLine = { text: string; english: string };

export type ForecastText = {
  headline: string;
  overview: string;
  focusAreas: ForecastLine[];
  opportunities: ForecastLine[];
  cautions: ForecastLine[];
};

const TEXT = "timing.forecast.text";

/** The planets the per-planet vocabularies are keyed by, as the engine names them. */
export const FORECAST_PLANETS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"] as const;

const isForecastPlanet = (planet: string) => (FORECAST_PLANETS as readonly string[]).includes(planet);

const slug = (planet: string) => planet.toLowerCase();

/** `tr`, or null when the catalog has no such key. */
function lookup(tr: Translate, key: string, params?: Record<string, string>): string | null {
  const text = tr(key, params);
  return text === key ? null : text;
}

function houseTheme(house: number, tr: Translate): string | null {
  return Number.isInteger(house) && house >= 1 && house <= 12 ? lookup(tr, `strength.houseThemes.${house}`) : null;
}

function paired(texts: Array<string | null>, english: string[]): ForecastLine[] | null {
  if (texts.length !== english.length || texts.some((text) => text === null)) return null;
  return texts.map((text, index) => ({ text: text as string, english: english[index] }));
}

const asIs = (english: string[]): ForecastLine[] => english.map((line) => ({ text: line, english: line }));

/** Every piece the sentences need, or null when one cannot be worded. */
function words(parts: ForecastParts, tr: Translate) {
  const lords = [parts.mahadasha, parts.antardasha, ...(parts.pratyantar ? [parts.pratyantar] : [])];
  if (!lords.every((lord) => isForecastPlanet(lord.planet))) return null;

  const theme = (planet: string, table: "periodFocus" | "opportunities" | "cautions") =>
    lookup(tr, `${TEXT}.${table}.${slug(planet)}`);
  const lord = (entry: { planet: string; house: number }) => ({
    name: planetName(entry.planet, tr),
    focus: theme(entry.planet, "periodFocus"),
    houseTheme: houseTheme(entry.house, tr),
    house: String(entry.house),
    planet: entry.planet,
  });

  const maha = lord(parts.mahadasha);
  const antar = lord(parts.antardasha);
  const pratyantar = parts.pratyantar ? lord(parts.pratyantar) : null;
  for (const entry of [maha, antar, pratyantar]) {
    if (entry && (entry.focus === null || entry.houseTheme === null)) return null;
  }
  return { maha, antar, pratyantar, theme };
}

/**
 * The forecast's prose in the reader's language.
 *
 * `formatDate` turns the bare YYYY-MM-DD into what the sentences print; the
 * card passes a localised long date.
 */
export function forecastText(
  forecast: ForecastReading,
  tr: Translate,
  formatDate: (isoDate: string) => string,
): ForecastText {
  const english: ForecastText = {
    headline: forecast.headline,
    overview: forecast.overview,
    focusAreas: asIs(forecast.focus_areas),
    opportunities: asIs(forecast.opportunities),
    cautions: asIs(forecast.cautions),
  };
  const pieces = forecast.parts ? words(forecast.parts, tr) : null;
  if (!pieces) return english;
  const { maha, antar, pratyantar, theme } = pieces;
  const date = formatDate(forecast.target_date);

  const headline = pratyantar
    ? lookup(tr, `${TEXT}.headlineLayered`, {
        date,
        dasha: maha.name,
        antardasha: antar.name,
        pratyantar: pratyantar.name,
        pratyantarFocus: pratyantar.focus!,
        antardashaFocus: antar.focus!,
      })
    : lookup(tr, `${TEXT}.headline`, {
        date,
        dasha: maha.name,
        antardasha: antar.name,
        antardashaFocus: antar.focus!,
      });

  const overviewParts = [
    lookup(tr, `${TEXT}.overviewOpen`, { date, dashaFocus: maha.focus!, antardashaFocus: antar.focus! }),
    ...(pratyantar
      ? [
          lookup(tr, `${TEXT}.overviewLayer`, {
            pratyantar: pratyantar.name,
            pratyantarFocus: pratyantar.focus!,
            pratyantarHouseTheme: pratyantar.houseTheme!,
          }),
        ]
      : []),
    lookup(tr, `${TEXT}.overviewClose`, {
      dashaHouseTheme: maha.houseTheme!,
      antardashaHouseTheme: antar.houseTheme!,
    }),
  ];

  const focusAreas = paired(
    [
      lookup(tr, `${TEXT}.focusMahadasha`, { planet: maha.name, houseTheme: maha.houseTheme!, house: maha.house }),
      pratyantar
        ? lookup(tr, `${TEXT}.focusPratyantar`, {
            planet: pratyantar.name,
            focus: pratyantar.focus!,
            houseTheme: pratyantar.houseTheme!,
            house: pratyantar.house,
          })
        : lookup(tr, `${TEXT}.focusAntardasha`, { planet: antar.name, houseTheme: antar.houseTheme!, house: antar.house }),
    ],
    forecast.focus_areas,
  );

  /* The near-term lord first, then the mahadasha's; one line when they share a
     lord, as the engine's dedupe leaves it. */
  const advisors = [...new Set([(pratyantar ?? antar).planet, maha.planet])];
  const opportunities = paired(
    advisors.map((planet) => theme(planet, "opportunities")),
    forecast.opportunities,
  );
  const cautions = paired(
    advisors.map((planet) => theme(planet, "cautions")),
    forecast.cautions,
  );

  return {
    headline: headline ?? english.headline,
    overview: overviewParts.every((part) => part !== null) ? overviewParts.join(" ") : english.overview,
    focusAreas: focusAreas ?? english.focusAreas,
    opportunities: opportunities ?? english.opportunities,
    cautions: cautions ?? english.cautions,
  };
}

const TRANSIT_TEMPLATES: Record<ForecastAspectInsight["tone"], string> = {
  supportive: `${TEXT}.transitSupportive`,
  challenging: `${TEXT}.transitChallenging`,
  mixed: `${TEXT}.transitMixed`,
};

/**
 * A transit's interpretation in the reader's language.
 *
 * The aspect sits mid-sentence, so it is lower-cased as the engine's English
 * is -- except in German, whose nouns keep their capital.
 */
export function transitInterpretation(signal: ForecastAspectInsight, tr: Translate, language: string): string {
  const template = TRANSIT_TEMPLATES[signal.tone];
  if (!template) return signal.interpretation;
  const aspect = aspectName(signal.aspect_type, tr);
  const theme = isForecastPlanet(signal.natal_planet)
    ? lookup(tr, `${TEXT}.natalThemes.${slug(signal.natal_planet)}`)
    : lookup(tr, `${TEXT}.natalThemeFallback`);
  if (theme === null) return signal.interpretation;
  return (
    lookup(tr, template, {
      transit: planetName(signal.transit_planet, tr),
      aspect: language === "de" ? aspect : aspect.toLowerCase(),
      natal: planetName(signal.natal_planet, tr),
      theme,
    }) ?? signal.interpretation
  );
}
