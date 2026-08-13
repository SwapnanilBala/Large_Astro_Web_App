import { describe, expect, it } from "vitest";
import type { ChartApiResponse } from "@/lib/astro-types";
import { buildChart } from "@/lib/engines/chart-service";
import type { BirthDetailsInput } from "@/lib/engines/compatibility-service";
import { verifyChartForStory } from "@/lib/story-verification";

const BIRTH: BirthDetailsInput = {
  name: "Verification Sample",
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
  engine_id: "lahiri_classic",
  birth_time_accuracy: "exact",
  birth_time_source: "exact",
  birth_time_fallback: false,
};

function verifiedPayload(): ChartApiResponse {
  return structuredClone(buildChart(BIRTH, {
    includeTransits: true,
    includePremium: true,
    includeUltimate: true,
    deferLifeDomains: false,
  })) as unknown as ChartApiResponse;
}

describe("story calculation verification", () => {
  it("passes a complete chart through independent report checks", () => {
    const result = verifyChartForStory(verifiedPayload());

    expect(result.status).toBe("verified");
    expect(result.failedCount).toBe(0);
    expect(result.warningCount).toBe(0);
    expect(result.checks.find((item) => item.id === "longitude-sign")?.status).toBe("passed");
    expect(result.checks.find((item) => item.id === "d1-echo")?.status).toBe("passed");
  });

  it("blocks a report when a longitude no longer agrees with its sign", () => {
    const payload = verifiedPayload();
    const sun = payload.chart.planets.find((planet) => planet.name === "Sun");
    if (!sun) throw new Error("Fixture has no Sun");
    sun.sign = sun.sign === "Aries" ? "Taurus" : "Aries";

    const result = verifyChartForStory(payload);

    expect(result.status).toBe("failed");
    expect(result.checks.find((item) => item.id === "longitude-sign")?.status).toBe("failed");
  });

  it("qualifies rather than blocks a report when corroborating coverage is incomplete", () => {
    const payload = verifiedPayload();
    if (payload.chart.divisional_charts) delete payload.chart.divisional_charts[60];

    const result = verifyChartForStory(payload);

    expect(result.status).toBe("qualified");
    expect(result.checks.find((item) => item.id === "varga-coverage")?.status).toBe("warning");
    expect(result.failedCount).toBe(0);
  });
});
