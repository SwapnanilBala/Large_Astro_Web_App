import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock swisseph
// ---------------------------------------------------------------------------
vi.mock("swisseph", () => {
  const PLANET_LONGITUDES: Record<number, number> = {
    0: 45.5,    // Sun - Taurus
    1: 120.25,  // Moon - Leo
    2: 50.0,    // Mercury - Taurus
    3: 200.8,   // Venus - Libra
    4: 15.0,    // Mars - Aries
    5: 90.0,    // Jupiter - Cancer
    6: 270.0,   // Saturn - Capricorn
    10: 150.0,  // Rahu - Virgo
  };

  return {
    default: {
      SE_SUN: 0, SE_MOON: 1, SE_MERCURY: 2, SE_VENUS: 3,
      SE_MARS: 4, SE_JUPITER: 5, SE_SATURN: 6, SE_MEAN_NODE: 10,
      SE_GREG_CAL: 1, SEFLG_SWIEPH: 2, SEFLG_SIDEREAL: 64, SEFLG_MOSEPH: 4,
      SE_SIDM_LAHIRI: 1, SE_SIDM_RAMAN: 3, SE_SIDM_KRISHNAMURTI: 5,
      swe_julday: vi.fn(() => 2451545.5),
      swe_set_sid_mode: vi.fn(),
      swe_calc_ut: vi.fn((_jd: number, planet: number) => {
        const lon = PLANET_LONGITUDES[planet];
        if (lon === undefined) return { error: "unknown" };
        return { longitude: lon, latitude: 0, distance: 1 };
      }),
      swe_houses_ex: vi.fn(() => ({ ascendant: 30.0, cusps: Array(13).fill(0) })),
    },
  };
});

import {
  buildChart,
  buildForecast,
  type ChartResponse,
  type ForecastReading,
} from "../engines/chart-service";
import type { BirthDetailsInput } from "../engines/compatibility-service";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BIRTH: BirthDetailsInput = {
  name: "Test User",
  birth_date: "1990-06-15",
  birth_time: "14:30",
  latitude: 28.6139,
  longitude: 77.209,
  timezone_offset_minutes: 330,
  country: "India",
  state: "Delhi",
  city: "New Delhi",
  town: "",
  time_zone_id: "Asia/Kolkata",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("chart-service", () => {
  describe("buildChart()", () => {
    it("returns complete ChartResponse shape", () => {
      const chart = buildChart(BIRTH);
      expect(chart).toHaveProperty("generated_at_utc");
      expect(chart).toHaveProperty("client");
      expect(chart).toHaveProperty("chart");
      expect(chart).toHaveProperty("engine");
      expect(chart).toHaveProperty("storage");
      expect(chart).toHaveProperty("access");
    });

    it("client section mirrors birth input", () => {
      const chart = buildChart(BIRTH);
      expect(chart.client.name).toBe("Test User");
      expect(chart.client.country).toBe("India");
      expect(chart.client.latitude).toBe(28.6139);
      expect(chart.client.longitude).toBe(77.209);
      expect(chart.client.timezone_offset_minutes).toBe(330);
    });

    it("chart section has planets, houses, ascendant, rules", () => {
      const chart = buildChart(BIRTH);
      expect(chart.chart.planets).toHaveLength(9);
      expect(chart.chart.houses).toHaveLength(12);
      expect(chart.chart.ascendant).toHaveProperty("sign");
      expect(chart.chart.deterministic_rules.length).toBeGreaterThan(0);
      expect(typeof chart.chart.summary).toBe("string");
    });

    it("engine section has correct preset info", () => {
      const chart = buildChart(BIRTH);
      expect(chart.engine.engine_id).toBe("lahiri_classic");
      expect(chart.engine.engine_label).toBe("Lahiri Classic");
      expect(chart.engine.ayanamsha).toBe("Lahiri");
      expect(chart.engine.house_system).toBe("Whole Sign");
      expect(chart.engine.available_engines.length).toBeGreaterThanOrEqual(3);
    });

    it("storage section reports not configured", () => {
      const chart = buildChart(BIRTH);
      expect(chart.storage.configured).toBe(false);
      expect(chart.storage.persisted).toBe(false);
    });

    describe("premium tier", () => {
      it("includePremium=true includes nakshatra, dasha, aspects, navamsa", () => {
        const chart = buildChart(BIRTH, { includePremium: true });
        expect(chart.chart.nakshatra).not.toBeNull();
        expect(chart.chart.dasha).not.toBeNull();
        expect(chart.chart.aspects).not.toBeNull();
        expect(chart.chart.navamsa).not.toBeNull();
      });

      it("nakshatra has correct shape", () => {
        const chart = buildChart(BIRTH, { includePremium: true });
        const nak = chart.chart.nakshatra!;
        expect(nak).toHaveProperty("name");
        expect(nak).toHaveProperty("index");
        expect(nak).toHaveProperty("lord");
        expect(nak).toHaveProperty("pada");
        expect(nak).toHaveProperty("degree_in_nakshatra");
      });

      it("dasha has current period info", () => {
        const chart = buildChart(BIRTH, { includePremium: true });
        const dasha = chart.chart.dasha!;
        expect(dasha).toHaveProperty("current_dasha");
        expect(dasha).toHaveProperty("current_antardasha");
        expect(dasha).toHaveProperty("periods");
        expect(dasha.periods.length).toBeGreaterThan(0);
      });

      it("aspects are an array of aspect objects", () => {
        const chart = buildChart(BIRTH, { includePremium: true });
        const aspects = chart.chart.aspects!;
        expect(Array.isArray(aspects)).toBe(true);
        if (aspects.length > 0) {
          expect(aspects[0]).toHaveProperty("planet1");
          expect(aspects[0]).toHaveProperty("planet2");
          expect(aspects[0]).toHaveProperty("aspect_type");
          expect(aspects[0]).toHaveProperty("vedic");
        }
      });

      it("navamsa has positions for all planets", () => {
        const chart = buildChart(BIRTH, { includePremium: true });
        const navamsa = chart.chart.navamsa!;
        expect(navamsa).toHaveLength(9);
        for (const n of navamsa) {
          expect(n).toHaveProperty("name");
          expect(n).toHaveProperty("rashi_sign");
          expect(n).toHaveProperty("navamsa_sign");
        }
      });

      it("calculation_audit is present", () => {
        const chart = buildChart(BIRTH, { includePremium: true });
        expect(chart.chart.calculation_audit).not.toBeNull();
        expect(chart.chart.calculation_audit).toHaveProperty("engine_id");
        expect(chart.chart.calculation_audit).toHaveProperty("moon_sidereal_longitude");
      });
    });

    describe("guest tier (no premium)", () => {
      it("excludes nakshatra, dasha, aspects, navamsa", () => {
        const chart = buildChart(BIRTH, { includePremium: false });
        expect(chart.chart.nakshatra).toBeNull();
        expect(chart.chart.dasha).toBeNull();
        expect(chart.chart.aspects).toBeNull();
        expect(chart.chart.navamsa).toBeNull();
      });

      it("locked_features includes premium features", () => {
        const chart = buildChart(BIRTH, { includePremium: false });
        expect(chart.access.locked_features).toEqual(
          expect.arrayContaining([
            "nakshatra_dasha",
            "planetary_aspects",
            "navamsa_d9",
            "live_transits",
          ])
        );
      });

      it("premium_features_enabled is false", () => {
        const chart = buildChart(BIRTH, { includePremium: false });
        expect(chart.access.premium_features_enabled).toBe(false);
      });
    });

    describe("ultimate tier", () => {
      it("includeUltimate=true includes life_domain_insights", () => {
        const chart = buildChart(BIRTH, { includePremium: true, includeUltimate: true });
        expect(chart.chart.life_domain_insights).not.toBeNull();
        expect(chart.chart.life_domain_insights!.length).toBe(7);
      });

      it("includeUltimate=false locks life_domain_readings", () => {
        const chart = buildChart(BIRTH, { includeUltimate: false });
        expect(chart.access.locked_features).toContain("life_domain_readings");
      });
    });

    describe("transits", () => {
      it("transits are null when includeTransits=false", () => {
        const chart = buildChart(BIRTH, { includeTransits: false, includePremium: true });
        expect(chart.transits).toBeNull();
      });

      it("transits are populated when includeTransits=true and premium", () => {
        const chart = buildChart(BIRTH, { includeTransits: true, includePremium: true });
        expect(chart.transits).not.toBeNull();
        expect(chart.transits!.positions).toHaveLength(9);
        expect(chart.transits!).toHaveProperty("computed_at_utc");
        expect(Array.isArray(chart.transits!.active_aspects)).toBe(true);
      });
    });

    describe("subscription tier", () => {
      it("defaults to guest tier", () => {
        const chart = buildChart(BIRTH);
        expect(chart.access.subscription_tier).toBe("guest");
      });

      it("respects custom subscription tier", () => {
        const chart = buildChart(BIRTH, { subscriptionTier: "premium" });
        expect(chart.access.subscription_tier).toBe("premium");
      });
    });

    describe("engine_id selection", () => {
      it("uses lahiri_classic by default", () => {
        const chart = buildChart(BIRTH);
        expect(chart.engine.engine_id).toBe("lahiri_classic");
      });

      it("uses specified engine_id", () => {
        const chart = buildChart({ ...BIRTH, engine_id: "raman_classic" });
        expect(chart.engine.engine_id).toBe("raman_classic");
      });
    });
  });

  describe("buildForecast()", () => {
    it("returns ForecastReading shape", () => {
      const forecast = buildForecast(BIRTH, "2024-12-01");
      expect(forecast).toHaveProperty("target_date");
      expect(forecast).toHaveProperty("headline");
      expect(forecast).toHaveProperty("overview");
      expect(forecast).toHaveProperty("dasha");
      expect(forecast).toHaveProperty("focus_areas");
      expect(forecast).toHaveProperty("opportunities");
      expect(forecast).toHaveProperty("cautions");
      expect(forecast).toHaveProperty("supportive_transits");
      expect(forecast).toHaveProperty("challenging_transits");
    });

    it("target_date matches input", () => {
      const forecast = buildForecast(BIRTH, "2025-03-15");
      expect(forecast.target_date).toBe("2025-03-15");
    });

    it("headline is a non-empty string", () => {
      const forecast = buildForecast(BIRTH, "2024-12-01");
      expect(typeof forecast.headline).toBe("string");
      expect(forecast.headline.length).toBeGreaterThan(0);
    });

    it("dasha section has periods and current info", () => {
      const forecast = buildForecast(BIRTH, "2024-12-01");
      expect(forecast.dasha.periods.length).toBeGreaterThan(0);
      expect(forecast.dasha.current_dasha).toBeTruthy();
    });

    it("focus_areas has at most 4 items", () => {
      const forecast = buildForecast(BIRTH, "2024-12-01");
      expect(forecast.focus_areas.length).toBeLessThanOrEqual(4);
    });

    it("opportunities and cautions are arrays", () => {
      const forecast = buildForecast(BIRTH, "2024-12-01");
      expect(Array.isArray(forecast.opportunities)).toBe(true);
      expect(Array.isArray(forecast.cautions)).toBe(true);
      expect(forecast.opportunities.length).toBeGreaterThan(0);
      expect(forecast.cautions.length).toBeGreaterThan(0);
    });

    it("supportive and challenging transits are arrays", () => {
      const forecast = buildForecast(BIRTH, "2024-12-01");
      expect(Array.isArray(forecast.supportive_transits)).toBe(true);
      expect(Array.isArray(forecast.challenging_transits)).toBe(true);
    });

    it("transit insights have tone field", () => {
      const forecast = buildForecast(BIRTH, "2024-12-01");
      for (const t of forecast.supportive_transits) {
        expect(t.tone).toBe("supportive");
      }
      for (const t of forecast.challenging_transits) {
        expect(t.tone).toBe("challenging");
      }
    });
  });
});
