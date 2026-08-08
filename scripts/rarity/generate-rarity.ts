/**
 * Monte Carlo rarity harness.
 *
 *   npm run rarity            # default sample size
 *   npm run rarity -- --n=50000 --seed=7 --out=lib/rules/rarity.json
 *
 * Samples synthetic births, runs each one through the real ephemeris and the
 * real rule interpreter, and tallies how often each `rarity_key` fires. The
 * output is checked in, because the numbers become client-facing claims
 * ("shows up in about 3 of every 100 charts") and a claim that cannot be
 * reproduced and reviewed as a diff should not be made at all.
 *
 * Three things this file is careful about, all of them ways to get a
 * confidently wrong number:
 *
 *   - Locations are drawn from a population-weighted city list, not a uniform
 *     lat/lng box. Ascendant and house distributions are latitude-dependent,
 *     and uniform sampling puts about a quarter of synthetic births in the
 *     Southern Ocean.
 *   - The PRNG is seeded, so regeneration is reproducible and its diff is
 *     reviewable.
 *   - Rules whose `rarity_key` is a constant (combination rules) are registered
 *     with a zero count up front. Without that, a four-clause rule that never
 *     fires in the sample would simply be absent from the dataset, and absence
 *     is indistinguishable from "not measured yet".
 */

import { writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { calculate } from "../../lib/engines/swiss-ephemeris-engine";
import { buildRuleContext } from "../../lib/rules/context";
import { evaluateRules, RULE_DEFINITIONS, RULES_SCHEMA_VERSION } from "../../lib/rules";
import { mulberry32, makeWeightedPicker, type Rng } from "./prng";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

type City = { name: string; country: string; lat: number; lng: number; tz: number; pop: number };
type LocationFile = { version: string; assumptions: string[]; cities: City[] };

const DEFAULTS = {
  n: 200_000,
  seed: 20260808,
  out: "lib/rules/rarity.json",
  /** Inclusive birth-date window. Chosen to cover the living client base. */
  startYear: 1940,
  endYear: 2015,
};

function parseArgs() {
  const opts = { ...DEFAULTS };
  for (const arg of process.argv.slice(2)) {
    const match = /^--([a-z]+)=(.+)$/.exec(arg);
    if (!match) continue;
    const [, key, value] = match;
    if (key === "n") opts.n = Number(value);
    else if (key === "seed") opts.seed = Number(value);
    else if (key === "out") opts.out = value;
  }
  if (!Number.isFinite(opts.n) || opts.n < 1) throw new Error(`--n must be a positive number`);
  return opts;
}

// ---------------------------------------------------------------------------
// Sampling
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

function sampleBirth(rng: Rng, city: City, startMs: number, spanDays: number) {
  const dayOffset = Math.floor(rng() * spanDays);
  const secondOfDay = Math.floor(rng() * 86_400);

  // Uniform LOCAL time, converted to UTC. A uniform local hour maps to a
  // uniform UTC hour, so this is a no-op today; it is here so a non-uniform
  // birth-hour model stays correct if one is ever added.
  const localMs = startMs + dayOffset * DAY_MS + secondOfDay * 1000;
  const utc = new Date(localMs - city.tz * 3_600_000);

  return {
    utc_year: utc.getUTCFullYear(),
    utc_month: utc.getUTCMonth() + 1,
    utc_day: utc.getUTCDate(),
    utc_hour: utc.getUTCHours(),
    utc_minute: utc.getUTCMinutes(),
    utc_second: utc.getUTCSeconds(),
    latitude: city.lat,
    longitude: city.lng,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const opts = parseArgs();
  const root = resolve(import.meta.dirname, "../..");

  const locations = JSON.parse(
    readFileSync(resolve(import.meta.dirname, "locations.json"), "utf8"),
  ) as LocationFile;

  const cities = locations.cities;
  const pickCity = makeWeightedPicker(cities.map((c) => c.pop));
  const rng = mulberry32(opts.seed);

  const startMs = Date.UTC(opts.startYear, 0, 1);
  const endMs = Date.UTC(opts.endYear, 11, 31);
  const spanDays = Math.round((endMs - startMs) / DAY_MS) + 1;

  // Constant rarity keys are known statically. Registering them at zero means a
  // thin-tailed rule is reported as measured-and-rare rather than missing.
  const counts = new Map<string, number>();
  for (const def of RULE_DEFINITIONS) {
    if (!/\{[$@]/.test(def.rarity_key)) counts.set(def.rarity_key, 0);
  }

  console.log(
    `Sampling ${opts.n.toLocaleString()} charts ` +
      `(seed ${opts.seed}, ${cities.length} cities, ${opts.startYear}-${opts.endYear})`,
  );

  const startedAt = Date.now();
  let failures = 0;

  for (let i = 0; i < opts.n; i++) {
    const city = cities[pickCity(rng)];
    const birth = sampleBirth(rng, city, startMs, spanDays);

    try {
      const chart = calculate(birth);
      const ctx = buildRuleContext(chart.ascendant.sign, chart.planets, chart.houses);
      // One chart can only contribute one observation per key, even if a
      // for_each rule expands to several instances sharing it.
      const keys = new Set(evaluateRules(ctx).map((r) => r.rarity_key));
      for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
    } catch {
      failures++;
    }

    if ((i + 1) % 10_000 === 0) {
      const elapsed = (Date.now() - startedAt) / 1000;
      const rate = (i + 1) / elapsed;
      const remaining = (opts.n - i - 1) / rate;
      console.log(
        `  ${(i + 1).toLocaleString()} / ${opts.n.toLocaleString()}  ` +
          `${rate.toFixed(0)}/s  eta ${(remaining / 60).toFixed(1)}m  ${counts.size} keys`,
      );
    }
  }

  const elapsed = (Date.now() - startedAt) / 1000;
  const observed = opts.n - failures;
  if (failures > 0) console.warn(`  ${failures} charts failed to compute and were excluded`);

  // Sorted so the checked-in file has a stable, reviewable ordering.
  const sortedKeys = [...counts.keys()].sort();
  const payload = {
    version: `${new Date(Date.now()).toISOString().slice(0, 10)}.1`,
    rules_schema_version: RULES_SCHEMA_VERSION,
    sample_size: observed,
    seed: opts.seed,
    date_range: [`${opts.startYear}-01-01`, `${opts.endYear}-12-31`],
    location_set: `population-weighted, ${cities.length} cities, locations.json v${locations.version}`,
    assumptions: locations.assumptions,
    // Deliberately no timing field: the same seed and rule set must produce a
    // byte-identical file, or every regeneration is a noisy diff.
    counts: Object.fromEntries(sortedKeys.map((k) => [k, counts.get(k)!])),
  };

  const outPath = resolve(root, opts.out);
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(
    `\nWrote ${outPath}\n  ${sortedKeys.length} keys, ${observed.toLocaleString()} charts, ` +
      `${elapsed.toFixed(0)}s\n`,
  );

  const zero = sortedKeys.filter((k) => counts.get(k) === 0);
  if (zero.length > 0) console.warn(`  never observed: ${zero.join(", ")}`);
  const thin = sortedKeys.filter((k) => {
    const c = counts.get(k)!;
    return c > 0 && c < 30;
  });
  if (thin.length > 0) console.warn(`  under 30 observations (low confidence): ${thin.join(", ")}`);
}

main();
