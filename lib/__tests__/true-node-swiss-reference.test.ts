import { describe, expect, it } from "vitest";

import { calculate, computeTransitPositions } from "../engines/swiss-ephemeris-engine";

/*
 * Rahu held to Swiss Ephemeris's true node.
 *
 * Reference values are Swiss Ephemeris 2.10.03 (pyswisseph from
 * `npm run pyjhora:setup`, Moshier ephemeris), SIDM_LAHIRI:
 * swe.calc_ut(jd, swe.TRUE_NODE, FLG_MOSEPH | FLG_SIDEREAL) and the same for
 * swe.MEAN_NODE. The first four are the charts that showed, in 2026-11, that
 * the engine's "true node" was the mean node to 0.0001°; the rest are one date
 * a decade from 1900 to 2100, none of them in the series fit's sample.
 *
 * The engine's true node is a fitted series (true-node-series.ts); on 10,000
 * unseen dates it sits within a few arcseconds of Swiss Ephemeris. The mean
 * column is here so a regression to the mean node fails loudly: the two are
 * 0.05° to 1.7° apart on every date below.
 */

type Utc = [number, number, number, number, number];
const REFERENCES: Array<[Utc, number, number]> = [
  [[1975, 8, 20, 22, 10], 212.88027, 212.793989],
  [[2012, 1, 1, 6, 0], 229.939023, 228.936711],
  [[1948, 11, 2, 18, 20], 11.794493, 11.435633],
  [[1990, 4, 15, 9, 0], 289.594714, 289.209724],
  [[1900, 4, 10, 3, 46], 230.070943, 231.441398],
  [[1910, 7, 16, 4, 5], 34.165708, 32.773299],
  [[1920, 2, 1, 12, 35], 208.60149, 207.971098],
  [[1930, 5, 26, 1, 14], 9.702499, 8.37498],
  [[1940, 9, 18, 11, 17], 167.957979, 168.678657],
  [[1950, 3, 27, 3, 16], 344.288098, 344.44295],
  [[1960, 4, 1, 20, 51], 151.202698, 150.559189],
  [[1970, 5, 26, 8, 12], 314.039887, 314.145606],
  [[1980, 3, 10, 9, 40], 125.51508, 124.642845],
  [[1990, 12, 28, 11, 5], 274.44209, 275.586174],
  [[2000, 10, 11, 21, 24], 86.508586, 86.116937],
  [[2010, 9, 8, 5, 15], 255.697757, 254.374527],
  [[2020, 8, 9, 2, 59], 63.673744, 62.389529],
  [[2030, 9, 27, 9, 0], 225.18608, 226.252903],
  [[2040, 5, 19, 22, 56], 39.386137, 39.584395],
  [[2050, 5, 28, 16, 12], 206.201867, 205.595668],
  [[2060, 7, 14, 19, 18], 10.023138, 9.518579],
  [[2070, 7, 15, 5, 14], 176.02251, 175.970052],
  [[2080, 5, 9, 1, 5], 347.07207, 345.950123],
  [[2090, 1, 15, 20, 17], 157.182552, 158.422283],
  [[2100, 9, 18, 20, 30], 313.036007, 311.859302],
];

/** Longitudes are rounded to 0.0001° (0.36″) on the way out. */
const TOLERANCE_ARCSEC = 8;

function gapArcsec(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180) * 3600;
}

function rahuAt([year, month, day, hour, minute]: Utc) {
  const chart = calculate({
    utc_year: year,
    utc_month: month,
    utc_day: day,
    utc_hour: hour,
    utc_minute: minute,
    utc_second: 0,
    latitude: 19.07,
    longitude: 72.88,
    engine_id: "lahiri_classic",
  });
  return chart.planets.find((p) => p.name === "Rahu")!;
}

describe("Rahu is the true node, held to Swiss Ephemeris", () => {
  it.each(REFERENCES)("%j", (utc, trueNode, meanNode) => {
    const rahu = rahuAt(utc);
    expect(gapArcsec(rahu.longitude, trueNode)).toBeLessThan(TOLERANCE_ARCSEC);
    expect(gapArcsec(rahu.longitude, meanNode)).toBeGreaterThan(150);
  });

  it("stays within a couple of arcseconds on the typical date", () => {
    const gaps = REFERENCES.map(([utc, trueNode]) => gapArcsec(rahuAt(utc).longitude, trueNode)).sort(
      (a, b) => a - b
    );
    expect(gaps[Math.floor(gaps.length / 2)]).toBeLessThan(2.5);
  });

  it("transits use the same node as the birth chart", () => {
    for (const [utc] of REFERENCES.slice(0, 6)) {
      const [year, month, day, hour, minute] = utc;
      const transit = computeTransitPositions(
        new Date(Date.UTC(year, month - 1, day, hour, minute)),
        "lahiri_classic"
      ).find((p) => p.name === "Rahu")!;
      expect(transit.longitude).toBeCloseTo(rahuAt(utc).longitude, 4);
    }
  });

  it("keeps Rahu and Ketu retrograde while the true node runs direct", () => {
    // 2012-01-01 06:00 UT: Swiss Ephemeris gives the true node +0.0047°/day.
    const rahu = rahuAt([2012, 1, 1, 6, 0]);
    expect(rahu.is_retrograde).toBe(true);
    expect(rahu.speed).toBeLessThan(0);
  });
});
