import { describe, expect, it } from "vitest";
import { ALL_DIVISIONAL_CHARTS } from "../engines/divisional-engine";
import {
  IMPORTANT_DIVISIONAL_CHARTS,
  IMPORTANT_DIVISION_NUMBERS,
  divisionalGuideKey,
  getImportantDivisionalChartGuide,
  type DivisionalGuideField,
} from "../divisional-chart-guide";
import divisionalMessages from "@/messages/en.divisional.json";

/*
 * The guidance prose moved into the divisional namespace, so these checks
 * follow it there -- through divisionalGuideKey, the builder the components
 * use, rather than by reading the JSON at a hand-written path.
 *
 * Worth asserting rather than trusting: the static key scan in
 * i18n-mobile-coverage only sees keys written as plain strings, and every key
 * here is assembled from a division at runtime. A varga missing from the
 * catalog would reach the screen as a literal "divisional.guide.d9.focus".
 */
function guideText(division: number, field: DivisionalGuideField): string {
  const value = divisionalGuideKey(division, field)
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[part]
          : undefined,
      divisionalMessages as unknown,
    );
  expect(typeof value).toBe("string");
  return value as string;
}

describe("divisional chart client guide", () => {
  it("keeps a deliberate ten-chart client-facing hierarchy", () => {
    expect(IMPORTANT_DIVISIONAL_CHARTS).toHaveLength(10);
    expect(IMPORTANT_DIVISION_NUMBERS).toEqual([
      1, 2, 4, 7, 9, 10, 12, 24, 30, 60,
    ]);
    expect(new Set(IMPORTANT_DIVISION_NUMBERS).size).toBe(10);
  });

  it("only promotes charts supported by the calculation engine", () => {
    for (const division of IMPORTANT_DIVISION_NUMBERS) {
      expect(ALL_DIVISIONAL_CHARTS).toContain(division);
    }
  });

  it("gives each key chart complete client guidance", () => {
    for (const chart of IMPORTANT_DIVISIONAL_CHARTS) {
      expect(chart.label).toBe(`D${chart.division}`);
      expect(guideText(chart.division, "name").length).toBeGreaterThan(2);
      expect(guideText(chart.division, "focus").length).toBeGreaterThan(5);
      expect(guideText(chart.division, "summary").length).toBeGreaterThan(40);
      expect(guideText(chart.division, "readWith").length).toBeGreaterThan(20);
      expect(guideText(chart.division, "clientQuestion").endsWith("?")).toBe(true);
      expect(
        guideText(chart.division, "sensitivityNote").length,
      ).toBeGreaterThan(20);
      expect(guideText(chart.division, "mappingMethod").length).toBeGreaterThan(20);
      expect(getImportantDivisionalChartGuide(chart.division)).toBe(chart);
    }
  });

  it("marks D60 as a rectified-time layer", () => {
    expect(getImportantDivisionalChartGuide(60)?.sensitivity).toBe(
      "rectified-time",
    );
  });
});
