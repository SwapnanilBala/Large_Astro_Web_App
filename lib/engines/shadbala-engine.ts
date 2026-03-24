
import type { PlanetPosition, HousePlacement } from "./swiss-ephemeris-engine";
import { SIGNS } from "./swiss-ephemeris-engine";
import type { NavamsaPosition } from "./navamsa-engine";
import type { AspectData } from "./aspect-engine";
import { computeDivisionalChart } from "./divisional-engine";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface ShadbalaResult {
  planet: string;
  sthanaBala: number;
  digBala: number;
  kalaBala: number;
  cheshtaBala: number;
  naisargikaBala: number;
  drikBala: number;
  totalVirupas: number;
  totalRupas: number;
  requiredMinimum: number;
  strengthRatio: number;
  isStrong: boolean;
}

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const CLASSICAL_PLANETS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];

/** Exaltation points as absolute sidereal longitude */
const EXALTATION_POINTS: Record<string, number> = {
  Sun: 10,          // 10 Aries
  Moon: 33,         // 3 Taurus
  Mars: 298,        // 28 Capricorn
  Mercury: 165,     // 15 Virgo
  Jupiter: 95,      // 5 Cancer
  Venus: 357,       // 27 Pisces
  Saturn: 200,      // 20 Libra
};

/** Sign rulers for dignity checks */
const SIGN_RULERS: Record<string, string> = {
  Aries: "Mars", Taurus: "Venus", Gemini: "Mercury", Cancer: "Moon",
  Leo: "Sun", Virgo: "Mercury", Libra: "Venus", Scorpio: "Mars",
  Sagittarius: "Jupiter", Capricorn: "Saturn", Aquarius: "Saturn", Pisces: "Jupiter",
};

const PLANET_OWN_SIGNS: Record<string, Set<string>> = {
  Sun: new Set(["Leo"]),
  Moon: new Set(["Cancer"]),
  Mercury: new Set(["Gemini", "Virgo"]),
  Venus: new Set(["Taurus", "Libra"]),
  Mars: new Set(["Aries", "Scorpio"]),
  Jupiter: new Set(["Sagittarius", "Pisces"]),
  Saturn: new Set(["Capricorn", "Aquarius"]),
};

const PLANET_EXALTATION_SIGNS: Record<string, string> = {
  Sun: "Aries", Moon: "Taurus", Mercury: "Virgo", Venus: "Pisces",
  Mars: "Capricorn", Jupiter: "Cancer", Saturn: "Libra",
};

const PLANET_DEBILITATION_SIGNS: Record<string, string> = {
  Sun: "Libra", Moon: "Scorpio", Mercury: "Pisces", Venus: "Virgo",
  Mars: "Cancer", Jupiter: "Capricorn", Saturn: "Aries",
};

/** Moolatrikona signs and degree ranges */
const MOOLATRIKONA_SIGNS: Record<string, { sign: string; start: number; end: number }> = {
  Sun:     { sign: "Leo",         start: 0,  end: 20 },
  Moon:    { sign: "Taurus",      start: 4,  end: 20 },
  Mars:    { sign: "Aries",       start: 0,  end: 12 },
  Mercury: { sign: "Virgo",       start: 16, end: 20 },
  Jupiter: { sign: "Sagittarius", start: 0,  end: 10 },
  Venus:   { sign: "Libra",       start: 0,  end: 15 },
  Saturn:  { sign: "Aquarius",    start: 0,  end: 20 },
};

/** The 7 vargas used for Saptavargaja Bala */
const SAPTAVARGA_DIVISIONS = [1, 2, 3, 7, 9, 12, 30] as const;

/** Average daily speeds in degrees/day for Cheshta Bala */
const AVERAGE_DAILY_SPEEDS: Record<string, number> = {
  Sun: 1.0,
  Moon: 13.2,
  Mercury: 1.38,
  Venus: 1.2,
  Mars: 0.52,
  Jupiter: 0.08,
  Saturn: 0.03,
};

/** Day-strong planets: Sun, Jupiter, Venus; Night-strong: Moon, Mars, Saturn; Always: Mercury */
const DAY_STRONG_PLANETS = new Set(["Sun", "Jupiter", "Venus"]);
const NIGHT_STRONG_PLANETS = new Set(["Moon", "Mars", "Saturn"]);

/** Natural friendship table for Saptavargaja */
const NATURAL_FRIENDS: Record<string, Set<string>> = {
  Sun: new Set(["Moon", "Mars", "Jupiter"]),
  Moon: new Set(["Sun", "Mercury"]),
  Mars: new Set(["Sun", "Moon", "Jupiter"]),
  Mercury: new Set(["Sun", "Venus"]),
  Jupiter: new Set(["Sun", "Moon", "Mars"]),
  Venus: new Set(["Mercury", "Saturn"]),
  Saturn: new Set(["Mercury", "Venus"]),
};

const NATURAL_ENEMIES: Record<string, Set<string>> = {
  Sun: new Set(["Venus", "Saturn"]),
  Moon: new Set([]),
  Mars: new Set(["Mercury"]),
  Mercury: new Set(["Moon"]),
  Jupiter: new Set(["Mercury", "Venus"]),
  Venus: new Set(["Sun", "Moon"]),
  Saturn: new Set(["Sun", "Moon", "Mars"]),
};

/** Dig Bala directional houses (house number where planet is strongest) */
const DIG_BALA_HOUSE: Record<string, number> = {
  Jupiter: 1,
  Mercury: 1,
  Sun: 10,
  Mars: 10,
  Saturn: 7,
  Moon: 4,
  Venus: 4,
};

/** Naisargika Bala — fixed natural strength in virupas */
const NAISARGIKA_BALA: Record<string, number> = {
  Sun: 60,
  Moon: 51.43,
  Mars: 17.14,
  Mercury: 25.71,
  Jupiter: 34.29,
  Venus: 42.86,
  Saturn: 8.57,
};

/** Required minimum total virupas for each planet */
const REQUIRED_MINIMUMS: Record<string, number> = {
  Sun: 390,
  Moon: 360,
  Mars: 300,
  Mercury: 420,
  Jupiter: 390,
  Venus: 330,
  Saturn: 300,
};

/** Whether a sign is odd (fire/air) or even (earth/water) */
function isOddSign(sign: string): boolean {
  const idx = SIGNS.indexOf(sign);
  // Aries=0(odd), Taurus=1(even), Gemini=2(odd), etc.
  return idx % 2 === 0;
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function normalize(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

function angularDistance(lon1: number, lon2: number): number {
  const diff = normalize(lon1 - lon2);
  return diff <= 180 ? diff : 360 - diff;
}

function signIndex(sign: string): number {
  return SIGNS.indexOf(sign);
}

function getDignityScore(planetName: string, sign: string, degreeInSign?: number): number {
  // Returns virupas for a single divisional chart dignity
  // Scoring: own=30, exalted=20, moolatrikona=15, friend=10, neutral=5, enemy=2, debilitated=0
  if (sign === PLANET_DEBILITATION_SIGNS[planetName]) return 0;
  if (sign === PLANET_EXALTATION_SIGNS[planetName]) return 20;
  // Check moolatrikona (sign match + degree range in D1 context)
  const mt = MOOLATRIKONA_SIGNS[planetName];
  if (mt && sign === mt.sign) {
    if (degreeInSign !== undefined && degreeInSign >= mt.start && degreeInSign <= mt.end) {
      return 15; // moolatrikona
    }
    // Even outside MT degree range, it's still own sign if the planet rules it
    if (PLANET_OWN_SIGNS[planetName]?.has(sign)) return 30;
  }
  if (PLANET_OWN_SIGNS[planetName]?.has(sign)) return 30;
  const signLord = SIGN_RULERS[sign];
  if (!signLord) return 5;
  if (NATURAL_FRIENDS[planetName]?.has(signLord)) return 10;
  if (NATURAL_ENEMIES[planetName]?.has(signLord)) return 2;
  return 5; // neutral
}

// --------------------------------------------------------------------------
// 1. Sthana Bala (Positional Strength)
// --------------------------------------------------------------------------

function uchchaBala(planet: PlanetPosition): number {
  const exaltPoint = EXALTATION_POINTS[planet.name];
  if (exaltPoint === undefined) return 0;
  const dist = angularDistance(planet.longitude, exaltPoint);
  return Math.max(0, (180 - dist) / 3);
}

function saptavargajaBala(
  planet: PlanetPosition,
  navamsa: NavamsaPosition | undefined,
  allPlanets?: PlanetPosition[]
): number {
  // Evaluate dignity in all 7 Saptavarga divisions:
  // D1 (Rashi), D2 (Hora), D3 (Drekkana), D7 (Saptamsa),
  // D9 (Navamsa), D12 (Dwadasamsa), D30 (Trimsamsa)
  // Max score per varga = 30, total max = 210 virupas
  let total = 0;

  for (const div of SAPTAVARGA_DIVISIONS) {
    if (div === 1) {
      // D1: use natal sign directly with degree for moolatrikona check
      total += getDignityScore(planet.name, planet.sign, planet.degree_in_sign);
    } else if (div === 9 && navamsa) {
      // D9: use pre-computed navamsa if available
      total += getDignityScore(planet.name, navamsa.navamsa_sign);
    } else {
      // Compute the divisional chart position using the divisional engine
      // We pass a single-planet array for efficiency
      try {
        const divPositions = computeDivisionalChart(
          allPlanets ? allPlanets.filter((p) => p.name === planet.name) : [planet],
          div
        );
        const pos = divPositions.find((p) => p.name === planet.name);
        if (pos) {
          total += getDignityScore(planet.name, pos.divisional_sign);
        } else {
          total += 5; // neutral fallback
        }
      } catch {
        // If divisional chart computation fails, use neutral score
        total += 5;
      }
    }
  }

  return total;
}

function ojayugmarasiBala(planet: PlanetPosition): number {
  const odd = isOddSign(planet.sign);
  // Moon and Venus gain strength in even signs; others in odd
  if (planet.name === "Moon" || planet.name === "Venus") {
    return odd ? 0 : 15;
  }
  return odd ? 15 : 0;
}

function kendradiBala(planet: PlanetPosition): number {
  const h = planet.house;
  if ([1, 4, 7, 10].includes(h)) return 60;
  if ([2, 5, 8, 11].includes(h)) return 30;
  return 15; // cadent: 3, 6, 9, 12
}

function drekkanaBala(planet: PlanetPosition): number {
  // Decanate: 0-10 = 1st, 10-20 = 2nd, 20-30 = 3rd
  const deg = planet.degree_in_sign;
  let decanate: number;
  if (deg < 10) decanate = 1;
  else if (deg < 20) decanate = 2;
  else decanate = 3;

  // Male planets (Sun, Mars, Jupiter) strong in 1st decanate
  // Neutral planets (Mercury, Saturn) strong in 2nd decanate
  // Female planets (Moon, Venus) strong in 3rd decanate
  const malePlanets = new Set(["Sun", "Mars", "Jupiter"]);
  const neutralPlanets = new Set(["Mercury", "Saturn"]);
  const femalePlanets = new Set(["Moon", "Venus"]);

  if (malePlanets.has(planet.name) && decanate === 1) return 15;
  if (neutralPlanets.has(planet.name) && decanate === 2) return 15;
  if (femalePlanets.has(planet.name) && decanate === 3) return 15;
  return 0;
}

function sthanaBala(
  planet: PlanetPosition,
  navamsa: NavamsaPosition | undefined,
  allPlanets?: PlanetPosition[]
): number {
  return (
    uchchaBala(planet) +
    saptavargajaBala(planet, navamsa, allPlanets) +
    ojayugmarasiBala(planet) +
    kendradiBala(planet) +
    drekkanaBala(planet)
  );
}

// --------------------------------------------------------------------------
// 2. Dig Bala (Directional Strength)
// --------------------------------------------------------------------------

function digBala(planet: PlanetPosition): number {
  const strongHouse = DIG_BALA_HOUSE[planet.name];
  if (strongHouse === undefined) return 30;
  // Distance in houses from strongest house, converted to degrees
  const houseDist = ((planet.house - strongHouse + 12) % 12);
  const degreeDist = houseDist * 30;
  const angDist = degreeDist <= 180 ? degreeDist : 360 - degreeDist;
  return Math.max(0, (180 - angDist) / 3);
}

// --------------------------------------------------------------------------
// 3. Kala Bala (Temporal Strength)
// --------------------------------------------------------------------------

/**
 * Approximate hour angle of sunrise/sunset using latitude and Sun's declination.
 * Returns the half-day arc in hours (from solar noon to sunset).
 * Sun declination is approximated from its sidereal longitude.
 */
function approxHalfDayArcHours(latitudeDeg: number, sunLongitude: number): number {
  // Approximate Sun's declination from ecliptic longitude
  // Obliquity of ecliptic ~ 23.44 degrees
  const obliquity = 23.44;
  const sunLonRad = (sunLongitude * Math.PI) / 180;
  const declRad = Math.asin(Math.sin((obliquity * Math.PI) / 180) * Math.sin(sunLonRad));
  const latRad = (latitudeDeg * Math.PI) / 180;

  // Hour angle at sunrise/sunset: cos(H) = -tan(lat)*tan(decl)
  const cosH = -Math.tan(latRad) * Math.tan(declRad);

  // Clamp for polar regions (midnight sun / polar night)
  if (cosH <= -1) return 12; // Sun never sets — full 24h day
  if (cosH >= 1) return 0;   // Sun never rises — full 24h night

  const hourAngleRad = Math.acos(cosH);
  return (hourAngleRad * 12) / Math.PI; // convert to hours (half the day arc)
}

/**
 * Compute Nathonnatha Bala (day/night strength).
 * Day-strong planets (Sun, Jupiter, Venus) get strength proportional to daylight.
 * Night-strong planets (Moon, Mars, Saturn) get strength proportional to nighttime.
 * Mercury is always strong and receives full score.
 *
 * We use the Sun's house position to estimate how far into day/night we are,
 * and the latitude + Sun longitude to compute approximate day/night length.
 */
function nathonnathaBala(
  planet: PlanetPosition,
  sunLongitude: number,
  sunHouse: number,
  latitude?: number
): number {
  const maxScore = 60;

  // Mercury is always strong (diurnal and nocturnal)
  if (planet.name === "Mercury") return maxScore;

  // Determine if it's daytime based on Sun's house
  // Sun in houses 7-12 (above horizon in Vedic whole-sign) = daytime
  // Sun in houses 1-6 (below horizon) = nighttime
  const isDaytime = sunHouse >= 7 && sunHouse <= 12;

  // If latitude is available, compute proportional day/night fraction
  // Otherwise use a simpler house-based approximation
  let dayFraction = 0.5; // default: equal day/night
  if (latitude !== undefined) {
    const halfDayHours = approxHalfDayArcHours(latitude, sunLongitude);
    const dayHours = halfDayHours * 2;
    const nightHours = 24 - dayHours;

    if (isDaytime) {
      // Estimate how far into the day we are using Sun's house position
      // Houses 7->12 map to sunrise->sunset (6 houses = full day)
      const dayProgress = sunHouse >= 7 ? (sunHouse - 7) / 6 : 0;
      dayFraction = dayProgress;
    } else {
      // Houses 1->6 map to sunset->sunrise (6 houses = full night)
      const nightProgress = sunHouse >= 1 && sunHouse <= 6 ? (sunHouse - 1) / 6 : 0;
      dayFraction = 1 - nightProgress; // invert: night-strong planets want night progress
    }

    // Day-strong planets score higher with longer days
    if (DAY_STRONG_PLANETS.has(planet.name)) {
      if (isDaytime) {
        // Score proportional to day length and progress through the day
        // Peak at solar noon (midday), min at sunrise/sunset
        const sineFactor = Math.sin(dayFraction * Math.PI); // peaks at 0.5 (noon)
        return maxScore * (dayHours / 24) * sineFactor;
      }
      // Day-strong planet during night: reduced strength
      return maxScore * 0.1;
    }

    if (NIGHT_STRONG_PLANETS.has(planet.name)) {
      if (!isDaytime) {
        const nightProgress2 = sunHouse >= 1 && sunHouse <= 6 ? (sunHouse - 1) / 6 : 0;
        const sineFactor = Math.sin(nightProgress2 * Math.PI); // peaks at midnight
        return maxScore * (nightHours / 24) * sineFactor;
      }
      // Night-strong planet during day: reduced strength
      return maxScore * 0.1;
    }
  }

  // Fallback: simple day/night scoring without latitude
  if (DAY_STRONG_PLANETS.has(planet.name)) {
    return isDaytime ? maxScore * 0.75 : maxScore * 0.25;
  }
  if (NIGHT_STRONG_PLANETS.has(planet.name)) {
    return isDaytime ? maxScore * 0.25 : maxScore * 0.75;
  }

  return maxScore * 0.5; // shouldn't reach here
}

function kalaBala(
  planet: PlanetPosition,
  sunLongitude: number,
  moonLongitude: number,
  sunHouse?: number,
  latitude?: number
): number {
  // Nathonnatha Bala (day/night strength)
  const nathonnatha = nathonnathaBala(
    planet,
    sunLongitude,
    sunHouse ?? planet.house, // fallback to planet's own house if Sun house unavailable
    latitude
  );

  // Paksha Bala (lunar phase strength)
  const moonSunAngle = normalize(moonLongitude - sunLongitude);
  const isShuklaPaksha = moonSunAngle <= 180;

  // Benefics: Jupiter, Venus, Moon, Mercury (waxing)
  // Malefics: Sun, Mars, Saturn
  const benefics = new Set(["Jupiter", "Venus", "Moon", "Mercury"]);

  let pakshaBala: number;
  if (planet.name === "Sun") {
    // Sun is always considered strong regardless of paksha
    pakshaBala = 30;
  } else if (benefics.has(planet.name)) {
    // Benefics stronger in Shukla Paksha
    pakshaBala = isShuklaPaksha
      ? 60 * (moonSunAngle / 180)
      : 60 * ((360 - moonSunAngle) / 180);
  } else {
    // Malefics stronger in Krishna Paksha
    pakshaBala = isShuklaPaksha
      ? 60 * ((180 - moonSunAngle) / 180)
      : 60 * ((moonSunAngle - 180) / 180);
  }
  pakshaBala = Math.max(0, Math.min(60, pakshaBala));

  return nathonnatha + pakshaBala;
}

// --------------------------------------------------------------------------
// 4. Cheshta Bala (Motional Strength)
// --------------------------------------------------------------------------

function cheshtaBala(planet: PlanetPosition): number {
  // Sun and Moon never retrograde — give them a baseline of 30
  if (planet.name === "Sun" || planet.name === "Moon") return 30;

  // If speed data is not available, fall back to 30 (backward compatible)
  if (planet.speed === undefined && planet.is_retrograde === undefined) return 30;

  // If we have is_retrograde flag but no speed
  if (planet.speed === undefined) {
    return planet.is_retrograde ? 60 : 30;
  }

  const speed = planet.speed;
  const absSpeed = Math.abs(speed);

  // Retrograde: maximum strength (60 virupas)
  // In Vedic astrology, retrograde planets are considered strong (vakri = powerful)
  if (speed < 0 || planet.is_retrograde) return 60;

  // Stationary: near-zero speed (within ±0.1 deg/day) — 30 virupas
  if (absSpeed <= 0.1) return 30;

  // Direct motion: score based on speed relative to average
  const avgSpeed = AVERAGE_DAILY_SPEEDS[planet.name] ?? 1;

  if (absSpeed < avgSpeed) {
    // Direct slow (below average): 15 virupas
    return 15;
  } else if (absSpeed <= avgSpeed * 1.5) {
    // Direct normal (around average): 7.5 virupas
    return 7.5;
  } else {
    // Direct fast (above 1.5x average): 3.75 virupas
    return 3.75;
  }
}

// --------------------------------------------------------------------------
// 5. Naisargika Bala (Natural Strength) — fixed
// --------------------------------------------------------------------------

function naisargikaBala(planetName: string): number {
  return NAISARGIKA_BALA[planetName] ?? 0;
}

// --------------------------------------------------------------------------
// 6. Drik Bala (Aspectual Strength) — simplified
// --------------------------------------------------------------------------

function drikBala(
  planet: PlanetPosition,
  allPlanets: PlanetPosition[],
  aspects: AspectData[] | null | undefined,
  moonLongitude: number
): number {
  if (!aspects || aspects.length === 0) return 30; // neutral fallback

  // Determine benefic/malefic nature
  const moonSunAngle = normalize(
    moonLongitude -
      (allPlanets.find((p) => p.name === "Sun")?.longitude ?? 0)
  );
  const isWaxingMoon = moonSunAngle <= 180;

  const beneficSet = new Set(["Jupiter", "Venus"]);
  if (isWaxingMoon) beneficSet.add("Moon");
  // Mercury considered mildly benefic by default
  beneficSet.add("Mercury");

  const maleficSet = new Set(["Saturn", "Mars", "Sun", "Rahu"]);
  if (!isWaxingMoon) maleficSet.add("Moon");

  let score = 0;

  // Score each aspect involving this planet
  for (const aspect of aspects) {
    let otherPlanet: string | null = null;
    if (aspect.planet1 === planet.name) otherPlanet = aspect.planet2;
    else if (aspect.planet2 === planet.name) otherPlanet = aspect.planet1;
    if (!otherPlanet) continue;

    const isBenefic = beneficSet.has(otherPlanet);
    const isMalefic = maleficSet.has(otherPlanet);
    const sign = isBenefic ? 1 : isMalefic ? -1 : 0;

    // Score by aspect type
    const type = aspect.aspect_type;
    if (type === "Conjunction") {
      score += sign * 5;
    } else if (type === "Trine") {
      score += sign * 10;
    } else if (type === "Sextile") {
      score += sign * 7.5;
    } else if (type === "Square") {
      score -= sign * 5; // squares reverse the sign effect
    } else if (type === "Opposition") {
      score -= sign * 7.5;
    } else {
      // Vedic special aspects — treat as moderate
      score += sign * 5;
    }
  }

  // Normalize to 0-60 range: shift and clamp
  // Raw score can range roughly -60 to +60
  const normalized = Math.max(0, Math.min(60, 30 + score));
  return Math.round(normalized * 100) / 100;
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

export function calculateShadbala(
  planets: PlanetPosition[],
  navamsaData: Array<{ name: string; navamsa_sign: string }> | null | undefined,
  aspects: AspectData[] | null | undefined,
  options?: { latitude?: number }
): ShadbalaResult[] {
  const results: ShadbalaResult[] = [];

  const sun = planets.find((p) => p.name === "Sun");
  const moon = planets.find((p) => p.name === "Moon");
  const sunLon = sun?.longitude ?? 0;
  const moonLon = moon?.longitude ?? 0;
  const sunHouse = sun?.house ?? 10; // default to midheaven if Sun not found
  const latitude = options?.latitude;

  for (const planetName of CLASSICAL_PLANETS) {
    const planet = planets.find((p) => p.name === planetName);
    if (!planet) continue;

    const navamsa = navamsaData?.find((n) => n.name === planetName) as
      | NavamsaPosition
      | undefined;

    const sthana = sthanaBala(planet, navamsa, planets);
    const dig = digBala(planet);
    const kala = kalaBala(planet, sunLon, moonLon, sunHouse, latitude);
    const cheshta = cheshtaBala(planet);
    const naisargika = naisargikaBala(planetName);
    const drik = drikBala(planet, planets, aspects, moonLon);

    const totalVirupas = Math.round(
      (sthana + dig + kala + cheshta + naisargika + drik) * 100
    ) / 100;
    const totalRupas = Math.round((totalVirupas / 60) * 100) / 100;
    const required = REQUIRED_MINIMUMS[planetName] ?? 300;
    const strengthRatio = Math.round((totalVirupas / required) * 100) / 100;

    results.push({
      planet: planetName,
      sthanaBala: Math.round(sthana * 100) / 100,
      digBala: Math.round(dig * 100) / 100,
      kalaBala: Math.round(kala * 100) / 100,
      cheshtaBala: Math.round(cheshta * 100) / 100,
      naisargikaBala: Math.round(naisargika * 100) / 100,
      drikBala: Math.round(drik * 100) / 100,
      totalVirupas,
      totalRupas,
      requiredMinimum: required,
      strengthRatio,
      isStrong: strengthRatio >= 1,
    });
  }

  // Sort by total virupas descending
  results.sort((a, b) => b.totalVirupas - a.totalVirupas);
  return results;
}
