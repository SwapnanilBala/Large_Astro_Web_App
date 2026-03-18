
import type { PlanetPosition, HousePlacement } from "./swiss-ephemeris-engine";
import { SIGNS } from "./swiss-ephemeris-engine";
import type { NavamsaPosition } from "./navamsa-engine";
import type { AspectData } from "./aspect-engine";

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

function getDignityScore(planetName: string, sign: string): number {
  // Returns virupas for a single divisional chart dignity
  if (sign === PLANET_EXALTATION_SIGNS[planetName]) return 30; // exalted → same as own for vargaja
  if (PLANET_OWN_SIGNS[planetName]?.has(sign)) return 30;
  const signLord = SIGN_RULERS[sign];
  if (!signLord) return 7.5;
  if (NATURAL_FRIENDS[planetName]?.has(signLord)) return 15;
  if (NATURAL_ENEMIES[planetName]?.has(signLord)) return 3.75;
  return 7.5; // neutral
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
  navamsa: NavamsaPosition | undefined
): number {
  // Evaluate D1 (rashi) and D9 (navamsa) dignity, then scale
  // Full calculation uses 7 vargas; we approximate with 2 and scale by 7/2
  let total = 0;
  // D1 dignity
  total += getDignityScore(planet.name, planet.sign);
  // D9 dignity
  if (navamsa) {
    total += getDignityScore(planet.name, navamsa.navamsa_sign);
  } else {
    total += 7.5; // neutral fallback
  }
  // Scale: we computed 2 charts worth, each max 30. Full is 7 charts.
  // Scale proportionally: (total / 2) * 7 = total * 3.5
  // But cap at 45 max since full vargaja max is ~45 in practice
  return Math.min(total * 3.5, 45);
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
  navamsa: NavamsaPosition | undefined
): number {
  return (
    uchchaBala(planet) +
    saptavargajaBala(planet, navamsa) +
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
// 3. Kala Bala (Temporal Strength) — simplified
// --------------------------------------------------------------------------

function kalaBala(
  planet: PlanetPosition,
  sunLongitude: number,
  moonLongitude: number
): number {
  // Nathonnatha Bala (day/night birth approximation)
  // We approximate: if Sun is in houses 7-12 (above horizon), it's daytime
  // For simplicity, use a fixed 30 virupas for nathonnatha (midpoint)
  // since we don't have precise sunrise/sunset times
  const nathonnathaBala = 30;

  // Paksha Bala
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

  return nathonnathaBala + pakshaBala;
}

// --------------------------------------------------------------------------
// 4. Cheshta Bala (Motional Strength) — simplified
// --------------------------------------------------------------------------

function cheshtaBala(_planet: PlanetPosition): number {
  // Without retrograde data, default to direct motion = 30 virupas
  // Sun and Moon don't have retrograde, so they get 30 as well
  return 30;
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
  aspects: AspectData[] | null | undefined
): ShadbalaResult[] {
  const results: ShadbalaResult[] = [];

  const sun = planets.find((p) => p.name === "Sun");
  const moon = planets.find((p) => p.name === "Moon");
  const sunLon = sun?.longitude ?? 0;
  const moonLon = moon?.longitude ?? 0;

  for (const planetName of CLASSICAL_PLANETS) {
    const planet = planets.find((p) => p.name === planetName);
    if (!planet) continue;

    const navamsa = navamsaData?.find((n) => n.name === planetName) as
      | NavamsaPosition
      | undefined;

    const sthana = sthanaBala(planet, navamsa);
    const dig = digBala(planet);
    const kala = kalaBala(planet, sunLon, moonLon);
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
