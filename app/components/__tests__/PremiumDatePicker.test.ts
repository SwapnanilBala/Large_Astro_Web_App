import { describe, expect, it } from "vitest";
import { parseLocalIsoDate } from "../PremiumDatePicker";

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