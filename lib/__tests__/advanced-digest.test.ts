import { describe, expect, it } from "vitest";

import { buildAdvancedDigest } from "@/lib/engines/advanced-digest";
import type { ChartApiResponse } from "@/lib/astro-types";

/**
 * What the advanced page tells the model.
 *
 * Two properties matter. The digest must *select* -- the page carries eighteen
 * aspects and a full shadbala table, and handing all of it over defeats the
 * point of summarising. And `available` must name only modules this chart
 * actually has, because the route turns it into the required keys of a JSON
 * schema: a key listed here with no data behind it asks the model to invent a
 * passage about nothing.
 */

function makeChart(overrides: Record<string, unknown> = {}): ChartApiResponse {
  return {
    chart: {
      ascendant: { sign: "Pisces", degree: 12.4, nakshatra: "Uttara Bhadrapada" },
      planets: [
        { name: "Sun", sign: "Aquarius" },
        { name: "Moon", sign: "Virgo" },
      ],
      houses: [],
      deterministic_rules: [],
      summary: "",
      ...(overrides.chart as Record<string, unknown> | undefined),
    },
    ...overrides,
  } as unknown as ChartApiResponse;
}

describe("module availability", () => {
  it("names nothing when the chart carries none of the modules", () => {
    const digest = buildAdvancedDigest(makeChart());
    expect(digest.available).toEqual([]);
  });

  it("names only the modules with data behind them", () => {
    const digest = buildAdvancedDigest(
      makeChart({
        chart: {
          ascendant: { sign: "Pisces", degree: 12.4, nakshatra: "Uttara Bhadrapada" },
          planets: [
            { name: "Sun", sign: "Aquarius" },
            { name: "Moon", sign: "Virgo" },
          ],
          houses: [],
          deterministic_rules: [],
          summary: "",
          aspects: [
            {
              planet1: "Moon",
              planet2: "Venus",
              aspect_type: "trine",
              exact_angle: 120,
              orb: 0.23,
              applying: true,
              vedic: false,
            },
          ],
        },
      }),
    );
    expect(digest.available).toEqual(["aspects"]);
    expect(digest.text).toContain("Moon trine Venus");
  });
});

describe("selection", () => {
  /* Twelve aspects in, six out: the whole reason this function exists is that
     the page has more detail than a summary can carry. */
  it("keeps only the six tightest aspects, closest first", () => {
    const aspects = Array.from({ length: 12 }, (_, index) => ({
      planet1: `P${index}`,
      planet2: "Moon",
      aspect_type: "trine",
      exact_angle: 120,
      orb: 6 - index * 0.5,
      applying: true,
      vedic: false,
    }));

    const digest = buildAdvancedDigest(
      makeChart({
        chart: {
          ascendant: { sign: "Pisces", degree: 12.4, nakshatra: "Uttara Bhadrapada" },
          planets: [],
          houses: [],
          deterministic_rules: [],
          summary: "",
          aspects,
        },
      }),
    );

    const listed = digest.text.match(/ {2}- P(\d+) trine/g) ?? [];
    expect(listed).toHaveLength(6);
    /* P11 has the smallest orb, so it must lead. */
    expect(digest.text).toContain("- P11 trine Moon");
    expect(digest.text).not.toContain("- P0 trine Moon");
  });

  it("counts the flowing and frictional contacts rather than listing them all", () => {
    const digest = buildAdvancedDigest(
      makeChart({
        chart: {
          ascendant: { sign: "Pisces", degree: 12.4, nakshatra: "Uttara Bhadrapada" },
          planets: [],
          houses: [],
          deterministic_rules: [],
          summary: "",
          aspects: [
            { planet1: "a", planet2: "b", aspect_type: "trine", exact_angle: 120, orb: 1, applying: true, vedic: false },
            { planet1: "c", planet2: "d", aspect_type: "sextile", exact_angle: 60, orb: 2, applying: true, vedic: false },
            { planet1: "e", planet2: "f", aspect_type: "square", exact_angle: 90, orb: 3, applying: false, vedic: false },
          ],
        },
      }),
    );
    expect(digest.text).toContain("3 contacts in total: 2 flowing, 1 frictional");
  });

  it("reports the strongest and weakest planet, not the whole table", () => {
    const digest = buildAdvancedDigest(
      makeChart({
        chart: {
          ascendant: { sign: "Pisces", degree: 12.4, nakshatra: "Uttara Bhadrapada" },
          planets: [],
          houses: [],
          deterministic_rules: [],
          summary: "",
          shadbala: [
            { planet: "Mars", strengthRatio: 1.4, isStrong: true },
            { planet: "Venus", strengthRatio: 0.9, isStrong: false },
            { planet: "Saturn", strengthRatio: 0.4, isStrong: false },
          ],
        },
      }),
    );
    expect(digest.available).toContain("strength");
    expect(digest.text).toContain("Strongest planet: Mars");
    expect(digest.text).toContain("Weakest planet: Saturn");
    expect(digest.text).toContain("Below the classical minimum: Venus, Saturn");
  });
});

describe("navamsa", () => {
  it("calls out the planets holding their sign across both charts", () => {
    const digest = buildAdvancedDigest(
      makeChart({
        chart: {
          ascendant: { sign: "Pisces", degree: 12.4, nakshatra: "Uttara Bhadrapada" },
          planets: [],
          houses: [],
          deterministic_rules: [],
          summary: "",
          navamsa: [
            { name: "Mercury", rashi_sign: "Aquarius", navamsa_sign: "Aquarius", navamsa_division: 1 },
            { name: "Moon", rashi_sign: "Virgo", navamsa_sign: "Pisces", navamsa_division: 4 },
          ],
        },
      }),
    );
    expect(digest.text).toContain("Vargottama (same sign in both charts): Mercury");
  });

  it("says so plainly when no planet is vargottama", () => {
    const digest = buildAdvancedDigest(
      makeChart({
        chart: {
          ascendant: { sign: "Pisces", degree: 12.4, nakshatra: "Uttara Bhadrapada" },
          planets: [],
          houses: [],
          deterministic_rules: [],
          summary: "",
          navamsa: [
            { name: "Moon", rashi_sign: "Virgo", navamsa_sign: "Pisces", navamsa_division: 4 },
          ],
        },
      }),
    );
    /* An absence stated is a fact the model can use; an absence omitted reads
       as data it was never given. */
    expect(digest.text).toContain("No planet holds the same sign in both charts.");
  });
});

describe("yogas", () => {
  it("passes on only the yogas that actually fired", () => {
    const digest = buildAdvancedDigest(
      makeChart({
        chart: {
          ascendant: { sign: "Pisces", degree: 12.4, nakshatra: "Uttara Bhadrapada" },
          planets: [],
          houses: [],
          deterministic_rules: [],
          summary: "",
          yogas: [
            {
              yoga_id: "vasumati",
              name: "Vasumati Yoga",
              sanskrit: "",
              category: "wealth",
              present: true,
              strength: "strong",
              occurrence_chance: 0.2,
              involved_planets: ["Venus", "Jupiter"],
              description: "",
              effects: "",
            },
            {
              yoga_id: "absent-one",
              name: "Should Not Appear",
              sanskrit: "",
              category: "benefic",
              present: false,
              strength: "weak",
              occurrence_chance: 0.1,
              involved_planets: [],
              description: "",
              effects: "",
            },
          ],
        },
      }),
    );
    expect(digest.text).toContain("Vasumati Yoga");
    expect(digest.text).not.toContain("Should Not Appear");
  });
});
