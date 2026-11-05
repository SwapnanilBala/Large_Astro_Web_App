import { describe, expect, it } from "vitest";

import { calculate, type BirthInput } from "../engines/swiss-ephemeris-engine";
import {
  calculateDashaTimeline,
  calculateNakshatra,
  computeSubPeriods,
} from "../engines/nakshatra-engine";

/*
 * Vimshottari dates held to Swiss Ephemeris.
 *
 * Reference values are Swiss Ephemeris 2.10.03 (pyswisseph from
 * `npm run pyjhora:setup`, Moshier ephemeris), FLG_SIDEREAL with SIDM_LAHIRI
 * or SIDM_RAMAN: swe.calc_ut(jd, body, FLG_MOSEPH | FLG_SIDEREAL) for the
 * bodies and swe.houses_ex(jd, lat, lon, b"W", same flags) for the ascendant.
 * The dates are what this engine's own timeline gives from Swiss
 * Ephemeris's Moon, so the test isolates the Moon's sidereal longitude, which
 * is the only ephemeris input to the dasha balance.
 *
 * Before 2026-11 the engine subtracted a mean ayanamsha from true-of-date
 * longitudes (nutation left in), anchored Lahiri on a true value as if it
 * were mean, and precessed it at psi_A instead of p_A. The Moon sat 9" to 34"
 * too far forward and these charts' periods began 2 to 5 days early. See
 * "Mean and true ayanamsha" in swiss-ephemeris-engine.ts.
 */

interface Reference {
  engine_id: string;
  utc: [number, number, number, number, number];
  sun: number;
  moon: number;
  asc: number;
  lord: string;
  firstMahaStart: string;
  secondMaha: string;
  antar2: string;
  antar4: string;
  pratyantar6: string;
}

const MUMBAI = { latitude: 19.07, longitude: 72.88 };

const REFERENCES: Record<string, Reference> = {
  "1975-08-20 22:10 UT, Lahiri": {
    engine_id: "lahiri_classic",
    utc: [1975, 8, 20, 22, 10],
    sun: 123.741535,
    moon: 293.748287,
    asc: 86.808127,
    lord: "Mars",
    firstMahaStart: "1975-06-02",
    secondMaha: "Rahu 1982-06-02",
    antar2: "Jupiter 1985-02-12",
    antar4: "Mercury 1990-05-14",
    pratyantar6: "Mars 1991-08-22",
  },
  "2012-01-01 06:00 UT, Lahiri": {
    engine_id: "lahiri_classic",
    utc: [2012, 1, 1, 6, 0],
    sun: 256.183683,
    moon: 346.073177,
    asc: 327.256527,
    lord: "Saturn",
    firstMahaStart: "1993-11-05",
    secondMaha: "Mercury 2012-11-05",
    antar2: "Ketu 2015-04-03",
    antar4: "Sun 2019-01-29",
    pratyantar6: "Saturn 2019-06-25",
  },
  "1948-11-02 18:20 UT, Lahiri": {
    engine_id: "lahiri_classic",
    utc: [1948, 11, 2, 18, 20],
    sun: 197.104559,
    moon: 216.953514,
    asc: 101.235137,
    lord: "Saturn",
    firstMahaStart: "1943-09-06",
    secondMaha: "Mercury 1962-09-06",
    antar2: "Ketu 1965-02-01",
    antar4: "Sun 1968-11-29",
    pratyantar6: "Saturn 1969-04-25",
  },
  "1990-04-15 09:00 UT, Raman": {
    engine_id: "raman_classic",
    utc: [1990, 4, 15, 9, 0],
    sun: 2.855962,
    moon: 240.110837,
    asc: 121.354636,
    lord: "Ketu",
    firstMahaStart: "1990-03-25",
    secondMaha: "Venus 1997-03-24",
    antar2: "Sun 2000-07-23",
    antar4: "Mars 2003-03-24",
    pratyantar6: "Ketu 2003-12-22",
  },
};

function arcsecBetween(a: number, b: number): number {
  let d = a - b;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return Math.abs(d) * 3600;
}

function chartFor(ref: Reference) {
  const [utc_year, utc_month, utc_day, utc_hour, utc_minute] = ref.utc;
  const input: BirthInput = {
    utc_year, utc_month, utc_day, utc_hour, utc_minute, utc_second: 0,
    ...MUMBAI,
    engine_id: ref.engine_id,
  };
  const chart = calculate(input);
  const lon = (name: string) => chart.planets.find((p) => p.name === name)!.longitude;
  return {
    sun: lon("Sun"),
    moon: lon("Moon"),
    asc: chart.ascendant.longitude,
    birthMs: Date.UTC(utc_year, utc_month - 1, utc_day, utc_hour, utc_minute),
  };
}

function datesFrom(moon: number, birthMs: number) {
  const nakshatra = calculateNakshatra(moon);
  const timeline = calculateDashaTimeline(nakshatra, "2000-01-01", Date.UTC(2026, 10, 4), birthMs);
  const [first, second] = timeline.periods;
  const antars = computeSubPeriods(
    second.planet, second.start_date, second.end_date, 2, [second.planet],
    second.sequence_start_date, second.sequence_end_date,
  );
  const antar = antars[3];
  const pratyantars = computeSubPeriods(
    antar.planet, antar.start_date, antar.end_date, 3, [second.planet, antar.planet],
    antar.sequence_start_date, antar.sequence_end_date,
  );
  return {
    lord: nakshatra.lord,
    firstMahaStart: first.sequence_start_date,
    secondMaha: `${second.planet} ${second.start_date}`,
    antar2: `${antars[1].planet} ${antars[1].start_date}`,
    antar4: `${antar.planet} ${antar.start_date}`,
    pratyantar6: `${pratyantars[5].planet} ${pratyantars[5].start_date}`,
  };
}

describe("Vimshottari dates against Swiss Ephemeris", () => {
  for (const [label, ref] of Object.entries(REFERENCES)) {
    describe(label, () => {
      const chart = chartFor(ref);

      it("puts the sidereal Moon, Sun and ascendant where Swiss Ephemeris does", () => {
        // astronomy-engine and Moshier agree on the tropical Moon to about 1".
        expect(arcsecBetween(chart.moon, ref.moon)).toBeLessThan(3);
        expect(arcsecBetween(chart.sun, ref.sun)).toBeLessThan(3);
        // Mean sidereal time against Swiss Ephemeris's apparent: a few arcsec.
        expect(arcsecBetween(chart.asc, ref.asc)).toBeLessThan(6);
      });

      it("starts the first Maha Dasha and its sub-periods on Swiss Ephemeris's days", () => {
        expect(datesFrom(chart.moon, chart.birthMs)).toEqual({
          lord: ref.lord,
          firstMahaStart: ref.firstMahaStart,
          secondMaha: ref.secondMaha,
          antar2: ref.antar2,
          antar4: ref.antar4,
          pratyantar6: ref.pratyantar6,
        });
      });
    });
  }
});
