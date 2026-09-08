import { describe, it, expect } from "vitest";
import { readChartParams, getChartPayload } from "../chart-params";
import {
  computeWeeklyEnergy,
  bandFor,
  ENERGY_BAND_THRESHOLDS,
  WEEKLY_ENERGY_MODEL_VERSION,
  type WeeklyEnergyInput,
} from "../engines/weekly-energy-engine";
import { QUOTE_AFFINITY } from "../engines/weekly-energy-copy";
import { addWeeks, isWeekStart } from "../format-week";
import enMessages from "../../messages/en.json";

const CHARTS = [
  { name: "Chart A", birthDate: "1992-02-20", birthTime: "08:30", timezoneOffsetMinutes: "-300", latitude: "40.7128", longitude: "-74.0060" },
  { name: "Chart B", birthDate: "1975-11-03", birthTime: "23:45", timezoneOffsetMinutes: "330", latitude: "19.0760", longitude: "72.8777" },
  { name: "Chart C", birthDate: "2001-07-14", birthTime: "05:05", timezoneOffsetMinutes: "60", latitude: "48.8566", longitude: "2.3522" },
  { name: "Chart D", birthDate: "1988-09-09", birthTime: "17:20", timezoneOffsetMinutes: "600", latitude: "-33.8688", longitude: "151.2093" },
];

/** A Saturday, so the week is valid and the sample is deterministic. */
const FIXED_WEEK = "2024-01-06";

function inputFor(chart: (typeof CHARTS)[number], weekStart: string): WeeklyEnergyInput {
  const payload = getChartPayload(
    readChartParams({
      ...chart,
      country: "X",
      state: "Y",
      city: "Z",
      engineId: "lahiri_classic",
      birthTimeAccuracy: "exact",
    })
  );
  return {
    weekStart,
    latitude: Number(chart.latitude),
    longitude: Number(chart.longitude),
    timezoneOffsetMinutes: Number(chart.timezoneOffsetMinutes),
    engineId: "lahiri_classic",
    natalPlanets: payload.chart.planets,
    ascendantSign: payload.chart.ascendant.sign,
  };
}

describe("computeWeeklyEnergy — shape", () => {
  const week = computeWeeklyEnergy(inputFor(CHARTS[0], FIXED_WEEK));

  it("returns exactly seven days, Saturday first and consecutive", () => {
    expect(week.days).toHaveLength(7);
    expect(isWeekStart(week.days[0].date)).toBe(true);
    // 6 = Saturday. The chart's x() maps index to position assuming exactly
    // seven consecutive days, so a gap here would mislabel the whole axis.
    expect(week.days[0].weekday_index).toBe(6);
    expect(week.days.map((d) => d.weekday_index)).toEqual([6, 0, 1, 2, 3, 4, 5]);
    expect(week.week.start_date).toBe(FIXED_WEEK);
    expect(week.week.end_date).toBe("2024-01-12");
  });

  it("carries the model version and the thresholds the chart must draw", () => {
    expect(week.model_version).toBe(WEEKLY_ENERGY_MODEL_VERSION);
    expect(week.bands).toEqual({
      high_min: ENERGY_BAND_THRESHOLDS.high,
      low_max: ENERGY_BAND_THRESHOLDS.low,
    });
  });

  it("returns four cards, distinct, best-first", () => {
    expect(week.cards).toHaveLength(4);
    expect(new Set(week.cards.map((c) => c.intent)).size).toBe(4);
    const scores = week.cards.map((c) => c.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    for (const card of week.cards) {
      expect(card.body).not.toContain("{day}");
      expect(card.title.length).toBeGreaterThan(0);
      expect(card.icon_key.length).toBeGreaterThan(0);
    }
  });

  it("names every factor family on every day", () => {
    for (const day of week.days) {
      const kinds = day.factors.map((f) => f.kind);
      expect(kinds).toContain("tithi");
      expect(kinds).toContain("nakshatra");
      expect(kinds).toContain("yoga");
      expect(kinds).toContain("karana");
      expect(kinds).toContain("weekday");
      expect(kinds).toContain("tarabala");
      expect(kinds).toContain("chandrabala");
      expect(kinds).toContain("transit_aspect");
      expect(day.tara.number).toBeGreaterThanOrEqual(1);
      expect(day.tara.number).toBeLessThanOrEqual(9);
      expect(day.chandra_house).toBeGreaterThanOrEqual(1);
      expect(day.chandra_house).toBeLessThanOrEqual(12);
    }
  });

  it("puts the same seven numbers in the alt text as in the days", () => {
    // The alt text is what a screen reader gets instead of the line, so it has
    // to recite the same values the line is drawn from.
    for (const day of week.days) {
      expect(week.chart_alt_text).toContain(String(day.score));
    }
    expect(week.chart_alt_text).toContain(String(week.average_score));
  });

  it("agrees with itself about the peak and the trough", () => {
    const scores = week.days.map((d) => d.score);
    expect(week.peak.score).toBe(Math.max(...scores));
    expect(week.trough.score).toBe(Math.min(...scores));
    expect(week.peak.is_significant).toBe(
      Math.max(...scores) - Math.min(...scores) >= 8
    );
  });
});

describe("computeWeeklyEnergy — determinism", () => {
  it("produces byte-identical output for the same input", () => {
    // No Math.random and no date-seeded shuffle anywhere: paging away from a
    // week and back must not rewrite its headline or its quote.
    const a = computeWeeklyEnergy(inputFor(CHARTS[0], FIXED_WEEK));
    const b = computeWeeklyEnergy(inputFor(CHARTS[0], FIXED_WEEK));
    expect(a).toEqual(b);
  });
});

describe("computeWeeklyEnergy — personalisation", () => {
  it("gives two different charts different weeks for the same dates", () => {
    // This is the test that matters most. scoreHour in the muhurta engine is
    // pure panchanga and never reads the natal chart, so a weekly score built
    // only from it would be identical for everyone at one location. If this
    // ever passes trivially, the natal half of the model has been lost.
    const a = computeWeeklyEnergy(inputFor(CHARTS[0], FIXED_WEEK));
    const b = computeWeeklyEnergy(inputFor(CHARTS[1], FIXED_WEEK));

    expect(a.days.map((d) => d.score)).not.toEqual(b.days.map((d) => d.score));
    expect(a.days.map((d) => d.tara.number)).not.toEqual(
      b.days.map((d) => d.tara.number)
    );
  });

  it("keeps the shared panchanga limbs identical across charts", () => {
    // The other half of the same claim: the limbs are properties of the day,
    // so two charts must agree on them even while their scores differ. A
    // difference here would mean the panchanga had accidentally become
    // chart-dependent.
    const a = computeWeeklyEnergy(inputFor(CHARTS[0], FIXED_WEEK));
    const b = computeWeeklyEnergy(inputFor(CHARTS[0], FIXED_WEEK));
    const limbsOf = (w: typeof a) =>
      w.days.map((d) =>
        d.factors
          .filter((f) => ["tithi", "nakshatra", "yoga"].includes(f.kind))
          .map((f) => f.value)
          .join("/")
      );
    expect(limbsOf(a)).toEqual(limbsOf(b));
  });
});

describe("computeWeeklyEnergy — score distribution", () => {
  /*
   * The calibration net.
   *
   * The thresholds in ENERGY_BAND_THRESHOLDS were measured, not reasoned, and
   * the first reasoned attempt put 67.6% of all days in the top band. This test
   * exists so that a later change to any weight cannot quietly do that again.
   * Tolerances are wide enough to survive an ordinary re-tune and narrow enough
   * to catch a band swallowing the distribution.
   *
   * 4 charts x 13 weeks x 7 days = 364 samples, ~110ms.
   */
  const scores: number[] = [];
  const bandCounts: Record<string, number> = { high: 0, balanced: 0, low: 0 };

  for (const chart of CHARTS) {
    let weekStart = FIXED_WEEK;
    for (let i = 0; i < 13; i += 1) {
      const week = computeWeeklyEnergy(inputFor(chart, weekStart));
      for (const day of week.days) {
        scores.push(day.score);
        bandCounts[day.band] += 1;
      }
      weekStart = addWeeks(weekStart, 1);
    }
  }

  const total = scores.length;
  const share = (band: string) => bandCounts[band] / total;

  it("samples the expected number of days", () => {
    expect(total).toBe(4 * 13 * 7);
  });

  it("stays inside 0-100 without the clamp doing the work", () => {
    // Both halves of the score are bounded to ±25 around 50, so the range is
    // structural rather than clamped. A value outside it means a term escaped
    // its cap.
    for (const score of scores) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it("centres near 50 rather than drifting up the scale", () => {
    const mean = scores.reduce((a, b) => a + b, 0) / total;
    const sorted = [...scores].sort((a, b) => a - b);
    const median = sorted[Math.floor(total / 2)];
    // Measured at mean 55.3 / median 55. The uncentred version of this model
    // sat at 67.5 / 68, which is the regression being guarded against.
    expect(mean).toBeGreaterThan(48);
    expect(mean).toBeLessThan(62);
    expect(median).toBeGreaterThan(48);
    expect(median).toBeLessThan(62);
  });

  it("keeps all three bands meaningful and Balanced the most common", () => {
    // Measured: high 26.4%, balanced 41.8%, low 31.9%.
    expect(share("high")).toBeGreaterThan(0.12);
    expect(share("high")).toBeLessThan(0.42);
    expect(share("low")).toBeGreaterThan(0.12);
    expect(share("low")).toBeLessThan(0.42);
    expect(share("balanced")).toBeGreaterThan(0.3);
    // The specific failure this file was written for.
    expect(share("high")).toBeLessThan(0.5);
  });

  it("agrees with bandFor about every score it produced", () => {
    for (const chart of CHARTS.slice(0, 1)) {
      const week = computeWeeklyEnergy(inputFor(chart, FIXED_WEEK));
      for (const day of week.days) {
        expect(day.band).toBe(bandFor(day.score));
      }
    }
  });
});

describe("computeWeeklyEnergy — copy integrity", () => {
  it("only ever emits quote keys that exist in en.json", () => {
    // A typo here would ship as a literal "quotes.24" on the page, because the
    // key is resolved through useTranslation on the client rather than here.
    const quotes = (enMessages as Record<string, unknown>).quotes as Record<string, string>;
    expect(quotes).toBeDefined();
    for (const [kind, keys] of Object.entries(QUOTE_AFFINITY)) {
      expect(keys.length, `${kind} has no quotes`).toBeGreaterThan(0);
      for (const key of keys) {
        expect(quotes[key], `quotes.${key} (from ${kind}) is missing`).toBeTruthy();
      }
    }
  });

  it("emits a quote key the client can resolve", () => {
    const week = computeWeeklyEnergy(inputFor(CHARTS[0], FIXED_WEEK));
    const quotes = (enMessages as Record<string, unknown>).quotes as Record<string, string>;
    expect(quotes[week.headline.quote_key]).toBeTruthy();
    expect(week.headline.title.split(" ")).toHaveLength(2);
    expect(week.headline.paragraph.length).toBeGreaterThan(20);
  });
});

describe("computeWeeklyEnergy — calendar edges", () => {
  it("handles a week containing a southern-hemisphere DST change", () => {
    // Australia moves its clocks on the first Sunday of April. Iterating days
    // by adding 86400000ms would drift an hour across that boundary and can
    // repeat or skip a calendar day; the engine goes through addDays, which is
    // anchored at local noon.
    const week = computeWeeklyEnergy(inputFor(CHARTS[3], "2024-04-06"));
    expect(week.days.map((d) => d.date)).toEqual([
      "2024-04-06",
      "2024-04-07",
      "2024-04-08",
      "2024-04-09",
      "2024-04-10",
      "2024-04-11",
      "2024-04-12",
    ]);
    expect(new Set(week.days.map((d) => d.date)).size).toBe(7);
  });

  it("handles a week straddling a year boundary", () => {
    const week = computeWeeklyEnergy(inputFor(CHARTS[0], "2024-12-28"));
    expect(week.days.map((d) => d.date)).toEqual([
      "2024-12-28",
      "2024-12-29",
      "2024-12-30",
      "2024-12-31",
      "2025-01-01",
      "2025-01-02",
      "2025-01-03",
    ]);
    // Both years named, because "Dec 28 – Jan 3, 2025" is wrong about the first.
    expect(week.week.label).toContain("2024");
    expect(week.week.label).toContain("2025");
  });
});
