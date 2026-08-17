// Pure JavaScript astronomical calculations using astronomy-engine
// Replaces the native swisseph C addon for Vercel compatibility

import * as Astronomy from "astronomy-engine";
import { getEnginePreset, type EnginePreset } from "./engine-registry";

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
// Ascendant calculation
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
  let gmst =
    280.46061837 +
    360.98564736629 * (jd_ut - J2000) +
    0.000387933 * T * T -
    (T * T * T) / 38710000.0;
  return normalize(gmst);
}

function computeAscendantLongitude(
  jd_ut: number,
  latitude: number,
  longitude: number
): number {
  const obliquity = degToRad(computeObliquity(jd_ut));
  const gmst = computeGMST(jd_ut);
  // Local Sidereal Time in degrees, then radians
  const lst = degToRad(normalize(gmst + longitude));
  const lat = degToRad(latitude);

  // Ascendant formula (Meeus)
  //   tan(λ) = −cos(RAMC) / [sin(RAMC)·cos(ε) + tan(φ)·sin(ε)]
  //
  // atan2 yields two solutions 180° apart (ASC and DSC). The numerator and
  // denominator signs produced by this form correspond to the Descendant, so
  // we add 180° to obtain the Ascendant.
  const y = -Math.cos(lst);
  const x = Math.sin(lst) * Math.cos(obliquity) + Math.tan(lat) * Math.sin(obliquity);
  let asc = radToDeg(Math.atan2(y, x)) + 180;
  return normalize(asc);
}

// --------------------------------------------------------------------------
// House system types
// --------------------------------------------------------------------------

export type HouseSystemCode =
  | "whole_sign"
  | "equal"
  | "placidus"
  | "koch"
  | "campanus"
  | "regiomontanus";

// --------------------------------------------------------------------------
// Midheaven (MC) calculation
// --------------------------------------------------------------------------

function computeMC(obliquityDeg: number, lstDeg: number): number {
  const eps = degToRad(obliquityDeg);
  const lst = degToRad(lstDeg);
  // MC = atan2(sin(LST), cos(LST) * cos(ε))
  // This gives the ecliptic longitude of the meridian
  let mc = radToDeg(Math.atan2(Math.sin(lst), Math.cos(lst) * Math.cos(eps)));
  return normalize(mc);
}

// --------------------------------------------------------------------------
// Convert right ascension to ecliptic longitude
// --------------------------------------------------------------------------

function raToEclipticLon(raDeg: number, obliquityDeg: number): number {
  // Given a point on the celestial equator at right ascension raDeg (declination=0),
  // project it to the ecliptic. For equatorial house systems the declination
  // of the cusp point is zero on the equator, so:
  // tan(λ) = tan(RA) / cos(ε)  (only valid for points on the equator)
  // We use atan2 for proper quadrant:
  const ra = degToRad(raDeg);
  const eps = degToRad(obliquityDeg);
  const lon = radToDeg(Math.atan2(Math.sin(ra) * Math.cos(eps), Math.cos(ra)));
  return normalize(lon);
}

// --------------------------------------------------------------------------
// House cusp calculation for different systems
// --------------------------------------------------------------------------

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

function computePlacidus(
  ascLongitude: number,
  mcLongitude: number,
  obliquityDeg: number,
  latitudeDeg: number,
  lstDeg: number
): number[] {
  const eps = degToRad(obliquityDeg);
  const phi = degToRad(latitudeDeg);
  const RAMC = normalize(lstDeg); // Right Ascension of MC in degrees

  // House 1 = Ascendant, House 10 = MC
  const cusps: number[] = new Array(12);
  cusps[0] = normalize(ascLongitude); // H1 = Asc
  cusps[9] = normalize(mcLongitude);  // H10 = MC
  cusps[3] = normalize(mcLongitude + 180); // H4 = IC
  cusps[6] = normalize(ascLongitude + 180); // H7 = Desc

  // Placidus uses semi-arc trisection.
  // For houses 11, 12 (above horizon) and 2, 3 (below horizon),
  // we iteratively solve for the ecliptic longitude where the
  // fraction of the semi-arc matches 1/3 or 2/3.

  // Diurnal semi-arc fraction method:
  // For a point at ecliptic longitude λ, its declination is:
  //   sin(δ) = sin(ε) * sin(λ)
  // Its ascensional difference is:
  //   AD = asin(tan(δ) * tan(φ))
  // Diurnal semi-arc: DSA = 90 + AD
  // Nocturnal semi-arc: NSA = 90 - AD
  //
  // For cusp 11: RAMC + DSA/3 = RA of cusp
  // For cusp 12: RAMC + 2*DSA/3 = RA of cusp
  // For cusp 2: RAMC + 180 + NSA/3 = RA of cusp
  // For cusp 3: RAMC + 180 + 2*NSA/3 = RA of cusp

  // Iterative method: start with a guess, compute the cusp RA that would
  // be needed, convert to ecliptic longitude, check if consistent.

  function eclipticLonToRA(lonDeg: number): number {
    const lon = degToRad(lonDeg);
    const ra = Math.atan2(
      Math.sin(lon) * Math.cos(eps),
      Math.cos(lon)
    );
    return normalize(radToDeg(ra));
  }

  function eclipticLonToDecl(lonDeg: number): number {
    const lon = degToRad(lonDeg);
    return radToDeg(Math.asin(Math.sin(eps) * Math.sin(lon)));
  }

  function raToEclipticWithDecl(raDeg: number, declDeg: number): number {
    const ra = degToRad(raDeg);
    const decl = degToRad(declDeg);
    const lon = Math.atan2(
      Math.sin(ra) * Math.cos(eps) + Math.tan(decl) * Math.sin(eps),
      Math.cos(ra)
    );
    return normalize(radToDeg(lon));
  }

  function placidusIterate(targetRA: number, fraction: number, isDiurnal: boolean): number {
    // Start from a simple ecliptic guess
    let lon = raToEclipticLon(targetRA, obliquityDeg);

    for (let iter = 0; iter < 50; iter++) {
      const decl = eclipticLonToDecl(lon);
      const tanDtanP = Math.tan(degToRad(decl)) * Math.tan(phi);
      // Clamp to avoid asin domain errors at extreme latitudes
      const clampedAD = Math.max(-1, Math.min(1, tanDtanP));
      const AD = radToDeg(Math.asin(clampedAD));

      let semiArc: number;
      if (isDiurnal) {
        semiArc = 90 + AD;
      } else {
        semiArc = 90 - AD;
      }

      const neededRA = normalize(
        isDiurnal
          ? RAMC + fraction * semiArc
          : RAMC + 180 + fraction * semiArc
      );

      const newLon = raToEclipticWithDecl(neededRA, decl);
      if (Math.abs(normalize(newLon - lon)) < 0.0001 || Math.abs(normalize(newLon - lon) - 360) < 0.0001) {
        return normalize(newLon);
      }
      lon = newLon;
    }
    return normalize(lon);
  }

  // Houses above horizon (diurnal): 11, 12
  cusps[10] = placidusIterate(RAMC + 30, 1 / 3, true);  // H11
  cusps[11] = placidusIterate(RAMC + 60, 2 / 3, true);  // H12

  // Houses below horizon (nocturnal): 2, 3
  cusps[1] = placidusIterate(RAMC + 210, 1 / 3, false);  // H2
  cusps[2] = placidusIterate(RAMC + 240, 2 / 3, false);  // H3

  // Opposite houses: H5=H11+180, H6=H12+180, H8=H2+180, H9=H3+180
  cusps[4] = normalize(cusps[10] + 180); // H5
  cusps[5] = normalize(cusps[11] + 180); // H6
  cusps[7] = normalize(cusps[1] + 180);  // H8
  cusps[8] = normalize(cusps[2] + 180);  // H9

  return cusps;
}

function computeKoch(
  ascLongitude: number,
  mcLongitude: number,
  obliquityDeg: number,
  latitudeDeg: number,
  lstDeg: number
): number[] {
  const eps = degToRad(obliquityDeg);
  const phi = degToRad(latitudeDeg);
  const RAMC = normalize(lstDeg);

  const cusps: number[] = new Array(12);
  cusps[0] = normalize(ascLongitude);
  cusps[9] = normalize(mcLongitude);
  cusps[3] = normalize(mcLongitude + 180);
  cusps[6] = normalize(ascLongitude + 180);

  // Koch: divides the time for the MC degree to rise from horizon to culmination
  // The MC's declination:
  const mcDecl = radToDeg(Math.asin(Math.sin(eps) * Math.sin(degToRad(mcLongitude))));
  const tanDtanP = Math.tan(degToRad(mcDecl)) * Math.tan(phi);
  const clampedVal = Math.max(-1, Math.min(1, tanDtanP));
  const AD_mc = radToDeg(Math.asin(clampedVal)); // ascensional difference of MC

  // Koch semi-arc of MC
  const DSA_mc = 90 + AD_mc;

  // For Koch, intermediate cusps use:
  // cusp RA = RAMC + f * DSA_mc (for houses 11, 12)
  // cusp RA = RAMC + 180 + f * (180 - DSA_mc) (for houses 2, 3)
  // Then convert RA to ecliptic longitude using the ascendant formula approach

  function kochCusp(ramc: number, f: number, _isDiurnal: boolean): number {
    let targetRA: number;
    if (_isDiurnal) {
      targetRA = normalize(ramc + f * DSA_mc);
    } else {
      const NSA_mc = 90 - AD_mc;
      targetRA = normalize(ramc + 180 + f * NSA_mc);
    }
    // Convert using the ascendant-like formula at this RA
    const H = degToRad(targetRA);
    const y = -Math.cos(H);
    const x = Math.sin(H) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps);
    return normalize(radToDeg(Math.atan2(y, x)));
  }

  cusps[10] = kochCusp(RAMC, 1 / 3, true);  // H11
  cusps[11] = kochCusp(RAMC, 2 / 3, true);  // H12
  cusps[1] = kochCusp(RAMC, 1 / 3, false);   // H2
  cusps[2] = kochCusp(RAMC, 2 / 3, false);   // H3

  cusps[4] = normalize(cusps[10] + 180);
  cusps[5] = normalize(cusps[11] + 180);
  cusps[7] = normalize(cusps[1] + 180);
  cusps[8] = normalize(cusps[2] + 180);

  return cusps;
}

function computeCampanus(
  ascLongitude: number,
  mcLongitude: number,
  obliquityDeg: number,
  latitudeDeg: number,
  lstDeg: number
): number[] {
  const eps = degToRad(obliquityDeg);
  const phi = degToRad(latitudeDeg);

  // Campanus divides the prime vertical into 12 equal arcs of 30 degrees,
  // then projects these points onto the ecliptic via great circles
  // through the north and south points of the horizon.

  const cusps: number[] = [];

  for (let i = 0; i < 12; i++) {
    // Campanus azimuth: starting from the East point, going through
    // the zenith. The prime vertical poles are N/S horizon points.
    // Azimuth on prime vertical for house cusp i:
    const A = degToRad(i * 30); // 0, 30, 60, ... on prime vertical

    // Project from prime vertical to ecliptic:
    // The pole of the prime vertical is the North/South point of the horizon.
    // Formula: tan(λ - LST) = tan(A) / cos(φ), with ecliptic correction

    // Campanus formula (simplified Placidus-style projection):
    // For house cusp at prime vertical angle A:
    //   tan(H) = tan(A) * cos(phi)
    //   where H is the hour angle
    // Then convert H to ecliptic longitude:

    const tanA = Math.tan(A);
    const H = Math.atan2(tanA, Math.cos(phi));
    // D (declination on the prime vertical circle):
    const D = Math.atan(Math.sin(phi) * Math.sin(H) / Math.cos(H));

    // RA = LST - H converted to ecliptic
    const lstRad = degToRad(lstDeg);
    const RA = lstRad - H;

    // Convert equatorial (RA, D) to ecliptic longitude:
    const lon = Math.atan2(
      Math.sin(RA) * Math.cos(eps) + Math.tan(D) * Math.sin(eps),
      Math.cos(RA)
    );

    cusps.push(normalize(radToDeg(lon)));
  }

  return cusps;
}

function computeRegiomontanus(
  ascLongitude: number,
  mcLongitude: number,
  obliquityDeg: number,
  latitudeDeg: number,
  lstDeg: number
): number[] {
  const eps = degToRad(obliquityDeg);
  const phi = degToRad(latitudeDeg);
  const RAMC = lstDeg; // RAMC = LST in degrees

  // Regiomontanus divides the celestial equator into 12 equal 30-degree arcs
  // starting from RAMC, then projects these via hour circles to the ecliptic.
  // The projection goes through the North and South points of the horizon.

  const cusps: number[] = [];

  for (let i = 0; i < 12; i++) {
    // RA of the cusp on the equator:
    const RA_cusp = normalize(RAMC + (i + 10) * 30); // H10 starts at RAMC

    // The Regiomontanus formula projects through the intersection with
    // the horizon plane. Hour angle:
    const HA = degToRad(normalize(RAMC - RA_cusp + 360));

    // Meridian distance → declination of the cusp point:
    // tan(δ) = tan(φ) * cos(HA) (Regiomontanus projection)
    // But the standard formula is:
    // For Regiomontanus, the cusp longitude λ is found from:
    //   tan(λ) = (sin(RA) * cos(ε) + tan(δ) * sin(ε)) / cos(RA)
    // where δ = atan(tan(φ) * sin(HA)) — the Regiomontanus declination

    // Regiomontanus declination:
    const declCusp = Math.atan(Math.cos(HA) * Math.tan(phi));

    const ra = degToRad(RA_cusp);
    const lon = Math.atan2(
      Math.sin(ra) * Math.cos(eps) + Math.tan(declCusp) * Math.sin(eps),
      Math.cos(ra)
    );

    cusps.push(normalize(radToDeg(lon)));
  }

  // Reorder: the loop above gives H10, H11, H12, H1, H2, ..., H9
  // We need H1, H2, ..., H12
  const reordered: number[] = [];
  for (let h = 0; h < 12; h++) {
    reordered.push(cusps[(h + 3) % 12]); // shift so index 0 = H1
  }

  return reordered;
}

/**
 * Compute house cusps for the given house system.
 * Returns an array of 12 cusp longitudes (0-360), where index 0 = House 1.
 */
export function computeHouseCusps(
  system: HouseSystemCode,
  ascLongitude: number,
  mcLongitude: number,
  obliquityDeg: number,
  latitudeDeg: number,
  lstDeg: number
): number[] {
  switch (system) {
    case "equal":
      return computeEqualCusps(ascLongitude);
    case "placidus":
      return computePlacidus(ascLongitude, mcLongitude, obliquityDeg, latitudeDeg, lstDeg);
    case "koch":
      return computeKoch(ascLongitude, mcLongitude, obliquityDeg, latitudeDeg, lstDeg);
    case "campanus":
      return computeCampanus(ascLongitude, mcLongitude, obliquityDeg, latitudeDeg, lstDeg);
    case "regiomontanus":
      return computeRegiomontanus(ascLongitude, mcLongitude, obliquityDeg, latitudeDeg, lstDeg);
    case "whole_sign":
    default:
      return computeWholeSignCusps(ascLongitude);
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

  const jd_ut = datetimeToJulian(
    input.utc_year,
    input.utc_month,
    input.utc_day,
    input.utc_hour,
    input.utc_minute,
    input.utc_second
  );

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

  // Compute ascendant (tropical → sidereal)
  const ascTropical = computeAscendantLongitude(jd_ut, input.latitude, input.longitude);
  const asc_longitude = normalize(ascTropical - ayanamsa);

  const ascInfo = getSign(asc_longitude);
  const ascendant: AscendantData = {
    longitude: round4(asc_longitude),
    sign: ascInfo.sign,
    degree_in_sign: round4(ascInfo.degree_in_sign),
  };

  // Determine house system from preset
  const houseSystemCode = (preset.house_system_code ?? "whole_sign") as HouseSystemCode;

  // Compute MC and house cusps based on the house system
  const obliquity = computeObliquity(jd_ut);
  const gmst = computeGMST(jd_ut);
  const lstDeg = normalize(gmst + input.longitude); // tropical LST in degrees
  const lstSidereal = normalize(lstDeg - ayanamsa); // sidereal LST

  const mcTropical = computeMC(obliquity, lstDeg);
  const mcSidereal = normalize(mcTropical - ayanamsa);

  const cusps = computeHouseCusps(
    houseSystemCode,
    asc_longitude,
    mcSidereal,
    obliquity,
    input.latitude,
    lstSidereal
  );

  const useWholeSign = houseSystemCode === "whole_sign";
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

  const decimalHour =
    utcDate.getUTCHours() +
    utcDate.getUTCMinutes() / 60 +
    utcDate.getUTCSeconds() / 3600;
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
