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

const PLANET_GEMSTONE_INTENTIONS: Record<string, string> = {
  Sun: "Support confidence, clarity, and constructive visibility.",
  Moon: "Support emotional steadiness, rest, and receptivity.",
  Mars: "Support courage, momentum, and decisive action.",
  Mercury: "Support clear communication, learning, and discernment.",
  Jupiter: "Support wisdom, learning, and expansive opportunities.",
  Venus: "Support harmony, creativity, and relationship grace.",
  Saturn: "Support patience, responsibility, and durable progress.",
  Rahu: "Support grounded ambition while resisting shortcuts.",
  Ketu: "Support reflection, discernment, and spiritual focus.",
};

const PLANET_CAUTIONS: Record<string, { colors: string[]; items: string[]; omens: string[] }> = {
  Sun: {
    colors: ["Dull Black", "Ash Grey"],
    items: ["Cracked mirrors", "faded gold"],
    omens: ["Repeated authority clashes before starting"],
  },
  Moon: {
    colors: ["Murky Brown", "Clouded Grey"],
    items: ["Stagnant water", "chipped silver"],
    omens: ["Unsettled sleep or repeated water spills"],
  },
  Mars: {
    colors: ["Rust Red", "Harsh Neon"],
    items: ["Broken blades", "burnt tools"],
    omens: ["Arguments, cuts, or sparks before departure"],
  },
  Mercury: {
    colors: ["Dusty Green", "Mixed Mud"],
    items: ["Torn papers", "faulty pens"],
    omens: ["Misplaced documents or repeated message errors"],
  },
  Jupiter: {
    colors: ["Sallow Yellow", "Muddy Gold"],
    items: ["Empty wallets", "damaged books"],
    omens: ["Broken promises from advisers or teachers"],
  },
  Venus: {
    colors: ["Washed Pink", "Stained White"],
    items: ["Wilted flowers", "scratched perfume bottles"],
    omens: ["Spoiled sweets or repeated social awkwardness"],
  },
  Saturn: {
    colors: ["Flat Black", "Cold Blue"],
    items: ["Rusty iron", "worn shoes"],
    omens: ["Blocked paths, delays, or broken machinery"],
  },
  Rahu: {
    colors: ["Smoky Black", "Electric Purple"],
    items: ["Synthetic stones", "frayed cords"],
    omens: ["Confusing shortcuts or sudden misinformation"],
  },
  Ketu: {
    colors: ["Dust Grey", "Pale Brown"],
    items: ["Frayed cloth", "broken beads"],
    omens: ["Sudden detachment, lost keys, or repeated silence"],
  },
};

/**
 * Yogakaraka: a planet that owns both a kendra house (1,4,7,10) AND a
 * trikona house (1,5,9) for the given lagna. It is considered the single
 * most auspicious planet and its gemstone / day / metal should be primary.
 * Only six lagnas have a yogakaraka planet other than the lagna lord itself.
 */
const YOGAKARAKA_BY_LAGNA: Record<string, string> = {
  Taurus:    "Saturn",  // rules 9th (Capricorn) + 10th (Aquarius) — trikona + kendra
  Cancer:    "Mars",    // rules 5th (Scorpio)   + 10th (Aries)    — trikona + kendra
  Leo:       "Mars",    // rules 4th (Scorpio)   + 9th  (Aries)    — kendra  + trikona
  Libra:     "Saturn",  // rules 4th (Capricorn) + 5th  (Aquarius) — kendra  + trikona
  Capricorn: "Venus",   // rules 5th (Taurus)    + 10th (Libra)    — trikona + kendra
  Aquarius:  "Venus",   // rules 4th (Taurus)    + 9th  (Libra)    — kendra  + trikona
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

function cautionFor(planet: string) {
  return PLANET_CAUTIONS[planet] ?? PLANET_CAUTIONS.Sun;
}

/** Return the first gemstone from `candidates` not already in `taken`. */
function pickDistinctGemAttribute(candidates: PlanetAttributes[], taken: string[]): PlanetAttributes {
  for (const attr of candidates) {
    if (!taken.includes(attr.gemstone)) return attr;
  }
  // All candidates share the same gem — return the first as fallback
  return candidates[0] ?? PLANET_LUCKY.Moon;
}

/** Return the first day from `candidates` not equal to `exclude`. */
function pickDay(candidates: PlanetAttributes[], exclude: string): string {
  for (const attr of candidates) {
    if (attr.day !== exclude) return attr.day;
  }
  return candidates[0]?.day ?? "Monday";
}

/** Return the first metal from `candidates` not equal to `exclude`. */
function pickMetal(candidates: PlanetAttributes[], exclude: string): string {
  for (const attr of candidates) {
    if (attr.metal !== exclude) return attr.metal;
  }
  return candidates[0]?.metal ?? "Silver";
}

function challengingLords(
  houses: HousePlacement[],
  ascLord: string,
  yogakaraka: string | null
): string[] {
  return uniqueStrings(
    [6, 8, 12]
      .map((houseNumber) => {
        const sign = findHouseSign(houses, houseNumber);
        return sign ? SIGN_RULERS[sign] : null;
      })
      .filter((planet): planet is string => Boolean(planet))
      .filter((planet) => planet !== ascLord && planet !== yogakaraka)
  );
}

/* ── Main computation ── */

function buildFortuneDomains(
  planets: PlanetPosition[],
  ninthLord: string,
  primaryPlanet: string,
  hasYogakaraka: boolean,
) {
  const getPlanetHouse = (planet: string) => findPlanet(planets, planet)?.house ?? null;

  return [
    {
      title: "Learning & mentors",
      focus: "Deep study, trusted guides, long-range travel, and choices that expand your perspective.",
      key_planet: ninthLord,
      planet_house: getPlanetHouse(ninthLord),
      basis: "9th-house lord",
    },
    {
      title: "Growth & opportunity",
      focus: "Generosity, teaching, and taking the wider view when an opening asks for faith and preparation.",
      key_planet: "Jupiter",
      planet_house: getPlanetHouse("Jupiter"),
      basis: "Jupiter’s natal placement",
    },
    {
      title: "Personal momentum",
      focus: "The practical choices that make opportunity easier to recognize and act on consistently.",
      key_planet: primaryPlanet,
      planet_house: getPlanetHouse(primaryPlanet),
      basis: hasYogakaraka ? "Yogakaraka influence" : "Ascendant-lord influence",
    },
  ];
}

export function computeLuckyElements(
  ascendantSign: string,
  planets: PlanetPosition[],
  houses: HousePlacement[],
  nakshatraLord?: string | null,
): LuckyElementsInfo {
  // 1. Ascendant lord → structural foundation
  const ascLord = SIGN_RULERS[ascendantSign] ?? "Sun";
  const ascAttr = attrFor(ascLord);

  // 2. Moon sign lord → emotional / receptive layer
  const moon = findPlanet(planets, "Moon");
  const moonSign = moon?.sign ?? ascendantSign;
  const moonLord = SIGN_RULERS[moonSign] ?? "Moon";
  const moonAttr = attrFor(moonLord);

  // 3. 9th house lord → fortune / dharma layer
  const ninthSign = findHouseSign(houses, 9) ?? ascendantSign;
  const ninthLord = SIGN_RULERS[ninthSign] ?? "Jupiter";
  const ninthAttr = attrFor(ninthLord);

  // 4. Nakshatra lord → subtle / lunar mansion influence
  const nakLord = nakshatraLord && PLANET_LUCKY[nakshatraLord] ? nakshatraLord : null;
  const nakAttr = nakLord ? attrFor(nakLord) : null;

  // 5. Yogakaraka → the single most auspicious planet for this lagna (if any)
  const yogakaraka = YOGAKARAKA_BY_LAGNA[ascendantSign] ?? null;
  const yogaAttr = yogakaraka ? attrFor(yogakaraka) : null;

  // ── Gemstones ──────────────────────────────────────────────────────────────
  // When a yogakaraka exists, its gem is primary (highest benefic for the lagna).
  // The ascendant lord's gem then becomes secondary.
  // Without a yogakaraka, ascendant lord is primary; cascade 9th → moon → nak
  // to find a genuinely distinct secondary.
  const primaryGemPlanet = yogakaraka ?? ascLord;
  const primaryGemstone = yogaAttr ? yogaAttr.gemstone : ascAttr.gemstone;

  const gemCandidates: PlanetAttributes[] = yogaAttr
    ? [ascAttr, ninthAttr, moonAttr, ...(nakAttr ? [nakAttr] : [])]
    : [ninthAttr, moonAttr, ...(nakAttr ? [nakAttr] : [])];
  const secondaryGemAttr = pickDistinctGemAttribute(gemCandidates, [primaryGemstone]);
  const secondaryGemstone = secondaryGemAttr.gemstone;
  const secondaryGemPlanet =
    Object.entries(PLANET_LUCKY).find(([, attr]) => attr === secondaryGemAttr)?.[0] ?? ninthLord;

  // ── Colors ─────────────────────────────────────────────────────────────────
  // Primary: ascendant lord always (structural base of the chart).
  const primaryColors = ascAttr.colors;

  // Secondary: moon lord + 9th lord + nakshatra lord, deduped against primary.
  // Nakshatra lord was previously omitted — now included.
  const secondaryColors = uniqueStrings([
    ...moonAttr.colors,
    ...ninthAttr.colors,
    ...(nakAttr ? nakAttr.colors : []),
    ...(yogaAttr ? yogaAttr.colors : []),
  ].filter((c) => !primaryColors.includes(c)));

  // ── Numbers ─────────────────────────────────────────────────────────────────
  const luckyNumbers = uniqueNumbers([
    ascAttr.number,
    moonAttr.number,
    ninthAttr.number,
    ...(nakAttr ? [nakAttr.number] : []),
    ...(yogaAttr ? [yogaAttr.number] : []),
  ]);

  // ── Day & Metal ──────────────────────────────────────────────────────────────
  // The yogakaraka (if present) governs the primary day/metal; otherwise asc lord.
  const primaryDayAttr = yogaAttr ?? ascAttr;
  const luckyDay = primaryDayAttr.day;
  const secondaryDay = pickDay([ascAttr, moonAttr, ninthAttr], luckyDay);

  const primaryMetal = primaryDayAttr.metal;
  const secondaryMetal = pickMetal([ascAttr, moonAttr, ninthAttr], primaryMetal);

  // ── Directions ───────────────────────────────────────────────────────────────
  const directions = uniqueStrings([
    ascAttr.direction,
    ninthAttr.direction,
    ...(nakAttr ? [nakAttr.direction] : []),
    ...(yogaAttr ? [yogaAttr.direction] : []),
  ]);

  const cautionPlanets = challengingLords(houses, ascLord, yogakaraka);
  const cautionSources = cautionPlanets.length > 0 ? cautionPlanets : ["Saturn", "Rahu", "Ketu"];
  const cautionAttrs = cautionSources.map(cautionFor);
  const unluckyColors = uniqueStrings(cautionAttrs.flatMap((attr) => attr.colors)).slice(0, 4);
  const unluckyItems = uniqueStrings(cautionAttrs.flatMap((attr) => attr.items)).slice(0, 4);
  const badOmens = uniqueStrings(cautionAttrs.flatMap((attr) => attr.omens)).slice(0, 3);
  const gemstoneGuidance = {
    primary: {
      gemstone: primaryGemstone,
      governing_planet: primaryGemPlanet,
      recommended_day: attrFor(primaryGemPlanet).day,
      metal: attrFor(primaryGemPlanet).metal,
      intention: PLANET_GEMSTONE_INTENTIONS[primaryGemPlanet] ?? PLANET_GEMSTONE_INTENTIONS.Sun,
    },
    secondary: {
      gemstone: secondaryGemstone,
      governing_planet: secondaryGemPlanet,
      recommended_day: secondaryGemAttr.day,
      metal: secondaryGemAttr.metal,
      intention: PLANET_GEMSTONE_INTENTIONS[secondaryGemPlanet] ?? PLANET_GEMSTONE_INTENTIONS.Moon,
    },
    safety_note: "Gemstone remedies are traditional spiritual practices, not guarantees. Consult a qualified Vedic astrologer before purchasing or wearing a remedial gemstone.",
  };
  const fortuneDomains = buildFortuneDomains(
    planets,
    ninthLord,
    primaryGemPlanet,
    Boolean(yogakaraka),
  );

  return {
    primary_colors: primaryColors,
    secondary_colors: secondaryColors.slice(0, 4),
    lucky_numbers: luckyNumbers,
    primary_gemstone: primaryGemstone,
    secondary_gemstone: secondaryGemstone,
    lucky_day: luckyDay,
    secondary_day: secondaryDay,
    primary_metal: primaryMetal,
    secondary_metal: secondaryMetal,
    auspicious_directions: directions,
    unlucky_colors: unluckyColors,
    unlucky_items: unluckyItems,
    bad_omens: badOmens,
    gemstone_guidance: gemstoneGuidance,
    fortune_domains: fortuneDomains,
    basis: {
      ascendant_lord: ascLord,
      moon_sign_lord: moonLord,
      ninth_house_lord: ninthLord,
      nakshatra_lord: nakLord,
      yogakaraka_lord: yogakaraka,
    },
  };
}
