/**
 * The yearly chart's year summary in the reader's language.
 *
 * The engine writes yearSummary in English and keeps doing so (the Android app
 * and the cache read it). The panel words the same sentences again from the
 * result's fields, so these tests hold it to two things: in English it says
 * exactly what the engine says, for real charts under several engines and
 * house systems, and in German and Hindi none of the engine's English is left.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BirthDetailsInput } from "@/lib/engines/compatibility-service";
import { computeVarshaphal, type VarshaphalResult } from "@/lib/engines/varshaphal-engine";
import { LanguageProvider, type MessageTree } from "@/lib/i18n-context";
import en from "@/messages/en.json";
import enTiming from "@/messages/en.timing.json";
import enStrength from "@/messages/en.strength.json";
import de from "@/messages/de.json";
import hi from "@/messages/hi.json";
import { HOUSE_THEMES } from "@/lib/engines/varshaphal-words";
import VarshaphalPanel, { profectionThemeKey, yearSummaryText } from "./varshaphal-panel";

type Tree = Record<string, unknown>;

function merge(base: Tree, extra: Tree): Tree {
  const out: Tree = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    out[key] =
      value && typeof value === "object" && out[key] && typeof out[key] === "object"
        ? merge(out[key] as Tree, value as Tree)
        : value;
  }
  return out;
}

/* A catalog with anything still staged for the fold merged in: a visitor who
   chose that language, before the fold and after it. */
const FRAGMENT_DIR = join(process.cwd(), "messages", "fragments");
const FRAGMENTS: Tree[] = (existsSync(FRAGMENT_DIR) ? readdirSync(FRAGMENT_DIR) : [])
  .filter((file) => file.endsWith(".json"))
  .map((file) => JSON.parse(readFileSync(join(FRAGMENT_DIR, file), "utf8")) as Tree);
const withStaged = (lang: string, catalog: Tree): Tree =>
  FRAGMENTS.reduce<Tree>((tree, fragment) => merge(tree, (fragment[lang] as Tree) ?? {}), catalog);

const ENGLISH = [en as Tree, enTiming as Tree, enStrength as Tree].reduce<Tree>(merge, {});
const CATALOGS: Record<string, Tree> = {
  en: ENGLISH,
  de: withStaged("de", de as Tree),
  hi: withStaged("hi", hi as Tree),
};

const lookup = (tree: Tree, key: string): unknown =>
  key.split(".").reduce<unknown>((node, part) => (node && typeof node === "object" ? (node as Tree)[part] : undefined), tree);

/* What `t` does: the catalog's text with its blanks filled, or the key. */
const translator = (tree: Tree) => (key: string, params?: Record<string, string>) => {
  const text = lookup(tree, key);
  if (typeof text !== "string") return key;
  return Object.entries(params ?? {}).reduce((out, [name, value]) => out.split(`{${name}}`).join(value), text);
};

const BENGALURU: BirthDetailsInput = {
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
};

const NEW_YORK: BirthDetailsInput = {
  ...BENGALURU,
  birth_date: "1984-11-02",
  birth_time: "23:10",
  timezone_offset_minutes: -300,
  latitude: 40.7128,
  longitude: -74.006,
  country: "United States",
  state: "New York",
  city: "New York",
  time_zone_id: "America/New_York",
};

/* Inside the Arctic Circle, where Placidus falls back to Porphyry. */
const TROMSO: BirthDetailsInput = {
  ...BENGALURU,
  birth_date: "1990-06-15",
  birth_time: "14:30",
  timezone_offset_minutes: 120,
  latitude: 69.6492,
  longitude: 18.9553,
  country: "Norway",
  state: "",
  city: "Tromso",
  time_zone_id: "Europe/Oslo",
};

describe("yearSummaryText", () => {
  /* The panel lower-cases the profection themes inside a sentence, as its
     other sentences do ("Self" reads "self"); otherwise word for word. */
  const sameWords = (a: string, b: string) => expect(a.toLowerCase()).toBe(b.toLowerCase());

  const cases = [
    ...[2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035].map(
      (year) => [BENGALURU, "lahiri_classic", year] as const,
    ),
    [BENGALURU, "lahiri_placidus", 2026] as const,
    [NEW_YORK, "lahiri_classic", 2026] as const,
    [NEW_YORK, "lahiri_placidus", 2027] as const,
    [TROMSO, "lahiri_placidus", 2026] as const,
  ];

  it.each(cases)("says in English what the engine says (%#)", (birth, engine_id, year) => {
    const data = computeVarshaphal({ ...birth, engine_id }, year);
    const text = yearSummaryText(data, translator(ENGLISH), "en");
    sameWords(text.ascendantComparison, data.yearSummary.ascendantComparison);
    sameWords(text.emotionalTone, data.yearSummary.emotionalTone);
    expect(text.focusAreas).toHaveLength(data.yearSummary.focusAreas.length);
    text.focusAreas.forEach((line, index) => sameWords(line, data.yearSummary.focusAreas[index]));
    expect(text.strongInfluences).toEqual(data.yearSummary.strongInfluences);
    expect(text.yearLordInterpretation).toBe(data.yearSummary.yearLordInterpretation);
  });

  it("covers both ascendant sentences and the activated-planet line across those charts", () => {
    const results = cases.map(([birth, engine_id, year]) => computeVarshaphal({ ...birth, engine_id }, year));
    expect(results.some((data) => data.yearSummary.ascendantComparison.includes("matches"))).toBe(true);
    expect(results.some((data) => data.yearSummary.ascendantComparison.includes("contrasting"))).toBe(true);
    expect(results.some((data) => data.yearSummary.focusAreas.length === 3)).toBe(true);
  });

  it("falls back to the engine's English when the result lacks the fields", () => {
    const data = computeVarshaphal({ ...BENGALURU, engine_id: "lahiri_classic" }, 2026);
    const bare = {
      ...data,
      returnChart: undefined,
      muntha: undefined,
      varshesh: undefined,
      profection: undefined,
    } as unknown as VarshaphalResult;
    expect(yearSummaryText(bare, translator(CATALOGS.hi), "hi")).toEqual(data.yearSummary);
  });

  it("falls back to the engine's English for words the catalog lacks", () => {
    const data = computeVarshaphal({ ...BENGALURU, engine_id: "lahiri_classic" }, 2026);
    expect(yearSummaryText(data, (key) => key, "hi")).toEqual(data.yearSummary);
  });
});

/* ---------------------------------------------------------------------- */

/* Words of the engine's English sentences and tables that no German or
   Hindi sentence should still carry. Mars, Venus, Jupiter, Saturn, Rahu,
   Ketu and Muntha are the same words in German, and so is "emotional", so
   they are not here. */
const ENGLISH_LEFTOVERS =
  /\b(the|of|and|year|house|ascendant|solar return|emotionally|tone|natal|angular|profection|activates|emphasizing|draws attention|Sun|Moon|Mercury|Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces|self|identity|finances|communication|home|creativity|health|partnerships|transformation|career|friends|spirituality)\b/i;

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

/* The provider cannot import() a language file under vitest, so the catalog
   goes in as the baseline, and the stored choice sets the language the panel
   reads (German keeps its nouns capitalised). */
async function renderPanel(lang: "de" | "hi", data: VarshaphalResult) {
  window.localStorage.setItem("astro_language", lang);
  vi.spyOn(console, "error").mockImplementation(() => {});
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => data } as Response);
  const view = render(
    <LanguageProvider baseMessages={CATALOGS[lang] as MessageTree}>
      <VarshaphalPanel queryString="name=Test&birth_date=1990-05-15" birthDate="1990-05-15" />
    </LanguageProvider>,
  );
  await waitFor(() => expect(view.container.querySelector("#annual-compass-title")).not.toBeNull());
  return view.container;
}

/* Every paragraph that prints a year-summary sentence. */
function summaryParagraphs(container: HTMLElement, lang: string): string[] {
  const seasonsTitle = lookup(CATALOGS[lang], "timing.varshaphal.seasons.title") as string;
  const seasons = screen.getByRole("heading", { name: seasonsTitle }).parentElement!;
  const paragraphs = [
    ...container.querySelectorAll("section[aria-labelledby='annual-compass-title'] p"),
    ...container.querySelectorAll("section[aria-labelledby='year-in-focus-title'] p"),
    ...seasons.querySelectorAll("article > p"),
  ];
  /* The closing interpretation: "{planet} as Year Lord:" and the theme. */
  const asYearLord = container.querySelectorAll("p > strong");
  paragraphs.push(asYearLord[asYearLord.length - 1].parentElement!);
  return paragraphs.map((paragraph) => paragraph.textContent ?? "");
}

describe("the Varshaphal panel's year summary", () => {
  const data = computeVarshaphal({ ...BENGALURU, engine_id: "lahiri_classic" }, 2026);
  const engineSentences = [
    data.yearSummary.ascendantComparison,
    data.yearSummary.emotionalTone,
    data.yearSummary.yearLordInterpretation,
    ...data.yearSummary.focusAreas,
    ...data.yearSummary.strongInfluences,
  ];

  it.each(["de", "hi"] as const)("prints in %s with no English left", async (lang) => {
    const container = await renderPanel(lang, data);
    const paragraphs = summaryParagraphs(container, lang);
    /* Hero, three focus paragraphs (two with the summary), four seasons, the interpretation. */
    expect(paragraphs.length).toBeGreaterThanOrEqual(9);

    for (const sentence of engineSentences) {
      expect(container.textContent, sentence).not.toContain(sentence);
    }
    for (const paragraph of paragraphs) {
      expect(paragraph, paragraph).not.toMatch(ENGLISH_LEFTOVERS);
      if (lang === "hi") expect(paragraph, paragraph).not.toMatch(/[A-Za-z]/);
    }

    const tr = translator(CATALOGS[lang]);
    const yearLordTheme = tr(`timing.varshaphal.summary.yearLordThemes.${data.varshesh.planet.toLowerCase()}`);
    expect(paragraphs[0]).toBe(yearLordTheme);
    const moon = data.returnChart.planets.find((planet) => planet.name === "Moon")!;
    const tone = tr(`timing.varshaphal.summary.moonTones.${moon.sign.toLowerCase()}`);
    expect(paragraphs.some((paragraph) => paragraph.includes(tone))).toBe(true);
    /* The seasons lead with the Muntha's line, its themes in the reader's
       words: lower case in Hindi's sense (no case), capitalised in German. */
    const themes = HOUSE_THEMES[data.muntha.house]
      .map((theme) => tr(profectionThemeKey(theme)))
      .join(tr("timing.varshaphal.summary.listSeparator"));
    const munthaLine = tr("timing.varshaphal.summary.munthaFocus", {
      sign: tr(`zodiacSigns.${data.muntha.sign.toLowerCase()}`),
      house: String(data.muntha.house),
      themes,
    });
    expect(paragraphs).toContain(munthaLine);
    expect(munthaLine).not.toContain("{");
  });
});
