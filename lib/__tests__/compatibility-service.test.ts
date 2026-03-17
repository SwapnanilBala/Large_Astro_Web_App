import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock swisseph
// ---------------------------------------------------------------------------
vi.mock("swisseph", () => {
  // Two different charts: primary and partner get different positions
  // based on the julian day. Since the mock swe_julday returns different
  // values for different birth dates, we use that to distinguish.
  let callCount = 0;

  const PRIMARY_LONGITUDES: Record<number, number> = {
    0: 45.5,    // Sun - Taurus
    1: 120.25,  // Moon - Leo (Fire)
    2: 50.0,    // Mercury - Taurus
    3: 200.8,   // Venus - Libra
    4: 15.0,    // Mars - Aries
    5: 90.0,    // Jupiter - Cancer
    6: 270.0,   // Saturn - Capricorn
    10: 150.0,  // Rahu - Virgo
  };

  const PARTNER_LONGITUDES: Record<number, number> = {
    0: 130.0,   // Sun - Leo (Fire)
    1: 125.0,   // Moon - Leo (Fire, same element as primary)
    2: 55.0,    // Mercury - Taurus
    3: 210.0,   // Venus - Libra
    4: 200.0,   // Mars - Libra
    5: 180.0,   // Jupiter - Libra
    6: 300.0,   // Saturn - Aquarius
    10: 20.0,   // Rahu - Aries
  };

  return {
    default: {
      SE_SUN: 0, SE_MOON: 1, SE_MERCURY: 2, SE_VENUS: 3,
      SE_MARS: 4, SE_JUPITER: 5, SE_SATURN: 6, SE_MEAN_NODE: 10,
      SE_GREG_CAL: 1, SEFLG_SWIEPH: 2, SEFLG_SIDEREAL: 64, SEFLG_MOSEPH: 4,
      SE_SIDM_LAHIRI: 1, SE_SIDM_RAMAN: 3, SE_SIDM_KRISHNAMURTI: 5,

      swe_julday: vi.fn((year: number) => {
        callCount++;
        return 2451545.0 + (year - 2000) * 365.25;
      }),
      swe_set_sid_mode: vi.fn(),
      swe_calc_ut: vi.fn((jd: number, planet: number) => {
        // Distinguish primary vs partner by julian day (different birth years)
        const isPartner = jd > 2451545.0 + 2 * 365.25; // year > 2002
        const longitudes = isPartner ? PARTNER_LONGITUDES : PRIMARY_LONGITUDES;
        const lon = longitudes[planet];
        if (lon === undefined) return { error: "unknown" };
        return { longitude: lon, latitude: 0, distance: 1 };
      }),
      swe_houses_ex: vi.fn((jd: number) => {
        const isPartner = jd > 2451545.0 + 2 * 365.25;
        return { ascendant: isPartner ? 60.0 : 30.0, cusps: Array(13).fill(0) };
      }),
    },
  };
});

import {
  buildCompatibility,
  type BirthDetailsInput,
  type CompatibilityResponse,
} from "../engines/compatibility-service";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PRIMARY: BirthDetailsInput = {
  name: "Alice",
  birth_date: "1990-06-15",
  birth_time: "14:30",
  latitude: 28.6139,
  longitude: 77.209,
  timezone_offset_minutes: 330,
  country: "India",
  city: "Delhi",
};

const PARTNER: BirthDetailsInput = {
  name: "Bob",
  birth_date: "2005-03-20",
  birth_time: "10:00",
  latitude: 40.7128,
  longitude: -74.006,
  timezone_offset_minutes: -300,
  country: "USA",
  city: "New York",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("compatibility-service", () => {
  describe("buildCompatibility()", () => {
    it("returns CompatibilityResponse shape", () => {
      const result = buildCompatibility(PRIMARY, PARTNER);
      expect(result).toHaveProperty("generated_at_utc");
      expect(result).toHaveProperty("primary_client");
      expect(result).toHaveProperty("partner_client");
      expect(result).toHaveProperty("compatibility_score");
      expect(result).toHaveProperty("summary");
      expect(result).toHaveProperty("themes");
      expect(result).toHaveProperty("synastry_aspects");
      expect(result).toHaveProperty("saved_comparison_id");
    });

    it("compatibility_score is between 20 and 98", () => {
      const result = buildCompatibility(PRIMARY, PARTNER);
      expect(result.compatibility_score).toBeGreaterThanOrEqual(20);
      expect(result.compatibility_score).toBeLessThanOrEqual(98);
    });

    it("client profiles reflect input names", () => {
      const result = buildCompatibility(PRIMARY, PARTNER);
      expect(result.primary_client.name).toBe("Alice");
      expect(result.partner_client.name).toBe("Bob");
    });

    it("client profiles include location data", () => {
      const result = buildCompatibility(PRIMARY, PARTNER);
      expect(result.primary_client.latitude).toBe(28.6139);
      expect(result.partner_client.latitude).toBe(40.7128);
      expect(result.primary_client.timezone_offset_minutes).toBe(330);
    });

    it("themes array is non-empty", () => {
      const result = buildCompatibility(PRIMARY, PARTNER);
      expect(result.themes.length).toBeGreaterThanOrEqual(3);
    });

    it("themes have required fields", () => {
      const result = buildCompatibility(PRIMARY, PARTNER);
      for (const theme of result.themes) {
        expect(theme).toHaveProperty("title");
        expect(theme).toHaveProperty("insight");
        expect(theme).toHaveProperty("confidence_score");
        expect(typeof theme.title).toBe("string");
        expect(typeof theme.insight).toBe("string");
        expect(theme.confidence_score).toBeGreaterThan(0);
        expect(theme.confidence_score).toBeLessThanOrEqual(1);
      }
    });

    it("includes Emotional Rhythm, Attraction Pattern, and Communication Style themes", () => {
      const result = buildCompatibility(PRIMARY, PARTNER);
      const titles = result.themes.map((t) => t.title);
      expect(titles).toContain("Emotional Rhythm");
      expect(titles).toContain("Attraction Pattern");
      expect(titles).toContain("Communication Style");
    });

    it("includes either Growth Edge or Long-Term Potential", () => {
      const result = buildCompatibility(PRIMARY, PARTNER);
      const titles = result.themes.map((t) => t.title);
      const hasGrowthOrLong = titles.includes("Growth Edge") || titles.includes("Long-Term Potential");
      expect(hasGrowthOrLong).toBe(true);
    });

    it("synastry_aspects is an array", () => {
      const result = buildCompatibility(PRIMARY, PARTNER);
      expect(Array.isArray(result.synastry_aspects)).toBe(true);
    });

    it("synastry aspects have required fields", () => {
      const result = buildCompatibility(PRIMARY, PARTNER);
      for (const aspect of result.synastry_aspects) {
        expect(aspect).toHaveProperty("primary_planet");
        expect(aspect).toHaveProperty("partner_planet");
        expect(aspect).toHaveProperty("aspect_type");
        expect(aspect).toHaveProperty("orb");
        expect(aspect).toHaveProperty("harmonious");
        expect(typeof aspect.harmonious).toBe("boolean");
      }
    });

    it("synastry aspects only include priority planets", () => {
      const priorityPlanets = new Set([
        "Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn",
      ]);
      const result = buildCompatibility(PRIMARY, PARTNER);
      for (const aspect of result.synastry_aspects) {
        expect(priorityPlanets.has(aspect.primary_planet)).toBe(true);
        expect(priorityPlanets.has(aspect.partner_planet)).toBe(true);
      }
    });

    it("synastry aspects are capped at 18", () => {
      const result = buildCompatibility(PRIMARY, PARTNER);
      expect(result.synastry_aspects.length).toBeLessThanOrEqual(18);
    });

    it("synastry aspects are sorted by orb ascending", () => {
      const result = buildCompatibility(PRIMARY, PARTNER);
      for (let i = 1; i < result.synastry_aspects.length; i++) {
        expect(result.synastry_aspects[i].orb).toBeGreaterThanOrEqual(
          result.synastry_aspects[i - 1].orb
        );
      }
    });

    it("harmonious is true for Conjunction, Trine, Sextile", () => {
      const result = buildCompatibility(PRIMARY, PARTNER);
      const harmoniousTypes = new Set(["Conjunction", "Trine", "Sextile"]);
      for (const a of result.synastry_aspects) {
        if (harmoniousTypes.has(a.aspect_type)) {
          expect(a.harmonious).toBe(true);
        }
      }
    });

    it("harmonious is false for Square and Opposition", () => {
      const result = buildCompatibility(PRIMARY, PARTNER);
      for (const a of result.synastry_aspects) {
        if (a.aspect_type === "Square" || a.aspect_type === "Opposition") {
          expect(a.harmonious).toBe(false);
        }
      }
    });

    it("summary is a non-empty string mentioning both names", () => {
      const result = buildCompatibility(PRIMARY, PARTNER);
      expect(typeof result.summary).toBe("string");
      expect(result.summary.length).toBeGreaterThan(0);
      expect(result.summary).toContain("Alice");
      expect(result.summary).toContain("Bob");
    });

    it("saved_comparison_id is null (no persistence)", () => {
      const result = buildCompatibility(PRIMARY, PARTNER);
      expect(result.saved_comparison_id).toBeNull();
    });

    it("generated_at_utc is an ISO date string", () => {
      const result = buildCompatibility(PRIMARY, PARTNER);
      const parsed = new Date(result.generated_at_utc);
      expect(parsed.getTime()).not.toBeNaN();
    });
  });
});
