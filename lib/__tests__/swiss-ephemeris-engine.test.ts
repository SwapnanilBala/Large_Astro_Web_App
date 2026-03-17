import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock swisseph BEFORE importing the engine
// ---------------------------------------------------------------------------
vi.mock("swisseph", () => {
  const SE_SUN = 0;
  const SE_MOON = 1;
  const SE_MERCURY = 2;
  const SE_VENUS = 3;
  const SE_MARS = 4;
  const SE_JUPITER = 5;
  const SE_SATURN = 6;
  const SE_MEAN_NODE = 10;
  const SE_GREG_CAL = 1;
  const SEFLG_SWIEPH = 2;
  const SEFLG_SIDEREAL = 64;
  const SEFLG_MOSEPH = 4;
  const SE_SIDM_LAHIRI = 1;
  const SE_SIDM_RAMAN = 3;
  const SE_SIDM_KRISHNAMURTI = 5;

  // Deterministic longitude table keyed by planet code
  const PLANET_LONGITUDES: Record<number, number> = {
    [SE_SUN]: 45.5,       // Taurus 15.5
    [SE_MOON]: 120.25,    // Leo 0.25
    [SE_MERCURY]: 60.0,   // Gemini 0
    [SE_VENUS]: 200.8,    // Libra 20.8
    [SE_MARS]: 310.0,     // Aquarius 10
    [SE_JUPITER]: 90.0,   // Cancer 0
    [SE_SATURN]: 270.0,   // Capricorn 0
    [SE_MEAN_NODE]: 150.0, // Virgo 0 (Rahu)
  };

  return {
    default: {
      SE_SUN,
      SE_MOON,
      SE_MERCURY,
      SE_VENUS,
      SE_MARS,
      SE_JUPITER,
      SE_SATURN,
      SE_MEAN_NODE,
      SE_GREG_CAL,
      SEFLG_SWIEPH,
      SEFLG_SIDEREAL,
      SEFLG_MOSEPH,
      SE_SIDM_LAHIRI,
      SE_SIDM_RAMAN,
      SE_SIDM_KRISHNAMURTI,

      swe_julday: vi.fn((year: number, month: number, day: number, hour: number, _cal: number) => {
        // Simplified Julian day calculation (not astronomically precise but deterministic)
        return 2451545.0 + (year - 2000) * 365.25 + (month - 1) * 30.4375 + day + hour / 24;
      }),

      swe_set_sid_mode: vi.fn(),

      swe_calc_ut: vi.fn((_jd: number, planet: number, _flags: number) => {
        const lon = PLANET_LONGITUDES[planet];
        if (lon === undefined) return { error: `Unknown planet ${planet}` };
        return { longitude: lon, latitude: 0, distance: 1 };
      }),

      swe_houses_ex: vi.fn((_jd: number, _flags: number, _lat: number, _lon: number, _sys: string) => {
        return { ascendant: 30.0, cusps: Array(13).fill(0) }; // Asc at 30.0 -> Taurus 0
      }),
    },
  };
});

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

    it("ascendant sign matches mock data (30 deg = Taurus 0)", () => {
      const result = calculate(birth);
      // Mock returns 30.0 for ascendant -> sign_index 1 -> Taurus
      expect(result.ascendant.sign).toBe("Taurus");
      expect(result.ascendant.degree_in_sign).toBeCloseTo(0, 2);
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
      // Asc is Taurus (index 1), so house 1 = Taurus, house 2 = Gemini, etc.
      expect(result.houses[0].sign).toBe("Taurus");
      expect(result.houses[1].sign).toBe("Gemini");
      expect(result.houses[11].sign).toBe("Aries");
    });

    it("planets in each house are correctly distributed", () => {
      const result = calculate(birth);
      // Every planet should appear in exactly one house's planet list
      const allHousePlanets = result.houses.flatMap((h) => h.planets);
      const planetNames = result.planets.map((p) => p.name);
      expect(allHousePlanets.sort()).toEqual(planetNames.sort());
    });

    it("fallback_mode is false on normal execution", () => {
      const result = calculate(birth);
      expect(result.fallback_mode).toBe(false);
    });

    it("accepts engine_id parameter", () => {
      const result = calculate({ ...birth, engine_id: "raman_classic" });
      expect(result).toHaveProperty("ascendant");
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

  describe("sidereal mode", () => {
    it("swe_set_sid_mode is called during calculate", async () => {
      const swisseph = (await import("swisseph")).default;
      (swisseph.swe_set_sid_mode as ReturnType<typeof vi.fn>).mockClear();

      calculate(birth);
      expect(swisseph.swe_set_sid_mode).toHaveBeenCalled();
    });
  });
});
