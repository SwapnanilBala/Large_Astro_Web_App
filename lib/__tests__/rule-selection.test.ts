/**
 * Selection and strength.
 *
 * The important property under test is that selection cannot starve anything:
 * it marks rules, it does not remove them, and it always reaches topN when
 * supply exists.
 */

import { describe, it, expect } from "vitest";
import { selectRules, DEFAULT_SELECTION_OPTIONS, type Selectable } from "../rules/selection";
import { computeStrength, clamp01 } from "../rules/strength";
import { ruleDefinitionSchema, type RuleDefinitionInput } from "../rules/schema";
import { buildRuleContext } from "../rules/context";
import type { PlanetPosition, HousePlacement } from "../engines/swiss-ephemeris-engine";
import type { RuleCategory, RuleTier } from "../astro-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let seq = 0;
function rule(
  category: RuleCategory,
  score: number,
  tier: RuleTier = "signature",
  key = `r${seq++}`,
): Selectable {
  return { instance_key: key, category, tier, score };
}

/** A spread wide enough that quotas actually bind. */
function wideSet(): Selectable[] {
  seq = 0;
  return [
    rule("core", 0.95, "foundation"),
    rule("core", 0.9),
    rule("core", 0.85),
    rule("core", 0.8),
    rule("core", 0.75),
    rule("career", 0.7, "foundation"),
    rule("career", 0.65),
    rule("career", 0.6),
    rule("love", 0.55, "foundation"),
    rule("love", 0.5),
    rule("love", 0.45),
  ];
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

describe("selectRules", () => {
  it("respects topN", () => {
    const { selectedIds } = selectRules(wideSet());
    expect(selectedIds).toHaveLength(DEFAULT_SELECTION_OPTIONS.topN);
  });

  it("respects maxPerCategory when supply allows", () => {
    const { selectedIds } = selectRules(wideSet());
    const set = new Set(selectedIds);
    const chosen = wideSet().filter((r) => set.has(r.instance_key));
    for (const category of ["core", "career", "love"] as const) {
      expect(chosen.filter((r) => r.category === category).length).toBeLessThanOrEqual(
        DEFAULT_SELECTION_OPTIONS.maxPerCategory,
      );
    }
  });

  it("pins one foundation rule per category even when it scores low", () => {
    seq = 0;
    const rules = [
      rule("core", 0.99),
      rule("core", 0.98),
      rule("core", 0.97),
      rule("career", 0.96),
      rule("career", 0.95),
      rule("love", 0.05, "foundation", "love-pin"),
      rule("love", 0.04),
    ];
    const { selectedIds } = selectRules(rules);
    expect(selectedIds).toContain("love-pin");
  });

  it("ranks by score, so a pinned low scorer ranks last rather than first", () => {
    seq = 0;
    const rules = [
      rule("core", 0.9),
      rule("core", 0.8),
      rule("career", 0.7),
      rule("love", 0.02, "foundation", "love-pin"),
    ];
    const { selectedIds } = selectRules(rules, { topN: 4 });
    expect(selectedIds[selectedIds.length - 1]).toBe("love-pin");
  });

  it("relaxes the quota to reach topN when a category runs dry", () => {
    seq = 0;
    // Only core rules exist, so a maxPerCategory of 3 cannot reach 7 unrelaxed.
    const rules = Array.from({ length: 9 }, (_, i) => rule("core", 0.9 - i * 0.05));
    const { selectedIds } = selectRules(rules);
    expect(selectedIds).toHaveLength(7);
  });

  it("returns everything and stops when supply is smaller than topN", () => {
    seq = 0;
    const rules = [rule("core", 0.9), rule("career", 0.8)];
    const { selectedIds } = selectRules(rules);
    expect(selectedIds).toHaveLength(2);
  });

  it("handles an empty rule set without hanging", () => {
    const { selectedIds, meta } = selectRules([]);
    expect(selectedIds).toEqual([]);
    expect(meta.size).toBe(0);
  });

  it("assigns ranks 1..N with no gaps and no duplicates", () => {
    const rules = wideSet();
    const { selectedIds, meta } = selectRules(rules);
    const ranks = selectedIds.map((id) => meta.get(id)!.rank);
    expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const rule of rules) {
      const entry = meta.get(rule.instance_key)!;
      if (!entry.selected) expect(entry.rank).toBe(0);
    }
  });

  it("gives every input rule a metadata entry", () => {
    const rules = wideSet();
    const { meta } = selectRules(rules);
    expect(meta.size).toBe(rules.length);
    for (const rule of rules) expect(meta.has(rule.instance_key)).toBe(true);
  });

  it("keeps selectedIds a subset of the input instance keys", () => {
    const rules = wideSet();
    const keys = new Set(rules.map((r) => r.instance_key));
    for (const id of selectRules(rules).selectedIds) expect(keys.has(id)).toBe(true);
  });

  it("is deterministic across repeated runs", () => {
    const first = selectRules(wideSet()).selectedIds;
    for (let i = 0; i < 100; i++) {
      expect(selectRules(wideSet()).selectedIds).toEqual(first);
    }
  });

  it("breaks score ties by declaration order", () => {
    seq = 0;
    const rules = [
      rule("core", 0.5, "signature", "first"),
      rule("core", 0.5, "signature", "second"),
      rule("core", 0.5, "signature", "third"),
    ];
    expect(selectRules(rules, { topN: 3, pinTiers: [] }).selectedIds).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("never selects the same rule twice when it could be pinned and greedily taken", () => {
    seq = 0;
    const rules = [
      rule("core", 0.95, "foundation", "top-foundation"),
      rule("core", 0.9),
      rule("career", 0.85, "foundation"),
      rule("love", 0.8, "foundation"),
    ];
    const { selectedIds } = selectRules(rules);
    expect(new Set(selectedIds).size).toBe(selectedIds.length);
  });
});

// ---------------------------------------------------------------------------
// Strength
// ---------------------------------------------------------------------------

function buildContext() {
  const planets: PlanetPosition[] = [
    { name: "Sun", longitude: 45, sign: "Taurus", degree_in_sign: 15, house: 1 },
    { name: "Moon", longitude: 120, sign: "Leo", degree_in_sign: 0, house: 4 },
    { name: "Mercury", longitude: 50, sign: "Taurus", degree_in_sign: 20, house: 1 },
    { name: "Venus", longitude: 200, sign: "Libra", degree_in_sign: 20, house: 6 },
    { name: "Mars", longitude: 15, sign: "Aries", degree_in_sign: 15, house: 12 },
    { name: "Jupiter", longitude: 90, sign: "Cancer", degree_in_sign: 0, house: 3 },
    { name: "Saturn", longitude: 270, sign: "Capricorn", degree_in_sign: 0, house: 9 },
  ];
  const signs = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
  ];
  const houses: HousePlacement[] = Array.from({ length: 12 }, (_, i) => ({
    house_number: i + 1,
    sign: signs[(1 + i) % 12],
    planets: planets.filter((p) => p.house === i + 1).map((p) => p.name),
  }));
  return buildRuleContext("Taurus", planets, houses);
}

describe("computeStrength", () => {
  const ctx = buildContext();
  const bindings = { p: ctx.planets.Jupiter, h1: ctx.houses[1] };

  const def = (base: number, bonuses: RuleDefinitionInput["strength"]["bonuses"]) =>
    ruleDefinitionSchema.parse({
      id: "test.strength",
      tier: "signature",
      category: "core",
      priority: "medium",
      instance_key: "test.strength:{$p.name}",
      for_each: null,
      bind: { p: { from: "planet", name: "Jupiter" }, h1: { from: "house", number: 1 } },
      when: { op: "always" },
      rarity_key: "test.strength",
      strength: { base, bonuses },
      display: { headline: "test headline", body: "test body text", tension: [] },
      evidence: {
        technical_note: "note",
        claims: [{ label: "Planet", path: "$p.name", kind: "placement" }],
      },
    } satisfies RuleDefinitionInput);

  it("returns the base when no bonus applies", () => {
    const rule = def(0.5, [{ when: { op: "dignity", planet: "$p", is: ["debilitated"] }, add: 0.3 }]);
    expect(computeStrength(rule, ctx, bindings)).toBe(0.5);
  });

  it("adds every bonus whose predicate matches", () => {
    const rule = def(0.4, [
      { when: { op: "dignity", planet: "$p", is: ["exalted"] }, add: 0.2 },
      { when: { op: "gte", left: "$h1.occupant_count", value: 2 }, add: 0.1 },
    ]);
    expect(computeStrength(rule, ctx, bindings)).toBeCloseTo(0.7, 10);
  });

  it("subtracts a negative bonus", () => {
    const rule = def(0.6, [{ when: { op: "dignity", planet: "$p", is: ["exalted"] }, add: -0.2 }]);
    expect(computeStrength(rule, ctx, bindings)).toBeCloseTo(0.4, 10);
  });

  it("clamps to [0, 1]", () => {
    const high = def(0.9, [
      { when: { op: "always" }, add: 0.5 },
      { when: { op: "always" }, add: 0.5 },
    ]);
    expect(computeStrength(high, ctx, bindings)).toBe(1);

    const low = def(0.1, [
      { when: { op: "always" }, add: -0.5 },
      { when: { op: "always" }, add: -0.5 },
    ]);
    expect(computeStrength(low, ctx, bindings)).toBe(0);

    expect(clamp01(2)).toBe(1);
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.42)).toBe(0.42);
  });
});
