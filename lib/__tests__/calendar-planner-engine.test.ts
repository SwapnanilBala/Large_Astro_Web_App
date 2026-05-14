import { describe, expect, it, vi } from "vitest";
import type { ForecastReading } from "../engines/chart-service";

vi.mock("../engines/chart-service", () => ({
  buildForecast: vi.fn(),
}));

vi.mock("../engines/muhurta-engine", () => ({
  findMuhurta: vi.fn(),
}));

import {
  buildWatchoutForForecast,
  buildWeeklyDashaContext,
  enumerateDateRange,
  getDashaPressure,
  mapIntentToMuhurtaActivity,
  scoreIntentForForecast,
} from "../engines/calendar-planner-engine";

function makeForecast(overrides: Partial<ForecastReading> = {}): ForecastReading {
  return {
    target_date: "2026-06-01",
    headline: "Mercury supports learning and communication.",
    overview: "A good day for study, writing, and careful planning.",
    dasha: {
      current_dasha: "Mercury",
      current_antardasha: "Jupiter",
      current_dasha_start: "2020-01-01",
      current_dasha_end: "2037-01-01",
      current_antardasha_start: "2026-01-01",
      current_antardasha_end: "2027-01-01",
      periods: [],
    },
    focus_areas: ["learning and communication"],
    opportunities: ["Study complex topics."],
    cautions: ["Avoid overcommitting."],
    supportive_transits: [
      {
        transit_planet: "Mercury",
        natal_planet: "Jupiter",
        aspect_type: "Trine",
        orb: 1.5,
        tone: "supportive",
        interpretation: "Supports study.",
      },
    ],
    challenging_transits: [],
    ...overrides,
  };
}

describe("calendar-planner-engine helpers", () => {
  it("enumerates date ranges inclusively", () => {
    expect(enumerateDateRange("2026-06-01", "2026-06-03")).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
    ]);
  });

  it("maps planner intents to existing muhurta activities", () => {
    expect(mapIntentToMuhurtaActivity("study")).toBe("education");
    expect(mapIntentToMuhurtaActivity("money")).toBe("investment");
    expect(mapIntentToMuhurtaActivity("travel")).toBe("travel");
  });

  it("rates Saturn/Rahu dasha combinations as high pressure", () => {
    const pressure = getDashaPressure(makeForecast({
      dasha: {
        current_dasha: "Saturn",
        current_antardasha: "Rahu",
        current_dasha_start: "2020-01-01",
        current_dasha_end: "2039-01-01",
        current_antardasha_start: "2026-01-01",
        current_antardasha_end: "2028-01-01",
        periods: [],
      },
    }));

    expect(pressure.pressure).toBe("high");
    expect(pressure.score).toBeGreaterThanOrEqual(45);
    expect(pressure.reasons.length).toBeGreaterThan(0);
  });

  it("scores matching intent themes higher than unrelated intents", () => {
    const forecast = makeForecast();

    const study = scoreIntentForForecast("study", forecast);
    const relationships = scoreIntentForForecast("relationships", forecast);

    expect(study.score).toBeGreaterThan(relationships.score);
    expect(study.reasons.join(" ")).toContain("Mercury");
  });

  it("builds watchouts from challenging transits and dasha pressure", () => {
    const watchout = buildWatchoutForForecast(makeForecast({
      dasha: {
        current_dasha: "Saturn",
        current_antardasha: "Mars",
        current_dasha_start: "2020-01-01",
        current_dasha_end: "2039-01-01",
        current_antardasha_start: "2026-01-01",
        current_antardasha_end: "2028-01-01",
        periods: [],
      },
      challenging_transits: [
        {
          transit_planet: "Saturn",
          natal_planet: "Moon",
          aspect_type: "Square",
          orb: 1.2,
          tone: "challenging",
          interpretation: "Pressure.",
        },
      ],
    }));

    expect(watchout).not.toBeNull();
    expect(watchout?.severity).toBe("high");
  });

  it("creates weekly dasha context buckets", () => {
    const dates = enumerateDateRange("2026-06-01", "2026-06-10");
    const forecasts = dates.map((date) => makeForecast({ target_date: date }));

    const contexts = buildWeeklyDashaContext(dates, forecasts);

    expect(contexts).toHaveLength(2);
    expect(contexts[0].week_start).toBe("2026-06-01");
    expect(contexts[0].week_end).toBe("2026-06-07");
    expect(contexts[1].week_start).toBe("2026-06-08");
  });
});
