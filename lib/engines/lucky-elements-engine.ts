/**
 * Lucky Elements Engine
 *
 * Derives lucky colors, numbers, gemstones, day, metals, and directions
 * from the natal chart using traditional Vedic Jyotish associations.
 */

import type { PlanetPosition, HousePlacement, LuckyElementsInfo } from "@/lib/astro-types";

/* ── Sign → Ruling Planet (local copy to avoid circular deps) ── */

const SIGN_RULERS: Record<string, string> = {
  Aries: "Mars", Taurus: "Venus", Gemini: "Mercury", Cancer: "Moon",
  Leo: "Sun", Virgo: "Mercury", Libra: "Venus", Scorpio: "Mars",
  Sagittarius: "Jupiter", Capricorn: "Saturn", Aquarius: "Saturn", Pisces: "Jupiter",
};

/* ── Planet → Lucky Attributes (traditional Vedic associations) ── */

type PlanetAttributes = {
  colors: string[];
  number: number;
  gemstone: string;
  day: string;
  metal: string;
  direction: string;
};

const PLANET_LUCKY: Record<string, PlanetAttributes> = {
  Sun:     { colors: ["Deep Red", "Orange"],       number: 1, gemstone: "Ruby",             day: "Sunday",    metal: "Gold",     direction: "East" },
  Moon:    { colors: ["White", "Cream"],            number: 2, gemstone: "Pearl",            day: "Monday",    metal: "Silver",   direction: "Northwest" },
  Mars:    { colors: ["Red", "Scarlet"],            number: 9, gemstone: "Red Coral",        day: "Tuesday",   metal: "Copper",   direction: "South" },
  Mercury: { colors: ["Green", "Emerald"],          number: 5, gemstone: "Emerald",          day: "Wednesday", metal: "Bronze",   direction: "North" },
  Jupiter: { colors: ["Yellow", "Golden"],          number: 3, gemstone: "Yellow Sapphire",  day: "Thursday",  metal: "Gold",     direction: "Northeast" },
  Venus:   { colors: ["White", "Pink"],             number: 6, gemstone: "Diamond",          day: "Friday",    metal: "Platinum", direction: "Southeast" },
  Saturn:  { colors: ["Blue", "Dark"],              number: 8, gemstone: "Blue Sapphire",    day: "Saturday",  metal: "Iron",     direction: "West" },
  Rahu:    { colors: ["Smoky", "Ultraviolet"],      number: 4, gemstone: "Hessonite Garnet", day: "Saturday",  metal: "Lead",     direction: "Southwest" },
  Ketu:    { colors: ["Grey", "Earthy"],            number: 7, gemstone: "Cat's Eye",        day: "Tuesday",   metal: "Iron",     direction: "Northeast" },
};

/* ── Helpers ── */

function findPlanet(planets: PlanetPosition[], name: string): PlanetPosition | undefined {
  return planets.find((p) => p.name === name);
}

function findHouseSign(houses: HousePlacement[], houseNumber: number): string | undefined {
  const h = houses.find((h) => h.house_number === houseNumber);
  return h?.sign;
}

function uniqueStrings(arr: string[]): string[] {
  return [...new Set(arr)];
}

function uniqueNumbers(arr: number[]): number[] {
  return [...new Set(arr)];
}

function attrFor(planet: string): PlanetAttributes {
  return PLANET_LUCKY[planet] ?? PLANET_LUCKY.Sun;
}

/* ── Main computation ── */

export function computeLuckyElements(
  ascendantSign: string,
  planets: PlanetPosition[],
  houses: HousePlacement[],
  nakshatraLord?: string | null,
): LuckyElementsInfo {
  // 1. Ascendant lord → primary lucky factors
  const ascLord = SIGN_RULERS[ascendantSign] ?? "Sun";
  const ascAttr = attrFor(ascLord);

  // 2. Moon sign lord → secondary / emotional factors
  const moon = findPlanet(planets, "Moon");
  const moonSign = moon?.sign ?? ascendantSign;
  const moonLord = SIGN_RULERS[moonSign] ?? "Moon";
  const moonAttr = attrFor(moonLord);

  // 3. 9th house lord → fortune factors
  const ninthSign = findHouseSign(houses, 9) ?? ascendantSign;
  const ninthLord = SIGN_RULERS[ninthSign] ?? "Jupiter";
  const ninthAttr = attrFor(ninthLord);

  // 4. Nakshatra lord (optional extra influence)
  const nakLord = nakshatraLord && PLANET_LUCKY[nakshatraLord] ? nakshatraLord : null;
  const nakAttr = nakLord ? attrFor(nakLord) : null;

  // Combine
  const primaryColors = ascAttr.colors;
  const secondaryColors = uniqueStrings([
    ...moonAttr.colors,
    ...ninthAttr.colors,
  ].filter((c) => !primaryColors.includes(c)));

  const luckyNumbers = uniqueNumbers([
    ascAttr.number,
    moonAttr.number,
    ninthAttr.number,
    ...(nakAttr ? [nakAttr.number] : []),
  ]);

  const directions = uniqueStrings([
    ascAttr.direction,
    ninthAttr.direction,
    ...(nakAttr ? [nakAttr.direction] : []),
  ]);

  return {
    primary_colors: primaryColors,
    secondary_colors: secondaryColors.slice(0, 3),
    lucky_numbers: luckyNumbers,
    primary_gemstone: ascAttr.gemstone,
    secondary_gemstone: ninthAttr.gemstone !== ascAttr.gemstone ? ninthAttr.gemstone : moonAttr.gemstone,
    lucky_day: ascAttr.day,
    secondary_day: moonAttr.day !== ascAttr.day ? moonAttr.day : ninthAttr.day,
    primary_metal: ascAttr.metal,
    secondary_metal: ninthAttr.metal !== ascAttr.metal ? ninthAttr.metal : moonAttr.metal,
    auspicious_directions: directions,
    basis: {
      ascendant_lord: ascLord,
      moon_sign_lord: moonLord,
      ninth_house_lord: ninthLord,
      nakshatra_lord: nakLord,
    },
  };
}
