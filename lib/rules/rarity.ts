/**
 * The rarity dataset loader.
 *
 * Turns the checked-in observation counts into the `RuleRarity` object the UI
 * renders. Two invariants here are load-bearing and easy to get backwards:
 *
 *   1. `score = 1 - fire_rate`. HIGH means RARE means NOTEWORTHY. Rarity's
 *      natural expression is a fire rate, where LOW means rare -- and every
 *      ranking sort in this codebase is hardcoded descending. Exposing a fire
 *      rate as the score would silently promote the most COMMON rule to the
 *      client's headline, with no test failing and no error logged.
 *   2. `fire_rate` never leaves `evidence.rarity`. Nothing outside this module
 *      sorts on it.
 */

import { z } from "zod";
import type { RarityBand, RuleRarity } from "@/lib/astro-types";
import rarityData from "./rarity.json";

// ---------------------------------------------------------------------------
// Dataset
// ---------------------------------------------------------------------------

const raritySchema = z.object({
  version: z.string().regex(/^\d{4}-\d{2}-\d{2}\.\d+$/),
  rules_schema_version: z.string().min(1),
  sample_size: z.number().int().min(1),
  seed: z.number().int(),
  date_range: z.tuple([z.string(), z.string()]),
  location_set: z.string().min(1),
  assumptions: z.array(z.string()),
  counts: z.record(z.string(), z.number().int().min(0)),
});

export type RarityDataset = z.infer<typeof raritySchema>;

let cached: RarityDataset | null = null;

export function loadRarityDataset(): RarityDataset {
  if (cached) return cached;
  const parsed = raritySchema.safeParse(rarityData);
  if (!parsed.success) {
    throw new Error(`lib/rules/rarity.json failed validation: ${parsed.error.issues[0].message}`);
  }
  cached = parsed.data;
  return cached;
}

export const RARITY_DATASET = loadRarityDataset();

/** Below this many observations the estimate is noise, not a measurement. */
export const LOW_CONFIDENCE_THRESHOLD = 30;

// ---------------------------------------------------------------------------
// Bands
// ---------------------------------------------------------------------------

/** Ordered least to most remarkable, so a cap is a simple index clamp. */
const BAND_ORDER: RarityBand[] = ["common", "notable", "uncommon", "rare", "very_rare"];

export function bandFor(fireRate: number): RarityBand {
  if (fireRate > 0.35) return "common";
  if (fireRate > 0.15) return "notable";
  if (fireRate > 0.05) return "uncommon";
  if (fireRate > 0.01) return "rare";
  return "very_rare";
}

/**
 * A thin tail cannot buy a strong claim.
 *
 * With fewer than 30 observations the band is clamped to "uncommon" -- a rule
 * that happened to fire twice in 200,000 charts would otherwise be reported as
 * "very rare", which is the strongest possible claim resting on the thinnest
 * possible evidence.
 */
function cappedBand(fireRate: number, lowConfidence: boolean): RarityBand {
  const band = bandFor(fireRate);
  if (!lowConfidence) return band;
  const capIndex = BAND_ORDER.indexOf("uncommon");
  return BAND_ORDER[Math.min(BAND_ORDER.indexOf(band), capIndex)];
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

/**
 * The rarity of one key.
 *
 * An unmeasured key returns `fire_rate: 1, score: 0` -- maximally common, so it
 * can never be promoted by the ranking on the strength of evidence nobody
 * gathered. Failing open in the other direction would put an unmeasured rule at
 * the top of the page.
 */
export function rarityFor(key: string, dataset: RarityDataset = RARITY_DATASET): RuleRarity {
  const sampleSize = dataset.sample_size;
  const observed = dataset.counts[key];

  if (observed === undefined) {
    return {
      fire_rate: 1,
      score: 0,
      band: "common",
      observed_count: 0,
      sample_size: sampleSize,
      low_confidence: true,
      dataset_version: dataset.version,
    };
  }

  // A key observed zero times in N samples is not "never happens" -- it is
  // "below the resolution of this sample". 1/(2N) is the conventional floor.
  const fireRate = observed === 0 ? 1 / (2 * sampleSize) : observed / sampleSize;
  const lowConfidence = observed < LOW_CONFIDENCE_THRESHOLD;

  return {
    fire_rate: fireRate,
    score: 1 - fireRate,
    band: cappedBand(fireRate, lowConfidence),
    observed_count: observed,
    sample_size: sampleSize,
    low_confidence: lowConfidence,
    dataset_version: dataset.version,
  };
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

/**
 * The client-facing rarity sentence. Never a bare decimal, never a percentage
 * of a thing that is not a percentage, and never a number at all when the
 * measurement is too thin to support one.
 */
export function rarityLabel(rarity: RuleRarity): string {
  if (rarity.low_confidence) return "An unusual combination";

  const perHundred = Math.round(rarity.fire_rate * 100);
  if (perHundred >= 100) return "Present in every chart";
  if (perHundred >= 1) return `Shows up in about ${perHundred} of every 100 charts`;

  const perThousand = Math.round(rarity.fire_rate * 1000);
  if (perThousand >= 1) return `Shows up in about ${perThousand} of every 1,000 charts`;

  return "Shows up in fewer than 1 in 1,000 charts";
}
