/**
 * The chart's one-line summary and a finding's rarity line, printed in the
 * reader's language by lib/chart-labels.ts from the facts the engine sends.
 *
 * The English rebuilt from the catalogs has to be the engine's own sentence,
 * word for word: the engine's English is what is stored and what the app
 * reads, and a page printing something else in English would be a silent
 * fork. So both are run over many charts and every rarity band.
 */
import { describe, expect, it } from "vitest";
import { generateRules } from "@/lib/engines/rule-engine";
import { rarityLabel } from "@/lib/rules/rarity";
import { chartSummaryText, rarityText } from "@/lib/chart-labels";
import type { HousePlacement, PlanetPosition } from "@/lib/engines/swiss-ephemeris-engine";
import en from "@/messages/en.json";
import enFullReading from "@/messages/en.full-reading.json";
import enMobile from "@/messages/en.mobile-insights.json";
import hi from "@/messages/hi.json";
import de from "@/messages/de.json";

type Tree = { [key: string]: string | Tree };

function translator(...trees: Tree[]) {
  return (key: string, params?: Record<string, string>) => {
    for (const tree of trees) {
      let node: string | Tree | undefined = tree;
      for (const part of key.split(".")) node = typeof node === "object" ? node[part] : undefined;
      if (typeof node === "string") {
        return node.replace(/\{(\w+)\}/g, (whole, name: string) => params?.[name] ?? whole);
      }
    }
    return key;
  };
}

const english = translator(en as Tree, enFullReading as Tree, enMobile as Tree);
const hindi = translator(hi as Tree);
const german = translator(de as Tree);

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];
const NAMES = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Rahu", "Ketu"];

/* A spread of charts: each planet stepped through the signs at its own rate,
   so the ascendants, elements and exalted/own-sign planets all vary. */
function chart(seed: number): { asc: string; planets: PlanetPosition[]; houses: HousePlacement[] } {
  const ascIndex = seed % 12;
  const planets = NAMES.map((name, i) => {
    const signIndex = (seed * (i + 2) + i * 5 + Math.floor(seed / 7)) % 12;
    const house = ((signIndex - ascIndex + 12) % 12) + 1;
    return { name, longitude: signIndex * 30 + 10, sign: SIGNS[signIndex], degree_in_sign: 10, house };
  });
  const houses = Array.from({ length: 12 }, (_, h) => ({
    house_number: h + 1,
    sign: SIGNS[(ascIndex + h) % 12],
    planets: planets.filter((p) => p.house === h + 1).map((p) => p.name),
  }));
  return { asc: SIGNS[ascIndex], planets, houses };
}

const CHARTS = Array.from({ length: 240 }, (_, seed) => chart(seed));

describe("the chart summary in the reader's language", () => {
  it("rebuilds the engine's English word for word, on the desktop and the phone", () => {
    let withStrongest = 0;
    for (const { asc, planets, houses } of CHARTS) {
      const { summary, summaryFacts } = generateRules(asc, planets, houses);
      if (summaryFacts.strongest.length) withStrongest++;
      expect(chartSummaryText(summaryFacts, "", english, "insights.page.hero")).toBe(summary);
      expect(chartSummaryText(summaryFacts, "", english, "mobileInsights")).toBe(summary);
    }
    // The sweep has to reach the "Strongest support" clause, or half the
    // sentence would go untested.
    expect(withStrongest).toBeGreaterThan(20);
  });

  it("prints it with no English left in Hindi, and in German with du", () => {
    for (const { asc, planets, houses } of CHARTS.slice(0, 60)) {
      const { summary, summaryFacts } = generateRules(asc, planets, houses);
      const hiText = chartSummaryText(summaryFacts, summary, hindi, "insights.page.hero");
      expect(hiText).not.toMatch(/[A-Za-z]/);
      expect(chartSummaryText(summaryFacts, summary, hindi, "mobileInsights")).toBe(hiText);
      expect(chartSummaryText(summaryFacts, summary, german, "insights.page.hero")).toMatch(/^Kern deines Horoskops/);
    }
  });

  it("keeps the engine's English when the payload predates the facts", () => {
    expect(chartSummaryText(undefined, "Chart core: as stored.", hindi, "insights.page.hero")).toBe(
      "Chart core: as stored.",
    );
  });
});

describe("a finding's rarity line in the reader's language", () => {
  const rates = [1, 0.996, 0.42, 0.083, 0.0149, 0.006, 0.0021, 0.0004, 0.00001];

  it("matches the engine's English in every band, on both trees", () => {
    for (const fire_rate of rates) {
      for (const low_confidence of [false, true]) {
        const rarity = {
          fire_rate,
          low_confidence,
          score: 1 - fire_rate,
          band: "common" as const,
          observed_count: 100,
          sample_size: 50000,
          dataset_version: "test",
        };
        const label = rarityLabel(rarity);
        expect(rarityText(rarity, "", english, "fullReading")).toBe(label);
        expect(rarityText(rarity, "", english, "mobileInsights")).toBe(label);
        const hiText = rarityText(rarity, label, hindi, "fullReading");
        expect(hiText).not.toMatch(/[A-Za-z]/);
        expect(rarityText(rarity, label, hindi, "mobileInsights")).toBe(hiText);
      }
    }
  });

  it("names the number in the reader's words", () => {
    const rarity = { fire_rate: 0.083, low_confidence: false };
    expect(rarityText(rarity, "", hindi, "fullReading")).toBe("लगभग हर 100 में से 8 कुंडलियों में मिलता है");
    expect(rarityText(rarity, "", german, "fullReading")).toBe("Kommt in etwa 8 von 100 Horoskopen vor");
  });
});
