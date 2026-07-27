import { describe, expect, it } from "vitest";
import { computeAshtakavarga } from "../engines/ashtakavarga-engine";
import { SIGNS, type PlanetPosition } from "../engines/swiss-ephemeris-engine";

const BAV_PLANETS = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
];

function makePlanet(name: string, sign = "Aries"): PlanetPosition {
  return {
    name,
    longitude: 0,
    sign,
    degree_in_sign: 0,
    house: 1,
  };
}

function standardPlanetPositions(): PlanetPosition[] {
  return BAV_PLANETS.map((planet) => makePlanet(planet));
}

function rotateSign(sign: string, steps: number): string {
  const index = SIGNS.indexOf(sign);
  return SIGNS[(index + steps + SIGNS.length) % SIGNS.length];
}

function rotateVector(values: number[], steps: number): number[] {
  return values.map(
    (_value, index) => values[(index - steps + values.length) % values.length],
  );
}

describe("ashtakavarga-engine", () => {
  it("uses the standard Parashari BAV totals and 337-point SAV checksum", () => {
    const result = computeAshtakavarga(standardPlanetPositions(), "Aries");

    expect(
      Object.fromEntries(
        BAV_PLANETS.map((planet) => [
          planet,
          result.bhinnashtakavarga[planet].reduce((sum, bindus) => sum + bindus, 0),
        ])
      )
    ).toEqual({
      Sun: 48,
      Moon: 49,
      Mars: 39,
      Mercury: 54,
      Jupiter: 56,
      Venus: 52,
      Saturn: 39,
    });
    expect(result.sarvashtakavarga.reduce((sum, bindus) => sum + bindus, 0)).toBe(337);
    expect(result.totalBindus).toBe(337);
  });

  it("uses the standard Moon-from-Mercury contribution places", () => {
    const result = computeAshtakavarga(standardPlanetPositions(), "Aries");

    // With all eight sources in Aries, each index is the number of sources
    // contributing to the corresponding house from Aries.
    expect(result.bhinnashtakavarga.Moon).toEqual([
      3, 1, 7, 3, 4, 5, 5, 3, 2, 7, 8, 1,
    ]);
  });

  it("rejects incomplete source-planet input instead of returning a nonstandard total", () => {
    const planetsWithoutMars = standardPlanetPositions().filter(
      (planet) => planet.name !== "Mars"
    );

    expect(() => computeAshtakavarga(planetsWithoutMars, "Aries")).toThrow(
      "missing: Mars"
    );
  });

  it("rejects duplicate classical-planet sources instead of silently overwriting one", () => {
    expect(() =>
      computeAshtakavarga(
        [...standardPlanetPositions(), makePlanet("Mars", "Taurus")],
        "Aries",
      ),
    ).toThrow("duplicates: Mars");
  });

  it("rotates every BAV and SAV vector when every natal source sign rotates", () => {
    const sourceSigns = [
      "Aries",
      "Gemini",
      "Leo",
      "Virgo",
      "Scorpio",
      "Capricorn",
      "Aquarius",
    ];
    const planets = BAV_PLANETS.map((planet, index) =>
      makePlanet(planet, sourceSigns[index]),
    );
    const ascendant = "Taurus";
    const baseline = computeAshtakavarga(planets, ascendant);
    const shifted = computeAshtakavarga(
      planets.map((planet) => ({
        ...planet,
        sign: rotateSign(planet.sign, 1),
      })),
      rotateSign(ascendant, 1),
    );

    for (const planet of BAV_PLANETS) {
      expect(shifted.bhinnashtakavarga[planet]).toEqual(
        rotateVector(baseline.bhinnashtakavarga[planet], 1),
      );
    }
    expect(shifted.sarvashtakavarga).toEqual(
      rotateVector(baseline.sarvashtakavarga, 1),
    );
    expect(shifted.totalBindus).toBe(337);
  });
});
