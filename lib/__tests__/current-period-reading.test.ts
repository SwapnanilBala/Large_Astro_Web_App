import { describe, expect, it } from "vitest";
import {
  currentPeriodCacheKey,
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
