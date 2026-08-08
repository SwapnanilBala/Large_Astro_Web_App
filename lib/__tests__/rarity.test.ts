/**
 * Guards on the rarity dataset and its loader.
 *
 * The numbers in rarity.json become client-facing claims, so the checks here
 * are about defensibility as much as correctness: is the sample big enough, is
 * the direction of `score` right, and does a thin tail degrade honestly instead
 * of shipping a confident number nobody measured.
 */

import { describe, it, expect } from "vitest";
import {
  RARITY_DATASET,
  rarityFor,
  rarityLabel,
  bandFor,
  loadRarityDataset,
  LOW_CONFIDENCE_THRESHOLD,
  type RarityDataset,
} from "../rules/rarity";
import { RULE_DEFINITIONS } from "../rules";

describe("rarity dataset", () => {
  it("validates", () => {
    expect(() => loadRarityDataset()).not.toThrow();
  });

  it("was measured against a large enough sample", () => {
    expect(RARITY_DATASET.sample_size).toBeGreaterThanOrEqual(100_000);
  });

  it("carries the assumptions it was generated under", () => {
    // A rarity number is only as defensible as the sampling assumptions you can
    // show, so they travel with the data rather than living in a commit message.
    expect(RARITY_DATASET.assumptions.length).toBeGreaterThan(0);
    expect(RARITY_DATASET.location_set).toMatch(/population-weighted/);
    expect(RARITY_DATASET.date_range).toHaveLength(2);
  });

  it("has a reproducible seed and a dated version", () => {
    expect(Number.isInteger(RARITY_DATASET.seed)).toBe(true);
    expect(RARITY_DATASET.version).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });

  it("never records more observations than samples", () => {
    for (const [key, count] of Object.entries(RARITY_DATASET.counts)) {
      expect(count, key).toBeLessThanOrEqual(RARITY_DATASET.sample_size);
      expect(count, key).toBeGreaterThanOrEqual(0);
    }
  });

  it("covers every constant rarity key in the rule set", () => {
    // Templated keys depend on the chart; constant ones are known statically,
    // and a missing constant key means a rule shipped unmeasured.
    for (const def of RULE_DEFINITIONS) {
      if (/\{[$@]/.test(def.rarity_key)) continue;
      expect(RARITY_DATASET.counts[def.rarity_key], `${def.id} was never measured`).toBeDefined();
    }
  });
});

describe("rarityFor", () => {
  it("keeps every fire rate inside (0, 1]", () => {
    for (const key of Object.keys(RARITY_DATASET.counts)) {
      const rarity = rarityFor(key);
      expect(rarity.fire_rate, key).toBeGreaterThan(0);
      expect(rarity.fire_rate, key).toBeLessThanOrEqual(1);
    }
  });

  it("defines score as 1 - fire_rate to six decimal places", () => {
    for (const key of Object.keys(RARITY_DATASET.counts)) {
      const rarity = rarityFor(key);
      expect(rarity.score, key).toBeCloseTo(1 - rarity.fire_rate, 6);
    }
  });

  it("scores a rare rule above a common one", () => {
    // The direction guard. If this ever inverts, the story engine starts
    // headlining the most ordinary thing in the chart.
    const common = rarityFor("yoga.budha_aditya");
    const rare = rarityFor("combo.late_partnership");
    expect(common.fire_rate).toBeGreaterThan(rare.fire_rate);
    expect(rare.score).toBeGreaterThan(common.score);
  });

  it("floors an observed-zero key at 1/(2N) rather than reporting zero", () => {
    const dataset: RarityDataset = { ...RARITY_DATASET, sample_size: 1000, counts: { "test.never": 0 } };
    const rarity = rarityFor("test.never", dataset);
    expect(rarity.fire_rate).toBe(1 / 2000);
    expect(rarity.observed_count).toBe(0);
    expect(rarity.low_confidence).toBe(true);
  });

  it("treats an unmeasured key as maximally common and does not throw", () => {
    const rarity = rarityFor("no.such_key");
    expect(rarity.fire_rate).toBe(1);
    expect(rarity.score).toBe(0);
    expect(rarity.band).toBe("common");
    expect(rarity.low_confidence).toBe(true);
  });

  it("sets low_confidence exactly when observations are under the threshold", () => {
    const dataset: RarityDataset = {
      ...RARITY_DATASET,
      sample_size: 200_000,
      counts: { "test.thin": LOW_CONFIDENCE_THRESHOLD - 1, "test.solid": LOW_CONFIDENCE_THRESHOLD },
    };
    expect(rarityFor("test.thin", dataset).low_confidence).toBe(true);
    expect(rarityFor("test.solid", dataset).low_confidence).toBe(false);
  });

  it("caps the band at uncommon when the measurement is thin", () => {
    const dataset: RarityDataset = { ...RARITY_DATASET, sample_size: 200_000, counts: { "test.thin": 5 } };
    const rarity = rarityFor("test.thin", dataset);
    // 5/200000 would otherwise band as very_rare.
    expect(bandFor(rarity.fire_rate)).toBe("very_rare");
    expect(rarity.band).toBe("uncommon");
  });

  it("assigns bands at the documented boundaries", () => {
    expect(bandFor(0.36)).toBe("common");
    expect(bandFor(0.35)).toBe("notable");
    expect(bandFor(0.16)).toBe("notable");
    expect(bandFor(0.15)).toBe("uncommon");
    expect(bandFor(0.06)).toBe("uncommon");
    expect(bandFor(0.05)).toBe("rare");
    expect(bandFor(0.02)).toBe("rare");
    expect(bandFor(0.01)).toBe("very_rare");
    expect(bandFor(0.0001)).toBe("very_rare");
  });
});

describe("rarityLabel", () => {
  const label = (fire_rate: number, low_confidence = false) =>
    rarityLabel({
      fire_rate,
      score: 1 - fire_rate,
      band: bandFor(fire_rate),
      observed_count: low_confidence ? 5 : 5000,
      sample_size: 200_000,
      low_confidence,
      dataset_version: "2026-08-08.1",
    });

  it("never renders a bare decimal or a percentage sign", () => {
    for (const rate of [1, 0.51, 0.33, 0.08, 0.03, 0.004, 0.0002]) {
      const text = label(rate);
      expect(text, String(rate)).not.toMatch(/\d+\.\d+|%/);
    }
  });

  it("phrases common rates per hundred", () => {
    expect(label(0.33)).toBe("Shows up in about 33 of every 100 charts");
    expect(label(0.08)).toBe("Shows up in about 8 of every 100 charts");
  });

  it("drops to per-thousand below one percent", () => {
    expect(label(0.004)).toBe("Shows up in about 4 of every 1,000 charts");
  });

  it("stops claiming precision below one in a thousand", () => {
    expect(label(0.0002)).toBe("Shows up in fewer than 1 in 1,000 charts");
  });

  it("goes non-numeric when the measurement is thin", () => {
    expect(label(0.00002, true)).toBe("An unusual combination");
  });

  it("handles a rule that fires for every chart", () => {
    expect(label(1)).toBe("Present in every chart");
  });
});
