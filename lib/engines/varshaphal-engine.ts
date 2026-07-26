/**
 * Annual Profections & Varshaphal (Solar Return / Tajaka) Engine
 *
 * Implements:
 *   Part A - Western Annual Profections (house activation by age)
 *   Part B - Vedic Varshaphal: solar return chart, Muntha, Varshesh
 */

import {
  calculate,
  computeTransitPositions,
  SIGNS,
  type PlanetPosition,
  type AscendantData,
  type HousePlacement,
  type BirthInput,
} from "./swiss-ephemeris-engine";
import type { BirthDetailsInput } from "./compatibility-service";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface AnnualProfection {
  year: number;
  age: number;
  activatedHouse: number;
  activatedSign: string;
  lordOfYear: string;
  activatedPlanets: string[];
  themes: string[];
  /** Natal signs are retained so the client can render the profection wheel accurately. */
  natalHouseSigns: Record<number, string>;
}

export interface VarshaphalResult {
  year: number;
  solarReturnMoment: string;
  returnChart: {
    ascendant: AscendantData;
    planets: PlanetPosition[];
    houses: HousePlacement[];
  };
  muntha: { sign: string; house: number };
  varshesh: { planet: string; reason: string };
  profection: AnnualProfection;
  yearSummary: {
    ascendantComparison: string;
    emotionalTone: string;
    focusAreas: string[];
    strongInfluences: string[];
    yearLordInterpretation: string;
  };
}

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const SIGN_RULERS: Record<string, string> = {
  Aries: "Mars",
  Taurus: "Venus",
  Gemini: "Mercury",
  Cancer: "Moon",
  Leo: "Sun",
  Virgo: "Mercury",
  Libra: "Venus",
  Scorpio: "Mars",
  Sagittarius: "Jupiter",
  Capricorn: "Saturn",
  Aquarius: "Saturn",
  Pisces: "Jupiter",
};

const HOUSE_THEMES: Record<number, string[]> = {
  1: ["Self", "identity", "personal direction"],
  2: ["Finances", "values", "material security"],
  3: ["Communication", "siblings", "short travel"],
  4: ["Home", "family", "emotional roots"],
  5: ["Creativity", "children", "romance"],
  6: ["Health", "service", "daily routines"],
  7: ["Partnerships", "marriage", "contracts"],
  8: ["Transformation", "shared resources", "occult"],
  9: ["Higher learning", "long travel", "philosophy"],
  10: ["Career", "public life", "authority"],
  11: ["Friends", "aspirations", "community"],
  12: ["Spirituality", "endings", "solitude"],
};

/** Dignity ranking (higher = stronger). */
const DIGNITY_SCORE: Record<string, number> = {
  own: 5,
  exalted: 4,
  friend: 3,
  neutral: 2,
  enemy: 1,
  debilitated: 0,
};

const EXALTATION_SIGNS: Record<string, string> = {
  Sun: "Aries",
  Moon: "Taurus",
  Mars: "Capricorn",
  Mercury: "Virgo",
  Jupiter: "Cancer",
  Venus: "Pisces",
  Saturn: "Libra",
};

const DEBILITATION_SIGNS: Record<string, string> = {
  Sun: "Libra",
  Moon: "Scorpio",
  Mars: "Cancer",
  Mercury: "Pisces",
  Jupiter: "Capricorn",
  Venus: "Virgo",
  Saturn: "Aries",
};

const OWN_SIGNS: Record<string, string[]> = {
  Sun: ["Leo"],
  Moon: ["Cancer"],
  Mars: ["Aries", "Scorpio"],
  Mercury: ["Gemini", "Virgo"],
  Jupiter: ["Sagittarius", "Pisces"],
  Venus: ["Taurus", "Libra"],
  Saturn: ["Capricorn", "Aquarius"],
};

const FRIENDLY_SIGNS: Record<string, string[]> = {
  Sun: ["Aries", "Sagittarius", "Scorpio"],
  Moon: ["Taurus", "Pisces"],
  Mars: ["Leo", "Sagittarius", "Pisces"],
  Mercury: ["Taurus", "Leo"],
  Jupiter: ["Aries", "Leo", "Scorpio"],
  Venus: ["Cancer", "Sagittarius", "Pisces"],
  Saturn: ["Gemini", "Virgo", "Libra"],
};

const PLANET_YEAR_LORD_THEMES: Record<string, string> = {
  Sun: "A year of visibility, leadership, and self-definition. Authority figures play a key role.",
  Moon: "A year of emotional depth, nurturing, and domestic focus. Intuition guides decisions.",
  Mars: "A year of initiative, energy, and bold action. Conflict may arise but drives growth.",
  Mercury: "A year of communication, learning, and commerce. Mental agility is the prime asset.",
  Jupiter: "A year of expansion, wisdom, and opportunity. Growth comes through faith and generosity.",
  Venus: "A year of relationships, pleasure, and creative expression. Harmony and beauty matter.",
  Saturn: "A year of discipline, responsibility, and structure. Patience builds lasting results.",
  Rahu: "A year of ambition, unconventional paths, and disruption. Foreign connections expand horizons.",
  Ketu: "A year of spiritual depth, release, and inner transformation. Detachment brings clarity.",
};

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function parseBirthUTC(birth: BirthDetailsInput): {
  utc_year: number;
  utc_month: number;
  utc_day: number;
  utc_hour: number;
  utc_minute: number;
  utc_second: number;
} {
  const [y, m, d] = birth.birth_date.split("-").map(Number);
  const timeParts = birth.birth_time.split(":").map(Number);
  const hour = timeParts[0] ?? 0;
  const minute = timeParts[1] ?? 0;
  const second = timeParts[2] ?? 0;

  const localTotalMinutes = hour * 60 + minute;
  const utcTotalMinutes = localTotalMinutes - (birth.timezone_offset_minutes ?? 0);

  const localDate = new Date(Date.UTC(y, m - 1, d, 0, 0, second));
  localDate.setUTCMinutes(localDate.getUTCMinutes() + utcTotalMinutes);

  return {
    utc_year: localDate.getUTCFullYear(),
    utc_month: localDate.getUTCMonth() + 1,
    utc_day: localDate.getUTCDate(),
    utc_hour: localDate.getUTCHours(),
    utc_minute: localDate.getUTCMinutes(),
    utc_second: localDate.getUTCSeconds(),
  };
}

function getSignIndex(sign: string): number {
  const idx = SIGNS.indexOf(sign);
  return idx >= 0 ? idx : 0;
}

function getPlanetDignity(planet: string, sign: string): string {
  if (OWN_SIGNS[planet]?.includes(sign)) return "own";
  if (EXALTATION_SIGNS[planet] === sign) return "exalted";
  if (DEBILITATION_SIGNS[planet] === sign) return "debilitated";
  if (FRIENDLY_SIGNS[planet]?.includes(sign)) return "friend";
  // Simplified: everything else is neutral or enemy
  // For enemy, check if debilitation lord's sign
  return "neutral";
}

function getPlanetStrengthScore(planet: string, sign: string): number {
  const dignity = getPlanetDignity(planet, sign);
  return DIGNITY_SCORE[dignity] ?? 2;
}

/**
 * Find the Sun's sidereal longitude from a natal chart computation.
 */
function getNatalSunLongitude(birth: BirthDetailsInput): number {
  const utc = parseBirthUTC(birth);
  const result = calculate({
    ...utc,
    latitude: birth.latitude,
    longitude: birth.longitude,
    engine_id: birth.engine_id,
  });
  const sun = result.planets.find((p) => p.name === "Sun");
  return sun?.longitude ?? 0;
}

/**
 * Binary-search for the exact moment the transiting Sun reaches a given
 * sidereal longitude in a target year.
 *
 * Searches +/- 3 days from the approximate birthday in the target year,
 * narrowing to within ~1 minute accuracy.
 */
function findSolarReturnMoment(
  natalSunLon: number,
  birthDate: string,
  targetYear: number,
  engineId?: string,
): Date {
  const [, birthMonth, birthDay] = birthDate.split("-").map(Number);

  // Start search from the birthday in the target year, +/- 3 days
  const approxDate = new Date(Date.UTC(targetYear, birthMonth - 1, birthDay, 12, 0, 0));
  let lowMs = approxDate.getTime() - 3 * 86400000;
  let highMs = approxDate.getTime() + 3 * 86400000;

  // Normalize angle difference to [-180, 180]
  function angleDiff(a: number, b: number): number {
    let d = ((a - b) % 360 + 360) % 360;
    if (d > 180) d -= 360;
    return d;
  }

  function sunLonAt(ms: number): number {
    const d = new Date(ms);
    const positions = computeTransitPositions(d, engineId);
    const sun = positions.find((p) => p.name === "Sun");
    return sun?.longitude ?? 0;
  }

  // Binary search: find when sunLon crosses natalSunLon
  // First ensure the low and high bracket the target
  const lowDiff = angleDiff(sunLonAt(lowMs), natalSunLon);
  const highDiff = angleDiff(sunLonAt(highMs), natalSunLon);

  // If both are same side, extend the range
  if (lowDiff > 0 && highDiff > 0) {
    lowMs -= 5 * 86400000;
  } else if (lowDiff < 0 && highDiff < 0) {
    highMs += 5 * 86400000;
  }

  // Binary search to ~1 minute precision (60000 ms)
  for (let i = 0; i < 40; i++) {
    const midMs = Math.floor((lowMs + highMs) / 2);
    const midDiff = angleDiff(sunLonAt(midMs), natalSunLon);

    if (Math.abs(midDiff) < 0.001) {
      // Close enough (< ~0.001 degree ~ under 1 minute of arc)
      return new Date(midMs);
    }

    // The Sun moves forward (increasing longitude) through the zodiac,
    // so if midDiff < 0, we haven't reached the target yet (need later time)
    if (midDiff < 0) {
      lowMs = midMs;
    } else {
      highMs = midMs;
    }

    // Safety: if range is under 1 minute, stop
    if (highMs - lowMs < 60000) break;
  }

  return new Date(Math.floor((lowMs + highMs) / 2));
}

// --------------------------------------------------------------------------
// Annual Profection calculation
// --------------------------------------------------------------------------

function computeAnnualProfection(
  age: number,
  natalHouses: HousePlacement[],
  natalPlanets: PlanetPosition[],
): AnnualProfection {
  const activatedHouse = (age % 12) + 1;
  const houseData = natalHouses.find((h) => h.house_number === activatedHouse);
  const activatedSign = houseData?.sign ?? SIGNS[0];
  const lordOfYear = SIGN_RULERS[activatedSign] ?? "Sun";

  // Find natal planets in the activated sign
  const activatedPlanets = natalPlanets
    .filter((p) => p.sign === activatedSign)
    .map((p) => p.name);

  const themes = HOUSE_THEMES[activatedHouse] ?? [];
  const natalHouseSigns = Object.fromEntries(
    natalHouses.map((house) => [house.house_number, house.sign]),
  );

  return {
    year: age + 1, // "1st year" = age 0, etc.
    age,
    activatedHouse,
    activatedSign,
    lordOfYear,
    activatedPlanets,
    themes,
    natalHouseSigns,
  };
}

// --------------------------------------------------------------------------
// Muntha calculation
// --------------------------------------------------------------------------

function computeMuntha(
  natalAscendantSign: string,
  age: number,
  returnHouses: HousePlacement[],
): { sign: string; house: number } {
  const ascIndex = getSignIndex(natalAscendantSign);
  const munthaSignIndex = (ascIndex + age) % 12;
  const munthaSign = SIGNS[munthaSignIndex];

  // Find which house of the return chart this falls in
  const munthaHouse = returnHouses.find((h) => h.sign === munthaSign);
  return {
    sign: munthaSign,
    house: munthaHouse?.house_number ?? 1,
  };
}

// --------------------------------------------------------------------------
// Varshesh (Year Lord) calculation
// --------------------------------------------------------------------------

function computeVarshesh(
  returnAscSign: string,
  munthaSign: string,
  natalAscSign: string,
  returnPlanets: PlanetPosition[],
): { planet: string; reason: string } {
  const candidates: Array<{ planet: string; score: number; reason: string }> = [];

  // Lord of Varshaphal ascendant
  const returnAscLord = SIGN_RULERS[returnAscSign] ?? "Sun";
  const returnAscPlanet = returnPlanets.find((p) => p.name === returnAscLord);
  if (returnAscPlanet) {
    candidates.push({
      planet: returnAscLord,
      score: getPlanetStrengthScore(returnAscLord, returnAscPlanet.sign),
      reason: `Lord of solar return ascendant (${returnAscSign})`,
    });
  }

  // Lord of Muntha sign
  const munthaLord = SIGN_RULERS[munthaSign] ?? "Sun";
  if (munthaLord !== returnAscLord) {
    const munthaPlanet = returnPlanets.find((p) => p.name === munthaLord);
    if (munthaPlanet) {
      candidates.push({
        planet: munthaLord,
        score: getPlanetStrengthScore(munthaLord, munthaPlanet.sign),
        reason: `Lord of Muntha sign (${munthaSign})`,
      });
    }
  }

  // Lord of natal ascendant
  const natalAscLord = SIGN_RULERS[natalAscSign] ?? "Sun";
  if (natalAscLord !== returnAscLord && natalAscLord !== munthaLord) {
    const natalAscPlanetInReturn = returnPlanets.find((p) => p.name === natalAscLord);
    if (natalAscPlanetInReturn) {
      candidates.push({
        planet: natalAscLord,
        score: getPlanetStrengthScore(natalAscLord, natalAscPlanetInReturn.sign),
        reason: `Lord of natal ascendant (${natalAscSign})`,
      });
    }
  }

  if (candidates.length === 0) {
    return { planet: returnAscLord, reason: "Default to return ascendant lord" };
  }

  // Pick the strongest
  candidates.sort((a, b) => b.score - a.score);
  return { planet: candidates[0].planet, reason: candidates[0].reason };
}

// --------------------------------------------------------------------------
// Year Summary generation
// --------------------------------------------------------------------------

function buildYearSummary(
  natalAsc: AscendantData,
  returnChart: { ascendant: AscendantData; planets: PlanetPosition[]; houses: HousePlacement[] },
  muntha: { sign: string; house: number },
  varshesh: { planet: string; reason: string },
  profection: AnnualProfection,
): VarshaphalResult["yearSummary"] {
  // Ascendant comparison
  const sameAsc = natalAsc.sign === returnChart.ascendant.sign;
  const ascendantComparison = sameAsc
    ? `The solar return ascendant matches your natal ascendant (${natalAsc.sign}), reinforcing core identity themes this year.`
    : `The solar return ascendant is ${returnChart.ascendant.sign}, contrasting with your natal ${natalAsc.sign} ascendant. This brings a different energy and perspective to the year.`;

  // Emotional tone from return Moon
  const returnMoon = returnChart.planets.find((p) => p.name === "Moon");
  const emotionalTone = returnMoon
    ? `Moon in ${returnMoon.sign} (house ${returnMoon.house}) sets the emotional tone: ${getMoonToneDescription(returnMoon.sign)}.`
    : "Moon position unavailable for emotional tone assessment.";

  // Focus areas from Muntha and profection
  const focusAreas: string[] = [];
  focusAreas.push(
    `Muntha in ${muntha.sign} (house ${muntha.house}) draws attention to ${HOUSE_THEMES[muntha.house]?.join(", ") ?? "life matters"}.`
  );
  focusAreas.push(
    `Annual profection activates house ${profection.activatedHouse} (${profection.activatedSign}), emphasizing ${profection.themes.join(", ")}.`
  );
  if (profection.activatedPlanets.length > 0) {
    focusAreas.push(
      `Natal ${profection.activatedPlanets.join(" and ")} in the activated sign add extra weight to this house's themes.`
    );
  }

  // Strong influences from angular houses (1, 4, 7, 10) in return chart
  const angularHouses = [1, 4, 7, 10];
  const strongInfluences: string[] = [];
  for (const planet of returnChart.planets) {
    if (angularHouses.includes(planet.house)) {
      strongInfluences.push(
        `${planet.name} in angular house ${planet.house} (${planet.sign}) will have a strong visible influence this year.`
      );
    }
  }
  if (strongInfluences.length === 0) {
    strongInfluences.push("No planets occupy angular houses in the return chart, suggesting a quieter year of internal development.");
  }

  // Year lord interpretation
  const yearLordInterpretation =
    PLANET_YEAR_LORD_THEMES[varshesh.planet] ??
    `${varshesh.planet} as year lord shapes the overall direction and outcomes.`;

  return {
    ascendantComparison,
    emotionalTone,
    focusAreas,
    strongInfluences: strongInfluences.slice(0, 5),
    yearLordInterpretation,
  };
}

function getMoonToneDescription(sign: string): string {
  const tones: Record<string, string> = {
    Aries: "emotionally assertive, impulsive, and action-oriented",
    Taurus: "emotionally steady, comfort-seeking, and grounded",
    Gemini: "emotionally curious, communicative, and mentally active",
    Cancer: "emotionally deep, nurturing, and sensitive to surroundings",
    Leo: "emotionally warm, expressive, and seeking recognition",
    Virgo: "emotionally analytical, service-minded, and detail-focused",
    Libra: "emotionally diplomatic, harmony-seeking, and relationship-focused",
    Scorpio: "emotionally intense, transformative, and deeply perceptive",
    Sagittarius: "emotionally optimistic, freedom-loving, and philosophically inclined",
    Capricorn: "emotionally disciplined, ambitious, and practically grounded",
    Aquarius: "emotionally detached, humanitarian, and intellectually oriented",
    Pisces: "emotionally intuitive, compassionate, and spiritually open",
  };
  return tones[sign] ?? "varied and responsive to circumstances";
}

// --------------------------------------------------------------------------
// Main public function
// --------------------------------------------------------------------------

export function computeVarshaphal(
  birth: BirthDetailsInput,
  targetYear: number,
): VarshaphalResult {
  // 1. Compute the natal chart
  const utc = parseBirthUTC(birth);
  const natalChart = calculate({
    ...utc,
    latitude: birth.latitude,
    longitude: birth.longitude,
    engine_id: birth.engine_id,
  });

  // 2. Get natal Sun longitude
  const natalSun = natalChart.planets.find((p) => p.name === "Sun");
  const natalSunLon = natalSun?.longitude ?? 0;

  // 3. Calculate age for the target year
  const [birthYear] = birth.birth_date.split("-").map(Number);
  const age = targetYear - birthYear;

  // 4. Compute Annual Profection
  const profection = computeAnnualProfection(
    age,
    natalChart.houses,
    natalChart.planets,
  );

  // 5. Find the solar return moment
  const solarReturnMoment = findSolarReturnMoment(
    natalSunLon,
    birth.birth_date,
    targetYear,
    birth.engine_id,
  );

  // 6. Cast the solar return chart at the return moment + birth location
  const returnInput: BirthInput = {
    utc_year: solarReturnMoment.getUTCFullYear(),
    utc_month: solarReturnMoment.getUTCMonth() + 1,
    utc_day: solarReturnMoment.getUTCDate(),
    utc_hour: solarReturnMoment.getUTCHours(),
    utc_minute: solarReturnMoment.getUTCMinutes(),
    utc_second: solarReturnMoment.getUTCSeconds(),
    latitude: birth.latitude,
    longitude: birth.longitude,
    engine_id: birth.engine_id,
  };
  const returnChartResult = calculate(returnInput);

  const returnChart = {
    ascendant: returnChartResult.ascendant,
    planets: returnChartResult.planets,
    houses: returnChartResult.houses,
  };

  // 7. Compute Muntha
  const muntha = computeMuntha(
    natalChart.ascendant.sign,
    age,
    returnChart.houses,
  );

  // 8. Compute Varshesh (Year Lord)
  const varshesh = computeVarshesh(
    returnChart.ascendant.sign,
    muntha.sign,
    natalChart.ascendant.sign,
    returnChart.planets,
  );

  // 9. Build year summary
  const yearSummary = buildYearSummary(
    natalChart.ascendant,
    returnChart,
    muntha,
    varshesh,
    profection,
  );

  return {
    year: targetYear,
    solarReturnMoment: solarReturnMoment.toISOString(),
    returnChart,
    muntha,
    varshesh,
    profection,
    yearSummary,
  };
}
