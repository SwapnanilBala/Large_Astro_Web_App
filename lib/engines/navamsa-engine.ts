
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

/*
 * Each sign spans 30deg, divided into 9 padas of 3deg20'.
 *
 * Written as the division rather than as a decimal. The literal 3.333333333
 * is smaller than 30/9, so `degree / SPAN` crossed each pada boundary a
 * fraction early and this file disagreed with divisional-engine's computeD9 --
 * which uses 30/9 -- for any degree inside a window of about 3e-10 either side
 * of a boundary. Measured over 360,672 sampled positions the two differed on
 * 276 of them, all of them boundary cases.
 *
 * Nothing observable depended on it: the window is roughly a microarcsecond,
 * far below what the ephemeris resolves. It is corrected because two
 * implementations of the same quantity should not be able to differ at all,
 * and because life-domain-rules.ts already states in a comment that this
 * function agrees with the D9 the app draws.
 */
const NAVAMSA_SPAN = 30 / 9;

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
