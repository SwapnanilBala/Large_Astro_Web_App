// Pure JavaScript astronomical calculations using astronomy-engine
// Replaces the native swisseph C addon for Vercel compatibility

import * as Astronomy from "astronomy-engine";
import { getEnginePreset } from "./engine-registry";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface PlanetPosition {
  name: string;
  longitude: number;
  sign: string;
  degree_in_sign: number;
  house: number;
  speed?: number;           // degrees per day (negative = retrograde)
  is_retrograde?: boolean;  // true if speed < 0
  is_combust?: boolean;     // true if within combustion orb of Sun
}

export interface AscendantData {
  longitude: number;
  sign: string;
  degree_in_sign: number;
}

export interface HousePlacement {
  house_number: number;
  sign: string;
  planets: string[];
}

export interface SwissEngineResult {
  julian_day_ut: number;
  ascendant: AscendantData;
  planets: PlanetPosition[];
  houses: HousePlacement[];
  house_cusps: number[];
  /** The system `house_cusps` were computed with: the preset's, unless it is undefined at the birthplace. */
  house_system: HouseSystemUsed;
  fallback_mode: boolean;
}

export interface BirthInput {
  utc_year: number;
  utc_month: number;
  utc_day: number;
  utc_hour: number;
  utc_minute: number;
  utc_second: number;
  latitude: number;
  longitude: number;
  engine_id?: string;
}

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

export const SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];

const PLANET_BODIES: Record<string, Astronomy.Body> = {
  Sun: Astronomy.Body.Sun,
  Moon: Astronomy.Body.Moon,
  Mercury: Astronomy.Body.Mercury,
  Venus: Astronomy.Body.Venus,
  Mars: Astronomy.Body.Mars,
  Jupiter: Astronomy.Body.Jupiter,
  Saturn: Astronomy.Body.Saturn,
};

// J2000.0 epoch as Julian Day
const J2000 = 2451545.0;
const UNIX_EPOCH_JD = 2440587.5;
const MILLISECONDS_PER_DAY = 86400000;

// --------------------------------------------------------------------------
// Ayanamsha reference values per sidereal mode
//
// Each preset defines a reference epoch (as Julian Day) and the ayanamsha
// value at that epoch in degrees. The ayanamsha for an arbitrary date is then
// computed by adding the IAU 2006 general-precession increment accumulated
// between the reference epoch and the target date.
//
// Sources / reference points:
//   Fagan-Bradley - Swiss Ephemeris SE_SIDM_FAGAN_BRADLEY:
//                   24.042044444 deg at JD 2433282.42346.
//   Lahiri        – Indian Astronomical Ephemeris / Rashtriya Panchang:
//                   23°51'11" at J2000.0 (JD 2451545.0), calibrated so that
//                   Spica (Chitra) sits at 0° Libra (180° sidereal longitude).
//   Raman         – Swiss Ephemeris SE_SIDM_RAMAN reference:
//                   21°00'51.984" at J1900.0 (Newcomb-based definition)
//   Krishnamurti  – KP system: 22°22'25.44" at J1900.0 (JD 2415020.0)
//                   (derived so that KP ayanamsha ≈ 23°46'25" at J2000.0,
//                   matching the standard Krishnamurti Paddhati tables)
//   Yukteshwar    - Swiss Ephemeris SE_SIDM_YUKTESHWAR:
//                   360 - 338.917778 deg at J1900.0.
//
// Pushyapaksha is handled separately below because Swiss Ephemeris defines
// SE_SIDM_TRUE_PUSHYA from the fixed star delta Cancri (Asellus Australis),
// not from a static reference epoch.
// --------------------------------------------------------------------------

interface AyanamsaRef {
  /** Ayanamsha value at the reference epoch, in degrees */
  value_deg: number;
  /** Julian Day of the reference epoch */
  jd_epoch: number;
}

const AYANAMSA_REF: Record<string, AyanamsaRef> = {
  SE_SIDM_FAGAN_BRADLEY: {
    value_deg: 24.042044444,
    jd_epoch: 2433282.42346,
  },
  SE_SIDM_LAHIRI: {
    value_deg: 23 + 51 / 60 + 11 / 3600, // 23°51'11" (IAE / Rashtriya Panchang)
    jd_epoch: 2451545.0,                   // J2000.0 (1 Jan 2000 12h TT)
  },
  SE_SIDM_RAMAN: {
    // Swiss Ephemeris defines Raman at J1900 as 360° - 338.98556°.
    // The former 1956 reference was about 0.675° too large and could put
    // the ascendant in the preceding sign near a boundary.
    value_deg: 360 - 338.98556,
    jd_epoch: 2415020.0,
  },
  SE_SIDM_KRISHNAMURTI: {
    value_deg: 22 + 22 / 60 + 25.44 / 3600, // 22°22'25.44"
    jd_epoch: 2415020.0,                      // J1900.0 (31 Dec 1899 12h TT)
  },
  SE_SIDM_YUKTESHWAR: {
    value_deg: 360 - 338.917778,
    jd_epoch: 2415020.0,
  },
};

// Swiss Ephemeris SE_SIDM_TRUE_PUSHYA anchors Pushya / Asellus Australis
// (delta Cancri, deCnc) at 16 deg Cancer = 106 deg sidereal longitude.
const TRUE_PUSHYA_TARGET_LONGITUDE = 106;
const PUSHYA_DELTA_CNC = {
  raHours: 8 + 44 / 60 + 41.09921 / 3600,
  decDeg: 18 + 9 / 60 + 15.5034 / 3600,
  pmRaMasPerYear: -17.67,
  pmDecMasPerYear: -229.26,
};

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function normalize(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

function getSign(longitude: number): { sign: string; degree_in_sign: number; sign_index: number } {
  const norm = normalize(longitude);
  const sign_index = Math.floor(norm / 30);
  return {
    sign: SIGNS[sign_index],
    degree_in_sign: norm % 30,
    sign_index,
  };
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function round6(v: number): number {
  return Math.round(v * 1000000) / 1000000;
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function astroTimeFromJulianDay(jd_ut: number): Astronomy.AstroTime {
  return Astronomy.MakeTime(new Date((jd_ut - UNIX_EPOCH_JD) * MILLISECONDS_PER_DAY));
}

function vectorFromEquatorial(raDeg: number, decDeg: number, time: Astronomy.AstroTime): Astronomy.Vector {
  const ra = degToRad(raDeg);
  const dec = degToRad(decDeg);
  const cosDec = Math.cos(dec);
  return new Astronomy.Vector(
    cosDec * Math.cos(ra),
    cosDec * Math.sin(ra),
    Math.sin(dec),
    time
  );
}

// --------------------------------------------------------------------------
// Julian Day calculation
// --------------------------------------------------------------------------

function datetimeToJulian(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
): number {
  const decimalHour = hour + minute / 60 + second / 3600;
  // Standard Meeus formula for Gregorian calendar
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    decimalHour / 24 +
    B -
    1524.5
  );
}

function julianDayOf(input: BirthInput): number {
  return datetimeToJulian(
    input.utc_year,
    input.utc_month,
    input.utc_day,
    input.utc_hour,
    input.utc_minute,
    input.utc_second
  );
}

// --------------------------------------------------------------------------
// IAU 2006 general precession in longitude
//
// The general precession in longitude ψ_A (arcseconds) as a function of
// Julian centuries T from J2000.0 (Capitaine et al. 2003 / IAU 2006):
//
//   ψ_A = 5038.481507″ T
//        −    1.0790069″ T²
//        −    0.00114045″ T³
//        +    0.000132851″ T⁴
//        −    0.0000000951″ T⁵
//
// This replaces the older constant-rate 50.24″/yr approximation and gives
// substantially better accuracy for dates far from J2000.0.
// --------------------------------------------------------------------------

/**
 * Evaluate the IAU 2006 general precession polynomial at T Julian centuries
 * from J2000.0. Returns the accumulated precession in **degrees**.
 */
function precessionIAU2006(T: number): number {
  // Polynomial in arcseconds
  const psiA =
    5038.481507 * T
    - 1.0790069 * T * T
    - 0.00114045 * T * T * T
    + 0.000132851 * T * T * T * T
    - 0.0000000951 * T * T * T * T * T;
  return psiA / 3600.0; // convert arcseconds → degrees
}

// --------------------------------------------------------------------------
// Ayanamsa calculation (IAU 2006 precession model)
//
// For a given Julian Day and sidereal mode the ayanamsha is:
//
//   ayanamsa(jd) = ref_value + [ ψ_A(T_target) − ψ_A(T_ref) ]
//
// where T_target and T_ref are Julian centuries from J2000.0 for the target
// date and the mode's reference epoch respectively, and ψ_A is the IAU 2006
// general-precession polynomial evaluated above.
// --------------------------------------------------------------------------

function computeTruePushyaAyanamsa(jd_ut: number): number {
  const yearsFromJ2000 = (jd_ut - J2000) / 365.25;
  const ra0Deg = PUSHYA_DELTA_CNC.raHours * 15;
  const dec0Deg = PUSHYA_DELTA_CNC.decDeg;
  const raPmDegPerYear =
    (PUSHYA_DELTA_CNC.pmRaMasPerYear / 1000 / 3600) / Math.cos(degToRad(dec0Deg));
  const decPmDegPerYear = PUSHYA_DELTA_CNC.pmDecMasPerYear / 1000 / 3600;

  const starVector = vectorFromEquatorial(
    ra0Deg + raPmDegPerYear * yearsFromJ2000,
    dec0Deg + decPmDegPerYear * yearsFromJ2000,
    astroTimeFromJulianDay(jd_ut)
  );
  const ecliptic = Astronomy.Ecliptic(starVector);

  return normalize(ecliptic.elon - TRUE_PUSHYA_TARGET_LONGITUDE);
}

function computeAyanamsa(jd_ut: number, siderealModeName: string): number {
  if (siderealModeName === "SE_SIDM_TRUE_PUSHYA") {
    return computeTruePushyaAyanamsa(jd_ut);
  }

  const ref = AYANAMSA_REF[siderealModeName] ?? AYANAMSA_REF.SE_SIDM_LAHIRI;

  const T_target = (jd_ut - J2000) / 36525.0;
  const T_ref = (ref.jd_epoch - J2000) / 36525.0;

  return ref.value_deg + (precessionIAU2006(T_target) - precessionIAU2006(T_ref));
}

// --------------------------------------------------------------------------
// True Lunar Node (Rahu) calculation — osculating node
// --------------------------------------------------------------------------

function computeTrueLunarNode(jd_ut: number): number {
  // True (osculating) longitude of the ascending lunar node (Rahu).
  // Computed as the mean node plus the principal nutation in longitude,
  // which causes the node to oscillate ~±1.5° around the mean position.
  //
  // Source: Meeus, "Astronomical Algorithms" (2nd ed.)
  //   - Chapter 22: mean longitude of the ascending node (Ω)
  //   - Chapter 22 / Table 22.A: nutation in longitude (dominant terms)
  //   - L₀ (mean Sun longitude): Meeus eq. 25.2
  //   - L_moon (mean Moon longitude): Meeus Table 47.A fundamental arguments

  const T = (jd_ut - J2000) / 36525.0; // Julian centuries from J2000.0

  // Mean longitude of the ascending node (Ω)
  const omega =
    125.04452 -
    1934.136261 * T +
    0.0020708 * T * T +
    (T * T * T) / 450000.0;

  // Mean longitude of the Sun (L₀) — Meeus eq. 25.2
  const L0 =
    280.46646 +
    36000.76983 * T +
    0.0003032 * T * T;

  // Mean longitude of the Moon (L_moon) — Meeus Table 47.A
  const Lmoon =
    218.3165 +
    481267.8813 * T;

  // Principal nutation in longitude (ΔΩ), converted from arcseconds to degrees.
  // Dominant terms from Meeus Table 22.A:
  //   −17.20″ sin(Ω)  −1.32″ sin(2L₀)  −0.23″ sin(2L_moon)  +0.21″ sin(2Ω)
  const omegaRad = degToRad(omega);
  const L0Rad = degToRad(L0);
  const LmoonRad = degToRad(Lmoon);

  const nutationArcsec =
    -17.20 * Math.sin(omegaRad) -
    1.32 * Math.sin(2 * L0Rad) -
    0.23 * Math.sin(2 * LmoonRad) +
    0.21 * Math.sin(2 * omegaRad);

  const nutationDeg = nutationArcsec / 3600.0;

  // True node = mean node + nutation correction
  return normalize(omega + nutationDeg);
}

// --------------------------------------------------------------------------
// Obliquity and sidereal time
// --------------------------------------------------------------------------

function computeObliquity(jd_ut: number): number {
  // Mean obliquity of the ecliptic — IAU 2006 (Hilton et al. 2006)
  //
  //   ε = 84381.406″ − 46.836769″ T − 0.0001831″ T²
  //     + 0.00200340″ T³ − 0.000000576″ T⁴ − 0.0000000434″ T⁵
  //
  // where T = Julian centuries from J2000.0.
  // This supersedes the older Lieske (1979) / Meeus formula.
  const T = (jd_ut - J2000) / 36525.0;
  const obliquityArcsec =
    84381.406
    - 46.836769 * T
    - 0.0001831 * T * T
    + 0.00200340 * T * T * T
    - 0.000000576 * T * T * T * T
    - 0.0000000434 * T * T * T * T * T;
  return obliquityArcsec / 3600.0;
}

function computeGMST(jd_ut: number): number {
  // Greenwich Mean Sidereal Time in degrees
  const T = (jd_ut - J2000) / 36525.0;
  // GMST at 0h UT in seconds
  const gmst =
    280.46061837 +
    360.98564736629 * (jd_ut - J2000) +
    0.000387933 * T * T -
    (T * T * T) / 38710000.0;
  return normalize(gmst);
}

// --------------------------------------------------------------------------
// The sky the houses divide
//
// The ascendant, the MC and every house cusp follow from three quantities:
// RAMC (the right ascension of the meridian, which is local sidereal time
// expressed as an angle), the obliquity of the ecliptic and the latitude. All
// three are equatorial, so the angles and cusps come out tropical and the
// ayanamsha is subtracted from each at the end, exactly as it is from the
// planets. RAMC takes no ayanamsha of its own: it is measured along the
// equator, and shifting it would turn the sky over the birthplace instead of
// relabelling the zodiac. The quadrant systems were once handed RAMC minus the
// ayanamsha, which turned their sky by about 24 degrees.
// --------------------------------------------------------------------------

export interface HouseSky {
  /** Right ascension of the meridian (local sidereal time), in degrees. */
  ramc: number;
  /** Obliquity of the ecliptic, in degrees. */
  obliquity: number;
  /** Geographic latitude, in degrees, north positive. */
  latitude: number;
}

function houseSkyAt(jd_ut: number, latitude: number, longitude: number): HouseSky {
  return {
    ramc: normalize(computeGMST(jd_ut) + longitude),
    obliquity: computeObliquity(jd_ut),
    latitude,
  };
}

/** The sky over a birth: the RAMC, obliquity and latitude calculate() divides into houses. */
export function birthSky(input: BirthInput): HouseSky {
  return houseSkyAt(julianDayOf(input), input.latitude, input.longitude);
}

/**
 * The degree of the ecliptic rising over the horizon of latitude `pole` whose
 * east point lies at right ascension `eastPoint`.
 *
 * With the birthplace's own latitude and an east point 90 degrees past RAMC,
 * this is the ascendant. The quadrant systems find their other cusps the same
 * way: each of their house circles passes through the north and south points
 * of the horizon, which makes it the horizon of some other latitude (its pole
 * height), and this finds where that circle cuts the ecliptic. Swiss
 * Ephemeris calls the same function Asc1.
 */
function risingDegree(eastPoint: number, pole: number, obliquity: number): number {
  const ra = degToRad(eastPoint);
  const eps = degToRad(obliquity);
  return normalize(
    radToDeg(
      Math.atan2(
        Math.sin(ra),
        Math.cos(eps) * Math.cos(ra) - Math.sin(eps) * Math.tan(degToRad(pole))
      )
    )
  );
}

/** The ascendant, tropical: the degree rising on the birthplace's eastern horizon. */
function ascendantOf(sky: HouseSky): number {
  return risingDegree(sky.ramc + 90, sky.latitude, sky.obliquity);
}

/** The midheaven, tropical: the degree of the ecliptic on the meridian. */
function midheavenOf(sky: HouseSky): number {
  const ramc = degToRad(sky.ramc);
  const eps = degToRad(sky.obliquity);
  return normalize(radToDeg(Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(eps))));
}

// --------------------------------------------------------------------------
// House systems
//
// Whole Sign and Equal count from the ascendant. The four quadrant systems
// (Placidus, Koch, Campanus, Regiomontanus) all put cusp 1 on the ascendant
// and cusp 10 on the MC, and differ only in where they put cusps 11, 12, 2
// and 3 inside the quadrants those angles make; cusps 4 to 9 are the
// opposites of 10 to 3. The formulas are the standard ones as Swiss Ephemeris
// implements them (swehouse.c), and lib/__tests__/house-cusps.test.ts holds
// them to its output.
//
// Inside the polar circles (|latitude| >= 90 - obliquity, about 66.56 deg)
// some degrees of the zodiac never rise or never set. Placidus and Koch divide
// the time a degree spends above or below the horizon, so there they have
// nothing to divide and are undefined. The engine computes Porphyry houses for
// them instead (each quadrant trisected along the ecliptic), the same
// stand-in Swiss Ephemeris uses. Inside the polar circles the MC can also sink
// below the horizon, and then no quadrant system can run from the ascendant
// through the MC in zodiac order. Swiss Ephemeris answers that by taking the
// descendant as the ascendant, which would contradict the lagna this engine
// reports, so any quadrant system whose cusps would come out of order, Porphyry
// included, falls back to Equal houses from the ascendant. The result names
// the system the cusps were actually computed with.
// --------------------------------------------------------------------------

export type HouseSystemCode =
  | "whole_sign"
  | "equal"
  | "placidus"
  | "koch"
  | "campanus"
  | "regiomontanus";

/** A system cusps can come out in: the six on offer, plus Porphyry, the polar stand-in. */
export type HouseSystemUsed = HouseSystemCode | "porphyry";

export interface HouseDivision {
  /** What the cusps were computed with: the system asked for, or its stand-in where that one is undefined. */
  system: HouseSystemUsed;
  /** Twelve cusp longitudes in the ayanamsha's frame, index 0 = house 1. */
  cusps: number[];
}

function computeWholeSignCusps(ascLongitude: number): number[] {
  const ascSignIndex = Math.floor(normalize(ascLongitude) / 30);
  const cusps: number[] = [];
  for (let i = 0; i < 12; i++) {
    cusps.push(normalize(((ascSignIndex + i) % 12) * 30));
  }
  return cusps;
}

function computeEqualCusps(ascLongitude: number): number[] {
  const cusps: number[] = [];
  for (let i = 0; i < 12; i++) {
    cusps.push(normalize(ascLongitude + i * 30));
  }
  return cusps;
}

/** The shorter way round from `b` to `a`, signed, in degrees. */
function angleDifference(a: number, b: number): number {
  return normalize(a - b + 180) - 180;
}

function insidePolarCircle(sky: HouseSky): boolean {
  return Math.abs(sky.latitude) >= 90 - sky.obliquity;
}

/** Cusps 11, 12, 2 and 3 of a quadrant system, tropical. */
interface IntermediateCusps {
  h11: number;
  h12: number;
  h2: number;
  h3: number;
}

/**
 * All twelve tropical cusps of a quadrant system: the ascendant and the MC,
 * the four cusps that system places between them, and the opposites of those
 * six. The ascendant goes in untouched so that cusp 1 is the very value the
 * engine reports as the ascendant.
 */
function quadrantHouses(sky: HouseSky, intermediate: IntermediateCusps): number[] {
  const asc = ascendantOf(sky);
  const mc = midheavenOf(sky);
  const [h11, h12, h2, h3] = [intermediate.h11, intermediate.h12, intermediate.h2, intermediate.h3].map(normalize);
  const opposite = (longitude: number) => normalize(longitude + 180);
  return [asc, h2, h3, opposite(mc), opposite(h11), opposite(h12), opposite(asc), opposite(h2), opposite(h3), mc, h11, h12];
}

/**
 * Placidus: the cusp of house 11 is the degree a third of the way through its
 * own diurnal semi-arc (the time it takes to climb from the eastern horizon to
 * the meridian), and house 12 the degree two thirds of the way; houses 2 and 3
 * do the same with the nocturnal semi-arc below the horizon. How long a degree
 * spends above the horizon depends on its declination, so each cusp sits on a
 * circle whose pole height depends on the cusp itself: start from a guess and
 * iterate, as Swiss Ephemeris does. Outside the polar circles that settles in
 * a handful of steps.
 */
function placidusCusps(sky: HouseSky): number[] | null {
  if (insidePolarCircle(sky)) return null;
  const tanLat = Math.tan(degToRad(sky.latitude));
  const sinEps = Math.sin(degToRad(sky.obliquity));

  // `offset` is where the cusp's circle meets the equator, past RAMC; `share`
  // is the part of its ascensional difference AD = asin(tan(lat) tan(dec))
  // the cusp carries. Its pole then has tan(pole) = sin(share * AD) / tan(dec),
  // which is 0/0 on the equator, where the limit is share * tan(lat).
  const cusp = (offset: number, share: number): number | null => {
    const poleThrough = (longitude: number) => {
      const tanDec = Math.tan(Math.asin(sinEps * Math.sin(degToRad(longitude))));
      const tanPole =
        Math.abs(tanDec) < 1e-12 ? share * tanLat : Math.sin(share * Math.asin(tanLat * tanDec)) / tanDec;
      return radToDeg(Math.atan(tanPole));
    };
    let longitude = risingDegree(sky.ramc + offset, radToDeg(Math.atan(share * tanLat)), sky.obliquity);
    for (let step = 0; step < 100; step++) {
      const next = risingDegree(sky.ramc + offset, poleThrough(longitude), sky.obliquity);
      if (Math.abs(angleDifference(next, longitude)) < 1e-10) return next;
      longitude = next;
    }
    return null;
  };

  const h11 = cusp(30, 1 / 3);
  const h12 = cusp(60, 2 / 3);
  const h2 = cusp(120, 2 / 3);
  const h3 = cusp(150, 1 / 3);
  if (h11 === null || h12 === null || h2 === null || h3 === null) return null;
  return quadrantHouses(sky, { h11, h12, h2, h3 });
}

/**
 * Koch: the MC degree rose a diurnal semi-arc ago. Cusps 11 and 12 are the
 * degrees that were rising two thirds and one third of that time ago; cusps 2
 * and 3 are the degrees that will rise a third and two thirds of the way to
 * the moment the IC rises. Undefined where the MC degree never rises, so it is
 * not computed inside the polar circles.
 */
function kochCusps(sky: HouseSky): number[] | null {
  if (insidePolarCircle(sky)) return null;
  const decMc = Math.asin(Math.sin(degToRad(sky.obliquity)) * Math.sin(degToRad(midheavenOf(sky))));
  // A third of the MC degree's ascensional difference.
  const third = radToDeg(Math.asin(Math.tan(degToRad(sky.latitude)) * Math.tan(decMc))) / 3;
  const risingAt = (eastPoint: number) => risingDegree(eastPoint, sky.latitude, sky.obliquity);
  return quadrantHouses(sky, {
    h11: risingAt(sky.ramc + 30 - 2 * third),
    h12: risingAt(sky.ramc + 60 - third),
    h2: risingAt(sky.ramc + 120 + third),
    h3: risingAt(sky.ramc + 150 + 2 * third),
  });
}

/**
 * Campanus: divide the prime vertical (the great circle through the zenith and
 * the east and west points) into twelve 30-degree arcs. The house circles run
 * through the north and south points of the horizon and those divisions. The
 * one crossing the prime vertical `z` degrees from the zenith has pole height
 * asin(sin(lat) sin z) and meets the equator atan2(sin z cos(lat), cos z)
 * degrees east of the meridian.
 */
function campanusCusps(sky: HouseSky): number[] {
  const lat = degToRad(sky.latitude);
  const cuspAt = (z: number) => {
    const zenithDistance = degToRad(z);
    const pole = radToDeg(Math.asin(Math.sin(lat) * Math.sin(zenithDistance)));
    const eastOfMeridian = radToDeg(
      Math.atan2(Math.sin(zenithDistance) * Math.cos(lat), Math.cos(zenithDistance))
    );
    return risingDegree(sky.ramc + eastOfMeridian, pole, sky.obliquity);
  };
  return quadrantHouses(sky, { h11: cuspAt(30), h12: cuspAt(60), h2: cuspAt(120), h3: cuspAt(150) });
}

/**
 * Regiomontanus: divide the celestial equator into twelve 30-degree arcs from
 * the meridian. The house circles run through the north and south points of
 * the horizon and those divisions; the one meeting the equator `h` degrees
 * east of the meridian has pole height atan(tan(lat) sin h).
 */
function regiomontanusCusps(sky: HouseSky): number[] {
  const tanLat = Math.tan(degToRad(sky.latitude));
  const cuspAt = (h: number) =>
    risingDegree(sky.ramc + h, radToDeg(Math.atan(tanLat * Math.sin(degToRad(h)))), sky.obliquity);
  return quadrantHouses(sky, { h11: cuspAt(30), h12: cuspAt(60), h2: cuspAt(120), h3: cuspAt(150) });
}

/**
 * Porphyry: trisect each quadrant along the ecliptic. Only ever the stand-in
 * for Placidus and Koch inside the polar circles. When the MC is below the
 * horizon the arc from it to the ascendant passes 180 degrees and these cusps
 * come out of order, which sends the chart on to Equal houses.
 */
function porphyryCusps(sky: HouseSky): number[] {
  const asc = ascendantOf(sky);
  const mc = midheavenOf(sky);
  const upper = normalize(asc - mc);
  const lower = 180 - upper;
  return quadrantHouses(sky, {
    h11: mc + upper / 3,
    h12: mc + (2 * upper) / 3,
    h2: asc + lower / 3,
    h3: asc + (2 * lower) / 3,
  });
}

const QUADRANT_SYSTEMS: Record<
  "placidus" | "koch" | "campanus" | "regiomontanus" | "porphyry",
  (sky: HouseSky) => number[] | null
> = {
  placidus: placidusCusps,
  koch: kochCusps,
  campanus: campanusCusps,
  regiomontanus: regiomontanusCusps,
  porphyry: porphyryCusps,
};

/** Whether twelve cusps go once round the zodiac in order: every house a positive arc, the arcs adding to 360. */
function runsInZodiacOrder(cusps: number[]): boolean {
  let total = 0;
  for (let i = 0; i < 12; i++) {
    const span = normalize(cusps[(i + 1) % 12] - cusps[i]);
    if (!(span > 0)) return false;
    total += span;
  }
  return Math.abs(total - 360) < 1e-6;
}

/**
 * The twelve house cusps of `system` for this sky, index 0 = house 1, with the
 * ayanamsha subtracted (pass 0 for tropical cusps). Inside the polar circles
 * the system can come back as a stand-in; see "House systems" above.
 */
export function computeHouseCusps(
  system: HouseSystemCode,
  sky: HouseSky,
  ayanamsa = 0
): HouseDivision {
  const ascendant = normalize(ascendantOf(sky) - ayanamsa);
  switch (system) {
    case "equal":
      return { system, cusps: computeEqualCusps(ascendant) };
    case "placidus":
    case "koch":
    case "campanus":
    case "regiomontanus":
      for (const candidate of [system, "porphyry"] as const) {
        const tropical = QUADRANT_SYSTEMS[candidate](sky);
        if (tropical && runsInZodiacOrder(tropical)) {
          return { system: candidate, cusps: tropical.map((cusp) => normalize(cusp - ayanamsa)) };
        }
      }
      return { system: "equal", cusps: computeEqualCusps(ascendant) };
    case "whole_sign":
    default:
      return { system: "whole_sign", cusps: computeWholeSignCusps(ascendant) };
  }
}

/**
 * Assign a planet to a house based on cusp-based boundaries.
 * A planet is in house N if its longitude falls between cusp N and cusp N+1.
 */
function assignHouseByCusps(planetLongitude: number, cusps: number[]): number {
  const lon = normalize(planetLongitude);
  for (let i = 0; i < 12; i++) {
    const cuspStart = cusps[i];
    const cuspEnd = cusps[(i + 1) % 12];

    if (cuspStart < cuspEnd) {
      // Normal case: cusp range doesn't wrap around 360
      if (lon >= cuspStart && lon < cuspEnd) return i + 1;
    } else {
      // Wraps around 360
      if (lon >= cuspStart || lon < cuspEnd) return i + 1;
    }
  }
  return 1; // fallback
}

// --------------------------------------------------------------------------
// Planet position using astronomy-engine
// --------------------------------------------------------------------------

function makeAstroTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
): Astronomy.AstroTime {
  return Astronomy.MakeTime(
    new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  );
}

function getTropicalLongitude(body: Astronomy.Body, time: Astronomy.AstroTime): number {
  if (body === Astronomy.Body.Sun) {
    return Astronomy.SunPosition(time).elon;
  }
  if (body === Astronomy.Body.Moon) {
    return Astronomy.EclipticGeoMoon(time).lon;
  }
  // For other planets, use geocentric ecliptic coordinates
  const geo = Astronomy.GeoVector(body, time, true);
  const ecliptic = Astronomy.Ecliptic(geo);
  return normalize(ecliptic.elon);
}

// --------------------------------------------------------------------------
// Retrograde detection helper
// --------------------------------------------------------------------------

/**
 * Returns true if the planet is retrograde (speed < 0).
 * If `speed` is not populated, returns false.
 */
export function isRetrograde(planet: PlanetPosition): boolean {
  return planet.is_retrograde === true;
}

// --------------------------------------------------------------------------
// Combustion orbs (degrees from the Sun)
//
// Traditional Vedic combustion orbs. Some planets have a tighter orb when
// retrograde — supply the retrograde orb as the second element.
//   [direct_orb, retrograde_orb]  (retrograde_orb is optional)
// --------------------------------------------------------------------------

const COMBUSTION_ORBS: Record<string, [number, number?]> = {
  Moon:    [12],
  Mars:    [17],
  Mercury: [14, 12],
  Jupiter: [11],
  Venus:   [10, 8],
  Saturn:  [15],
};

// --------------------------------------------------------------------------
// Main calculation
// --------------------------------------------------------------------------

export function calculate(input: BirthInput): SwissEngineResult {
  const preset = getEnginePreset(input.engine_id);

  const jd_ut = julianDayOf(input);

  const ayanamsa = computeAyanamsa(jd_ut, preset.sidereal_mode_name);

  const time = makeAstroTime(
    input.utc_year,
    input.utc_month,
    input.utc_day,
    input.utc_hour,
    input.utc_minute,
    input.utc_second
  );

  // Compute tropical planet positions and convert to sidereal.
  // Also compute positions at jd + 0.01 days to derive daily speed.
  const DT = 0.01; // time step in days for velocity estimation
  const jd_ut2 = jd_ut + DT;
  const ayanamsa2 = computeAyanamsa(jd_ut2, preset.sidereal_mode_name);
  const time2 = Astronomy.MakeTime(
    new Date(
      Date.UTC(
        input.utc_year,
        input.utc_month - 1,
        input.utc_day,
        input.utc_hour,
        input.utc_minute,
        input.utc_second
      ) + DT * 86400000 // add DT days in milliseconds
    )
  );

  const placements: Array<{ name: string; longitude: number; speed: number }> = [];

  for (const [planetName, body] of Object.entries(PLANET_BODIES)) {
    const tropicalLon = getTropicalLongitude(body, time);
    const siderealLon = normalize(tropicalLon - ayanamsa);

    const tropicalLon2 = getTropicalLongitude(body, time2);
    const siderealLon2 = normalize(tropicalLon2 - ayanamsa2);

    // Angular difference handling 360° wraparound
    let diff = siderealLon2 - siderealLon;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    const speed = diff / DT; // degrees per day

    placements.push({ name: planetName, longitude: siderealLon, speed });
  }

  // Rahu (True Lunar Node — osculating node)
  const rahuTropical = computeTrueLunarNode(jd_ut);
  const rahuSidereal = normalize(rahuTropical - ayanamsa);

  const rahuTropical2 = computeTrueLunarNode(jd_ut2);
  const rahuSidereal2 = normalize(rahuTropical2 - ayanamsa2);
  let rahuDiff = rahuSidereal2 - rahuSidereal;
  if (rahuDiff > 180) rahuDiff -= 360;
  if (rahuDiff < -180) rahuDiff += 360;
  const rahuSpeed = rahuDiff / DT;

  // Rahu and Ketu are always retrograde (mean motion is negative)
  placements.push({ name: "Rahu", longitude: rahuSidereal, speed: Math.min(rahuSpeed, -0.001) });

  // Ketu (opposite of Rahu)
  const ketuSidereal = normalize(rahuSidereal + 180);
  placements.push({ name: "Ketu", longitude: ketuSidereal, speed: Math.min(rahuSpeed, -0.001) });

  // The ascendant and the house cusps come off the same sky, so cusp 1 of
  // every system but Whole Sign is the ascendant to the last bit.
  const sky = houseSkyAt(jd_ut, input.latitude, input.longitude);
  const asc_longitude = normalize(ascendantOf(sky) - ayanamsa);

  const ascInfo = getSign(asc_longitude);
  const ascendant: AscendantData = {
    longitude: round4(asc_longitude),
    sign: ascInfo.sign,
    degree_in_sign: round4(ascInfo.degree_in_sign),
  };

  // House cusps in the preset's system, or its stand-in inside the polar circles.
  const { system: houseSystem, cusps } = computeHouseCusps(
    (preset.house_system_code ?? "whole_sign") as HouseSystemCode,
    sky,
    ayanamsa
  );

  const useWholeSign = houseSystem === "whole_sign";
  const asc_sign_index = ascInfo.sign_index;

  const planets: PlanetPosition[] = placements.map((p) => {
    const info = getSign(p.longitude);
    // For Whole Sign, use sign-based house assignment (original behavior)
    // For all other systems, use cusp-based assignment
    const house_number = useWholeSign
      ? ((info.sign_index - asc_sign_index + 12) % 12) + 1
      : assignHouseByCusps(p.longitude, cusps);
    return {
      name: p.name,
      longitude: round4(p.longitude),
      sign: info.sign,
      degree_in_sign: round4(info.degree_in_sign),
      house: house_number,
      speed: round4(p.speed),
      is_retrograde: p.speed < 0,
    };
  });

  // ---------- Combustion detection ----------
  // Find the Sun's longitude to compute angular distances
  const sunPlanet = planets.find((p) => p.name === "Sun");
  if (sunPlanet) {
    const sunLon = sunPlanet.longitude;
    for (const planet of planets) {
      const orbEntry = COMBUSTION_ORBS[planet.name];
      if (!orbEntry) {
        // Sun, Rahu, Ketu — not subject to combustion
        planet.is_combust = false;
        continue;
      }
      // Pick the appropriate orb (retrograde orb if planet is retrograde and one exists)
      const orb = (planet.is_retrograde && orbEntry[1] != null)
        ? orbEntry[1]
        : orbEntry[0];
      // Angular distance between planet and Sun (shortest arc)
      let angularDist = Math.abs(planet.longitude - sunLon);
      if (angularDist > 180) angularDist = 360 - angularDist;
      planet.is_combust = angularDist <= orb;
    }
  }

  const houses: HousePlacement[] = [];
  for (let h = 1; h <= 12; h++) {
    // For Whole Sign, house sign is determined by sign index offset
    // For cusp-based systems, house sign is determined by cusp longitude
    const houseSign = useWholeSign
      ? SIGNS[(asc_sign_index + h - 1) % 12]
      : getSign(cusps[h - 1]).sign;
    const housePlanets = planets
      .filter((p) => p.house === h)
      .map((p) => p.name);
    houses.push({
      house_number: h,
      sign: houseSign,
      planets: housePlanets,
    });
  }

  return {
    julian_day_ut: round6(jd_ut),
    ascendant,
    planets,
    houses,
    house_cusps: cusps.map(round4),
    house_system: houseSystem,
    fallback_mode: false,
  };
}

// --------------------------------------------------------------------------
// Transit computation
// --------------------------------------------------------------------------

export function computeTransitPositions(
  utcDate: Date,
  engineId?: string
): Array<{ name: string; longitude: number; sign: string; degree_in_sign: number }> {
  const preset = getEnginePreset(engineId);

  const jd_ut = datetimeToJulian(
    utcDate.getUTCFullYear(),
    utcDate.getUTCMonth() + 1,
    utcDate.getUTCDate(),
    utcDate.getUTCHours(),
    utcDate.getUTCMinutes(),
    utcDate.getUTCSeconds()
  );

  const ayanamsa = computeAyanamsa(jd_ut, preset.sidereal_mode_name);
  const time = Astronomy.MakeTime(utcDate);

  const positions: Array<{
    name: string;
    longitude: number;
    sign: string;
    degree_in_sign: number;
  }> = [];

  for (const [planetName, body] of Object.entries(PLANET_BODIES)) {
    const tropicalLon = getTropicalLongitude(body, time);
    const siderealLon = normalize(tropicalLon - ayanamsa);
    const info = getSign(siderealLon);
    positions.push({
      name: planetName,
      longitude: round4(siderealLon),
      sign: info.sign,
      degree_in_sign: round4(info.degree_in_sign),
    });
  }

  // Rahu
  const rahuTropical = computeTrueLunarNode(jd_ut);
  const rahuSidereal = normalize(rahuTropical - ayanamsa);
  const rahuInfo = getSign(rahuSidereal);
  positions.push({
    name: "Rahu",
    longitude: round4(rahuSidereal),
    sign: rahuInfo.sign,
    degree_in_sign: round4(rahuInfo.degree_in_sign),
  });

  // Ketu
  const ketuSidereal = normalize(rahuSidereal + 180);
  const ketuInfo = getSign(ketuSidereal);
  positions.push({
    name: "Ketu",
    longitude: round4(ketuSidereal),
    sign: ketuInfo.sign,
    degree_in_sign: round4(ketuInfo.degree_in_sign),
  });

  return positions;
}
