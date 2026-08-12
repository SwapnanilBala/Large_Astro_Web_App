import { describe, expect, it } from "vitest";
import {
  computeDivisionalChart,
  computeMultipleDivisionalCharts,
} from "../engines/divisional-engine";
import type { PlanetPosition } from "../engines/swiss-ephemeris-engine";

function planet(sign: string, degreeInSign: number, name = "Sun"): PlanetPosition {
  return {
    name,
    longitude: degreeInSign,
    sign,
    degree_in_sign: degreeInSign,
    house: 1,
  };
}

function signsFor(
  division: number,
  sign: string,
  degrees: number[]
): string[] {
  return computeDivisionalChart(
    degrees.map((degree, index) => planet(sign, degree, `P${index}`)),
    division
  ).map((position) => position.divisional_sign);
}

describe("divisional-engine", () => {
  it("keeps natal signs unchanged in D1", () => {
    const positions = computeDivisionalChart(
      [planet("Aries", 4), planet("Scorpio", 28, "Moon")],
      1
    );

    expect(positions.map((position) => position.divisional_sign)).toEqual([
      "Aries",
      "Scorpio",
    ]);
  });

  it("maps D4 quarters to the 1st, 4th, 7th, and 10th signs", () => {
    expect(signsFor(4, "Taurus", [1, 8, 16, 24])).toEqual([
      "Taurus",
      "Leo",
      "Scorpio",
      "Aquarius",
    ]);
  });

  it("uses the extended odd/even Panchamsa sequence for D5", () => {
    expect(signsFor(5, "Aries", [1, 7, 13, 19, 25])).toEqual([
      "Aries",
      "Aquarius",
      "Sagittarius",
      "Gemini",
      "Libra",
    ]);
    expect(signsFor(5, "Taurus", [1, 7, 13, 19, 25])).toEqual([
      "Taurus",
      "Virgo",
      "Pisces",
      "Capricorn",
      "Scorpio",
    ]);
  });

  it("starts D6 from Aries for odd signs and Libra for even signs", () => {
    expect(signsFor(6, "Aries", [1, 6, 11, 16, 21, 26])).toEqual([
      "Aries",
      "Taurus",
      "Gemini",
      "Cancer",
      "Leo",
      "Virgo",
    ]);
    expect(signsFor(6, "Taurus", [1, 6, 11, 16, 21, 26])).toEqual([
      "Libra",
      "Scorpio",
      "Sagittarius",
      "Capricorn",
      "Aquarius",
      "Pisces",
    ]);
  });

  it("uses modality starts for the extended D8 chart", () => {
    expect(signsFor(8, "Aries", [1, 4])).toEqual(["Aries", "Taurus"]);
    expect(signsFor(8, "Taurus", [1, 4])).toEqual(["Leo", "Virgo"]);
    expect(signsFor(8, "Gemini", [1, 4])).toEqual(["Sagittarius", "Capricorn"]);
  });

  it("calculates the complete supported atlas by default", () => {
    const charts = computeMultipleDivisionalCharts([planet("Leo", 17)]);

    expect(Object.keys(charts).map(Number)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 20, 24, 27, 30, 40, 45, 60,
    ]);
    expect(Object.values(charts).every((chart) => chart.positions.length === 1)).toBe(true);
  });

  it("reflects the sign ordinal for D11 before walking forward", () => {
    expect(signsFor(11, "Aries", [1, 4])).toEqual(["Aries", "Taurus"]);
    expect(signsFor(11, "Gemini", [1, 12])).toEqual(["Aquarius", "Gemini"]);
    expect(signsFor(11, "Scorpio", [19])).toEqual(["Pisces"]);
  });

  it("uses modality starts for D16, D20, and D45", () => {
    expect(signsFor(16, "Cancer", [1])).toEqual(["Aries"]);
    expect(signsFor(16, "Taurus", [1])).toEqual(["Leo"]);
    expect(signsFor(20, "Virgo", [1])).toEqual(["Leo"]);
    expect(signsFor(45, "Pisces", [0.1])).toEqual(["Sagittarius"]);
  });

  it("uses masculine and feminine signs for D30 planetary lords", () => {
    expect(signsFor(30, "Aries", [1, 6, 12, 20, 28])).toEqual([
      "Aries", "Aquarius", "Sagittarius", "Gemini", "Libra",
    ]);
    expect(signsFor(30, "Taurus", [1, 6, 14, 22, 28])).toEqual([
      "Taurus", "Virgo", "Pisces", "Capricorn", "Scorpio",
    ]);
  });

  it("maps D60 by the half-degree ordinal rather than natal sign", () => {
    expect(signsFor(60, "Aries", [0.1, 0.6, 6.1])).toEqual([
      "Aries", "Taurus", "Aries",
    ]);
    expect(signsFor(60, "Scorpio", [0.1, 0.6, 6.1])).toEqual([
      "Aries", "Taurus", "Aries",
    ]);
  });
});
