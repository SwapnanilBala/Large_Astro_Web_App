/**
 * Unit coverage for the interpreter itself: every predicate op positive and
 * negative, both template token forms, all seven filters, path resolution
 * failure, and `for_each` expansion.
 */

import { describe, it, expect } from "vitest";
import type { PlanetPosition, HousePlacement } from "../engines/swiss-ephemeris-engine";
import { buildRuleContext, signDistance, planetDignity, forEachPlanets } from "../rules/context";
import { evaluate } from "../rules/predicates";
import {
  renderTemplate,
  resolveBindings,
  resolvePath,
  buildClaim,
  ordinal,
  humanDignity,
  formatElementCounts,
  RuleResolutionError,
} from "../rules/paths";
import { evaluateRules } from "../rules";
import type { Predicate, RuleDefinition, RuleDefinitionInput } from "../rules/schema";
import { ruleDefinitionSchema } from "../rules/schema";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function buildTestPlanets(): PlanetPosition[] {
  return [
    { name: "Sun", longitude: 45, sign: "Taurus", degree_in_sign: 15, house: 1 },
    { name: "Moon", longitude: 120, sign: "Leo", degree_in_sign: 0, house: 4 },
    { name: "Mercury", longitude: 50, sign: "Taurus", degree_in_sign: 20, house: 1 },
    { name: "Venus", longitude: 200, sign: "Libra", degree_in_sign: 20, house: 6 },
    { name: "Mars", longitude: 15, sign: "Aries", degree_in_sign: 15, house: 12 },
    { name: "Jupiter", longitude: 90, sign: "Cancer", degree_in_sign: 0, house: 3 },
    { name: "Saturn", longitude: 270, sign: "Capricorn", degree_in_sign: 0, house: 9 },
    { name: "Rahu", longitude: 150, sign: "Virgo", degree_in_sign: 0, house: 5 },
    { name: "Ketu", longitude: 330, sign: "Pisces", degree_in_sign: 0, house: 11 },
  ];
}

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

function buildHouses(ascSign: string, planets: PlanetPosition[]): HousePlacement[] {
  const ascIdx = SIGNS.indexOf(ascSign);
  const houses: HousePlacement[] = [];
  for (let h = 1; h <= 12; h++) {
    houses.push({
      house_number: h,
      sign: SIGNS[(ascIdx + h - 1) % 12],
      planets: planets.filter((p) => p.house === h).map((p) => p.name),
    });
  }
  return houses;
}

const planets = buildTestPlanets();
const houses = buildHouses("Taurus", planets);
const ctx = buildRuleContext("Taurus", planets, houses);

const bindings = {
  sun: ctx.planets.Sun,
  moon: ctx.planets.Moon,
  mercury: ctx.planets.Mercury,
  venus: ctx.planets.Venus,
  jupiter: ctx.planets.Jupiter,
  saturn: ctx.planets.Saturn,
  h1: ctx.houses[1],
  h10: ctx.houses[10],
  asc: ctx.ascendant,
  d: ctx.derived,
};

const check = (pred: Predicate) => evaluate(pred, ctx, bindings).matched;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

describe("buildRuleContext", () => {
  it("derives element, dignity and lordship onto every planet", () => {
    expect(ctx.planets.Sun.element).toBe("Earth");
    expect(ctx.planets.Jupiter.dignity).toBe("exalted");
    expect(ctx.planets.Venus.dignity).toBe("own_sign");
    // Taurus rising: Venus rules the 1st (Taurus) and the 6th (Libra).
    expect(ctx.planets.Venus.rules_houses).toEqual([1, 6]);
  });

  it("derives occupancy onto every house", () => {
    expect(ctx.houses[1].occupants).toEqual(["Sun", "Mercury"]);
    expect(ctx.houses[1].occupant_count).toBe(2);
    expect(ctx.houses[2].occupant_count).toBe(0);
  });

  it("computes the derived aggregates", () => {
    expect(ctx.derived.densest_house).toBe(1);
    expect(ctx.derived.dominant_element).toBe("Earth");
    expect(ctx.derived.dominant_element_count).toBe(3);
    expect(ctx.derived.kendra_planets).toEqual(["Sun", "Moon", "Mercury"]);
    expect(ctx.derived.kendra_planet_count).toBe(3);
  });

  it("computes whole-sign distance in both directions", () => {
    // Moon in Leo, Jupiter in Cancer: Cancer is 12 signs on from Leo.
    expect(ctx.planets.Jupiter.sign_distance_from.moon).toBe(12);
    expect(ctx.planets.Moon.sign_distance_from.jupiter).toBe(2);
    expect(signDistance("Leo", "Leo")).toBe(1);
  });

  it("classifies dignity", () => {
    expect(planetDignity("Jupiter", "Cancer")).toBe("exalted");
    expect(planetDignity("Saturn", "Aries")).toBe("debilitated");
    expect(planetDignity("Venus", "Taurus")).toBe("own_sign");
    expect(planetDignity("Sun", "Taurus")).toBe("neutral");
  });

  it("filters for_each sets to planets the chart actually has", () => {
    expect(forEachPlanets("career_planets", ctx)).toEqual(["Mercury", "Jupiter", "Saturn"]);
    expect(forEachPlanets("core_planets", ctx)).toEqual(["Sun"]);
    expect(forEachPlanets("classical_planets", ctx)).toHaveLength(7);
  });
});

// ---------------------------------------------------------------------------
// Predicates -- one positive and one negative per op
// ---------------------------------------------------------------------------

describe("predicates", () => {
  it("always", () => {
    expect(check({ op: "always" })).toBe(true);
  });

  it("eq", () => {
    expect(check({ op: "eq", left: "$sun.sign", right: "Taurus" })).toBe(true);
    expect(check({ op: "eq", left: "$sun.sign", right: "Leo" })).toBe(false);
  });

  it("neq", () => {
    expect(check({ op: "neq", left: "$sun.sign", right: "Leo" })).toBe(true);
    expect(check({ op: "neq", left: "$sun.sign", right: "Taurus" })).toBe(false);
  });

  it("eqPath", () => {
    expect(check({ op: "eqPath", left: "$sun.sign", right: "$mercury.sign" })).toBe(true);
    expect(check({ op: "eqPath", left: "$sun.sign", right: "$moon.sign" })).toBe(false);
  });

  it("neqPath", () => {
    expect(check({ op: "neqPath", left: "$sun.element", right: "$moon.element" })).toBe(true);
    expect(check({ op: "neqPath", left: "$sun.element", right: "$mercury.element" })).toBe(false);
  });

  it("in", () => {
    expect(check({ op: "in", left: "$venus.house", values: [6, 8, 12] })).toBe(true);
    expect(check({ op: "in", left: "$venus.house", values: [1, 4, 7, 10] })).toBe(false);
  });

  it("notIn", () => {
    expect(check({ op: "notIn", left: "$venus.house", values: [1, 4, 7, 10] })).toBe(true);
    expect(check({ op: "notIn", left: "$venus.house", values: [6, 8, 12] })).toBe(false);
  });

  it("gte", () => {
    expect(check({ op: "gte", left: "$h1.occupant_count", value: 2 })).toBe(true);
    expect(check({ op: "gte", left: "$h1.occupant_count", value: 3 })).toBe(false);
  });

  it("lte", () => {
    expect(check({ op: "lte", left: "$h10.occupant_count", value: 0 })).toBe(true);
    expect(check({ op: "lte", left: "$h1.occupant_count", value: 1 })).toBe(false);
  });

  it("sameHouse", () => {
    expect(check({ op: "sameHouse", a: "$sun", b: "$mercury" })).toBe(true);
    expect(check({ op: "sameHouse", a: "$sun", b: "$moon" })).toBe(false);
  });

  it("signDistance", () => {
    // Moon (Leo) -> Jupiter (Cancer) is 12.
    expect(check({ op: "signDistance", from: "$moon", to: "$jupiter", oneOf: [12] })).toBe(true);
    expect(check({ op: "signDistance", from: "$moon", to: "$jupiter", oneOf: [1, 4, 7, 10] })).toBe(false);
  });

  it("dignity", () => {
    expect(check({ op: "dignity", planet: "$jupiter", is: ["exalted"] })).toBe(true);
    expect(check({ op: "dignity", planet: "$jupiter", is: ["debilitated"] })).toBe(false);
  });

  it("rulesHouse", () => {
    expect(check({ op: "rulesHouse", planet: "$venus", house: 1 })).toBe(true);
    expect(check({ op: "rulesHouse", planet: "$venus", house: 10 })).toBe(false);
  });

  it("countPlanetsInHouses", () => {
    expect(check({ op: "countPlanetsInHouses", houses: [1, 4, 7, 10], gte: 3 })).toBe(true);
    expect(check({ op: "countPlanetsInHouses", houses: [1, 4, 7, 10], gte: 4 })).toBe(false);
    expect(check({ op: "countPlanetsInHouses", houses: [1, 4, 7, 10], lte: 3 })).toBe(true);
  });

  it("all", () => {
    expect(
      check({ op: "all", of: [{ op: "always" }, { op: "eq", left: "$sun.sign", right: "Taurus" }] }),
    ).toBe(true);
    expect(
      check({ op: "all", of: [{ op: "always" }, { op: "eq", left: "$sun.sign", right: "Leo" }] }),
    ).toBe(false);
  });

  it("any", () => {
    expect(
      check({
        op: "any",
        of: [
          { op: "eq", left: "$sun.sign", right: "Leo" },
          { op: "eq", left: "$sun.sign", right: "Taurus" },
        ],
      }),
    ).toBe(true);
    expect(
      check({
        op: "any",
        of: [
          { op: "eq", left: "$sun.sign", right: "Leo" },
          { op: "eq", left: "$sun.sign", right: "Virgo" },
        ],
      }),
    ).toBe(false);
  });

  it("not", () => {
    expect(check({ op: "not", of: { op: "eq", left: "$sun.sign", right: "Leo" } })).toBe(true);
    expect(check({ op: "not", of: { op: "eq", left: "$sun.sign", right: "Taurus" } })).toBe(false);
  });

  it("traces only the clauses that matched", () => {
    const result = evaluate(
      {
        op: "all",
        of: [
          { op: "dignity", planet: "$jupiter", is: ["exalted"] },
          { op: "sameHouse", a: "$sun", b: "$mercury" },
        ],
      },
      ctx,
      bindings,
    );
    expect(result.matched).toBe(true);
    expect(result.trace).toEqual(["Jupiter is exalted", "Sun and Mercury share house 1"]);
  });

  it("produces no trace when the predicate fails", () => {
    const result = evaluate({ op: "dignity", planet: "$sun", is: ["exalted"] }, ctx, bindings);
    expect(result.matched).toBe(false);
    expect(result.trace).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

describe("templates", () => {
  it("renders a bare path token", () => {
    expect(renderTemplate("Sun in {$sun.sign}, house {$sun.house}.", bindings)).toBe(
      "Sun in Taurus, house 1.",
    );
  });

  it("renders a table lookup token", () => {
    expect(renderTemplate("{@house_themes[$sun.house]}", bindings)).toBe(
      "identity, appearance and direction",
    );
  });

  it("applies every filter", () => {
    expect(renderTemplate("{$sun.element|lower}", bindings)).toBe("earth");
    expect(renderTemplate("{$h1.occupants|list}", bindings)).toBe("Sun, Mercury");
    expect(renderTemplate("{$h1.occupants|slug}", bindings)).toBe("Sun-Mercury");
    expect(renderTemplate("{$venus.house|ordinal}", bindings)).toBe("6th");
    expect(renderTemplate("{$sun.house|theme}", bindings)).toBe("identity, appearance and direction");
    expect(renderTemplate("{$venus.dignity|dignity}", bindings)).toBe("own sign");
    expect(renderTemplate("{$sun.degree_in_sign|degrees}", bindings)).toBe("15.00");
  });

  it("joins arrays with a comma when no filter is given", () => {
    expect(renderTemplate("{$h1.occupants}", bindings)).toBe("Sun, Mercury");
  });

  it("resolves a nested path", () => {
    expect(renderTemplate("{$jupiter.sign_distance_from.moon}", bindings)).toBe("12");
  });

  it("throws on an unbound name", () => {
    expect(() => renderTemplate("{$nobody.sign}", bindings)).toThrow(RuleResolutionError);
    expect(() => resolvePath("$nobody.sign", bindings)).toThrow(/unbound name/);
  });

  it("throws on an unknown table entry", () => {
    expect(() => renderTemplate("{@career_insights[$sun.house]}", bindings)).toThrow(/no entry/);
  });

  it("leaves text with no tokens untouched", () => {
    expect(renderTemplate("plain sentence, no tokens.", bindings)).toBe("plain sentence, no tokens.");
  });
});

describe("formatting primitives", () => {
  it("ordinal handles the teens", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st",
    ]);
  });

  it("humanDignity strips the underscore", () => {
    expect(humanDignity("own_sign")).toBe("own sign");
  });

  it("formatElementCounts sorts by count and never emits JSON", () => {
    const formatted = formatElementCounts({ Fire: 2, Earth: 3, Air: 1 });
    expect(formatted).toBe("Earth 3, Fire 2, Air 1");
    expect(formatted).not.toMatch(/[{}"]/);
  });

  it("formatElementCounts survives an empty tally", () => {
    expect(formatElementCounts({})).toBe("none");
  });
});

// ---------------------------------------------------------------------------
// Selectors and claims
// ---------------------------------------------------------------------------

describe("selectors", () => {
  it("resolves each selector kind", () => {
    const bound = resolveBindings(
      {
        p: { from: "planet", name: "Venus" },
        h: { from: "house", number: 7 },
        hl: { from: "house_lord", house: 10 },
        a: { from: "ascendant" },
        al: { from: "ascendant_lord" },
        dh: { from: "densest_house" },
        dv: { from: "derived" },
      },
      ctx,
      null,
    )!;

    expect((bound.p as { name: string }).name).toBe("Venus");
    expect((bound.h as { number: number }).number).toBe(7);
    // Taurus rising puts Aquarius on the 10th, ruled by Saturn.
    expect((bound.hl as { name: string }).name).toBe("Saturn");
    expect((bound.a as { sign: string }).sign).toBe("Taurus");
    expect((bound.al as { name: string }).name).toBe("Venus");
    expect((bound.dh as { number: number }).number).toBe(1);
    expect((bound.dv as { dominant_element: string }).dominant_element).toBe("Earth");
  });

  it("binds the for_each variable through @p", () => {
    const bound = resolveBindings({ p: { from: "planet", name: "@p" } }, ctx, "Mars")!;
    expect((bound.p as { name: string }).name).toBe("Mars");
  });

  it("returns null rather than throwing when a planet is missing from the chart", () => {
    expect(resolveBindings({ p: { from: "planet", name: "Chiron" } }, ctx, null)).toBeNull();
  });
});

describe("claims", () => {
  it("formats each claim kind", () => {
    expect(buildClaim({ label: "House", path: "$venus.house", format: "ordinal_house", kind: "placement" }, bindings))
      .toEqual({ label: "House", value: "6th house", kind: "placement" });

    expect(buildClaim({ label: "Dignity", path: "$venus.dignity", format: "dignity", kind: "dignity" }, bindings).value)
      .toBe("own sign");

    expect(buildClaim({ label: "Degree", path: "$sun.degree_in_sign", format: "degrees", kind: "measurement" }, bindings).value)
      .toBe("15.00 deg");

    expect(buildClaim({ label: "Occupants", path: "$h10.occupants", format: "list", kind: "count" }, bindings).value)
      .toBe("none");

    expect(buildClaim({ label: "Elements", path: "$d.element_counts", format: "element_counts", kind: "count" }, bindings).value)
      .toBe("Earth 3, Fire 2, Air 1, Water 1");
  });

  it("renders the optional detail template", () => {
    const claim = buildClaim(
      { label: "House", path: "$venus.house", format: "ordinal_house", kind: "placement", detail: "Venus sits in {$venus.sign}." },
      bindings,
    );
    expect(claim.detail).toBe("Venus sits in Libra.");
  });
});

// ---------------------------------------------------------------------------
// for_each expansion
// ---------------------------------------------------------------------------

describe("for_each expansion", () => {
  function parse(input: RuleDefinitionInput): RuleDefinition {
    return ruleDefinitionSchema.parse(input);
  }

  const template: RuleDefinitionInput = {
    id: "test.expansion",
    tier: "signature",
    category: "career",
    priority: "medium",
    instance_key: "test.expansion:{$p.name}",
    for_each: { as: "p", over: "career_planets" },
    bind: { p: { from: "planet", name: "@p" } },
    when: { op: "always" },
    rarity_key: "test.expansion.{$p.name}",
    strength: { base: 0.5, bonuses: [] },
    display: { headline: "{$p.name}", body: "{$p.name} in {$p.sign}.", tension: [] },
    evidence: {
      technical_note: "{$p.name} in {$p.sign}, house {$p.house}.",
      claims: [{ label: "Planet", path: "$p.name", kind: "placement" }],
    },
  };

  it("emits one instance per planet in the set", () => {
    const fired = evaluateRules(ctx, [parse(template)]);
    expect(fired.map((r) => r.instance_key)).toEqual([
      "test.expansion:Mercury",
      "test.expansion:Jupiter",
      "test.expansion:Saturn",
    ]);
  });

  it("filters expansion by the rule's own predicate", () => {
    const fired = evaluateRules(ctx, [
      parse({ ...template, when: { op: "dignity", planet: "$p", is: ["exalted"] } }),
    ]);
    expect(fired.map((r) => r.instance_key)).toEqual(["test.expansion:Jupiter"]);
  });

  it("emits nothing when no planet in the set matches", () => {
    const fired = evaluateRules(ctx, [
      parse({ ...template, when: { op: "dignity", planet: "$p", is: ["debilitated"] } }),
    ]);
    expect(fired).toEqual([]);
  });

  it("renders per-instance evidence and rarity keys", () => {
    const fired = evaluateRules(ctx, [parse(template)]);
    const jupiter = fired.find((r) => r.instance_key === "test.expansion:Jupiter")!;
    expect(jupiter.technical_note).toBe("Jupiter in Cancer, house 3.");
    expect(jupiter.rarity_key).toBe("test.expansion.Jupiter");
    expect(jupiter.claims).toEqual([{ label: "Planet", value: "Jupiter", kind: "placement" }]);
  });

  it("picks the first matching tension variant and no others", () => {
    const fired = evaluateRules(ctx, [
      parse({
        ...template,
        display: {
          headline: "{$p.name}",
          body: "{$p.name}.",
          tension: [
            { when: { op: "dignity", planet: "$p", is: ["debilitated"] }, text: "second" },
            { when: { op: "always" }, text: "fallback for {$p.name}" },
          ],
        },
      }),
    ]);
    expect(fired.map((r) => r.tension)).toEqual([
      "fallback for Mercury",
      "fallback for Jupiter",
      "fallback for Saturn",
    ]);
  });
});
