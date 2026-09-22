import { describe, expect, it } from "vitest";
import {
  buildLifeShiftFacts,
  formatShiftPivot,
  formatShiftWindow,
  lifeShiftCacheKey,
  lifeShiftId,
  MAX_LIFE_SHIFTS,
  renderLifeShiftFacts,
  type LifeShiftFacts,
} from "../life-shift-reading";
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

describe("buildLifeShiftFacts", () => {
  it("words the dates the way the card prints them", () => {
    const [facts] = buildLifeShiftFacts([shift()]);
    expect(facts.pivot).toBe(formatShiftPivot("2014-09-18T00:00:00.000Z"));
    expect(facts.window).toBe(
      formatShiftWindow("2013-09-18T00:00:00.000Z", "2015-09-18T00:00:00.000Z"),
    );
  });

  it("does not carry the engine's own narrative into the prompt", () => {
    /* The model phrases the chapter; handing it the template to paraphrase
       would make the template the ceiling rather than the fallback. */
    const [facts] = buildLifeShiftFacts([shift()]);
    expect(JSON.stringify(facts)).not.toContain("the engine's own sentence");
  });

  it("caps the set at what one call is allowed to take", () => {
    const many = Array.from({ length: MAX_LIFE_SHIFTS + 3 }, (_, index) =>
      shift({ pivotIso: `20${30 + index}-01-01T00:00:00.000Z` }),
    );
    expect(buildLifeShiftFacts(many)).toHaveLength(MAX_LIFE_SHIFTS);
  });
});

describe("renderLifeShiftFacts", () => {
  it("gives the model the id it has to echo back", () => {
    const facts = buildLifeShiftFacts([shift()]);
    expect(renderLifeShiftFacts(facts)).toContain(`id: ${facts[0].id}`);
  });

  it("omits the evidence line rather than printing an empty one", () => {
    const facts = buildLifeShiftFacts([shift({ evidence: "" })]);
    expect(renderLifeShiftFacts(facts)).not.toContain("evidence:");
  });
});

describe("lifeShiftCacheKey", () => {
  const facts: LifeShiftFacts[] = buildLifeShiftFacts([shift()]);

  it("is stable for the same depth and facts", () => {
    expect(lifeShiftCacheKey("headline", facts)).toBe(lifeShiftCacheKey("headline", facts));
  });

  /*
   * The one this function exists for. Both pages ask about overlapping
   * chapters, so a key that ignored the depth would let whichever page was
   * visited first decide how long the other one's readings are -- and the
   * wrong-length reading renders perfectly, which is what makes it worth a
   * test rather than a comment.
   */
  it("separates the two lengths for the same chapter", () => {
    expect(lifeShiftCacheKey("headline", facts)).not.toBe(
      lifeShiftCacheKey("compact", facts),
    );
  });

  it("separates two different chapter sets at the same depth", () => {
    const other = buildLifeShiftFacts([shift({ pivotIso: "2044-03-01T00:00:00.000Z" })]);
    expect(lifeShiftCacheKey("compact", facts)).not.toBe(
      lifeShiftCacheKey("compact", other),
    );
  });
});
