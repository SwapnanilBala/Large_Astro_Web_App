import { describe, expect, it } from "vitest";
import {
  getLifeDomainPayload,
  getTopLifeDomainSummary,
  readChartParams,
} from "../chart-params";

/*
 * The results page's Top Takeaways card is drawn first from this summary,
 * which the server sends with the page, and again once the client has fetched
 * the full life-domain insights (buildTopTakeaways in insights-content.tsx).
 * The page only holds still if both name the same area, so this pins the
 * summary to the insight with the highest confidence_score (the first such,
 * on a tie, as the client's stable sort would leave it), across charts whose
 * strongest areas differ.
 */
const CHARTS = [
  { name: "Chart A", birthDate: "1992-02-20", birthTime: "08:30", timezoneOffsetMinutes: "-300", latitude: "40.7128", longitude: "-74.0060" },
  { name: "Chart B", birthDate: "1975-11-03", birthTime: "23:45", timezoneOffsetMinutes: "330", latitude: "19.0760", longitude: "72.8777" },
  { name: "Chart C", birthDate: "2001-07-14", birthTime: "05:05", timezoneOffsetMinutes: "60", latitude: "48.8566", longitude: "2.3522" },
  { name: "Chart D", birthDate: "1988-09-09", birthTime: "17:20", timezoneOffsetMinutes: "600", latitude: "-33.8688", longitude: "151.2093" },
];

function paramsFor(chart: (typeof CHARTS)[number]) {
  return readChartParams({
    ...chart,
    country: "X",
    state: "Y",
    city: "Z",
    engineId: "lahiri_classic",
    birthTimeAccuracy: "exact",
  });
}

describe("getTopLifeDomainSummary", () => {
  for (const chart of CHARTS) {
    it(`names the strongest life area for ${chart.name}`, () => {
      const params = paramsFor(chart);
      const { insights } = getLifeDomainPayload(params);
      const best = Math.max(...insights.map((insight) => insight.confidence_score));
      const strongest = insights.find((insight) => insight.confidence_score === best)!;

      expect(getTopLifeDomainSummary(params)).toEqual({
        key: strongest.key,
        label: strongest.label,
        headline: strongest.display.headline,
        guidance: strongest.display.guidance,
      });
    });
  }

  it("is a few hundred bytes where the insights it summarises are tens of KB", () => {
    const params = paramsFor(CHARTS[0]);
    expect(JSON.stringify(getTopLifeDomainSummary(params)).length).toBeLessThan(2000);
    expect(JSON.stringify(getLifeDomainPayload(params)).length).toBeGreaterThan(20000);
  });
});
