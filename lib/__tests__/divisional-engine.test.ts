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

  it("counts D60 from the planet's own sign", () => {
    /* Parashara: degrees x 2, divide by 12, count the remainder from the sign
       the planet is in. This asserted the opposite until the natal sign was
       restored — every planet was placed as though it sat in Aries. */
    expect(signsFor(60, "Aries", [0.1, 0.6, 6.1])).toEqual([
      "Aries", "Taurus", "Aries",
    ]);
    // 6.1 deg -> floor(12.2) = 12 -> 12 % 12 = 0 -> the sign itself.
    expect(signsFor(60, "Scorpio", [0.1, 0.6, 6.1])).toEqual([
      "Scorpio", "Sagittarius", "Scorpio",
    ]);
    expect(signsFor(60, "Pisces", [0.1, 0.6, 6.1])).toEqual([
      "Pisces", "Aries", "Pisces",
    ]);
  });

  /* ----------------------------------------------------------------------
   * The canonical vargas.
   *
   * These had no assertions at all while the four non-Parashari extensions
   * (D5, D6, D8, D11) were each covered — so the least authoritative parts of
   * the engine were the best tested. D9 and D10 in particular are the two most
   * consulted charts after D1.
   * -------------------------------------------------------------------- */

  it("maps D2 horas to Leo and Cancer by parity", () => {
    // Odd sign: Sun's hora first, Moon's second. Even sign: reversed.
    expect(signsFor(2, "Aries", [1, 20])).toEqual(["Leo", "Cancer"]);
    expect(signsFor(2, "Taurus", [1, 20])).toEqual(["Cancer", "Leo"]);
  });

  it("maps D3 decanates to the 1st, 5th and 9th from the sign", () => {
    expect(signsFor(3, "Aries", [5, 15, 25])).toEqual(["Aries", "Leo", "Sagittarius"]);
    expect(signsFor(3, "Leo", [5, 15, 25])).toEqual(["Leo", "Sagittarius", "Aries"]);
  });

  it("starts D7 from the sign in odd rashis and the 7th in even rashis", () => {
    // 30/7 = 4.2857 deg per part.
    expect(signsFor(7, "Aries", [1, 5])).toEqual(["Aries", "Taurus"]);
    expect(signsFor(7, "Taurus", [1, 5])).toEqual(["Scorpio", "Sagittarius"]);
  });

  it("starts D9 from the element's movable sign", () => {
    // Fire -> Aries, Earth -> Capricorn, Air -> Libra, Water -> Cancer.
    expect(signsFor(9, "Aries", [0])).toEqual(["Aries"]);
    expect(signsFor(9, "Taurus", [0])).toEqual(["Capricorn"]);
    expect(signsFor(9, "Gemini", [0])).toEqual(["Libra"]);
    expect(signsFor(9, "Cancer", [0])).toEqual(["Cancer"]);
    // 30/9 = 3.3333 deg per part; 7 deg falls in the third navamsa.
    expect(signsFor(9, "Aries", [7])).toEqual(["Gemini"]);
    // The last navamsa of a sign is the 9th from its start.
    expect(signsFor(9, "Aries", [29.9])).toEqual(["Sagittarius"]);
  });

  it("starts D10 from the sign in odd rashis and the 9th in even rashis", () => {
    expect(signsFor(10, "Aries", [1, 4])).toEqual(["Aries", "Taurus"]);
    expect(signsFor(10, "Taurus", [1, 4])).toEqual(["Capricorn", "Aquarius"]);
  });

  it("walks D12 forward from the sign itself", () => {
    // 2.5 deg per part, all rashis start from themselves.
    expect(signsFor(12, "Aries", [1, 4, 29])).toEqual(["Aries", "Taurus", "Pisces"]);
    expect(signsFor(12, "Scorpio", [1, 4])).toEqual(["Scorpio", "Sagittarius"]);
  });

  it("rejects an unknown rashi instead of silently treating it as Aries", () => {
    expect(() => signsFor(9, "Bogus", [5])).toThrow(/Unknown rashi/);
  });

  it("rejects a degree that is not a finite number inside the sign", () => {
    expect(() => signsFor(9, "Aries", [Number.NaN])).toThrow(/finite/);
    expect(() => signsFor(9, "Aries", [30])).toThrow(/\[0, 30\)/);
    expect(() => signsFor(9, "Aries", [-1])).toThrow(/\[0, 30\)/);
  });
});
