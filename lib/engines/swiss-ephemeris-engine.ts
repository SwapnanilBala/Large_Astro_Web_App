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

// --------------------------------------------------------------------------
// Ayanamsha reference values per sidereal mode
//
// Each preset defines a reference epoch (as Julian Day) and the ayanamsha
// value at that epoch in degrees. The ayanamsha for an arbitrary date is then
// computed by adding the IAU 2006 general-precession increment accumulated
// between the reference epoch and the target date.
//
// Sources / reference points:
//   Lahiri        – Indian Astronomical Ephemeris: 23°15'00" on 21 Mar 1956
//   Raman         – B.V. Raman's value: 22°27'37.76" on 21 Mar 1956
//   Krishnamurti  – KP system: 23°45'00" at J1900.0 (JD 2415020.0)
// --------------------------------------------------------------------------

interface AyanamsaRef {
  /** Ayanamsha value at the reference epoch, in degrees */
  value_deg: number;
  /** Julian Day of the reference epoch */
  jd_epoch: number;
}

const AYANAMSA_REF: Record<string, AyanamsaRef> = {
  SE_SIDM_LAHIRI: {
    value_deg: 23 + 15 / 60 + 0 / 3600, // 23°15'00"
    jd_epoch: 2435190.5,                  // 21 March 1956 0h UT
  },
  SE_SIDM_RAMAN: {
    value_deg: 22 + 27 / 60 + 37.76 / 3600, // 22°27'37.76"
    jd_epoch: 2435190.5,                      // 21 March 1956 0h UT
  },
  SE_SIDM_KRISHNAMURTI: {
    value_deg: 23 + 45 / 60, // 23°45'00"
    jd_epoch: 2415020.0,     // J1900.0 (31 Dec 1899 12h TT)
  },
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

function computeAyanamsa(jd_ut: number, siderealModeName: string): number {
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

  // Ascendant formula
  const y = -Math.cos(lst);
  const x = Math.sin(lst) * Math.cos(obliquity) + Math.tan(lat) * Math.sin(obliquity);
  let asc = radToDeg(Math.atan2(y, x));
  return normalize(asc);
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

  // Compute tropical planet positions and convert to sidereal
  const placements: Array<{ name: string; longitude: number }> = [];

  for (const [planetName, body] of Object.entries(PLANET_BODIES)) {
    const tropicalLon = getTropicalLongitude(body, time);
    const siderealLon = normalize(tropicalLon - ayanamsa);
    placements.push({ name: planetName, longitude: siderealLon });
  }

  // Rahu (True Lunar Node — osculating node)
  const rahuTropical = computeTrueLunarNode(jd_ut);
  const rahuSidereal = normalize(rahuTropical - ayanamsa);
  placements.push({ name: "Rahu", longitude: rahuSidereal });

  // Ketu (opposite of Rahu)
  const ketuSidereal = normalize(rahuSidereal + 180);
  placements.push({ name: "Ketu", longitude: ketuSidereal });

  // Compute ascendant (tropical → sidereal)
  const ascTropical = computeAscendantLongitude(jd_ut, input.latitude, input.longitude);
  const asc_longitude = normalize(ascTropical - ayanamsa);

  const ascInfo = getSign(asc_longitude);
  const ascendant: AscendantData = {
    longitude: round4(asc_longitude),
    sign: ascInfo.sign,
    degree_in_sign: round4(ascInfo.degree_in_sign),
  };

  const asc_sign_index = ascInfo.sign_index;

  const planets: PlanetPosition[] = placements.map((p) => {
    const info = getSign(p.longitude);
    const house_number = ((info.sign_index - asc_sign_index + 12) % 12) + 1;
    return {
      name: p.name,
      longitude: round4(p.longitude),
      sign: info.sign,
      degree_in_sign: round4(info.degree_in_sign),
      house: house_number,
    };
  });

  const houses: HousePlacement[] = [];
  for (let h = 1; h <= 12; h++) {
    const houseSign = SIGNS[(asc_sign_index + h - 1) % 12];
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
