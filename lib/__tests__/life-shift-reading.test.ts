import { describe, expect, it } from "vitest";
import { formatShiftPivot, formatShiftWindow, lifeShiftId } from "../life-shift-reading";
import type { MajorLifeShift } from "../engines/major-shifts-engine";

function shift(overrides: Partial<MajorLifeShift> = {}): MajorLifeShift {
  return {
    index: 1,
    kind: "saturn-return",
    label: "Saturn return (first)",
    planet: "Saturn",
    pivotIso: "2014-09-18T00:00:00.000Z",
    windowStartIso: "2013-09-18T00:00:00.000Z",
    windowEndIso: "2015-09-18T00:00:00.000Z",
    status: "past",
    ageAtPivot: 29,
    theme: "structure, responsibility, and the cost of choices",
    narrative: "the engine's own sentence",
    evidence: "Cycle: ~29.5 years | Natal Saturn: Capricorn / H9",
    ...overrides,
  };
}

describe("lifeShiftId", () => {
  it("is the key the panel files a chapter under", () => {
    expect(lifeShiftId(shift())).toBe("saturn-return-2014-09-18T00:00:00.000Z");
  });

  it("separates two chapters of the same kind at different pivots", () => {
    const first = lifeShiftId(shift());
    const second = lifeShiftId(shift({ pivotIso: "2044-03-01T00:00:00.000Z" }));
    expect(first).not.toBe(second);
  });
});

describe("the chapter dates", () => {
  it("are worded the way the card prints them", () => {
    expect(formatShiftPivot("2014-09-18T12:00:00.000Z")).toBe("September 2014");
    expect(formatShiftWindow("2013-09-18T12:00:00.000Z", "2015-09-18T12:00:00.000Z")).toBe("Sep 2013 → Sep 2015");
  });
});
