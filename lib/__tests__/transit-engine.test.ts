import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock swisseph
// ---------------------------------------------------------------------------
vi.mock("swisseph", () => {
  const PLANET_LONGITUDES: Record<number, number> = {
    0: 75.0,    // Sun - Gemini 15
    1: 200.0,   // Moon - Libra 20
    2: 90.0,    // Mercury - Cancer 0
    3: 150.0,   // Venus - Virgo 0
    4: 30.0,    // Mars - Taurus 0
    5: 300.0,   // Jupiter - Aquarius 0
    6: 240.0,   // Saturn - Sagittarius 0
    10: 120.0,  // Rahu - Leo 0
  };

  return {
    default: {
      SE_SUN: 0, SE_MOON: 1, SE_MERCURY: 2, SE_VENUS: 3,
      SE_MARS: 4, SE_JUPITER: 5, SE_SATURN: 6, SE_MEAN_NODE: 10,
      SE_GREG_CAL: 1, SEFLG_SWIEPH: 2, SEFLG_SIDEREAL: 64,
      SEFLG_MOSEPH: 4,
      SE_SIDM_LAHIRI: 1, SE_SIDM_RAMAN: 3, SE_SIDM_KRISHNAMURTI: 5,
      swe_julday: vi.fn(() => 2460000),
      swe_set_sid_mode: vi.fn(),
      swe_calc_ut: vi.fn((_jd: number, planet: number) => {
        const lon = PLANET_LONGITUDES[planet];
        if (lon === undefined) return { error: "unknown" };
        return { longitude: lon, latitude: 0, distance: 1 };
      }),
      swe_houses_ex: vi.fn(() => ({ ascendant: 0, cusps: Array(13).fill(0) })),
    },
  };
});

import {
  getTransitPositions,
  getCurrentTransitPositions,
  computeTransitAspects,
  type TransitPosition,
  type TransitAspect,
} from "../engines/transit-engine";
import type { PlanetPosition } from "../engines/swiss-ephemeris-engine";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("transit-engine", () => {
  describe("getTransitPositions()", () => {
    it("returns 9 transit positions (including Ketu)", () => {
      const positions = getTransitPositions(new Date("2024-06-15T12:00:00Z"));
      expect(positions).toHaveLength(9);
    });

    it("each position has name, longitude, sign, degree_in_sign", () => {
      const positions = getTransitPositions(new Date("2024-01-01T00:00:00Z"));
      for (const p of positions) {
        expect(p).toHaveProperty("name");
        expect(p).toHaveProperty("longitude");
        expect(p).toHaveProperty("sign");
        expect(p).toHaveProperty("degree_in_sign");
        expect(typeof p.longitude).toBe("number");
        expect(typeof p.sign).toBe("string");
      }
    });

    it("includes all 9 bodies", () => {
      const positions = getTransitPositions(new Date());
      const names = positions.map((p) => p.name);
      expect(names).toEqual(
        expect.arrayContaining([
          "Sun", "Moon", "Mercury", "Venus", "Mars",
          "Jupiter", "Saturn", "Rahu", "Ketu",
        ])
      );
    });

    it("Ketu longitude is 180 from Rahu", () => {
      const positions = getTransitPositions(new Date());
      const rahu = positions.find((p) => p.name === "Rahu")!;
      const ketu = positions.find((p) => p.name === "Ketu")!;
      const diff = Math.abs(rahu.longitude - ketu.longitude);
      const normalizedDiff = diff > 180 ? 360 - diff : diff;
      expect(normalizedDiff).toBeCloseTo(180, 2);
    });

    it("accepts optional engine_id", () => {
      const positions = getTransitPositions(new Date(), "raman_classic");
      expect(positions).toHaveLength(9);
    });
  });

  describe("getCurrentTransitPositions()", () => {
    it("returns transit positions for current moment", () => {
      const positions = getCurrentTransitPositions();
      expect(positions).toHaveLength(9);
    });
  });

  describe("computeTransitAspects()", () => {
    const natalPlanets: PlanetPosition[] = [
      { name: "Sun", longitude: 75, sign: "Gemini", degree_in_sign: 15, house: 1 },
      { name: "Moon", longitude: 200, sign: "Libra", degree_in_sign: 20, house: 5 },
      { name: "Mars", longitude: 30, sign: "Taurus", degree_in_sign: 0, house: 10 },
    ];

    const transitPositions: TransitPosition[] = [
      { name: "Sun", longitude: 75, sign: "Gemini", degree_in_sign: 15 },
      { name: "Saturn", longitude: 260, sign: "Sagittarius", degree_in_sign: 20 },
      { name: "Jupiter", longitude: 150, sign: "Virgo", degree_in_sign: 0 },
    ];

    it("returns array of transit aspects", () => {
      const aspects = computeTransitAspects(natalPlanets, transitPositions);
      expect(Array.isArray(aspects)).toBe(true);
    });

    it("detects conjunction when transit and natal planet are at same longitude", () => {
      const aspects = computeTransitAspects(natalPlanets, transitPositions);
      const conj = aspects.find(
        (a) => a.transit_planet === "Sun" && a.natal_planet === "Sun" && a.aspect_type === "Conjunction"
      );
      expect(conj).toBeDefined();
      expect(conj!.orb).toBeCloseTo(0, 1);
    });

    it("each aspect has required fields", () => {
      const aspects = computeTransitAspects(natalPlanets, transitPositions);
      for (const a of aspects) {
        expect(a).toHaveProperty("transit_planet");
        expect(a).toHaveProperty("natal_planet");
        expect(a).toHaveProperty("aspect_type");
        expect(a).toHaveProperty("orb");
        expect(typeof a.orb).toBe("number");
      }
    });

    it("aspect types are standard names", () => {
      const validTypes = ["Conjunction", "Opposition", "Trine", "Square", "Sextile"];
      const aspects = computeTransitAspects(natalPlanets, transitPositions);
      for (const a of aspects) {
        expect(validTypes).toContain(a.aspect_type);
      }
    });

    it("aspects are sorted by orb ascending", () => {
      const aspects = computeTransitAspects(natalPlanets, transitPositions);
      for (let i = 1; i < aspects.length; i++) {
        expect(aspects[i].orb).toBeGreaterThanOrEqual(aspects[i - 1].orb);
      }
    });

    it("orb must be within 8 degrees", () => {
      const aspects = computeTransitAspects(natalPlanets, transitPositions);
      for (const a of aspects) {
        expect(a.orb).toBeLessThanOrEqual(8);
      }
    });

    it("returns empty array when no aspects within orb", () => {
      const farNatal: PlanetPosition[] = [
        { name: "Sun", longitude: 0, sign: "Aries", degree_in_sign: 0, house: 1 },
      ];
      const farTransit: TransitPosition[] = [
        { name: "Moon", longitude: 35, sign: "Taurus", degree_in_sign: 5 },
      ];
      // 0 to 35 = 35 degrees; not near any standard aspect angle (0,60,90,120,180) within 8 deg orb
      const aspects = computeTransitAspects(farNatal, farTransit);
      expect(aspects).toHaveLength(0);
    });
  });
});
