import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { formatBirthDate, parseBirthDate } from "@/lib/format-birth-date";

describe("parsing a birth date", () => {
  it("lands on the day that was typed, not the instant before it", () => {
    const date = parseBirthDate("1992-05-12")!;
    expect(date.getFullYear()).toBe(1992);
    expect(date.getMonth()).toBe(4);
    expect(date.getDate()).toBe(12);
  });

  it("puts it at local midnight, so no formatter can shift it", () => {
    const date = parseBirthDate("1992-05-12")!;
    expect([date.getHours(), date.getMinutes(), date.getSeconds()]).toEqual([0, 0, 0]);
  });

  it("refuses a date the calendar does not have", () => {
    /* `new Date(2026, 1, 31)` silently becomes 3 March. */
    expect(parseBirthDate("2026-02-31")).toBeNull();
    expect(parseBirthDate("1992-13-01")).toBeNull();
  });

  it("refuses anything that is not YYYY-MM-DD", () => {
    expect(parseBirthDate("12 May 1992")).toBeNull();
    expect(parseBirthDate("")).toBeNull();
  });
});

describe("formatting a birth date", () => {
  it("renders the date as given", () => {
    expect(formatBirthDate("1992-05-12")).toBe("May 12, 1992");
  });

  it("returns an unparseable value untouched rather than Invalid Date", () => {
    expect(formatBirthDate("sometime in 1992")).toBe("sometime in 1992");
  });

  it("does not drop a day on the first of a month", () => {
    /* The failing case: UTC midnight on the 1st is the previous month's last
       day for every reader west of Greenwich. */
    expect(formatBirthDate("1992-05-01")).toBe("May 1, 1992");
    expect(formatBirthDate("1992-01-01")).toBe("Jan 1, 1992");
  });
});

/*
 * The regression itself, pinned to the timezone that showed it.
 *
 * TZ has to be set before the first Date is constructed for the process to
 * pick it up, so this reruns the formatter under an explicit offset rather
 * than trusting whatever zone CI happens to run in — the bug was invisible in
 * UTC and wrong everywhere west of it.
 */
describe("west of Greenwich", () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "America/New_York";
  });

  afterAll(() => {
    process.env.TZ = originalTz;
  });

  it("still shows the day that was typed", () => {
    /* new Date("1992-05-12").toLocaleDateString() gave "May 11, 1992" here. */
    expect(formatBirthDate("1992-05-12")).toBe("May 12, 1992");
    expect(new Date("1992-05-12").getTime()).toBe(Date.UTC(1992, 4, 12));
  });
});
