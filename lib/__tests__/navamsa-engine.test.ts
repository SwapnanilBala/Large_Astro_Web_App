import { describe, it, expect } from "vitest";
import { calculateNavamsa, type NavamsaPosition } from "../engines/navamsa-engine";
import type { PlanetPosition } from "../engines/swiss-ephemeris-engine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlanet(
  name: string,
  sign: string,
  degree_in_sign: number,
  longitude?: number,
  house = 1
): PlanetPosition {
  const signs = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
  ];
  const signIndex = signs.indexOf(sign);
  const lon = longitude ?? signIndex * 30 + degree_in_sign;
  return { name, longitude: lon, sign, degree_in_sign, house };
}

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("navamsa-engine", () => {
  describe("D9 division basics", () => {
    it("returns one navamsa position per planet", () => {
      const planets = [
        makePlanet("Sun", "Aries", 5),
        makePlanet("Moon", "Cancer", 15),
      ];
      const result = calculateNavamsa(planets);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Sun");
      expect(result[1].name).toBe("Moon");
    });

    it("each result has required fields", () => {
      const planets = [makePlanet("Mars", "Leo", 10)];
      const result = calculateNavamsa(planets);
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).toHaveProperty("rashi_sign");
      expect(result[0]).toHaveProperty("navamsa_sign");
      expect(result[0]).toHaveProperty("navamsa_division");
    });

    it("rashi_sign matches the input sign", () => {
      const planets = [makePlanet("Venus", "Libra", 20)];
      const result = calculateNavamsa(planets);
      expect(result[0].rashi_sign).toBe("Libra");
    });

    it("navamsa_division is 0-8", () => {
      for (let deg = 0; deg < 30; deg += 1) {
        const planets = [makePlanet("Sun", "Aries", deg)];
        const result = calculateNavamsa(planets);
        expect(result[0].navamsa_division).toBeGreaterThanOrEqual(0);
        expect(result[0].navamsa_division).toBeLessThanOrEqual(8);
      }
    });

    it("navamsa_sign is a valid zodiac sign", () => {
      const planets = [makePlanet("Jupiter", "Pisces", 25)];
      const result = calculateNavamsa(planets);
      expect(SIGNS).toContain(result[0].navamsa_sign);
    });
  });

  describe("Fire sign navamsa mapping (Aries, Leo, Sagittarius start at Aries)", () => {
    it("Aries 0 deg -> division 0 -> navamsa Aries", () => {
      const planets = [makePlanet("Sun", "Aries", 0)];
      const result = calculateNavamsa(planets);
      expect(result[0].navamsa_sign).toBe("Aries");
      expect(result[0].navamsa_division).toBe(0);
    });

    it("Aries 3.5 deg -> division 1 -> navamsa Taurus", () => {
      const planets = [makePlanet("Sun", "Aries", 3.5)];
      const result = calculateNavamsa(planets);
      expect(result[0].navamsa_division).toBe(1);
      expect(result[0].navamsa_sign).toBe("Taurus");
    });

    it("Aries ~26.67 deg -> division 8 -> navamsa Sagittarius", () => {
      const planets = [makePlanet("Sun", "Aries", 27)];
      const result = calculateNavamsa(planets);
      expect(result[0].navamsa_division).toBe(8);
      expect(result[0].navamsa_sign).toBe("Sagittarius");
    });

    it("Leo 0 deg -> division 0 -> navamsa Aries (fire start)", () => {
      const planets = [makePlanet("Sun", "Leo", 0)];
      const result = calculateNavamsa(planets);
      expect(result[0].navamsa_sign).toBe("Aries");
    });

    it("Sagittarius 0 deg -> division 0 -> navamsa Aries (fire start)", () => {
      const planets = [makePlanet("Sun", "Sagittarius", 0)];
      const result = calculateNavamsa(planets);
      expect(result[0].navamsa_sign).toBe("Aries");
    });
  });

  describe("Earth sign navamsa mapping (Taurus, Virgo, Capricorn start at Capricorn)", () => {
    it("Taurus 0 deg -> navamsa Capricorn", () => {
      const planets = [makePlanet("Moon", "Taurus", 0)];
      const result = calculateNavamsa(planets);
      // NAVAMSA_START for Earth = 9 -> index 9 -> Capricorn
      expect(result[0].navamsa_sign).toBe("Capricorn");
    });

    it("Virgo 0 deg -> navamsa Capricorn", () => {
      const planets = [makePlanet("Moon", "Virgo", 0)];
      const result = calculateNavamsa(planets);
      expect(result[0].navamsa_sign).toBe("Capricorn");
    });

    it("Capricorn 0 deg -> navamsa Capricorn", () => {
      const planets = [makePlanet("Moon", "Capricorn", 0)];
      const result = calculateNavamsa(planets);
      expect(result[0].navamsa_sign).toBe("Capricorn");
    });
  });

  describe("Air sign navamsa mapping (Gemini, Libra, Aquarius start at Libra)", () => {
    it("Gemini 0 deg -> navamsa Libra", () => {
      const planets = [makePlanet("Mercury", "Gemini", 0)];
      const result = calculateNavamsa(planets);
      // NAVAMSA_START for Air = 6 -> index 6 -> Libra
      expect(result[0].navamsa_sign).toBe("Libra");
    });

    it("Libra 0 deg -> navamsa Libra", () => {
      const planets = [makePlanet("Mercury", "Libra", 0)];
      const result = calculateNavamsa(planets);
      expect(result[0].navamsa_sign).toBe("Libra");
    });
  });

  describe("Water sign navamsa mapping (Cancer, Scorpio, Pisces start at Cancer)", () => {
    it("Cancer 0 deg -> navamsa Cancer", () => {
      const planets = [makePlanet("Mars", "Cancer", 0)];
      const result = calculateNavamsa(planets);
      // NAVAMSA_START for Water = 3 -> index 3 -> Cancer
      expect(result[0].navamsa_sign).toBe("Cancer");
    });

    it("Scorpio 0 deg -> navamsa Cancer", () => {
      const planets = [makePlanet("Mars", "Scorpio", 0)];
      const result = calculateNavamsa(planets);
      expect(result[0].navamsa_sign).toBe("Cancer");
    });

    it("Pisces 0 deg -> navamsa Cancer", () => {
      const planets = [makePlanet("Mars", "Pisces", 0)];
      const result = calculateNavamsa(planets);
      expect(result[0].navamsa_sign).toBe("Cancer");
    });
  });

  describe("edge cases", () => {
    it("degree_in_sign = 0 gives division 0", () => {
      const planets = [makePlanet("Sun", "Aries", 0)];
      const result = calculateNavamsa(planets);
      expect(result[0].navamsa_division).toBe(0);
    });

    it("degree_in_sign just under 30 gives division 8", () => {
      const planets = [makePlanet("Sun", "Aries", 29.99)];
      const result = calculateNavamsa(planets);
      expect(result[0].navamsa_division).toBe(8);
    });

    it("processes all 9 planets correctly", () => {
      const planets = [
        makePlanet("Sun", "Aries", 5),
        makePlanet("Moon", "Taurus", 10),
        makePlanet("Mercury", "Gemini", 15),
        makePlanet("Venus", "Cancer", 20),
        makePlanet("Mars", "Leo", 25),
        makePlanet("Jupiter", "Virgo", 3),
        makePlanet("Saturn", "Libra", 8),
        makePlanet("Rahu", "Scorpio", 12),
        makePlanet("Ketu", "Pisces", 28),
      ];
      const result = calculateNavamsa(planets);
      expect(result).toHaveLength(9);
      for (const r of result) {
        expect(SIGNS).toContain(r.navamsa_sign);
        expect(r.navamsa_division).toBeGreaterThanOrEqual(0);
        expect(r.navamsa_division).toBeLessThanOrEqual(8);
      }
    });

    it("division cycles through 9 navamsa divisions across 30 degrees", () => {
      const divisions: number[] = [];
      for (let deg = 0; deg < 30; deg += 3.4) {
        const planets = [makePlanet("Sun", "Aries", deg)];
        const result = calculateNavamsa(planets);
        divisions.push(result[0].navamsa_division);
      }
      // Should be monotonically non-decreasing
      for (let i = 1; i < divisions.length; i++) {
        expect(divisions[i]).toBeGreaterThanOrEqual(divisions[i - 1]);
      }
    });
  });
});
