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
  it("defines exactly 200 unique yogas", () => {
    const ids = YOGA_DEFINITIONS.map((definition) => definition.id);
    expect(YOGA_DEFINITIONS).toHaveLength(200);
    expect(new Set(ids)).toHaveLength(200);
  });

  /* Two yogas sharing a display name would be indistinguishable in the panel,
     which is the one place the reader sees them. Shakata is the near miss:
     the Moon-Jupiter combination and the Nabhasa figure are unrelated rules
     that the tradition gives the same name, so the second is disambiguated. */
  it("gives every yoga a distinct display name", () => {
    const names = YOGA_DEFINITIONS.map((definition) => definition.name);
    expect(new Set(names).size).toBe(YOGA_DEFINITIONS.length);
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

/*
 * The eight whole-chart figures below did not fire once in 50,000 sampled
 * charts, which is the expected result -- Dhwaja wants every benefic in the
 * ascendant and every malefic in the 8th -- but it is also exactly what a
 * definition that can never fire looks like. A Monte Carlo run cannot tell
 * those two apart, so each one gets a chart built to satisfy it by hand.
 *
 * These are the records most likely to be broken by a later refactor and
 * least likely to be noticed, since no real chart exercises them.
 */
describe("yoga-engine: rare whole-chart figures are reachable", () => {
  const SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
  ];

  /** Aries ascendant, so house N carries sign N. Signs can be overridden
      where a rule tests dignity rather than placement. */
  function chartOf(
    placements: Record<string, number>,
    signOverrides: Record<string, string> = {},
  ): YogaChartInput {
    const houses = SIGNS.map((sign, index) => ({
      house_number: index + 1,
      sign,
      planets: [] as string[],
    }));
    const planets = Object.entries(placements).map(([name, house]) => ({
      name,
      longitude: 0,
      sign: signOverrides[name] ?? houses[house - 1].sign,
      degree_in_sign: 10,
      house,
    }));
    for (const planet of planets) {
      const home = houses.find((house) => house.sign === planet.sign);
      if (home) home.planets.push(planet.name);
    }
    return { planets, houses, ascendantSign: "Aries" };
  }

  const cases: Array<[string, YogaChartInput]> = [
    ["shakata_nabhasa", chartOf({ Sun: 1, Moon: 1, Mars: 1, Mercury: 1, Venus: 7, Jupiter: 7, Saturn: 7 })],
    ["vajra", chartOf({ Jupiter: 1, Venus: 1, Mercury: 7, Sun: 4, Mars: 4, Saturn: 10, Moon: 1 })],
    ["kamala", chartOf({ Sun: 1, Moon: 4, Mars: 7, Mercury: 10, Venus: 1, Jupiter: 4, Saturn: 7 })],
    ["vapi", chartOf({ Sun: 2, Moon: 5, Mars: 8, Mercury: 11, Venus: 2, Jupiter: 5, Saturn: 8 })],
    ["chakra", chartOf({ Sun: 1, Moon: 3, Mars: 5, Mercury: 7, Venus: 9, Jupiter: 11, Saturn: 1 })],
    ["samudra", chartOf({ Sun: 2, Moon: 4, Mars: 6, Mercury: 8, Venus: 10, Jupiter: 12, Saturn: 2 })],
    ["dhwaja", chartOf({ Mercury: 1, Venus: 1, Jupiter: 1, Sun: 8, Mars: 8, Saturn: 8, Moon: 5 })],
    ["kurma", chartOf(
      { Mercury: 5, Venus: 6, Jupiter: 7, Sun: 1, Mars: 3, Saturn: 11, Moon: 9 },
      {
        Mercury: "Virgo", Venus: "Pisces", Jupiter: "Cancer",
        Sun: "Aries", Mars: "Capricorn", Saturn: "Libra",
      },
    )],
  ];

  it.each(cases)("detects %s on a chart built to satisfy it", (id, chart) => {
    expect(detectYogas(chart).map((yoga) => yoga.yoga_id)).toContain(id);
  });
});

describe("yoga-engine: citations", () => {
  /* The hundred added in 2026-09 each name the text they come from. The
     original hundred deliberately do not -- see the note on YogaDefinition. */
  it("cites a classical source on exactly the definitions that have one", () => {
    const cited = YOGA_DEFINITIONS.filter((definition) => definition.source);
    expect(cited).toHaveLength(100);
    for (const definition of cited) {
      expect(definition.source!.length).toBeGreaterThan(10);
    }
  });
});
