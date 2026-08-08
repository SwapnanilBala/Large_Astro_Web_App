/**
 * The guard file.
 *
 * Everything here fails the build rather than the reading. A rule that
 * references an unbound name, names a table that does not exist, or leaks
 * astrologer vocabulary into client-facing copy is caught at `npm test`, not by
 * a reviewer noticing it in a screenshot.
 */

import { describe, it, expect } from "vitest";
import { RULE_DEFINITIONS, loadRuleDefinitions, evaluateRules } from "../rules";
import { ruleDefinitionSchema, RULE_CATEGORIES, RULE_TIERS } from "../rules/schema";
import { buildRuleContext } from "../rules/context";
import { calculate } from "../engines/swiss-ephemeris-engine";

// ---------------------------------------------------------------------------
// Fixture charts -- deliberately spread so most conditional rules fire somewhere
// ---------------------------------------------------------------------------

const FIXTURES = [
  { label: "London 1948", y: 1948, mo: 3, d: 14, h: 4, mi: 30, lat: 51.51, lng: -0.13 },
  { label: "Sydney 1979", y: 1979, mo: 9, d: 30, h: 17, mi: 45, lat: -33.87, lng: 151.21 },
  { label: "Tokyo 1991", y: 1991, mo: 5, d: 17, h: 23, mi: 10, lat: 35.68, lng: 139.69 },
  { label: "Chennai 2008", y: 2008, mo: 2, d: 19, h: 18, mi: 35, lat: 13.08, lng: 80.27 },
  { label: "Berlin 2014", y: 2014, mo: 7, d: 7, h: 11, mi: 20, lat: 52.52, lng: 13.40 },
];

function contextFor(f: (typeof FIXTURES)[number]) {
  const r = calculate({
    utc_year: f.y, utc_month: f.mo, utc_day: f.d,
    utc_hour: f.h, utc_minute: f.mi, utc_second: 0,
    latitude: f.lat, longitude: f.lng,
  });
  return buildRuleContext(r.ascendant.sign, r.planets, r.houses);
}

/** Every display string a rule can put in front of a client. */
function displayStrings(def: (typeof RULE_DEFINITIONS)[number]): Array<{ where: string; text: string }> {
  return [
    { where: `${def.id} display.headline`, text: def.display.headline },
    { where: `${def.id} display.body`, text: def.display.body },
    ...def.display.tension.map((v, i) => ({ where: `${def.id} display.tension[${i}]`, text: v.text })),
  ];
}

/**
 * Drop `{...}` tokens before linting prose.
 *
 * A token is a path, not something the client reads -- `{$d.kendra_planet_count}`
 * renders as "3". Linting the raw template would flag the variable name and
 * miss jargon arriving through a table value, so the copy lint runs twice:
 * here on the authored prose, and again on rendered output further down.
 */
function proseOnly(template: string): string {
  return template.replace(/\{[^}]*\}/g, " ");
}

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

describe("rule definitions", () => {
  it("every record parses under the schema", () => {
    for (const def of RULE_DEFINITIONS) {
      const result = ruleDefinitionSchema.safeParse(def);
      expect(result.success, `${def.id}: ${result.success ? "" : result.error.message}`).toBe(true);
    }
  });

  it("loads without a static-check failure", () => {
    expect(() => loadRuleDefinitions()).not.toThrow();
    expect(RULE_DEFINITIONS.length).toBeGreaterThan(0);
  });

  it("ids are unique", () => {
    const ids = RULE_DEFINITIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the Lagna signature first in declaration order", () => {
    expect(RULE_DEFINITIONS[0].id).toBe("core.lagna_signature");
  });

  it("every category is one of the closed three", () => {
    // A fourth value would drop those rules out of all three desktop buckets
    // and off the page entirely.
    for (const def of RULE_DEFINITIONS) {
      expect(RULE_CATEGORIES).toContain(def.category);
      expect(RULE_TIERS).toContain(def.tier);
    }
  });

  it("covers all three categories and all three tiers", () => {
    const categories = new Set(RULE_DEFINITIONS.map((d) => d.category));
    const tiers = new Set(RULE_DEFINITIONS.map((d) => d.tier));
    expect([...categories].sort()).toEqual(["career", "core", "love"]);
    expect([...tiers].sort()).toEqual(["combination", "foundation", "signature"]);
  });

  it("has no dignity.neutral record", () => {
    // The legacy `if (dignity === "neutral") continue` survives as an absence,
    // not as a downstream filter.
    expect(RULE_DEFINITIONS.some((d) => d.id.startsWith("dignity.neutral"))).toBe(false);
  });

  it("rejects a display template that reaches for degrees", () => {
    const base = RULE_DEFINITIONS.find((d) => d.id === "core.solar_identity")!;
    const bad = ruleDefinitionSchema.safeParse({
      ...base,
      display: { ...base.display, body: "Sun at {$sun.degree_in_sign|degrees} deg." },
    });
    expect(bad.success).toBe(false);
  });

  it("rejects an unknown key on a rule record", () => {
    const base = RULE_DEFINITIONS.find((d) => d.id === "core.solar_identity")!;
    expect(ruleDefinitionSchema.safeParse({ ...base, confidence_score: 0.86 }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Anti-jargon lint
// ---------------------------------------------------------------------------

/**
 * Terms that mean nothing to a paying client without a gloss. Allowed only when
 * immediately followed by a parenthetical explanation. The technical tier is
 * exempt -- that is what it is for.
 */
const JARGON_DENYLIST = [
  "lagna", "dasha", "antardasha", "kendra", "dusthana",
  "nakshatra", "bindu", "graha", "navamsa", "shadbala", "ayanamsha",
];

describe("client-facing copy", () => {
  it("contains no decimals, degrees, JSON or checksums", () => {
    for (const def of RULE_DEFINITIONS) {
      for (const { where, text } of displayStrings(def)) {
        expect(proseOnly(text), where).not.toMatch(/\d+\.\d+|\bdeg\b|°|[{}]\s*"|JSON|checksum/i);
      }
    }
  });

  it("contains no unglossed astrologer vocabulary", () => {
    for (const def of RULE_DEFINITIONS) {
      for (const { where, text } of displayStrings(def)) {
        for (const term of JARGON_DENYLIST) {
          const unglossed = new RegExp(`\\b${term}\\w*\\b(?!\\s*\\()`, "i");
          expect(proseOnly(text), `${where} uses "${term}" without a gloss`).not.toMatch(unglossed);
        }
      }
    }
  });

  it("gives every rule a headline and a body of usable length", () => {
    for (const def of RULE_DEFINITIONS) {
      expect(def.display.headline.length, `${def.id} headline`).toBeGreaterThan(10);
      expect(def.display.body.length, `${def.id} body`).toBeGreaterThan(10);
    }
  });

  it("keeps the technical tier free to use the vocabulary", () => {
    // The point of the two-layer split: "kendra" and "dusthana" are legitimate
    // in evidence, and at least one rule should be exercising that.
    const technical = RULE_DEFINITIONS.map((d) => d.evidence.technical_note).join(" ");
    expect(technical).toMatch(/kendra|dusthana/i);
  });
});

// ---------------------------------------------------------------------------
// Behaviour against real charts
// ---------------------------------------------------------------------------

describe("rule definitions against real charts", () => {
  for (const fixture of FIXTURES) {
    describe(fixture.label, () => {
      const ctx = contextFor(fixture);
      const fired = evaluateRules(ctx);

      it("renders every template without an unresolved token or table miss", () => {
        expect(fired.length).toBeGreaterThan(0);
        for (const rule of fired) {
          const rendered = [rule.headline, rule.body, rule.technical_note, rule.tension ?? ""].join(" ");
          expect(rendered, rule.instance_key).not.toMatch(/\{[$@]/);
          expect(rendered, rule.instance_key).not.toMatch(/undefined|NaN|\[object Object\]/);
        }
      });

      it("gives every fired rule a unique instance key", () => {
        const keys = fired.map((r) => r.instance_key);
        expect(new Set(keys).size, `duplicate keys: ${keys.join(", ")}`).toBe(keys.length);
      });

      it("resolves every claim to a printable value", () => {
        for (const rule of fired) {
          expect(rule.claims.length, rule.instance_key).toBeGreaterThan(0);
          for (const claim of rule.claims) {
            expect(claim.value, `${rule.instance_key} / ${claim.label}`).toBeTruthy();
            expect(claim.value).not.toMatch(/undefined|NaN|\[object Object\]/);
          }
        }
      });

      it("fires at least one rule in each category", () => {
        for (const category of RULE_CATEGORIES) {
          expect(fired.some((r) => r.category === category), `no ${category} rule fired`).toBe(true);
        }
      });

      it("fires at least one high-priority rule", () => {
        expect(fired.some((r) => r.priority === "high")).toBe(true);
      });

      it("records a matched condition for every conditional rule", () => {
        for (const rule of fired) {
          if (rule.definition.when.op === "always") continue;
          expect(rule.matched_conditions.length, rule.instance_key).toBeGreaterThan(0);
        }
      });

      it("keeps rendered copy free of jargon, degrees and JSON", () => {
        // The authored-prose lint above cannot see through a `{@table[...]}`
        // token. This one reads what the client actually gets.
        for (const rule of fired) {
          const rendered = [rule.headline, rule.body, rule.tension ?? ""].join(" ");
          expect(rendered, rule.instance_key).not.toMatch(/\d+\.\d+|\bdeg\b|°|[{}]|JSON|checksum/i);
          for (const term of JARGON_DENYLIST) {
            const unglossed = new RegExp(`\\b${term}\\w*\\b(?!\\s*\\()`, "i");
            expect(rendered, `${rule.instance_key} renders "${term}" without a gloss`).not.toMatch(unglossed);
          }
        }
      });
    });
  }
});
