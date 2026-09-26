/**
 * Step 1 of the PyJHora comparison: build a seeded sample of real charts with
 * our engine and write them where the Python side can read them.
 *
 * Each record carries the exact planet longitudes our engine computed, so
 * PyJHora's yoga functions are judged on the same chart ours are. That is the
 * point: a disagreement then comes from how a yoga is defined, never from a
 * planet sitting in a different sign. The birth moment and place travel along
 * too, so the Python side can also compute the chart itself and report
 * whether the two engines place the planets alike.
 *
 *   npx tsx scripts/pyjhora/export-charts.ts [count]
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { calculate } from "../../lib/engines/swiss-ephemeris-engine";
import { mulberry32 } from "../rarity/prng";
import { YOGA_PAIRS } from "./yoga-map";

export const OUT_DIR = path.resolve(__dirname, "out");
export const CHARTS_FILE = path.join(OUT_DIR, "charts.json");

const SEED = 20260926;
const DEFAULT_COUNT = 2000;

/* Spread across both hemispheres and a wide band of latitude, because house
   placement -- and so most yogas -- depends on the ascendant, which moves
   fastest at high latitude. */
const CITIES = [
  { name: "Mumbai", lat: 19.08, lng: 72.88 },
  { name: "Delhi", lat: 28.61, lng: 77.21 },
  { name: "Chennai", lat: 13.08, lng: 80.27 },
  { name: "London", lat: 51.51, lng: -0.13 },
  { name: "New York", lat: 40.71, lng: -74.01 },
  { name: "Sydney", lat: -33.87, lng: 151.21 },
  { name: "Singapore", lat: 1.35, lng: 103.82 },
  { name: "Stockholm", lat: 59.33, lng: 18.07 },
  { name: "Buenos Aires", lat: -34.6, lng: -58.38 },
  { name: "Johannesburg", lat: -26.2, lng: 28.05 },
];

export type ExportedChart = {
  id: number;
  city: string;
  utc: { year: number; month: number; day: number; hour: number; minute: number };
  latitude: number;
  longitude: number;
  julian_day_ut: number;
  chart: ReturnType<typeof calculate>;
};

function main() {
  const count = Number(process.argv[2] ?? DEFAULT_COUNT);
  const rng = mulberry32(SEED);
  const start = Date.UTC(1940, 0, 1);
  const span = Date.UTC(2015, 11, 31) - start;

  const charts: ExportedChart[] = [];
  for (let id = 0; id < count; id++) {
    const city = CITIES[Math.floor(rng() * CITIES.length)];
    // Whole minutes, so both engines are handed exactly the same instant.
    const when = new Date(start + Math.floor((rng() * span) / 60_000) * 60_000);
    const utc = {
      year: when.getUTCFullYear(),
      month: when.getUTCMonth() + 1,
      day: when.getUTCDate(),
      hour: when.getUTCHours(),
      minute: when.getUTCMinutes(),
    };
    const chart = calculate({
      utc_year: utc.year,
      utc_month: utc.month,
      utc_day: utc.day,
      utc_hour: utc.hour,
      utc_minute: utc.minute,
      utc_second: 0,
      latitude: city.lat,
      longitude: city.lng,
    });
    charts.push({
      id,
      city: city.name,
      utc,
      latitude: city.lat,
      longitude: city.lng,
      julian_day_ut: chart.julian_day_ut,
      chart,
    });
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    CHARTS_FILE,
    JSON.stringify({
      seed: SEED,
      // The engine calls its Rahu the true node; this comparison found it
      // tracks the mean node, so the label says what it computes.
      engine: "lahiri_classic (Lahiri ayanamsa, whole-sign houses, Rahu at the mean node)",
      pyjhora_functions: [...new Set(YOGA_PAIRS.map((pair) => pair.theirs))],
      charts,
    })
  );
  console.log(`Wrote ${charts.length} charts to ${path.relative(process.cwd(), CHARTS_FILE)}`);
}

if (require.main === module) main();
