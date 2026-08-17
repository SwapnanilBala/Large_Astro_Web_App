import { describe, it, expect } from "vitest";

import {
  calculate,
  computeTransitPositions,
  SIGNS,
  type BirthInput,
} from "../engines/swiss-ephemeris-engine";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("swiss-ephemeris-engine", () => {
  const birth: BirthInput = {
    utc_year: 1990,
    utc_month: 6,
    utc_day: 15,
    utc_hour: 12,
    utc_minute: 0,
    utc_second: 0,
    latitude: 28.6139,
    longitude: 77.209,
  };

  describe("calculate()", () => {
    it("returns result with correct top-level shape", () => {
      const result = calculate(birth);

      expect(result).toHaveProperty("julian_day_ut");
      expect(result).toHaveProperty("ascendant");
      expect(result).toHaveProperty("planets");
      expect(result).toHaveProperty("houses");
      expect(result).toHaveProperty("fallback_mode");
      expect(typeof result.julian_day_ut).toBe("number");
      expect(typeof result.fallback_mode).toBe("boolean");
    });

    it("returns 9 planets (Sun through Ketu)", () => {
      const result = calculate(birth);
      expect(result.planets).toHaveLength(9);

      const names = result.planets.map((p) => p.name);
      expect(names).toEqual(
        expect.arrayContaining([
          "Sun", "Moon", "Mercury", "Venus", "Mars",
          "Jupiter", "Saturn", "Rahu", "Ketu",
        ])
      );
    });

    it("returns 12 houses", () => {
      const result = calculate(birth);
      expect(result.houses).toHaveLength(12);
      const houseNums = result.houses.map((h) => h.house_number);
      expect(houseNums).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });

    it("each planet has required fields", () => {
      const result = calculate(birth);
      for (const p of result.planets) {
        expect(p).toHaveProperty("name");
        expect(p).toHaveProperty("longitude");
        expect(p).toHaveProperty("sign");
        expect(p).toHaveProperty("degree_in_sign");
        expect(p).toHaveProperty("house");
        expect(typeof p.longitude).toBe("number");
        expect(typeof p.house).toBe("number");
        expect(SIGNS).toContain(p.sign);
        expect(p.degree_in_sign).toBeGreaterThanOrEqual(0);
        expect(p.degree_in_sign).toBeLessThan(30);
        expect(p.house).toBeGreaterThanOrEqual(1);
        expect(p.house).toBeLessThanOrEqual(12);
      }
    });

    it("ascendant has correct structure", () => {
      const result = calculate(birth);
      expect(result.ascendant).toHaveProperty("longitude");
      expect(result.ascendant).toHaveProperty("sign");
      expect(result.ascendant).toHaveProperty("degree_in_sign");
      expect(SIGNS).toContain(result.ascendant.sign);
    });

    it("ascendant matches known chart (Gandhi — Libra lagna)", () => {
      // Mahatma Gandhi: 2 Oct 1869, LMT ~07:11:33, Porbandar (21.6417°N, 69.6293°E)
      // LMT offset = 69.6293° / 15 = 4h 38m 31s → UTC = 02:33:02
      // Known Lahiri ascendant: Libra (universally accepted in Vedic astrology)
      const gandhi: BirthInput = {
        utc_year: 1869, utc_month: 10, utc_day: 2,
        utc_hour: 2, utc_minute: 33, utc_second: 2,
        latitude: 21.6417, longitude: 69.6293,
        engine_id: "lahiri_classic",
      };
      const result = calculate(gandhi);
      expect(result.ascendant.sign).toBe("Libra");
    });

    it("matches Swiss Ephemeris Lahiri ascendant regressions", () => {
      const cases: Array<{
        label: string;
        birth: BirthInput;
        expectedLongitude: number;
        expectedSign: string;
      }> = [
        {
          label: "Delhi",
          birth: {
            utc_year: 1990,
            utc_month: 6,
            utc_day: 15,
            utc_hour: 12,
            utc_minute: 0,
            utc_second: 0,
            latitude: 28.6139,
            longitude: 77.209,
            engine_id: "lahiri_classic",
          },
          expectedLongitude: 217.425,
          expectedSign: "Scorpio",
        },
        {
          label: "Gandhi",
          birth: {
            utc_year: 1869,
            utc_month: 10,
            utc_day: 2,
            utc_hour: 2,
            utc_minute: 33,
            utc_second: 2,
            latitude: 21.6417,
            longitude: 69.6293,
            engine_id: "lahiri_classic",
          },
          expectedLongitude: 184.5168,
          expectedSign: "Libra",
        },
        {
          label: "New York",
          birth: {
            utc_year: 2000,
            utc_month: 1,
            utc_day: 1,
            utc_hour: 17,
            utc_minute: 0,
            utc_second: 0,
            latitude: 40.7128,
            longitude: -74.006,
            engine_id: "lahiri_classic",
          },
          expectedLongitude: 356.1074,
          expectedSign: "Pisces",
        },
        {
          label: "Quito",
          birth: {
            utc_year: 2024,
            utc_month: 3,
            utc_day: 20,
            utc_hour: 12,
            utc_minute: 0,
            utc_second: 0,
            latitude: -0.18,
            longitude: -78.47,
            engine_id: "lahiri_classic",
          },
          expectedLongitude: 346.7137,
          expectedSign: "Pisces",
        },
      ];

      for (const { label, birth, expectedLongitude, expectedSign } of cases) {
        const result = calculate(birth);
        expect(result.ascendant.sign, label).toBe(expectedSign);
        expect(
          Math.abs(result.ascendant.longitude - expectedLongitude),
          label
        ).toBeLessThan(0.02);
      }
    });

    it("matches the Swiss Ephemeris Raman reference and preserves the sign at a boundary", () => {
      const base: BirthInput = {
        utc_year: 1990,
        utc_month: 6,
        utc_day: 15,
        utc_hour: 12,
        utc_minute: 0,
        utc_second: 0,
        latitude: 28.6139,
        longitude: 77.209,
        engine_id: "raman_classic",
      };

      const reference = calculate(base);
      expect(reference.ascendant.longitude).toBeCloseTo(218.8713, 2);
      expect(reference.ascendant.sign).toBe("Scorpio");

      // Swiss Ephemeris 2.10.03: 240.1407935°. The previous Raman reference
      // returned about 239.46° here and incorrectly crossed back into Scorpio.
      const boundary = calculate({ ...base, utc_hour: 13, utc_minute: 38 });
      expect(boundary.ascendant.longitude).toBeCloseTo(240.1408, 2);
      expect(boundary.ascendant.sign).toBe("Sagittarius");
    });

    it("Ketu is exactly 180 degrees from Rahu", () => {
      const result = calculate(birth);
      const rahu = result.planets.find((p) => p.name === "Rahu")!;
      const ketu = result.planets.find((p) => p.name === "Ketu")!;
      const diff = Math.abs(rahu.longitude - ketu.longitude);
      const normalizedDiff = diff > 180 ? 360 - diff : diff;
      expect(normalizedDiff).toBeCloseTo(180, 2);
    });

    it("houses use whole-sign system starting from ascendant sign", () => {
      const result = calculate(birth);
      const ascSignIndex = SIGNS.indexOf(result.ascendant.sign);
      expect(result.houses[0].sign).toBe(SIGNS[ascSignIndex]);
      expect(result.houses[1].sign).toBe(SIGNS[(ascSignIndex + 1) % 12]);
      expect(result.houses[11].sign).toBe(SIGNS[(ascSignIndex + 11) % 12]);
    });

    it("planets in each house are correctly distributed", () => {
      const result = calculate(birth);
      // Every planet should appear in exactly one house's planet list
      const allHousePlanets = result.houses.flatMap((h) => h.planets);
      const planetNames = result.planets.map((p) => p.name);
      expect(allHousePlanets.sort()).toEqual(planetNames.sort());
    });

    it("fallback_mode is false", () => {
      const result = calculate(birth);
      expect(result.fallback_mode).toBe(false);
    });

    it("accepts engine_id parameter", () => {
      const result = calculate({ ...birth, engine_id: "raman_classic" });
      expect(result).toHaveProperty("ascendant");
      expect(result.planets).toHaveLength(9);
    });

    it("different ayanamsa engines produce different longitudes", () => {
      const lahiri = calculate({ ...birth, engine_id: "lahiri_classic" });
      const raman = calculate({ ...birth, engine_id: "raman_classic" });
      // Lahiri and Raman ayanamsas differ, so longitudes should differ
      expect(lahiri.planets[0].longitude).not.toBeCloseTo(raman.planets[0].longitude, 0);
    });

    it("supports the requested ayanamsha engines end to end", () => {
      const engineIds = [
        "fagan_bradley_classic",
        "pushyapaksha_classic",
        "yukteshwar_classic",
      ];

      for (const engine_id of engineIds) {
        const result = calculate({ ...birth, engine_id });
        expect(result.planets).toHaveLength(9);
        expect(result.houses).toHaveLength(12);
        expect(SIGNS).toContain(result.ascendant.sign);
      }
    });

    it("julian day is a plausible number", () => {
      const result = calculate(birth);
      // J2000.0 = 2451545.0, any modern date should be near that
      expect(result.julian_day_ut).toBeGreaterThan(2440000);
      expect(result.julian_day_ut).toBeLessThan(2470000);
    });
  });

  describe("edge cases", () => {
    it("midnight birth time (0:0:0)", () => {
      const midnight: BirthInput = {
        ...birth,
        utc_hour: 0,
        utc_minute: 0,
        utc_second: 0,
      };
      const result = calculate(midnight);
      expect(result.planets).toHaveLength(9);
      expect(result.houses).toHaveLength(12);
    });

    it("extreme northern latitude (70 deg)", () => {
      const arctic: BirthInput = { ...birth, latitude: 70 };
      const result = calculate(arctic);
      expect(result.planets).toHaveLength(9);
      expect(result.ascendant).toHaveProperty("sign");
    });

    it("extreme southern latitude (-70 deg)", () => {
      const antarctic: BirthInput = { ...birth, latitude: -70 };
      const result = calculate(antarctic);
      expect(result.planets).toHaveLength(9);
    });

    it("longitude 0 (Greenwich)", () => {
      const greenwich: BirthInput = { ...birth, longitude: 0 };
      const result = calculate(greenwich);
      expect(result.planets).toHaveLength(9);
    });
  });

  describe("computeTransitPositions()", () => {
    it("returns transit positions for all 9 bodies", () => {
      const positions = computeTransitPositions(new Date("2024-06-15T12:00:00Z"));
      expect(positions).toHaveLength(9);
      for (const p of positions) {
        expect(p).toHaveProperty("name");
        expect(p).toHaveProperty("longitude");
        expect(p).toHaveProperty("sign");
        expect(p).toHaveProperty("degree_in_sign");
      }
    });

    it("includes Ketu as 180 degrees from Rahu", () => {
      const positions = computeTransitPositions(new Date("2024-06-15T12:00:00Z"));
      const rahu = positions.find((p) => p.name === "Rahu")!;
      const ketu = positions.find((p) => p.name === "Ketu")!;
      const diff = Math.abs(rahu.longitude - ketu.longitude);
      const normalizedDiff = diff > 180 ? 360 - diff : diff;
      expect(normalizedDiff).toBeCloseTo(180, 2);
    });

    it("accepts optional engine_id", () => {
      const positions = computeTransitPositions(new Date(), "krishnamurti_classic");
      expect(positions).toHaveLength(9);
    });
  });
});
