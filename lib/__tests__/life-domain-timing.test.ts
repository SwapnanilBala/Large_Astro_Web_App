import { describe, expect, it } from "vitest";
import type { DashaInfo } from "@/lib/astro-types";
import { makeDomainInsight } from "./factories";
import { getLifeDomainTimingWindows } from "@/lib/life-domain-timing";

const DASHA: DashaInfo = {
  current_dasha: "Mercury",
  current_antardasha: "Venus",
  current_dasha_start: "2020-01-01",
  current_dasha_end: "2037-01-01",
  current_antardasha_start: "2025-01-01",
  current_antardasha_end: "2027-01-01",
  periods: [
    { planet: "Mercury", start_date: "2020-01-01", end_date: "2037-01-01", years: 17 },
    { planet: "Saturn", start_date: "2037-01-01", end_date: "2056-01-01", years: 19 },
  ],
};

describe("getLifeDomainTimingWindows", () => {
  it("uses the active dasha instead of presenting generic timing as current", () => {
    const domain = makeDomainInsight({
      signal_profile: {
        activity_score: 0.8,
        support_score: 0.7,
        pressure_score: 0.4,
        activity_band: "prominent",
        activation_planets: ["Saturn", "Venus"],
      },
    });

    const windows = getLifeDomainTimingWindows(
      domain,
      DASHA,
      new Date("2026-08-12T00:00:00Z")
    );

    expect(windows[0].value).toContain("Venus sub-period");
    expect(windows[1].value).toContain("Saturn");
    expect(windows[1].value).toContain("2037–2056");
    expect(windows[1].label).toBe("Next stronger cycle");
  });

  it("states when the active period is only background context", () => {
    const domain = makeDomainInsight({
      signal_profile: {
        activity_score: 0.63,
        support_score: 0.55,
        pressure_score: 0.41,
        activity_band: "active",
        activation_planets: ["Moon"],
      },
    });

    const windows = getLifeDomainTimingWindows(domain, DASHA);
    expect(windows[0].value).toContain("background phase");
  });
});
