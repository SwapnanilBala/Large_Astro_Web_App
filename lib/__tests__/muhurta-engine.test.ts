import { describe, it, expect } from "vitest";
import {
  findMuhurta,
  getRahukaala,
  getYamaghantaka,
  getHoraLord,
} from "../engines/muhurta-engine";

/**
 * Characterisation tests for the muhurta engine.
 *
 * These exist to pin the panchanga limb mappings -- tithi, nakshatra, yoga,
 * karana, weekday, hora -- through the engine's public surface, so that
 * moving that math into lib/engines/panchanga.ts is provably behaviour-
 * preserving. A transposed index in a 27-entry nakshatra table or a 60-entry
 * yoga table is not something you would notice by looking at the muhurta
 * panel; it would just quietly recommend the wrong hours.
 *
 * They are deliberately assertions about current output, not about what the
 * output ought to be. If a deliberate change to the model makes one fail, the
 * expected values are what need updating -- but a failure during a pure
 * refactor means the refactor broke something.
 *
 * No mocking: findMuhurta reads planet positions through
 * computeTransitPositions, which uses astronomy-engine rather than the
 * swisseph binding, so the whole path is deterministic for a fixed date.
 */

// New York, so the sunrise/sunset-derived factors (Rahukaala, Yamaghantaka,
// Hora) all resolve against a mid-latitude day rather than the polar
// fallbacks approxSunriseSunset returns above |lat| 66.
const LAT = 40.7128;
const LON = -74.006;
const TZ = -300;

const WEEK_START = new Date("2024-06-22T00:00:00Z");

describe("findMuhurta", () => {
  it("returns a stable set of windows for a fixed five-day search", () => {
    const windows = findMuhurta(
      "general_auspicious",
      WEEK_START,
      new Date("2024-06-27T00:00:00Z"),
      LAT,
      LON,
      TZ
    );

    expect(windows).toHaveLength(5);

    // Sorted by score descending, so the best window is first.
    expect(windows[0]).toEqual({
      start: "2024-06-25T18:00:00.000Z",
      end: "2024-06-26T20:00:00.000Z",
      score: 98,
      quality: "excellent",
      factors: [
        {
          name: "Tithi",
          value: "Panchami (20/30)",
          quality: "Purna (full/complete)",
          score: 18,
        },
        {
          name: "Nakshatra",
          value: "Dhanishta",
          quality: "Movable (Chara)",
          score: 15,
        },
        { name: "Yoga", value: "Priti", quality: "auspicious", score: 15 },
        { name: "Karana", value: "Kaulava", quality: "auspicious", score: 8 },
        { name: "Weekday", value: "Tuesday", quality: "neutral", score: 0 },
        {
          name: "Rahukaala",
          value: "Clear",
          quality: "favorable",
          score: 0,
        },
        {
          name: "Yamaghantaka",
          value: "Clear",
          quality: "favorable",
          score: 0,
        },
        {
          name: "Hora",
          value: "Saturn hora",
          quality: "inauspicious",
          score: -5,
        },
      ],
      recommendation:
        "Highly favorable for general auspicious. Panchami (20/30) tithi " +
        "supports this activity. Moon in Dhanishta adds a movable (chara) " +
        "quality. Priti yoga enhances the timing. Saturn hora is malefic " +
        "during this window.",
    });

    expect(windows.every((w) => w.score >= 60)).toBe(true);
    expect(windows.map((w) => w.score)).toEqual(
      [...windows.map((w) => w.score)].sort((a, b) => b - a)
    );
  });

  it("maps every panchanga limb the same way across a twenty-day sweep", () => {
    // Twenty days is long enough for the Moon to cross several nakshatras and
    // tithis, so this reaches six tithis over three groups, nine yogas over
    // all three qualities, four karanas and six horas. That breadth is the
    // point: it is what makes the tables hard to move incorrectly without a
    // failure here.
    const windows = findMuhurta(
      "general_auspicious",
      WEEK_START,
      new Date("2024-07-12T00:00:00Z"),
      LAT,
      LON,
      TZ
    );

    const distinct: Record<string, string[]> = {};
    for (const window of windows) {
      for (const factor of window.factors) {
        const bucket = (distinct[factor.name] ??= []);
        const entry = `${factor.value}|${factor.quality}|${factor.score}`;
        if (!bucket.includes(entry)) bucket.push(entry);
      }
    }
    for (const key of Object.keys(distinct)) distinct[key].sort();

    expect(distinct).toEqual({
      Tithi: [
        "Dashami (25/30)|Purna (full/complete)|18",
        "Panchami (20/30)|Purna (full/complete)|18",
        "Panchami (5/30)|Purna (full/complete)|18",
        "Pratipada (1/30)|Nanda (joyful)|15",
        "Pratipada (16/30)|Nanda (joyful)|15",
        "Saptami (22/30)|Bhadra (auspicious)|12",
      ],
      Nakshatra: [
        "Ashwini|Movable (Chara)|15",
        "Dhanishta|Movable (Chara)|15",
        "Punarvasu|Movable (Chara)|15",
        "Purva Ashadha|Mixed (Sadharana)|5",
        "Purva Bhadrapada|Mixed (Sadharana)|5",
        "Purva Phalguni|Mixed (Sadharana)|5",
      ],
      Yoga: [
        "Brahma|auspicious|15",
        "Harshana|auspicious|15",
        "Priti|auspicious|15",
        "Saubhagya|auspicious|15",
        "Sukarma|auspicious|15",
        "Variyana|neutral|0",
        "Vishkambha|inauspicious|-12",
        "Vyaghata|inauspicious|-12",
        "Vyatipata|inauspicious|-12",
      ],
      Karana: [
        "Balava|auspicious|8",
        "Bava|auspicious|8",
        "Kaulava|auspicious|8",
        "Vanija|neutral|0",
      ],
      Weekday: [
        "Saturday|neutral|0",
        "Sunday|neutral|0",
        "Thursday|favorable|12",
        "Tuesday|neutral|0",
        "Wednesday|favorable|10",
      ],
      Rahukaala: ["Clear|favorable|0"],
      Yamaghantaka: ["Clear|favorable|0"],
      Hora: [
        "Jupiter hora|auspicious|10",
        "Mercury hora|auspicious|10",
        "Moon hora|auspicious|10",
        "Saturn hora|inauspicious|-5",
        "Sun hora|neutral|0",
        "Venus hora|auspicious|10",
      ],
    });
  });
});

describe("inauspicious period and hora helpers", () => {
  const noon = new Date("2024-06-22T12:00:00Z");

  it("places Rahukaala and Yamaghantaka in their weekday slots", () => {
    expect(getRahukaala(noon, LAT, TZ)).toEqual({
      start: new Date("2024-06-22T13:16:12.233Z"),
      end: new Date("2024-06-22T15:08:06.116Z"),
    });

    expect(getYamaghantaka(noon, LAT, TZ)).toEqual({
      start: new Date("2024-06-22T18:51:53.883Z"),
      end: new Date("2024-06-22T20:43:47.766Z"),
    });
  });

  it("both periods are one eighth of the day apart in length", () => {
    // Each is one of eight equal parts of sunrise-to-sunset, so on any given
    // day they must be the same length as each other. This is the invariant
    // that survives a change to the sunrise approximation, where the exact
    // timestamps above would not.
    const rahu = getRahukaala(noon, LAT, TZ);
    const yama = getYamaghantaka(noon, LAT, TZ);
    const rahuMs = rahu.end.getTime() - rahu.start.getTime();
    const yamaMs = yama.end.getTime() - yama.start.getTime();

    expect(rahuMs).toBe(yamaMs);
    expect(rahu.start.getTime()).toBeLessThan(yama.start.getTime());
  });

  it("resolves the hora lord", () => {
    expect(getHoraLord(noon, LAT, TZ)).toBe("Jupiter");
  });
});
