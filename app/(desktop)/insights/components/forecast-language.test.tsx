/**
 * The date forecast and the weekly energy, rendered in Hindi and German.
 *
 * Both engines write English; the forecast card and the weekly panel say the
 * same things through the catalog (lib/forecast-text.ts,
 * lib/weekly-energy-text.ts). These render the real components against real
 * engine output, with the language's catalog plus the staged fragment as the
 * provider's messages, and check that none of the engine's English is left
 * on screen -- in Hindi, no Latin letter at all.
 */
import { render, waitFor } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildForecast } from "@/lib/engines/chart-service";
import type { BirthDetailsInput } from "@/lib/engines/compatibility-service";
import { computeWeeklyEnergy } from "@/lib/engines/weekly-energy-engine";
import { getChartPayload, readChartParams } from "@/lib/chart-params";
import type { ForecastReading, WeeklyEnergyResponse } from "@/lib/astro-types";
import { LanguageProvider, type MessageTree } from "@/lib/i18n-context";
import hi from "@/messages/hi.json";
import de from "@/messages/de.json";
import FutureForecastPanel from "./future-forecast-panel";
import WeeklyEnergyPanel from "./weekly-energy-panel";

type Tree = Record<string, unknown>;

function merge(target: Tree, source: Tree): Tree {
  for (const [key, value] of Object.entries(source)) {
    target[key] =
      value && typeof value === "object" ? merge({ ...((target[key] as Tree | undefined) ?? {}) }, value as Tree) : value;
  }
  return target;
}

/* The catalog as it will read once the fragment is folded. */
const FRAGMENT_PATH = join(process.cwd(), "messages", "fragments", "forecast-text.json");
const FRAGMENT: Tree = existsSync(FRAGMENT_PATH) ? JSON.parse(readFileSync(FRAGMENT_PATH, "utf8")) : {};
const catalog = (lang: "hi" | "de", base: Tree): MessageTree =>
  merge(merge({}, base), (FRAGMENT[lang] as Tree | undefined) ?? {}) as MessageTree;

const BIRTH: BirthDetailsInput = {
  name: "Test",
  birth_date: "1990-05-15",
  birth_time: "10:30",
  timezone_offset_minutes: 330,
  latitude: 12.9716,
  longitude: 77.5946,
  country: "India",
  state: "Karnataka",
  city: "Bengaluru",
  town: "",
  time_zone_id: "Asia/Kolkata",
  engine_id: "lahiri_classic",
} as BirthDetailsInput;

const CHART = {
  name: "Chart A",
  birthDate: "1990-05-15",
  birthTime: "10:30",
  timezoneOffsetMinutes: "330",
  latitude: "12.9716",
  longitude: "77.5946",
};

const forecasts: ForecastReading[] = [];
const weeks: WeeklyEnergyResponse[] = [];

/* Both panels ask their routes; here the routes answer from the engines. */
const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
  const url = new URL(String(input), "http://localhost");
  if (url.pathname === "/api/chart/forecast") {
    const forecast = buildForecast(BIRTH, url.searchParams.get("target_date")!) as unknown as ForecastReading;
    forecasts.push(forecast);
    return { ok: true, status: 200, json: async () => forecast } as Response;
  }
  const payload = getChartPayload(
    readChartParams({ ...CHART, country: "X", state: "Y", city: "Z", engineId: "lahiri_classic", birthTimeAccuracy: "exact" }),
  );
  const week = {
    ...computeWeeklyEnergy({
      weekStart: url.searchParams.get("week_start")!,
      latitude: Number(CHART.latitude),
      longitude: Number(CHART.longitude),
      timezoneOffsetMinutes: Number(CHART.timezoneOffsetMinutes),
      engineId: "lahiri_classic",
      natalPlanets: payload.chart.planets,
      ascendantSign: payload.chart.ascendant.sign,
    }),
    generated_at_utc: new Date().toISOString(),
  };
  weeks.push(week);
  return { ok: true, status: 200, json: async () => week } as Response;
});

/* The weekly panel waits to be scrolled to. */
class SeenAtOnce {
  constructor(private callback: IntersectionObserverCallback) {}
  observe() {
    this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
}

beforeEach(() => {
  forecasts.length = 0;
  weeks.length = 0;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("IntersectionObserver", SeenAtOnce);
  /* The provider tries import() for the language file, which vitest cannot do;
     the catalog goes in as the baseline instead. */
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

function renderIn(lang: "hi" | "de", base: Tree, panel: React.ReactNode) {
  window.localStorage.setItem("astro_language", lang);
  return render(<LanguageProvider baseMessages={catalog(lang, base)}>{panel}</LanguageProvider>);
}

/* Words the engines' English is made of, and German is not. */
const ENGLISH_WORDS = /\b(the|and|with|falls|keeps|runs|bringing|supports|puts|while|toward|rather|natal|house|week|day|peak|average)\b/i;

const LANGUAGES = [
  ["hi", hi as Tree],
  ["de", de as Tree],
] as const;

describe.each(LANGUAGES)("the date forecast in %s", (lang, base) => {
  it("leaves none of the engine's English on the card", async () => {
    const { container } = renderIn(lang, base, <FutureForecastPanel queryString="name=Test&birthDate=1990-05-15" />);
    await waitFor(() => expect(container.querySelector(".forecast-card")).not.toBeNull());
    const forecast = forecasts.at(-1)!;
    expect(forecast.parts).toBeDefined();

    const printed = [
      ".forecast-card-header h3",
      ".forecast-overview",
      ".domain-reading-list li",
      ".forecast-event p",
    ].flatMap((selector) => [...container.querySelectorAll(selector)].map((node) => node.textContent ?? ""));
    expect(printed.length).toBeGreaterThan(4);

    for (const line of printed) {
      if (lang === "hi") expect(line).not.toMatch(/[A-Za-z]/);
      else expect(line).not.toMatch(ENGLISH_WORDS);
    }
    const english = [
      forecast.headline,
      forecast.overview,
      ...forecast.focus_areas,
      ...forecast.opportunities,
      ...forecast.cautions,
      ...[...forecast.supportive_transits, ...forecast.challenging_transits].map((signal) => signal.interpretation.slice(0, 40)),
    ];
    const text = container.textContent ?? "";
    for (const sentence of english) expect(text).not.toContain(sentence);
  });
});

describe.each(LANGUAGES)("the weekly energy in %s", (lang, base) => {
  it("leaves none of the engine's English on the panel or in the chart's text", async () => {
    const { container } = renderIn(lang, base, <WeeklyEnergyPanel queryString="name=Test&birthDate=1990-05-15" />);
    await waitFor(() => expect(container.querySelector("svg desc")).not.toBeNull());
    const week = weeks.at(-1)!;
    expect(week.headline.noun_kind).toBeDefined();

    const text = container.textContent ?? "";
    const english = [
      week.headline.title,
      week.headline.paragraph,
      week.chart_alt_text.slice(0, 30),
      ...week.cards.flatMap((card) => [card.title, card.body]),
      ...(week.peak.is_significant ? [week.peak.label] : []),
    ];
    for (const phrase of english) expect(text).not.toContain(phrase);

    const desc = container.querySelector("svg desc")!.textContent ?? "";
    const cards = [...container.querySelectorAll("article")].map((card) => card.textContent ?? "");
    expect(cards).toHaveLength(week.cards.length);
    const headline = [...container.querySelectorAll("h3")].map((node) => node.textContent ?? "");
    for (const line of [desc, ...cards, ...headline]) {
      if (lang === "hi") expect(line).not.toMatch(/[A-Za-z]/);
      else expect(line).not.toMatch(ENGLISH_WORDS);
    }
  });
});
