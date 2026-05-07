import { describe, expect, it } from "vitest";

import {
  detectYogas,
  YOGA_DEFINITIONS,
  type YogaChartInput,
} from "../engines/yoga-engine";

function buildChart(): YogaChartInput {
  const planets = [
    { name: "Sun", longitude: 45, sign: "Taurus", degree_in_sign: 15, house: 1 },
    { name: "Moon", longitude: 120, sign: "Leo", degree_in_sign: 0, house: 4 },
    { name: "Mercury", longitude: 50, sign: "Taurus", degree_in_sign: 20, house: 1 },
    { name: "Venus", longitude: 200, sign: "Libra", degree_in_sign: 20, house: 6 },
    { name: "Mars", longitude: 15, sign: "Aries", degree_in_sign: 15, house: 12 },
    { name: "Jupiter", longitude: 90, sign: "Cancer", degree_in_sign: 0, house: 3 },
    { name: "Saturn", longitude: 270, sign: "Capricorn", degree_in_sign: 0, house: 9 },
    { name: "Rahu", longitude: 150, sign: "Virgo", degree_in_sign: 0, house: 5 },
    { name: "Ketu", longitude: 330, sign: "Pisces", degree_in_sign: 0, house: 11 },
  ];
  const signs = [
    "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra",
    "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces", "Aries",
  ];
  const houses = signs.map((sign, index) => ({
    house_number: index + 1,
    sign,
    planets: planets.filter((planet) => planet.house === index + 1).map((planet) => planet.name),
  }));

  return { planets, houses, ascendantSign: "Taurus" };
}

describe("yoga-engine", () => {
  it("defines exactly 50 unique yogas", () => {
    const ids = YOGA_DEFINITIONS.map((definition) => definition.id);
    expect(YOGA_DEFINITIONS).toHaveLength(50);
    expect(new Set(ids)).toHaveLength(50);
  });

  it("adds occurrence chance to every detected yoga", () => {
    const yogas = detectYogas(buildChart());
    expect(yogas.length).toBeGreaterThan(0);
    for (const yoga of yogas) {
      expect(yoga.occurrence_chance).toBeGreaterThanOrEqual(30);
      expect(yoga.occurrence_chance).toBeLessThanOrEqual(99);
    }
  });

  it("filters cancellation cases below the 30 percent occurrence threshold", () => {
    const yogas = detectYogas(buildChart());
    expect(yogas.find((yoga) => yoga.yoga_id === "shakata")).toBeUndefined();
  });
});
