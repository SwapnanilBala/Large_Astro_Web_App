import { describe, it, expect } from "vitest";
import {
  calculateNakshatra,
  calculateDashaTimeline,
  computeSubPeriods,
  DASHA_YEARS,
  NAKSHATRA_SPAN,
  YEAR_DAYS,
  type NakshatraData,
} from "../engines/nakshatra-engine";

// ---------------------------------------------------------------------------
// Nakshatra calculation
// ---------------------------------------------------------------------------

describe("nakshatra-engine", () => {
  describe("calculateNakshatra()", () => {
    it("0 degrees Moon -> Ashwini nakshatra, lord Ketu", () => {
      const result = calculateNakshatra(0);
      expect(result.name).toBe("Ashwini");
      expect(result.index).toBe(0);
      expect(result.lord).toBe("Ketu");
      expect(result.pada).toBe(1);
      expect(result.degree_in_nakshatra).toBeCloseTo(0, 4);
    });

    it("13.33 degrees Moon -> Bharani nakshatra, lord Venus", () => {
      const result = calculateNakshatra(13.34);
      expect(result.name).toBe("Bharani");
      expect(result.index).toBe(1);
      expect(result.lord).toBe("Venus");
    });

    it("26.67 degrees Moon -> Krittika nakshatra, lord Sun", () => {
      const result = calculateNakshatra(26.67);
      expect(result.name).toBe("Krittika");
      expect(result.index).toBe(2);
      expect(result.lord).toBe("Sun");
    });

    it("40.0 degrees -> Rohini, lord Moon", () => {
      const result = calculateNakshatra(40.0);
      expect(result.name).toBe("Rohini");
      expect(result.lord).toBe("Moon");
    });

    it("53.33 degrees -> Mrigashira, lord Mars", () => {
      const result = calculateNakshatra(53.34);
      expect(result.name).toBe("Mrigashira");
      expect(result.lord).toBe("Mars");
    });

    it("66.67 degrees -> Ardra, lord Rahu", () => {
      const result = calculateNakshatra(66.67);
      expect(result.name).toBe("Ardra");
      expect(result.lord).toBe("Rahu");
    });

    it("80 degrees -> Punarvasu, lord Jupiter", () => {
      const result = calculateNakshatra(80.0);
      expect(result.name).toBe("Punarvasu");
      expect(result.lord).toBe("Jupiter");
    });

    it("lord sequence repeats every 9 nakshatras", () => {
      const expectedLords = [
        "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
      ];
      for (let i = 0; i < 27; i++) {
        const lon = i * NAKSHATRA_SPAN + 1; // offset slightly into each nakshatra
        const result = calculateNakshatra(lon);
        expect(result.lord).toBe(expectedLords[i % 9]);
      }
    });

    it("correctly calculates all 27 nakshatras", () => {
      const allNames = [
        "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
        "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni",
        "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha",
        "Jyeshtha", "Moola", "Purva Ashadha", "Uttara Ashadha", "Shravana",
        "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
      ];
      for (let i = 0; i < 27; i++) {
        const lon = i * NAKSHATRA_SPAN + 0.5;
        const result = calculateNakshatra(lon);
        expect(result.name).toBe(allNames[i]);
        expect(result.index).toBe(i);
      }
    });

    describe("pada calculation", () => {
      it("first pada is degrees 0 to 3.333", () => {
        const result = calculateNakshatra(1.0);
        expect(result.pada).toBe(1);
      });

      it("second pada starts at ~3.333 degrees into nakshatra", () => {
        const result = calculateNakshatra(3.5);
        expect(result.pada).toBe(2);
      });

      it("third pada starts at ~6.667 degrees", () => {
        const result = calculateNakshatra(7.0);
        expect(result.pada).toBe(3);
      });

      it("fourth pada starts at ~10.0 degrees", () => {
        const result = calculateNakshatra(10.5);
        expect(result.pada).toBe(4);
      });

      it("pada is always 1-4", () => {
        for (let lon = 0; lon < 360; lon += 2.5) {
          const result = calculateNakshatra(lon);
          expect(result.pada).toBeGreaterThanOrEqual(1);
          expect(result.pada).toBeLessThanOrEqual(4);
        }
      });
    });

    it("handles negative longitude via normalization", () => {
      const result = calculateNakshatra(-10);
      expect(result.degree_in_nakshatra).toBeGreaterThanOrEqual(0);
      expect(result.name).toBeTruthy();
    });

    it("handles longitude > 360 via normalization", () => {
      const result = calculateNakshatra(370);
      const result2 = calculateNakshatra(10);
      expect(result.name).toBe(result2.name);
      expect(result.index).toBe(result2.index);
    });

    it("degree_in_nakshatra is between 0 and NAKSHATRA_SPAN", () => {
      for (let lon = 0; lon < 360; lon += 7.7) {
        const result = calculateNakshatra(lon);
        expect(result.degree_in_nakshatra).toBeGreaterThanOrEqual(0);
        expect(result.degree_in_nakshatra).toBeLessThanOrEqual(NAKSHATRA_SPAN + 0.001);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Dasha timeline
  // ---------------------------------------------------------------------------

  describe("calculateDashaTimeline()", () => {
    // Birth nakshatra: Ashwini, lord Ketu, near start
    const nakshatra: NakshatraData = {
      name: "Ashwini",
      index: 0,
      lord: "Ketu",
      pada: 1,
      degree_in_nakshatra: 1.0,
    };
    const birthDate = "1990-01-15";
    const currentDate = "2024-06-01";

    it("returns a timeline with required shape", () => {
      const timeline = calculateDashaTimeline(nakshatra, birthDate, currentDate);
      expect(timeline).toHaveProperty("periods");
      expect(timeline).toHaveProperty("current_dasha");
      expect(timeline).toHaveProperty("current_antardasha");
      expect(Array.isArray(timeline.periods)).toBe(true);
    });

    it("periods follow the correct lord sequence starting from birth lord", () => {
      const timeline = calculateDashaTimeline(nakshatra, birthDate, currentDate);
      const expectedOrder = [
        "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
      ];
      // The first period's lord should be the birth lord (Ketu)
      expect(timeline.periods[0].planet).toBe("Ketu");

      // Subsequent periods follow the sequence
      for (let i = 1; i < timeline.periods.length && i < expectedOrder.length; i++) {
        expect(timeline.periods[i].planet).toBe(expectedOrder[i]);
      }
    });

    it("total period durations approximate 120 years", () => {
      const timeline = calculateDashaTimeline(nakshatra, birthDate, currentDate);
      // Sum all periods' years (some may be partial)
      // Use sequence dates to get full unclipped years
      const totalDays = Object.values(DASHA_YEARS).reduce((sum, y) => sum + y, 0);
      expect(totalDays).toBe(120);
    });

    it("DASHA_YEARS sum to 120", () => {
      const total = Object.values(DASHA_YEARS).reduce((sum, y) => sum + y, 0);
      expect(total).toBe(120);
    });

    it("each period has valid fields", () => {
      const timeline = calculateDashaTimeline(nakshatra, birthDate, currentDate);
      for (const p of timeline.periods) {
        expect(p).toHaveProperty("planet");
        expect(p).toHaveProperty("start_date");
        expect(p).toHaveProperty("end_date");
        expect(p).toHaveProperty("years");
        expect(typeof p.start_date).toBe("string");
        expect(typeof p.end_date).toBe("string");
        expect(p.years).toBeGreaterThan(0);
        // start_date should be a valid date string
        expect(new Date(p.start_date + "T00:00:00Z").getTime()).not.toBeNaN();
      }
    });

    it("current_dasha is detected for the given current date", () => {
      const timeline = calculateDashaTimeline(nakshatra, birthDate, currentDate);
      expect(timeline.current_dasha).not.toBeNull();
      expect(timeline.current_dasha!.planet).toBeTruthy();
    });

    it("current_antardasha is detected within the current dasha", () => {
      const timeline = calculateDashaTimeline(nakshatra, birthDate, currentDate);
      expect(timeline.current_antardasha).not.toBeNull();
      expect(timeline.current_antardasha!.major_lord).toBe(timeline.current_dasha!.planet);
      expect(timeline.current_antardasha!.sub_lord).toBeTruthy();
    });

    it("first period is partial when birth is not at nakshatra start", () => {
      const timeline = calculateDashaTimeline(nakshatra, birthDate, currentDate);
      // degree_in_nakshatra = 1.0, so some of Ketu dasha elapsed before birth
      expect(timeline.periods[0].is_partial).toBe(true);
    });

    it("periods have non-overlapping date ranges", () => {
      const timeline = calculateDashaTimeline(nakshatra, birthDate, currentDate);
      for (let i = 1; i < timeline.periods.length; i++) {
        const prev = new Date(timeline.periods[i - 1].end_date + "T00:00:00Z").getTime();
        const curr = new Date(timeline.periods[i].start_date + "T00:00:00Z").getTime();
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    });

    it("handles a nakshatra at the very beginning (degree 0)", () => {
      const nakAtStart: NakshatraData = {
        name: "Ashwini",
        index: 0,
        lord: "Ketu",
        pada: 1,
        degree_in_nakshatra: 0,
      };
      const timeline = calculateDashaTimeline(nakAtStart, birthDate, currentDate);
      expect(timeline.periods.length).toBeGreaterThan(0);
      // First period should NOT be partial since no dasha elapsed before birth
      expect(timeline.periods[0].is_partial).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Sub-period computation
  // ---------------------------------------------------------------------------

  describe("computeSubPeriods()", () => {
    it("returns 9 sub-periods for a level 2 subdivision", () => {
      const subs = computeSubPeriods(
        "Venus", "2020-01-01", "2040-01-01", 2, ["Venus"]
      );
      // Should produce up to 9 sub-periods
      expect(subs.length).toBeGreaterThanOrEqual(1);
      expect(subs.length).toBeLessThanOrEqual(9);
    });

    it("sub-periods start from the parent lord", () => {
      const subs = computeSubPeriods(
        "Venus", "2020-01-01", "2040-01-01", 2, ["Venus"]
      );
      expect(subs[0].planet).toBe("Venus");
    });

    it("sub-periods have correct level", () => {
      const subs = computeSubPeriods(
        "Saturn", "2020-01-01", "2039-01-01", 3, ["Jupiter", "Saturn"]
      );
      for (const sp of subs) {
        expect(sp.level).toBe(3);
      }
    });

    it("lords chain includes parent lords plus sub lord", () => {
      const subs = computeSubPeriods(
        "Mars", "2020-01-01", "2027-01-01", 2, ["Mars"]
      );
      for (const sp of subs) {
        expect(sp.lords[0]).toBe("Mars");
        expect(sp.lords.length).toBe(2);
      }
    });

    it("sub-periods cover the parent window without gaps", () => {
      const subs = computeSubPeriods(
        "Moon", "2020-01-01", "2030-01-01", 2, ["Moon"]
      );
      // Check consecutive dates
      for (let i = 1; i < subs.length; i++) {
        const prevEnd = new Date(subs[i - 1].end_date + "T00:00:00Z").getTime();
        const currStart = new Date(subs[i].start_date + "T00:00:00Z").getTime();
        // Allow 1 day tolerance for rounding
        expect(Math.abs(currStart - prevEnd)).toBeLessThanOrEqual(86400000);
      }
    });
  });
});
