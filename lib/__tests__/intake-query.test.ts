import { describe, expect, it } from "vitest";
import { buildChartQuery } from "../intake-query";
import { profileInitialState } from "../astro-types";

/* A visitor who typed an exact time and then ticked "I don't know my exact
 * birth time". The intake keeps the typed value in the draft so unticking the
 * box gives it back, which makes it this function's job to make sure a parked
 * time never reaches the chart. */
const draftWithParkedTime = {
  ...profileInitialState,
  name: "Rukmini",
  birthDate: "1990-05-15",
  birthTime: "14:35",
  country: "India",
  state: "West Bengal",
  city: "Kolkata",
};

describe("buildChartQuery", () => {
  it("sends the exact time when the visitor knows it", () => {
    const params = buildChartQuery(draftWithParkedTime, { unknownTime: false, coarseTime: "" });

    expect(params.get("birthTime")).toBe("14:35");
    expect(params.get("birthTimeAccuracy")).toBe("exact");
    expect(params.get("birthTimeSource")).toBe("exact");
    expect(params.get("birthTimeFallback")).toBe("false");
  });

  it("substitutes the coarse window and never leaks the parked exact time", () => {
    const params = buildChartQuery(draftWithParkedTime, {
      unknownTime: true,
      coarseTime: "morning",
    });

    expect(params.get("birthTime")).toBe("08:00");
    expect(params.get("birthTimeAccuracy")).toBe("morning");
    expect(params.get("birthTimeSource")).toBe("fallback");
    expect(params.get("birthTimeFallback")).toBe("true");
    expect(params.toString()).not.toContain("14%3A35");
  });

  it("falls back to noon when no window was chosen either", () => {
    const params = buildChartQuery(draftWithParkedTime, { unknownTime: true, coarseTime: "" });

    expect(params.get("birthTime")).toBe("12:00");
    expect(params.get("birthTimeAccuracy")).toBe("unknown");
  });
});
