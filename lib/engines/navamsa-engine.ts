
import type { PlanetPosition } from "./swiss-ephemeris-engine";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface NavamsaPosition {
  name: string;
  rashi_sign: string;
  navamsa_sign: string;
  navamsa_division: number;
}

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

// Starting Navamsa sign index for each rashi, grouped by element.
const NAVAMSA_START: Record<string, number> = {
  // Fire
  Aries: 0, Leo: 0, Sagittarius: 0,
  // Earth
  Taurus: 9, Virgo: 9, Capricorn: 9,
  // Air
  Gemini: 6, Libra: 6, Aquarius: 6,
  // Water
  Cancer: 3, Scorpio: 3, Pisces: 3,
};

// Each sign spans 30deg; divided into 9 Navamsa padas = 3deg20' each.
const NAVAMSA_SPAN = 3.333333333; // 30 / 9

// --------------------------------------------------------------------------
// Main calculation
// --------------------------------------------------------------------------

export function calculateNavamsa(planets: PlanetPosition[]): NavamsaPosition[] {
  return planets.map((planet) => {
    let division = Math.floor(planet.degree_in_sign / NAVAMSA_SPAN);
    division = Math.max(0, Math.min(division, 8));

    const startIndex = NAVAMSA_START[planet.sign] ?? 0;
    const navamsaSignIndex = (startIndex + division) % 12;
    const navamsaSign = SIGNS[navamsaSignIndex];

    return {
      name: planet.name,
      rashi_sign: planet.sign,
      navamsa_sign: navamsaSign,
      navamsa_division: division,
    };
  });
}
