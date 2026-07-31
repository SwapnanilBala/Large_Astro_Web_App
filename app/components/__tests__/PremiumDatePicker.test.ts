import { describe, expect, it } from "vitest";
import { parseFlexibleDate, parseFlexibleTime, parseLocalIsoDate } from "../PremiumDatePicker";

describe("parseLocalIsoDate", () => {
  it("parses ISO dates as local calendar dates", () => {
    const date = parseLocalIsoDate("1990-01-15");

    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(1990);
    expect(date?.getMonth()).toBe(0);
    expect(date?.getDate()).toBe(15);
  });

  it("rejects impossible or non-ISO dates", () => {
    expect(parseLocalIsoDate("1990-02-30")).toBeNull();
    expect(parseLocalIsoDate("15 Jan 1990")).toBeNull();
  });
});

/* Reads a parsed date as [year, month (1-based), day] for readable assertions. */
function ymd(date: Date | null): [number, number, number] | null {
  return date ? [date.getFullYear(), date.getMonth() + 1, date.getDate()] : null;
}

describe("parseFlexibleDate", () => {
  it("accepts the formats a person actually types for a birth date", () => {
    expect(ymd(parseFlexibleDate("1990-05-15"))).toEqual([1990, 5, 15]);
    expect(ymd(parseFlexibleDate("15/05/1990"))).toEqual([1990, 5, 15]);
    expect(ymd(parseFlexibleDate("15-05-1990"))).toEqual([1990, 5, 15]);
    expect(ymd(parseFlexibleDate("15.05.1990"))).toEqual([1990, 5, 15]);
    expect(ymd(parseFlexibleDate("15 May 1990"))).toEqual([1990, 5, 15]);
    expect(ymd(parseFlexibleDate("15 May, 1990"))).toEqual([1990, 5, 15]);
    expect(ymd(parseFlexibleDate("May 15 1990"))).toEqual([1990, 5, 15]);
    expect(ymd(parseFlexibleDate("15 September 1990"))).toEqual([1990, 9, 15]);
  });

  it("reads ambiguous numeric dates day-first", () => {
    /* Both orderings are valid here; day-first matches the dd MMM yyyy
     * display format, so 05/06 must mean 5 June and never 6 May. */
    expect(ymd(parseFlexibleDate("05/06/1990"))).toEqual([1990, 6, 5]);
  });

  it("falls back to month-first only when day-first is impossible", () => {
    /* 22 cannot be a month, so this can only mean 22 May. */
    expect(ymd(parseFlexibleDate("05/22/1990"))).toEqual([1990, 5, 22]);
  });

  it("tolerates surrounding whitespace and mixed case month names", () => {
    expect(ymd(parseFlexibleDate("  15 mAy 1990  "))).toEqual([1990, 5, 15]);
  });

  it("rejects dates that do not exist rather than rolling them forward", () => {
    expect(parseFlexibleDate("31/02/1990")).toBeNull();
    expect(parseFlexibleDate("1990-02-30")).toBeNull();
    expect(parseFlexibleDate("32/01/1990")).toBeNull();
  });

  it("rejects two-digit years instead of guessing a century", () => {
    expect(parseFlexibleDate("15/05/90")).toBeNull();
  });

  it("rejects text that is not a date", () => {
    expect(parseFlexibleDate("hello")).toBeNull();
    expect(parseFlexibleDate("")).toBeNull();
    expect(parseFlexibleDate("15 Smarch 1990")).toBeNull();
  });
});

/* Reads a parsed time as [hours, minutes]. */
function hm(date: Date | null): [number, number] | null {
  return date ? [date.getHours(), date.getMinutes()] : null;
}

describe("parseFlexibleTime", () => {
  it("accepts 24-hour and 12-hour forms", () => {
    expect(hm(parseFlexibleTime("14:30"))).toEqual([14, 30]);
    expect(hm(parseFlexibleTime("2:30 PM"))).toEqual([14, 30]);
    expect(hm(parseFlexibleTime("2:30pm"))).toEqual([14, 30]);
    expect(hm(parseFlexibleTime("2:30 am"))).toEqual([2, 30]);
    expect(hm(parseFlexibleTime("14.30"))).toEqual([14, 30]);
    expect(hm(parseFlexibleTime("1430"))).toEqual([14, 30]);
  });

  it("preserves exact minutes rather than snapping to picker steps", () => {
    /* The ascendant advances about a degree every four minutes, so 14:37
     * must survive as 14:37 and not round to 14:35 or 14:45. */
    expect(hm(parseFlexibleTime("14:37"))).toEqual([14, 37]);
    expect(hm(parseFlexibleTime("2:37 PM"))).toEqual([14, 37]);
  });

  it("handles midnight and noon boundaries", () => {
    expect(hm(parseFlexibleTime("12:00 AM"))).toEqual([0, 0]);
    expect(hm(parseFlexibleTime("12:00 PM"))).toEqual([12, 0]);
    expect(hm(parseFlexibleTime("00:00"))).toEqual([0, 0]);
  });

  it("rejects impossible clock values", () => {
    expect(parseFlexibleTime("25:00")).toBeNull();
    expect(parseFlexibleTime("14:75")).toBeNull();
    expect(parseFlexibleTime("13:00 PM")).toBeNull();
    expect(parseFlexibleTime("hello")).toBeNull();
    expect(parseFlexibleTime("")).toBeNull();
  });
});
