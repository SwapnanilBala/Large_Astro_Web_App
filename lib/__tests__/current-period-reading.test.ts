import { describe, expect, it } from "vitest";
import {
  currentPeriodCacheKey,
  currentPeriodChart,
  currentPeriodLanguage,
  renderCurrentPeriodFacts,
  type CurrentPeriodFacts,
} from "../current-period-reading";
import { COMMENTARY_LANGUAGES } from "../varga-commentary";

/*
 * The current-period reading is cached by its facts and shared by every
 * visitor whose facts match, so the key has to cover everything the prompt is
 * given: two requests that would be written differently must never share an
 * entry. The placements arrive from the browser, which is why they matter.
 */

const FACTS: CurrentPeriodFacts = {
  stack: [
    { lord: "Saturn", startDate: "2019-03-01", endDate: "2038-03-01", sign: "Capricorn", house: 10 },
    { lord: "Mercury", startDate: "2025-01-10", endDate: "2027-09-20", sign: "Virgo", house: 6 },
  ],
  nakshatra: { name: "Rohini", lord: "Moon", pada: 2 },
  progressPercent: 40,
};

const withStep = (index: number, change: Partial<CurrentPeriodFacts["stack"][number]>): CurrentPeriodFacts => ({
  ...FACTS,
  stack: FACTS.stack.map((step, at) => (at === index ? { ...step, ...change } : step)),
});

describe("the current-period cache key", () => {
  it("is the same for the same facts", () => {
    expect(currentPeriodCacheKey(FACTS)).toBe(currentPeriodCacheKey(structuredClone(FACTS)));
  });

  it("follows the phase band rather than the day's percentage", () => {
    expect(currentPeriodCacheKey({ ...FACTS, progressPercent: 41 })).toBe(currentPeriodCacheKey(FACTS));
    expect(currentPeriodCacheKey({ ...FACTS, progressPercent: 70 })).not.toBe(currentPeriodCacheKey(FACTS));
  });

  it("separates the same stack with another sign or house, which the prompt is given", () => {
    const moved = [withStep(0, { sign: "Aries" }), withStep(1, { house: 7 })];
    for (const other of moved) {
      expect(renderCurrentPeriodFacts(other)).not.toBe(renderCurrentPeriodFacts(FACTS));
      expect(currentPeriodCacheKey(other)).not.toBe(currentPeriodCacheKey(FACTS));
    }
  });

  it("separates a stack sent without placements from one sent with them", () => {
    const bare: CurrentPeriodFacts = {
      ...FACTS,
      stack: FACTS.stack.map((step) => ({ lord: step.lord, startDate: step.startDate, endDate: step.endDate })),
    };
    expect(currentPeriodCacheKey(bare)).not.toBe(currentPeriodCacheKey(FACTS));
  });

  it("separates the same facts in two languages, which the prompt is given", () => {
    expect(renderCurrentPeriodFacts(FACTS, "hi")).not.toBe(renderCurrentPeriodFacts(FACTS, "en"));
    expect(currentPeriodCacheKey(FACTS, "hi")).not.toBe(currentPeriodCacheKey(FACTS, "en"));
    expect(currentPeriodCacheKey(FACTS, "hi")).not.toBe(currentPeriodCacheKey(FACTS, "bn"));
    expect(currentPeriodCacheKey(FACTS)).toBe(currentPeriodCacheKey(FACTS, "en"));
  });
});

/*
 * The reading is written straight in the reader's language from English
 * facts, as the classical notes are, and the language is said last: handed
 * English facts and nothing more, the model answers in English.
 */
describe("the current-period reading's language", () => {
  it("is asked for last, with the reminder the classical notes give", () => {
    const prompt = renderCurrentPeriodFacts(FACTS, "hi");
    expect(prompt.startsWith(renderCurrentPeriodFacts(FACTS, "en").replace(/\n\nWrite the paragraph in English\.$/, ""))).toBe(true);
    expect(prompt.endsWith(
      "\n\nWrite the paragraph in Hindi. Write every sentence in Hindi, although the facts above are in English.",
    )).toBe(true);
  });

  it("asks a German reading to say du", () => {
    expect(renderCurrentPeriodFacts(FACTS, "de")).toContain('Write the paragraph in German, addressing the reader informally as "du".');
  });

  it("says English plainly, without the reminder", () => {
    const prompt = renderCurrentPeriodFacts(FACTS, "en");
    expect(prompt.endsWith("\n\nWrite the paragraph in English.")).toBe(true);
    expect(prompt).not.toContain("Write every sentence");
  });

  it("keeps every language the commentary routes write in", () => {
    for (const code of Object.keys(COMMENTARY_LANGUAGES)) {
      expect(currentPeriodLanguage(code)).toBe(code);
    }
  });

  it.each(["constructor", "__proto__", "toString", "xx", "", 7, null, undefined])("reads %j as English", (code) => {
    expect(currentPeriodLanguage(code)).toBe("en");
    if (typeof code !== "string") return;
    expect(renderCurrentPeriodFacts(FACTS, code)).toBe(renderCurrentPeriodFacts(FACTS, "en"));
    expect(currentPeriodCacheKey(FACTS, code)).toBe(currentPeriodCacheKey(FACTS, "en"));
  });
});

/*
 * The panel measures the Antardasha, so the phase is the Antardasha's however
 * deep the stack. It used to be labelled with the innermost level, which gave
 * a Pratyantardasha 60% through the Antardasha's "well past its midpoint".
 */
describe("the current-period phase", () => {
  const THREE_LEVELS: CurrentPeriodFacts = {
    ...FACTS,
    stack: [...FACTS.stack, { lord: "Mars", startDate: "2026-09-01", endDate: "2026-11-04", sign: "Aries", house: 1 }],
    progressPercent: 69,
  };

  it("describes the Antardasha when the stack runs to a Pratyantardasha", () => {
    const prompt = renderCurrentPeriodFacts(THREE_LEVELS);
    expect(prompt).toContain("Pratyantardasha: Mars");
    expect(prompt).toContain("\n\nThe Antardasha is well past its midpoint.\n\n");
    expect(prompt).not.toMatch(/The Pratyantardasha (is|has)/);
  });

  it("describes the Antardasha when it is the innermost level, as before", () => {
    expect(renderCurrentPeriodFacts(FACTS)).toContain("\n\nThe Antardasha is around its midpoint.\n\n");
  });
});

/*
 * With the chart, the paragraph is written from the facts the period reading
 * uses: rulerships, how each level stands to the one above, and the houses
 * several lords share. A chart is all or nothing.
 */
const PLANETS = [
  { name: "Sun", sign: "Leo" },
  { name: "Moon", sign: "Taurus" },
  { name: "Mars", sign: "Aries" },
  { name: "Mercury", sign: "Virgo" },
  { name: "Jupiter", sign: "Pisces" },
  { name: "Venus", sign: "Cancer" },
  { name: "Saturn", sign: "Capricorn" },
  { name: "Rahu", sign: "Gemini" },
  { name: "Ketu", sign: "Sagittarius" },
];

describe("the current-period chart", () => {
  it("is built only when the rising sign and all nine planets are known", () => {
    expect(currentPeriodChart("Aries", PLANETS)?.planets).toHaveLength(9);
    expect(currentPeriodChart("Aries", PLANETS.slice(1))).toBeUndefined();
    expect(currentPeriodChart("Aries", [...PLANETS.slice(1), { name: "Sun", sign: "Leo-ish" }])).toBeUndefined();
    expect(currentPeriodChart("Atlantis", PLANETS)).toBeUndefined();
    expect(currentPeriodChart(undefined, PLANETS)).toBeUndefined();
  });

  it("gives the prompt the chart's facts in place of each row's house", () => {
    const withChart: CurrentPeriodFacts = { ...FACTS, chart: currentPeriodChart("Aries", PLANETS) };
    const prompt = renderCurrentPeriodFacts(withChart);
    expect(prompt).toContain("The chart rises in Aries");
    expect(prompt).toContain("What makes these periods themselves:");
    expect(prompt).toContain("How each level's planet stands to the one above it:");
    expect(prompt).not.toContain(", house 10");
    expect(renderCurrentPeriodFacts(FACTS)).toContain(", house 10");
  });

  it("separates the same stack with and without a chart, or with another chart", () => {
    const withChart: CurrentPeriodFacts = { ...FACTS, chart: currentPeriodChart("Aries", PLANETS) };
    const otherRising: CurrentPeriodFacts = { ...FACTS, chart: currentPeriodChart("Taurus", PLANETS) };
    expect(currentPeriodCacheKey(withChart)).not.toBe(currentPeriodCacheKey(FACTS));
    expect(currentPeriodCacheKey(otherRising)).not.toBe(currentPeriodCacheKey(withChart));
  });
});
