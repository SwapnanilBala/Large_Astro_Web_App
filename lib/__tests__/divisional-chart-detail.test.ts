import { describe, expect, it } from "vitest";
import type { DivisionalChartInfo } from "../astro-types";
import {
  buildDivisionalChartDetail,
  distanceToDivisionalBoundary,
  getKeyDivisionalChartFocus,
} from "../divisional-chart-detail";
import { IMPORTANT_DIVISION_NUMBERS } from "../divisional-chart-guide";

function chart(
  positions: DivisionalChartInfo["positions"],
  division = 9,
): DivisionalChartInfo {
  return {
    division,
    label: `D${division}`,
    description: "Test chart",
    positions,
  };
}

describe("key divisional chart focus", () => {
  it("defines complete focus metadata for exactly the ten important charts", () => {
    for (const division of IMPORTANT_DIVISION_NUMBERS) {
      const focus = getKeyDivisionalChartFocus(division);
      expect(focus).toMatchObject({ division, label: `D${division}` });
      expect(focus?.name.length).toBeGreaterThan(2);
      expect(focus?.focus.length).toBeGreaterThan(5);
      expect(focus?.focusPlanets.length).toBeGreaterThan(0);
      expect(focus?.focusHouses.length).toBeGreaterThan(0);
      expect(focus?.mappingMethod.length).toBeGreaterThan(20);
    }
  });

  it("does not promote a supporting chart into the key-chart model", () => {
    expect(getKeyDivisionalChartFocus(3)).toBeNull();
    expect(buildDivisionalChartDetail(chart([], 3))).toBeNull();
  });
});

describe("buildDivisionalChartDetail", () => {
  it("derives houses, dignity, repetition, rulers, and conjunctions", () => {
    const detail = buildDivisionalChartDetail(
      chart([
        {
          name: "Ascendant",
          rashi_sign: "Cancer",
          divisional_sign: "Cancer",
          part_index: 0, degree_in_divisional_sign: 0,
        },
        {
          name: "Sun",
          rashi_sign: "Aries",
          divisional_sign: "Aries",
          part_index: 1, degree_in_divisional_sign: 0,
        },
        {
          name: "Moon",
          rashi_sign: "Taurus",
          divisional_sign: "Cancer",
          part_index: 2, degree_in_divisional_sign: 0,
        },
        {
          name: "Mercury",
          rashi_sign: "Gemini",
          divisional_sign: "Pisces",
          part_index: 3, degree_in_divisional_sign: 0,
        },
        {
          name: "Jupiter",
          rashi_sign: "Sagittarius",
          divisional_sign: "Cancer",
          part_index: 4, degree_in_divisional_sign: 0,
        },
        {
          name: "Rahu",
          rashi_sign: "Taurus",
          divisional_sign: "Taurus",
          part_index: 5, degree_in_divisional_sign: 0,
        },
      ]),
    );

    expect(detail).not.toBeNull();
    expect(detail?.hasValidAscendant).toBe(true);
    expect(detail?.ascendantSign).toBe("Cancer");
    expect(detail?.houses).toHaveLength(12);
    expect(detail?.houses[0]).toEqual({
      houseNumber: 1,
      sign: "Cancer",
      signRuler: "Moon",
      occupants: ["Ascendant", "Moon", "Jupiter"],
      isFocusHouse: true,
    });
    expect(detail?.houses[9]).toMatchObject({
      houseNumber: 10,
      sign: "Aries",
      occupants: ["Sun"],
    });

    expect(detail?.positions.find((item) => item.name === "Sun")).toMatchObject({
      rashiSign: "Aries",
      vargaSign: "Aries",
      divisionPart: 1,
      wholeSignHouse: 10,
      signRuler: "Mars",
      dignity: "exalted",
      repeatsD1: true,
      conjunctionPeers: [],
      isFocusPlanet: false,
      isFocusHouse: false,
    });
    expect(detail?.positions.find((item) => item.name === "Mercury")).toMatchObject({
      wholeSignHouse: 9,
      signRuler: "Jupiter",
      dignity: "debilitated",
      repeatsD1: false,
      isFocusHouse: true,
    });
    expect(detail?.positions.find((item) => item.name === "Jupiter")).toMatchObject({
      wholeSignHouse: 1,
      dignity: "exalted",
      isFocusPlanet: true,
      conjunctionPeers: ["Ascendant", "Moon"],
    });
    expect(detail?.positions.find((item) => item.name === "Rahu")?.dignity).toBeNull();

    expect(detail?.repeatedNames).toEqual(["Ascendant", "Sun", "Rahu"]);
    expect(detail?.strongClassicalNames).toEqual(["Sun", "Moon", "Jupiter"]);
    expect(detail?.pressuredClassicalNames).toEqual(["Mercury"]);
    expect(detail?.conjunctionGroups).toEqual([
      {
        sign: "Cancer",
        wholeSignHouse: 1,
        names: ["Ascendant", "Moon", "Jupiter"],
      },
    ]);
  });

  it("keeps sign-level facts but withholds houses when the Ascendant is missing", () => {
    const detail = buildDivisionalChartDetail(
      chart([
        {
          name: "Sun",
          rashi_sign: "Leo",
          divisional_sign: "Leo",
          part_index: 0, degree_in_divisional_sign: 0,
        },
        {
          name: "Ketu",
          rashi_sign: "Aquarius",
          divisional_sign: "Leo",
          part_index: 1, degree_in_divisional_sign: 0,
        },
      ]),
    );

    expect(detail?.hasValidAscendant).toBe(false);
    expect(detail?.ascendantSign).toBeNull();
    expect(detail?.houses).toEqual([]);
    expect(detail?.positions.every((position) => position.wholeSignHouse === null)).toBe(true);
    expect(detail?.positions.find((position) => position.name === "Sun")?.dignity).toBe("own_sign");
    expect(detail?.conjunctionGroups[0]).toEqual({
      sign: "Leo",
      wholeSignHouse: null,
      names: ["Sun", "Ketu"],
    });
  });

  it("treats an invalid Ascendant and invalid signs as unavailable instead of defaulting to Aries", () => {
    const detail = buildDivisionalChartDetail(
      chart([
        {
          name: "Ascendant",
          rashi_sign: "Unknown",
          divisional_sign: "Unknown",
          part_index: 0, degree_in_divisional_sign: 0,
        },
        {
          name: "Saturn",
          rashi_sign: "Unknown",
          divisional_sign: "Unknown",
          part_index: 1, degree_in_divisional_sign: 0,
        },
      ]),
    );

    expect(detail?.hasValidAscendant).toBe(false);
    expect(detail?.houses).toEqual([]);
    expect(detail?.repeatedNames).toEqual([]);
    expect(detail?.conjunctionGroups).toEqual([]);
    expect(detail?.positions[1]).toMatchObject({
      wholeSignHouse: null,
      signRuler: null,
      dignity: null,
      repeatsD1: false,
      conjunctionPeers: [],
    });
  });
});

describe("distanceToDivisionalBoundary", () => {
  it("uses equal portions for the ordinary key vargas", () => {
    expect(distanceToDivisionalBoundary(2, "Taurus", 7)).toEqual({
      distanceDegrees: 7,
      distanceArcMinutes: 420,
      nearestBoundaryDegree: 0,
      lowerBoundaryDegree: 0,
      upperBoundaryDegree: 15,
      segmentNumber: 1,
      isAtBoundary: false,
    });

    expect(distanceToDivisionalBoundary(4, "Aries", 7.5)).toEqual({
      distanceDegrees: 0,
      distanceArcMinutes: 0,
      nearestBoundaryDegree: 7.5,
      lowerBoundaryDegree: 7.5,
      upperBoundaryDegree: 15,
      segmentNumber: 2,
      isAtBoundary: true,
    });

    const d60 = distanceToDivisionalBoundary(60, "Scorpio", 12.24);
    expect(d60).toMatchObject({
      lowerBoundaryDegree: 12,
      upperBoundaryDegree: 12.5,
      nearestBoundaryDegree: 12,
      segmentNumber: 25,
      isAtBoundary: false,
    });
    expect(d60?.distanceDegrees).toBeCloseTo(0.24, 10);
    expect(d60?.distanceArcMinutes).toBeCloseTo(14.4, 10);
  });

  it("uses the unequal odd-sign D30 boundaries", () => {
    expect(distanceToDivisionalBoundary(30, "Aries", 11)).toMatchObject({
      lowerBoundaryDegree: 10,
      upperBoundaryDegree: 18,
      nearestBoundaryDegree: 10,
      distanceDegrees: 1,
      segmentNumber: 3,
    });
    expect(distanceToDivisionalBoundary(30, "Aries", 17)).toMatchObject({
      lowerBoundaryDegree: 10,
      upperBoundaryDegree: 18,
      nearestBoundaryDegree: 18,
      distanceDegrees: 1,
      segmentNumber: 3,
    });
  });

  it("uses the unequal even-sign D30 boundaries and advances on an exact cutoff", () => {
    expect(distanceToDivisionalBoundary(30, "Taurus", 11)).toMatchObject({
      lowerBoundaryDegree: 5,
      upperBoundaryDegree: 12,
      nearestBoundaryDegree: 12,
      distanceDegrees: 1,
      segmentNumber: 2,
    });
    expect(distanceToDivisionalBoundary(30, "Taurus", 12)).toEqual({
      distanceDegrees: 0,
      distanceArcMinutes: 0,
      nearestBoundaryDegree: 12,
      lowerBoundaryDegree: 12,
      upperBoundaryDegree: 20,
      segmentNumber: 3,
      isAtBoundary: true,
    });
  });

  it("covers every key division and rejects unsupported or invalid input", () => {
    for (const division of IMPORTANT_DIVISION_NUMBERS) {
      expect(distanceToDivisionalBoundary(division, "Gemini", 12.345)).not.toBeNull();
    }

    expect(distanceToDivisionalBoundary(3, "Aries", 5)).toBeNull();
    expect(distanceToDivisionalBoundary(9, "Not a sign", 5)).toBeNull();
    expect(distanceToDivisionalBoundary(9, "Aries", Number.NaN)).toBeNull();
    expect(distanceToDivisionalBoundary(9, "Aries", -0.1)).toBeNull();
    expect(distanceToDivisionalBoundary(9, "Aries", 30)).toBeNull();
  });
});
