/**
 * Seeded mulberry32.
 *
 * The rarity dataset is checked in and reviewed as a diff, so it has to be
 * reproducible: the same seed and the same rule set must produce the same
 * rarity.json byte for byte. Math.random() would make every regeneration a
 * meaningless full-file diff and would make a suspicious number impossible to
 * reproduce for investigation.
 */

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform integer in [min, max]. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Draw an index from a cumulative-weight table by binary search.
 *
 * Precomputing the cumulative array matters here: this runs once per sampled
 * chart, and a linear scan over 200 cities would be 200x the work for the same
 * answer.
 */
export function makeWeightedPicker(weights: number[]): (rng: Rng) => number {
  const cumulative: number[] = [];
  let total = 0;
  for (const w of weights) {
    total += w;
    cumulative.push(total);
  }
  return (rng: Rng) => {
    const target = rng() * total;
    let lo = 0;
    let hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
}
