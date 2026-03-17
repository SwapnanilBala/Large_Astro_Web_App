// Swiss Ephemeris engine - port of backend/app/services/swiss_ephemeris_engine.py
// Uses the `swisseph` npm package (Node.js bindings for Swiss Ephemeris)

import swisseph from "swisseph";
import { getEnginePreset, type EnginePreset } from "./engine-registry";

// --------------------------------------------------------------------------
// Ephemeris path configuration (module-level, set once)
// --------------------------------------------------------------------------

let ephemerisPathSet = false;

function ensureEphemerisPath(): void {
  if (ephemerisPathSet) return;
  ephemerisPathSet = true;
  const ephePath = process.env.EPHEMERIS_PATH;
  if (ephePath) {
    swisseph.swe_set_ephe_path(ephePath);
  }
}

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

const PLANET_CODES: Record<string, number> = {
  Sun: swisseph.SE_SUN,
  Moon: swisseph.SE_MOON,
  Mercury: swisseph.SE_MERCURY,
  Venus: swisseph.SE_VENUS,
  Mars: swisseph.SE_MARS,
  Jupiter: swisseph.SE_JUPITER,
  Saturn: swisseph.SE_SATURN,
  Rahu: swisseph.SE_MEAN_NODE,
};

// Map preset sidereal mode names to swisseph constants
const SIDEREAL_MODES: Record<string, number> = {
  SE_SIDM_LAHIRI: swisseph.SE_SIDM_LAHIRI,
  SE_SIDM_RAMAN: swisseph.SE_SIDM_RAMAN,
  SE_SIDM_KRISHNAMURTI: swisseph.SE_SIDM_KRISHNAMURTI,
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

function datetimeToJulian(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
): number {
  const decimalHour = hour + minute / 60 + second / 3600;
  return swisseph.swe_julday(year, month, day, decimalHour, swisseph.SE_GREG_CAL);
}

function setSiderealMode(preset: EnginePreset): void {
  const mode = SIDEREAL_MODES[preset.sidereal_mode_name] ?? swisseph.SE_SIDM_LAHIRI;
  swisseph.swe_set_sid_mode(mode, 0, 0);
}

// --------------------------------------------------------------------------
// Main calculation
// --------------------------------------------------------------------------

export function calculate(input: BirthInput): SwissEngineResult {
  ensureEphemerisPath();
  const preset = getEnginePreset(input.engine_id);
  setSiderealMode(preset);

  const jd_ut = datetimeToJulian(
    input.utc_year,
    input.utc_month,
    input.utc_day,
    input.utc_hour,
    input.utc_minute,
    input.utc_second
  );

  const siderealFlags = swisseph.SEFLG_SWIEPH | swisseph.SEFLG_SIDEREAL;
  let fallback_mode = false;

  let asc_longitude: number;
  let placements: Array<{ name: string; longitude: number }>;

  try {
    asc_longitude = computeAscendant(jd_ut, input.latitude, input.longitude, siderealFlags);
    placements = computePlanets(jd_ut, siderealFlags);
  } catch {
    // Fallback to Moshier ephemeris
    fallback_mode = true;
    const fallbackFlags = swisseph.SEFLG_MOSEPH | swisseph.SEFLG_SIDEREAL;
    setSiderealMode(preset);
    asc_longitude = computeAscendant(jd_ut, input.latitude, input.longitude, fallbackFlags);
    placements = computePlanets(jd_ut, fallbackFlags);
  }

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
    fallback_mode,
  };
}

// --------------------------------------------------------------------------
// Internal computation helpers
// --------------------------------------------------------------------------

function computePlanets(
  jd_ut: number,
  flags: number
): Array<{ name: string; longitude: number }> {
  const placements: Array<{ name: string; longitude: number }> = [];

  for (const [planetName, planetCode] of Object.entries(PLANET_CODES)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = swisseph.swe_calc_ut(jd_ut, planetCode, flags);
    if (result.error) {
      throw new Error(`swe_calc_ut error for ${planetName}: ${result.error}`);
    }
    placements.push({ name: planetName, longitude: normalize(result.longitude) });
  }

  const rahu = placements.find((p) => p.name === "Rahu")!;
  const ketuLongitude = normalize(rahu.longitude + 180);
  placements.push({ name: "Ketu", longitude: ketuLongitude });

  return placements;
}

function computeAscendant(
  jd_ut: number,
  latitude: number,
  longitude: number,
  flags: number
): number {
  // "P" = Placidus house system (used only for ascendant; actual houses are whole-sign)
  // The mivion/swisseph binding accepts the house system as a string character.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = swisseph.swe_houses_ex(jd_ut, flags, latitude, longitude, "P");
  if (result.error) {
    throw new Error(`swe_houses_ex error: ${result.error}`);
  }
  // result.ascendant contains the ascendant longitude
  return normalize(result.ascendant);
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function round6(v: number): number {
  return Math.round(v * 1000000) / 1000000;
}

// --------------------------------------------------------------------------
// Transit computation
// --------------------------------------------------------------------------

export function computeTransitPositions(
  utcDate: Date,
  engineId?: string
): Array<{ name: string; longitude: number; sign: string; degree_in_sign: number }> {
  ensureEphemerisPath();
  const preset = getEnginePreset(engineId);
  setSiderealMode(preset);

  const decimalHour =
    utcDate.getUTCHours() +
    utcDate.getUTCMinutes() / 60 +
    utcDate.getUTCSeconds() / 3600;
  const jd_ut = swisseph.swe_julday(
    utcDate.getUTCFullYear(),
    utcDate.getUTCMonth() + 1,
    utcDate.getUTCDate(),
    decimalHour,
    swisseph.SE_GREG_CAL
  );

  const siderealFlags = swisseph.SEFLG_SWIEPH | swisseph.SEFLG_SIDEREAL;
  const positions: Array<{
    name: string;
    longitude: number;
    sign: string;
    degree_in_sign: number;
  }> = [];
  let rahuLongitude = 0;

  for (const [planetName, planetCode] of Object.entries(PLANET_CODES)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = swisseph.swe_calc_ut(jd_ut, planetCode, siderealFlags);
    if (result.error) {
      throw new Error(`swe_calc_ut error for ${planetName}: ${result.error}`);
    }
    const lon = normalize(result.longitude);
    const info = getSign(lon);
    positions.push({
      name: planetName,
      longitude: round4(lon),
      sign: info.sign,
      degree_in_sign: round4(info.degree_in_sign),
    });
    if (planetName === "Rahu") rahuLongitude = lon;
  }

  const ketuLon = normalize(rahuLongitude + 180);
  const ketuInfo = getSign(ketuLon);
  positions.push({
    name: "Ketu",
    longitude: round4(ketuLon),
    sign: ketuInfo.sign,
    degree_in_sign: round4(ketuInfo.degree_in_sign),
  });

  return positions;
}
