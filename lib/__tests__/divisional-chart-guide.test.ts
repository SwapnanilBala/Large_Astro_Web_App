import { describe, expect, it } from "vitest";
import { ALL_DIVISIONAL_CHARTS } from "../engines/divisional-engine";
import {
  IMPORTANT_DIVISIONAL_CHARTS,
  IMPORTANT_DIVISION_NUMBERS,
  getImportantDivisionalChartGuide,
} from "../divisional-chart-guide";

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
      expect(chart.focus.length).toBeGreaterThan(5);
      expect(chart.summary.length).toBeGreaterThan(40);
      expect(chart.readWith.length).toBeGreaterThan(20);
      expect(chart.clientQuestion.endsWith("?")).toBe(true);
      expect(chart.sensitivityNote.length).toBeGreaterThan(20);
      expect(getImportantDivisionalChartGuide(chart.division)).toBe(chart);
    }
  });

  it("marks D60 as a rectified-time layer", () => {
    expect(getImportantDivisionalChartGuide(60)?.sensitivity).toBe(
      "rectified-time",
    );
  });
});
