import { describe, expect, it } from "vitest";
import type { ChartApiResponse } from "../astro-types";
import { computeMajorLifeShifts } from "../engines/major-shifts-engine";
import { formatShiftPivot, formatShiftWindow } from "../life-shift-reading";

/*
 * The chapter ids carry each chapter's pivot instant, and the browser and the
 * server each compute them: the panel sends the ids it drew, and the route
 * looks them up in the chart it rebuilds. The audit's birth instant has no
 * offset ("1998-03-10T03:45"), and read in the machine's own time zone it put
 * the returns hours apart on a UTC server and in an Indian or American
 * browser, so the route found none of the chapters asked for and every card
 * kept its template. These pin the instant to UTC, whatever zone the tests
 * run in.
 */

const YEAR_MS = 365.25 * 86_400_000;
const BIRTH_UTC = Date.UTC(1998, 2, 10, 3, 45);

const payload = {
  chart: {
    planets: [{ name: "Saturn", sign: "Pisces", house: 12 }],
    calculation_audit: { birth_utc_iso: "1998-03-10T03:45", birth_local_iso: "1998-03-10T09:15" },
    dasha: { periods: [] },
  },
} as unknown as ChartApiResponse;

describe("the life chapters' dates", () => {
  it("count the returns from the birth instant read as UTC", () => {
    const saturn = computeMajorLifeShifts(payload).find((shift) => shift.kind === "saturn-return" && shift.label.endsWith("(first)"));
    expect(saturn?.pivotIso).toBe(new Date(BIRTH_UTC + 29.4571 * YEAR_MS).toISOString());
  });

  it("read an instant that already says its zone as it says", () => {
    const zoned = {
      chart: { ...payload.chart, calculation_audit: { birth_utc_iso: "1998-03-10T03:45Z", birth_local_iso: "" } },
    } as unknown as ChartApiResponse;
    expect(computeMajorLifeShifts(zoned).map((shift) => shift.pivotIso)).toEqual(
      computeMajorLifeShifts(payload).map((shift) => shift.pivotIso),
    );
  });

  it("print the month the engine counts, in UTC, wherever the card is read", () => {
    expect(formatShiftPivot("2033-10-31T23:30:00.000Z")).toBe("October 2033");
    expect(formatShiftWindow("2033-01-31T23:30:00.000Z", "2033-12-31T23:30:00.000Z")).toBe("Jan 2033 → Dec 2033");
  });
});
