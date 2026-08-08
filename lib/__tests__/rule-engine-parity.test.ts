/**
 * TEMPORARY. Delete once generateRules() delegates to the interpreter (Phase 4).
 *
 * Proves that the data-driven interpreter fires the same rules, in the same
 * order, with the same evidence, as the hand-written engine it replaces --
 * across twelve real charts spread over seven decades and both hemispheres.
 *
 * What is compared and what is not:
 *
 *   - Structural fields (id, category, priority, technical_note) and emission
 *     order ARE compared. These must not drift; a change here is a regression.
 *   - Client-facing copy (title, insight, tension text) is NOT compared. The
 *     whole point of the migration is that those strings are rewritten.
 *   - Dignity rules are compared as a set rather than a sequence. The legacy
 *     loop emitted them in planet order; the interpreter emits one record per
 *     (dignity x category), so the same rules arrive in a different order. No
 *     consumer depends on the order within that group.
 *   - Combination rules are excluded: they have no legacy counterpart.
 */

import { describe, it, expect } from "vitest";
import { generateRules, type DeterministicRule } from "../engines/rule-engine";
import { calculate } from "../engines/swiss-ephemeris-engine";
import { buildRuleContext } from "../rules/context";
import { evaluateRules, type EvaluatedRule } from "../rules";

// ---------------------------------------------------------------------------
// Fixture charts
// ---------------------------------------------------------------------------

type Fixture = { label: string; y: number; mo: number; d: number; h: number; mi: number; lat: number; lng: number };

const FIXTURES: Fixture[] = [
  { label: "London 1948",     y: 1948, mo: 3,  d: 14, h: 4,  mi: 30, lat: 51.51, lng: -0.13 },
  { label: "Mumbai 1961",     y: 1961, mo: 11, d: 2,  h: 21, mi: 5,  lat: 19.08, lng: 72.88 },
  { label: "Reykjavik 1972",  y: 1972, mo: 6,  d: 21, h: 12, mi: 0,  lat: 64.15, lng: -21.94 },
  { label: "Sydney 1979",     y: 1979, mo: 9,  d: 30, h: 17, mi: 45, lat: -33.87, lng: 151.21 },
  { label: "Lima 1983",       y: 1983, mo: 1,  d: 8,  h: 2,  mi: 15, lat: -12.05, lng: -77.04 },
  { label: "Cairo 1988",      y: 1988, mo: 12, d: 25, h: 9,  mi: 50, lat: 30.04, lng: 31.24 },
  { label: "Tokyo 1991",      y: 1991, mo: 5,  d: 17, h: 23, mi: 10, lat: 35.68, lng: 139.69 },
  { label: "Lagos 1995",      y: 1995, mo: 8,  d: 3,  h: 6,  mi: 25, lat: 6.52,  lng: 3.38 },
  { label: "Buenos Aires 99", y: 1999, mo: 4,  d: 11, h: 14, mi: 55, lat: -34.60, lng: -58.38 },
  { label: "Anchorage 2003",  y: 2003, mo: 10, d: 28, h: 1,  mi: 5,  lat: 61.22, lng: -149.90 },
  { label: "Chennai 2008",    y: 2008, mo: 2,  d: 19, h: 18, mi: 35, lat: 13.08, lng: 80.27 },
  { label: "Berlin 2014",     y: 2014, mo: 7,  d: 7,  h: 11, mi: 20, lat: 52.52, lng: 13.40 },
];

function chartFor(f: Fixture) {
  const result = calculate({
    utc_year: f.y, utc_month: f.mo, utc_day: f.d,
    utc_hour: f.h, utc_minute: f.mi, utc_second: 0,
    latitude: f.lat, longitude: f.lng,
  });
  return {
    ascendantSign: result.ascendant.sign,
    planets: result.planets,
    houses: result.houses,
  };
}

// ---------------------------------------------------------------------------
// Canonical keys
//
// Both engines describe the same event; only the naming changed for dignity.
// ---------------------------------------------------------------------------

const DIGNITY_SLUGS = ["exalted", "own_sign", "debilitated"];

function legacyKey(rule: DeterministicRule): string {
  if (rule.id === "dignity.planet_strength") {
    const [, planet, dignity] = rule.instance_key!.split(":");
    return `dignity:${dignity}:${planet}`;
  }
  return `${rule.id}|${rule.instance_key}`;
}

function interpreterKey(rule: EvaluatedRule): string {
  if (rule.id.startsWith("dignity.")) {
    const suffix = rule.id.slice("dignity.".length);
    const slug = DIGNITY_SLUGS.find((s) => suffix.startsWith(s))!;
    const planet = rule.instance_key.split(":")[1];
    return `dignity:${slug}:${planet}`;
  }
  return `${rule.id}|${rule.instance_key}`;
}

const isDignity = (id: string) => id === "dignity.planet_strength" || id.startsWith("dignity.");

/** The one rule whose evidence string deliberately changed: the JSON dump is deleted. */
const EVIDENCE_EXEMPT = new Set(["core.dominant_element"]);

/**
 * Rules allowed to raise a tension line the legacy engine did not.
 *
 * `career.tenth_house_axis` gains a second variant for a debilitated 10th lord
 * (the contract's worked example carries both). Everywhere else the tension
 * conditions must match exactly -- an unlisted rule that starts volunteering a
 * counterweight is a predicate bug, not a copy improvement.
 */
const TENSION_ADDITIVE = new Set(["career.tenth_house_axis"]);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("rule engine parity (interpreter vs legacy)", () => {
  for (const fixture of FIXTURES) {
    describe(fixture.label, () => {
      const { ascendantSign, planets, houses } = chartFor(fixture);
      const legacy = generateRules(ascendantSign, planets, houses).rules;
      const ctx = buildRuleContext(ascendantSign, planets, houses);
      const fired = evaluateRules(ctx).filter((r) => r.tier !== "combination");

      it("fires exactly the same set of rules", () => {
        const legacyKeys = legacy.map(legacyKey).sort();
        const firedKeys = fired.map(interpreterKey).sort();
        expect(firedKeys).toEqual(legacyKeys);
      });

      it("preserves emission order outside the dignity group", () => {
        const legacyOrder = legacy.filter((r) => !isDignity(r.id!)).map((r) => r.id);
        const firedOrder = fired.filter((r) => !isDignity(r.id)).map((r) => r.id);
        expect(firedOrder).toEqual(legacyOrder);
      });

      it("keeps the Lagna signature first", () => {
        expect(fired[0].id).toBe("core.lagna_signature");
        expect(legacy[0].id).toBe("core.lagna_signature");
      });

      it("reproduces every technical note byte for byte", () => {
        const byKey = new Map(fired.map((r) => [interpreterKey(r), r]));
        for (const rule of legacy) {
          if (EVIDENCE_EXEMPT.has(rule.id!)) continue;
          const match = byKey.get(legacyKey(rule));
          expect(match, `no interpreter rule for ${legacyKey(rule)}`).toBeDefined();
          expect(match!.technical_note).toBe(rule.basis);
        }
      });

      it("preserves category and priority on every rule", () => {
        const byKey = new Map(fired.map((r) => [interpreterKey(r), r]));
        for (const rule of legacy) {
          const match = byKey.get(legacyKey(rule))!;
          expect(match.category, `category for ${legacyKey(rule)}`).toBe(rule.category);
          expect(match.priority, `priority for ${legacyKey(rule)}`).toBe(rule.priority);
        }
      });

      it("never loses a tension line the legacy engine raised", () => {
        const byKey = new Map(fired.map((r) => [interpreterKey(r), r]));
        for (const rule of legacy) {
          const match = byKey.get(legacyKey(rule))!;
          const legacyHasTension = (rule.tension_note ?? "").length > 0;
          if (legacyHasTension) {
            expect(Boolean(match.tension), `lost tension on ${legacyKey(rule)}`).toBe(true);
          } else if (!TENSION_ADDITIVE.has(rule.id!)) {
            expect(Boolean(match.tension), `unexpected tension on ${legacyKey(rule)}`).toBe(false);
          }
        }
      });

      it("no longer emits a raw JSON dump as evidence", () => {
        const element = fired.find((r) => r.id === "core.dominant_element")!;
        expect(element.technical_note).not.toMatch(/[{}]/);
        expect(element.claims.some((c) => c.label === "Element distribution")).toBe(true);
      });
    });
  }
});
