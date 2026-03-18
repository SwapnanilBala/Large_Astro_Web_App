
import type { PlanetPosition, HousePlacement } from "./swiss-ephemeris-engine";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface YogaChartInput {
  planets: PlanetPosition[];
  houses: HousePlacement[];
  ascendantSign: string;
}

export interface YogaDetectionResult {
  yoga_id: string;
  name: string;
  sanskrit: string;
  category: "mahapurusha" | "wealth" | "benefic" | "challenging" | "viparita" | "nabhasa";
  present: boolean;
  strength: "strong" | "moderate" | "weak";
  involved_planets: string[];
  description: string;
  effects: string;
  cancellation?: string;
}

interface YogaDefinition {
  id: string;
  name: string;
  sanskrit: string;
  category: YogaDetectionResult["category"];
  description: string;
  effects: string;
  detect: (chart: YogaChartInput) => YogaDetectionResult | null;
}

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const SIGN_RULERS: Record<string, string> = {
  Aries: "Mars", Taurus: "Venus", Gemini: "Mercury", Cancer: "Moon",
  Leo: "Sun", Virgo: "Mercury", Libra: "Venus", Scorpio: "Mars",
  Sagittarius: "Jupiter", Capricorn: "Saturn", Aquarius: "Saturn", Pisces: "Jupiter",
};

const PLANET_OWN_SIGNS: Record<string, string[]> = {
  Sun: ["Leo"],
  Moon: ["Cancer"],
  Mercury: ["Gemini", "Virgo"],
  Venus: ["Taurus", "Libra"],
  Mars: ["Aries", "Scorpio"],
  Jupiter: ["Sagittarius", "Pisces"],
  Saturn: ["Capricorn", "Aquarius"],
};

const PLANET_EXALTATIONS: Record<string, string> = {
  Sun: "Aries", Moon: "Taurus", Mercury: "Virgo", Venus: "Pisces",
  Mars: "Capricorn", Jupiter: "Cancer", Saturn: "Libra",
};

const PLANET_DEBILITATIONS: Record<string, string> = {
  Sun: "Libra", Moon: "Scorpio", Mercury: "Pisces", Venus: "Virgo",
  Mars: "Cancer", Jupiter: "Capricorn", Saturn: "Aries",
};

const NATURAL_BENEFICS = ["Jupiter", "Venus", "Mercury"];

// --------------------------------------------------------------------------
// Helper functions
// --------------------------------------------------------------------------

export function getSignLord(sign: string): string {
  return SIGN_RULERS[sign] ?? "Sun";
}

export function isInKendra(house: number): boolean {
  return [1, 4, 7, 10].includes(house);
}

export function isInTrikona(house: number): boolean {
  return [1, 5, 9].includes(house);
}

export function isExalted(planet: string, sign: string): boolean {
  return PLANET_EXALTATIONS[planet] === sign;
}

export function isDebilitated(planet: string, sign: string): boolean {
  return PLANET_DEBILITATIONS[planet] === sign;
}

export function isOwnSign(planet: string, sign: string): boolean {
  return PLANET_OWN_SIGNS[planet]?.includes(sign) ?? false;
}

export function isInDusthana(house: number): boolean {
  return [6, 8, 12].includes(house);
}

export function arePlanetsConjunct(
  p1Name: string,
  p2Name: string,
  planets: PlanetPosition[]
): boolean {
  const planet1 = planets.find((p) => p.name === p1Name);
  const planet2 = planets.find((p) => p.name === p2Name);
  if (!planet1 || !planet2) return false;
  return planet1.sign === planet2.sign;
}

export function getHouseLord(
  houseNum: number,
  houses: HousePlacement[],
  _ascendant: string
): string {
  const house = houses.find((h) => h.house_number === houseNum);
  if (!house) return "Sun";
  return getSignLord(house.sign);
}

function findPlanet(planets: PlanetPosition[], name: string): PlanetPosition | undefined {
  return planets.find((p) => p.name === name);
}

function signDistance(fromSign: string, toSign: string): number {
  const fi = ZODIAC_SIGNS.indexOf(fromSign);
  const ti = ZODIAC_SIGNS.indexOf(toSign);
  return ((ti - fi + 12) % 12) + 1;
}

function planetStrength(planet: string, sign: string): "strong" | "moderate" | "weak" {
  if (isExalted(planet, sign)) return "strong";
  if (isOwnSign(planet, sign)) return "strong";
  if (isDebilitated(planet, sign)) return "weak";
  return "moderate";
}

function overallStrength(strengths: Array<"strong" | "moderate" | "weak">): "strong" | "moderate" | "weak" {
  if (strengths.includes("strong") && !strengths.includes("weak")) return "strong";
  if (strengths.includes("weak") && !strengths.includes("strong")) return "weak";
  return "moderate";
}

// --------------------------------------------------------------------------
// Mahapurusha Yoga helper
// --------------------------------------------------------------------------

function detectMahapurusha(
  planetName: string,
  yogaId: string,
  yogaName: string,
  sanskrit: string,
  description: string,
  effects: string,
  chart: YogaChartInput
): YogaDetectionResult | null {
  const planet = findPlanet(chart.planets, planetName);
  if (!planet) return null;

  const inKendra = isInKendra(planet.house);
  const exalted = isExalted(planetName, planet.sign);
  const ownSign = isOwnSign(planetName, planet.sign);

  if (inKendra && (exalted || ownSign)) {
    return {
      yoga_id: yogaId,
      name: yogaName,
      sanskrit,
      category: "mahapurusha",
      present: true,
      strength: exalted ? "strong" : "moderate",
      involved_planets: [planetName],
      description,
      effects,
    };
  }

  return null;
}

// --------------------------------------------------------------------------
// Yoga definitions
// --------------------------------------------------------------------------

const YOGA_DEFINITIONS: YogaDefinition[] = [
  // ── Pancha Mahapurusha Yogas ──
  {
    id: "ruchaka",
    name: "Ruchaka Yoga",
    sanskrit: "रुचक योग",
    category: "mahapurusha",
    description: "Mars in own sign or exalted and placed in a kendra house (1/4/7/10).",
    effects: "Bestows courage, leadership ability, military prowess, athletic build, and commanding presence.",
    detect: (chart) =>
      detectMahapurusha(
        "Mars", "ruchaka", "Ruchaka Yoga", "रुचक योग",
        "Mars is in own sign or exalted and placed in a kendra house (1/4/7/10).",
        "Bestows courage, leadership ability, military prowess, athletic build, and commanding presence.",
        chart
      ),
  },
  {
    id: "bhadra",
    name: "Bhadra Yoga",
    sanskrit: "भद्र योग",
    category: "mahapurusha",
    description: "Mercury in own sign or exalted and placed in a kendra house (1/4/7/10).",
    effects: "Grants sharp intelligence, communication mastery, business acumen, and scholarly pursuits.",
    detect: (chart) =>
      detectMahapurusha(
        "Mercury", "bhadra", "Bhadra Yoga", "भद्र योग",
        "Mercury is in own sign or exalted and placed in a kendra house (1/4/7/10).",
        "Grants sharp intelligence, communication mastery, business acumen, and scholarly pursuits.",
        chart
      ),
  },
  {
    id: "hamsa",
    name: "Hamsa Yoga",
    sanskrit: "हंस योग",
    category: "mahapurusha",
    description: "Jupiter in own sign or exalted and placed in a kendra house (1/4/7/10).",
    effects: "Confers wisdom, spiritual knowledge, righteousness, respect from society, and good fortune.",
    detect: (chart) =>
      detectMahapurusha(
        "Jupiter", "hamsa", "Hamsa Yoga", "हंस योग",
        "Jupiter is in own sign or exalted and placed in a kendra house (1/4/7/10).",
        "Confers wisdom, spiritual knowledge, righteousness, respect from society, and good fortune.",
        chart
      ),
  },
  {
    id: "malavya",
    name: "Malavya Yoga",
    sanskrit: "मालव्य योग",
    category: "mahapurusha",
    description: "Venus in own sign or exalted and placed in a kendra house (1/4/7/10).",
    effects: "Brings beauty, luxury, artistic talent, romantic fulfillment, and material comfort.",
    detect: (chart) =>
      detectMahapurusha(
        "Venus", "malavya", "Malavya Yoga", "मालव्य योग",
        "Venus is in own sign or exalted and placed in a kendra house (1/4/7/10).",
        "Brings beauty, luxury, artistic talent, romantic fulfillment, and material comfort.",
        chart
      ),
  },
  {
    id: "shasha",
    name: "Shasha Yoga",
    sanskrit: "शश योग",
    category: "mahapurusha",
    description: "Saturn in own sign or exalted and placed in a kendra house (1/4/7/10).",
    effects: "Grants discipline, authority, longevity, success through hard work, and organizational power.",
    detect: (chart) =>
      detectMahapurusha(
        "Saturn", "shasha", "Shasha Yoga", "शश योग",
        "Saturn is in own sign or exalted and placed in a kendra house (1/4/7/10).",
        "Grants discipline, authority, longevity, success through hard work, and organizational power.",
        chart
      ),
  },

  // ── Wealth & Raja Yogas ──
  {
    id: "gajakesari",
    name: "Gajakesari Yoga",
    sanskrit: "गजकेसरी योग",
    category: "wealth",
    description: "Jupiter in a kendra (1/4/7/10) from the Moon.",
    effects: "Confers wisdom, fame, lasting wealth, and the ability to overcome obstacles with grace.",
    detect: (chart) => {
      const moon = findPlanet(chart.planets, "Moon");
      const jupiter = findPlanet(chart.planets, "Jupiter");
      if (!moon || !jupiter) return null;

      const dist = signDistance(moon.sign, jupiter.sign);
      if ([1, 4, 7, 10].includes(dist)) {
        const str = planetStrength("Jupiter", jupiter.sign);
        return {
          yoga_id: "gajakesari",
          name: "Gajakesari Yoga",
          sanskrit: "गजकेसरी योग",
          category: "wealth",
          present: true,
          strength: str,
          involved_planets: ["Moon", "Jupiter"],
          description: `Jupiter is ${dist} signs from the Moon, forming a kendra relationship.`,
          effects: "Confers wisdom, fame, lasting wealth, and the ability to overcome obstacles with grace.",
        };
      }
      return null;
    },
  },
  {
    id: "budhaditya",
    name: "Budhaditya Yoga",
    sanskrit: "बुधादित्य योग",
    category: "wealth",
    description: "Sun and Mercury in the same sign.",
    effects: "Grants intelligence, eloquence, fame through communication, and sharp analytical ability.",
    detect: (chart) => {
      const sun = findPlanet(chart.planets, "Sun");
      const mercury = findPlanet(chart.planets, "Mercury");
      if (!sun || !mercury) return null;

      if (sun.sign === mercury.sign) {
        // Combustion check: if Mercury is too close to Sun, weaker
        const angleDiff = Math.abs(sun.longitude - mercury.longitude);
        const isCombusted = angleDiff < 3;
        return {
          yoga_id: "budhaditya",
          name: "Budhaditya Yoga",
          sanskrit: "बुधादित्य योग",
          category: "wealth",
          present: true,
          strength: isCombusted ? "weak" : "moderate",
          involved_planets: ["Sun", "Mercury"],
          description: `Sun and Mercury are conjunct in ${sun.sign}.${isCombusted ? " Mercury is combust (within 3 degrees), reducing effectiveness." : ""}`,
          effects: "Grants intelligence, eloquence, fame through communication, and sharp analytical ability.",
          cancellation: isCombusted ? "Mercury is combust due to close proximity to the Sun, weakening this yoga." : undefined,
        };
      }
      return null;
    },
  },
  {
    id: "dhana",
    name: "Dhana Yoga",
    sanskrit: "धन योग",
    category: "wealth",
    description: "Lord of the 2nd house in a kendra or trikona, or lord of the 11th in the 2nd house.",
    effects: "Indicates wealth accumulation, financial stability, and material prosperity.",
    detect: (chart) => {
      const lord2Name = getHouseLord(2, chart.houses, chart.ascendantSign);
      const lord11Name = getHouseLord(11, chart.houses, chart.ascendantSign);
      const lord2 = findPlanet(chart.planets, lord2Name);
      const lord11 = findPlanet(chart.planets, lord11Name);

      const involved: string[] = [];
      let formed = false;
      let desc = "";

      if (lord2 && (isInKendra(lord2.house) || isInTrikona(lord2.house))) {
        formed = true;
        involved.push(lord2Name);
        desc = `Lord of the 2nd house (${lord2Name}) is placed in house ${lord2.house}, a ${isInKendra(lord2.house) ? "kendra" : "trikona"} position.`;
      }

      if (lord11 && lord11.house === 2) {
        formed = true;
        if (!involved.includes(lord11Name)) involved.push(lord11Name);
        desc += (desc ? " Additionally, " : "") + `Lord of the 11th house (${lord11Name}) is placed in the 2nd house.`;
      }

      if (formed) {
        return {
          yoga_id: "dhana",
          name: "Dhana Yoga",
          sanskrit: "धन योग",
          category: "wealth",
          present: true,
          strength: overallStrength(involved.map((n) => {
            const p = findPlanet(chart.planets, n);
            return p ? planetStrength(n, p.sign) : "moderate";
          })),
          involved_planets: involved,
          description: desc,
          effects: "Indicates wealth accumulation, financial stability, and material prosperity.",
        };
      }
      return null;
    },
  },
  {
    id: "raja",
    name: "Raja Yoga",
    sanskrit: "राज योग",
    category: "wealth",
    description: "Lord of a trikona (1/5/9) conjunct lord of a kendra (1/4/7/10).",
    effects: "Bestows power, authority, social status, and success in public life.",
    detect: (chart) => {
      const trikonaHouses = [1, 5, 9];
      const kendraHouses = [1, 4, 7, 10];

      const trikonaLords = trikonaHouses.map((h) => ({
        house: h,
        lord: getHouseLord(h, chart.houses, chart.ascendantSign),
      }));
      const kendraLords = kendraHouses.map((h) => ({
        house: h,
        lord: getHouseLord(h, chart.houses, chart.ascendantSign),
      }));

      for (const tl of trikonaLords) {
        for (const kl of kendraLords) {
          if (tl.lord === kl.lord && tl.house !== kl.house) {
            // Same planet rules both a trikona and kendra — automatic raja yoga
            const planet = findPlanet(chart.planets, tl.lord);
            if (planet) {
              return {
                yoga_id: "raja",
                name: "Raja Yoga",
                sanskrit: "राज योग",
                category: "wealth",
                present: true,
                strength: planetStrength(tl.lord, planet.sign),
                involved_planets: [tl.lord],
                description: `${tl.lord} rules both the ${tl.house}th house (trikona) and ${kl.house}th house (kendra), forming Raja Yoga.`,
                effects: "Bestows power, authority, social status, and success in public life.",
              };
            }
          }

          if (tl.lord !== kl.lord && arePlanetsConjunct(tl.lord, kl.lord, chart.planets)) {
            const p1 = findPlanet(chart.planets, tl.lord);
            const p2 = findPlanet(chart.planets, kl.lord);
            if (p1 && p2) {
              return {
                yoga_id: "raja",
                name: "Raja Yoga",
                sanskrit: "राज योग",
                category: "wealth",
                present: true,
                strength: overallStrength([planetStrength(tl.lord, p1.sign), planetStrength(kl.lord, p2.sign)]),
                involved_planets: [tl.lord, kl.lord],
                description: `Lord of the ${tl.house}th (${tl.lord}) is conjunct lord of the ${kl.house}th (${kl.lord}) in ${p1.sign}.`,
                effects: "Bestows power, authority, social status, and success in public life.",
              };
            }
          }
        }
      }
      return null;
    },
  },
  {
    id: "lakshmi",
    name: "Lakshmi Yoga",
    sanskrit: "लक्ष्मी योग",
    category: "wealth",
    description: "Lord of the 9th house is strong, and Venus is in own or exalted sign in a kendra or trikona.",
    effects: "Brings great fortune, prosperity, beauty, and divine grace in material and spiritual matters.",
    detect: (chart) => {
      const lord9Name = getHouseLord(9, chart.houses, chart.ascendantSign);
      const lord9 = findPlanet(chart.planets, lord9Name);
      const venus = findPlanet(chart.planets, "Venus");
      if (!lord9 || !venus) return null;

      const lord9Strong = isExalted(lord9Name, lord9.sign) || isOwnSign(lord9Name, lord9.sign);
      const venusStrong = isExalted("Venus", venus.sign) || isOwnSign("Venus", venus.sign);
      const venusInGoodHouse = isInKendra(venus.house) || isInTrikona(venus.house);

      if (lord9Strong && venusStrong && venusInGoodHouse) {
        return {
          yoga_id: "lakshmi",
          name: "Lakshmi Yoga",
          sanskrit: "लक्ष्मी योग",
          category: "wealth",
          present: true,
          strength: "strong",
          involved_planets: [lord9Name, "Venus"].filter((v, i, a) => a.indexOf(v) === i),
          description: `Lord of the 9th (${lord9Name}) is ${isExalted(lord9Name, lord9.sign) ? "exalted" : "in own sign"}, and Venus is ${isExalted("Venus", venus.sign) ? "exalted" : "in own sign"} in house ${venus.house}.`,
          effects: "Brings great fortune, prosperity, beauty, and divine grace in material and spiritual matters.",
        };
      }
      return null;
    },
  },

  // ── Benefic Yogas ──
  {
    id: "chandra_mangal",
    name: "Chandra-Mangal Yoga",
    sanskrit: "चन्द्र-मंगल योग",
    category: "benefic",
    description: "Moon and Mars in the same sign.",
    effects: "Generates wealth through enterprise, courage, and bold action. Strong emotional drive.",
    detect: (chart) => {
      const moon = findPlanet(chart.planets, "Moon");
      const mars = findPlanet(chart.planets, "Mars");
      if (!moon || !mars) return null;

      if (moon.sign === mars.sign) {
        return {
          yoga_id: "chandra_mangal",
          name: "Chandra-Mangal Yoga",
          sanskrit: "चन्द्र-मंगल योग",
          category: "benefic",
          present: true,
          strength: overallStrength([planetStrength("Moon", moon.sign), planetStrength("Mars", mars.sign)]),
          involved_planets: ["Moon", "Mars"],
          description: `Moon and Mars are conjunct in ${moon.sign} (house ${moon.house}).`,
          effects: "Generates wealth through enterprise, courage, and bold action. Strong emotional drive.",
        };
      }
      return null;
    },
  },
  {
    id: "guru_mangal",
    name: "Guru-Mangal Yoga",
    sanskrit: "गुरु-मंगल योग",
    category: "benefic",
    description: "Jupiter and Mars in conjunction (same sign).",
    effects: "Combines energy with wisdom, producing righteous action, courage with judgment, and success in competitive fields.",
    detect: (chart) => {
      const jupiter = findPlanet(chart.planets, "Jupiter");
      const mars = findPlanet(chart.planets, "Mars");
      if (!jupiter || !mars) return null;

      if (jupiter.sign === mars.sign) {
        return {
          yoga_id: "guru_mangal",
          name: "Guru-Mangal Yoga",
          sanskrit: "गुरु-मंगल योग",
          category: "benefic",
          present: true,
          strength: overallStrength([planetStrength("Jupiter", jupiter.sign), planetStrength("Mars", mars.sign)]),
          involved_planets: ["Jupiter", "Mars"],
          description: `Jupiter and Mars are conjunct in ${jupiter.sign} (house ${jupiter.house}).`,
          effects: "Combines energy with wisdom, producing righteous action, courage with judgment, and success in competitive fields.",
        };
      }
      return null;
    },
  },
  {
    id: "amala",
    name: "Amala Yoga",
    sanskrit: "अमल योग",
    category: "benefic",
    description: "A natural benefic planet (Jupiter, Venus, or Mercury) in the 10th house from the Lagna or Moon.",
    effects: "Indicates pure character, fame, spotless reputation, and success through virtuous conduct.",
    detect: (chart) => {
      const moon = findPlanet(chart.planets, "Moon");
      if (!moon) return null;

      for (const benefic of NATURAL_BENEFICS) {
        const planet = findPlanet(chart.planets, benefic);
        if (!planet) continue;

        // 10th from lagna
        if (planet.house === 10) {
          return {
            yoga_id: "amala",
            name: "Amala Yoga",
            sanskrit: "अमल योग",
            category: "benefic",
            present: true,
            strength: planetStrength(benefic, planet.sign),
            involved_planets: [benefic],
            description: `${benefic} (a natural benefic) is in the 10th house from the Lagna.`,
            effects: "Indicates pure character, fame, spotless reputation, and success through virtuous conduct.",
          };
        }

        // 10th from Moon
        const distFromMoon = signDistance(moon.sign, planet.sign);
        if (distFromMoon === 10) {
          return {
            yoga_id: "amala",
            name: "Amala Yoga",
            sanskrit: "अमल योग",
            category: "benefic",
            present: true,
            strength: planetStrength(benefic, planet.sign),
            involved_planets: [benefic, "Moon"],
            description: `${benefic} (a natural benefic) is in the 10th sign from the Moon.`,
            effects: "Indicates pure character, fame, spotless reputation, and success through virtuous conduct.",
          };
        }
      }
      return null;
    },
  },
  {
    id: "saraswati",
    name: "Saraswati Yoga",
    sanskrit: "सरस्वती योग",
    category: "benefic",
    description: "Jupiter, Venus, and Mercury in kendras, trikonas, or 2nd house, with Jupiter strong.",
    effects: "Bestows learning, artistic talent, eloquence, mastery of scriptures, and academic excellence.",
    detect: (chart) => {
      const jupiter = findPlanet(chart.planets, "Jupiter");
      const venus = findPlanet(chart.planets, "Venus");
      const mercury = findPlanet(chart.planets, "Mercury");
      if (!jupiter || !venus || !mercury) return null;

      const goodHouse = (h: number) => isInKendra(h) || isInTrikona(h) || h === 2;
      const jupiterStrong = isExalted("Jupiter", jupiter.sign) || isOwnSign("Jupiter", jupiter.sign);

      if (goodHouse(jupiter.house) && goodHouse(venus.house) && goodHouse(mercury.house) && jupiterStrong) {
        return {
          yoga_id: "saraswati",
          name: "Saraswati Yoga",
          sanskrit: "सरस्वती योग",
          category: "benefic",
          present: true,
          strength: "strong",
          involved_planets: ["Jupiter", "Venus", "Mercury"],
          description: `Jupiter (${jupiter.sign}, house ${jupiter.house}), Venus (${venus.sign}, house ${venus.house}), and Mercury (${mercury.sign}, house ${mercury.house}) are all in favorable positions with Jupiter strong.`,
          effects: "Bestows learning, artistic talent, eloquence, mastery of scriptures, and academic excellence.",
        };
      }
      return null;
    },
  },
  {
    id: "adhi",
    name: "Adhi Yoga",
    sanskrit: "अधि योग",
    category: "benefic",
    description: "Benefic planets in the 6th, 7th, and 8th houses from the Moon.",
    effects: "Grants leadership ability, prosperity, good health, and the capacity to overcome adversaries.",
    detect: (chart) => {
      const moon = findPlanet(chart.planets, "Moon");
      if (!moon) return null;

      const positions6_7_8: string[] = [];

      for (const benefic of NATURAL_BENEFICS) {
        const planet = findPlanet(chart.planets, benefic);
        if (!planet) continue;
        const dist = signDistance(moon.sign, planet.sign);
        if ([6, 7, 8].includes(dist)) {
          positions6_7_8.push(benefic);
        }
      }

      if (positions6_7_8.length >= 2) {
        return {
          yoga_id: "adhi",
          name: "Adhi Yoga",
          sanskrit: "अधि योग",
          category: "benefic",
          present: true,
          strength: positions6_7_8.length === 3 ? "strong" : "moderate",
          involved_planets: ["Moon", ...positions6_7_8],
          description: `${positions6_7_8.join(", ")} occupy the 6th, 7th, or 8th signs from the Moon, forming Adhi Yoga.`,
          effects: "Grants leadership ability, prosperity, good health, and the capacity to overcome adversaries.",
        };
      }
      return null;
    },
  },

  // ── Challenging Yogas ──
  {
    id: "kemadruma",
    name: "Kemadruma Yoga",
    sanskrit: "केमद्रुम योग",
    category: "challenging",
    description: "No planets in the 2nd or 12th house from the Moon (excluding Sun, Rahu, Ketu).",
    effects: "Can indicate periods of poverty, loneliness, emotional isolation, and lack of support.",
    detect: (chart) => {
      const moon = findPlanet(chart.planets, "Moon");
      const jupiter = findPlanet(chart.planets, "Jupiter");
      if (!moon) return null;

      const classicalPlanets = chart.planets.filter(
        (p) => !["Sun", "Moon", "Rahu", "Ketu"].includes(p.name)
      );

      const dist2 = classicalPlanets.some(
        (p) => signDistance(moon.sign, p.sign) === 2
      );
      const dist12 = classicalPlanets.some(
        (p) => signDistance(moon.sign, p.sign) === 12
      );

      if (!dist2 && !dist12) {
        // Check cancellation: Moon in kendra
        const moonInKendra = isInKendra(moon.house);
        // Check cancellation: Jupiter aspects Moon (same sign or aspect)
        const jupiterAspectsMoon = jupiter
          ? jupiter.sign === moon.sign || signDistance(jupiter.sign, moon.sign) === 7
          : false;

        if (moonInKendra || jupiterAspectsMoon) {
          return {
            yoga_id: "kemadruma",
            name: "Kemadruma Yoga",
            sanskrit: "केमद्रुम योग",
            category: "challenging",
            present: true,
            strength: "weak",
            involved_planets: ["Moon"],
            description: "No classical planets flank the Moon in the 2nd or 12th signs from it.",
            effects: "Can indicate periods of poverty, loneliness, emotional isolation, and lack of support.",
            cancellation: moonInKendra
              ? "Cancelled: Moon is in a kendra house, providing angular strength."
              : "Mitigated: Jupiter aspects or is conjunct the Moon, offering protection.",
          };
        }

        return {
          yoga_id: "kemadruma",
          name: "Kemadruma Yoga",
          sanskrit: "केमद्रुम योग",
          category: "challenging",
          present: true,
          strength: "strong",
          involved_planets: ["Moon"],
          description: "No classical planets flank the Moon in the 2nd or 12th signs from it, and no cancellation applies.",
          effects: "Can indicate periods of poverty, loneliness, emotional isolation, and lack of support.",
        };
      }
      return null;
    },
  },
  {
    id: "vish",
    name: "Vish Yoga",
    sanskrit: "विष योग",
    category: "challenging",
    description: "Moon conjunct Saturn in the same sign.",
    effects: "Creates emotional hardship, tendency toward melancholy, delays in happiness, and heaviness in relationships.",
    detect: (chart) => {
      const moon = findPlanet(chart.planets, "Moon");
      const saturn = findPlanet(chart.planets, "Saturn");
      const jupiter = findPlanet(chart.planets, "Jupiter");
      if (!moon || !saturn) return null;

      if (moon.sign === saturn.sign) {
        const jupiterAspects = jupiter
          ? jupiter.sign === moon.sign || signDistance(jupiter.sign, moon.sign) === 7
          : false;

        return {
          yoga_id: "vish",
          name: "Vish Yoga",
          sanskrit: "विष योग",
          category: "challenging",
          present: true,
          strength: jupiterAspects ? "weak" : "moderate",
          involved_planets: ["Moon", "Saturn"],
          description: `Moon and Saturn are conjunct in ${moon.sign} (house ${moon.house}).`,
          effects: "Creates emotional hardship, tendency toward melancholy, delays in happiness, and heaviness in relationships.",
          cancellation: jupiterAspects
            ? "Mitigated by Jupiter's aspect, which softens Saturn's harshness on the Moon."
            : undefined,
        };
      }
      return null;
    },
  },
  {
    id: "daridra",
    name: "Daridra Yoga",
    sanskrit: "दरिद्र योग",
    category: "challenging",
    description: "Lord of the 11th house placed in the 6th, 8th, or 12th house.",
    effects: "Indicates financial difficulties, loss of gains, struggles with income, and obstacles to prosperity.",
    detect: (chart) => {
      const lord11Name = getHouseLord(11, chart.houses, chart.ascendantSign);
      const lord11 = findPlanet(chart.planets, lord11Name);
      if (!lord11) return null;

      if (isInDusthana(lord11.house)) {
        return {
          yoga_id: "daridra",
          name: "Daridra Yoga",
          sanskrit: "दरिद्र योग",
          category: "challenging",
          present: true,
          strength: planetStrength(lord11Name, lord11.sign) === "strong" ? "weak" : "moderate",
          involved_planets: [lord11Name],
          description: `Lord of the 11th house (${lord11Name}) is placed in house ${lord11.house}, a dusthana position.`,
          effects: "Indicates financial difficulties, loss of gains, struggles with income, and obstacles to prosperity.",
        };
      }
      return null;
    },
  },
  {
    id: "grahan",
    name: "Grahan Yoga",
    sanskrit: "ग्रहण योग",
    category: "challenging",
    description: "Sun or Moon conjunct Rahu or Ketu.",
    effects: "Eclipsed luminaries create identity challenges (Sun) or emotional confusion (Moon), requiring conscious self-work.",
    detect: (chart) => {
      const sun = findPlanet(chart.planets, "Sun");
      const moon = findPlanet(chart.planets, "Moon");
      const rahu = findPlanet(chart.planets, "Rahu");
      const ketu = findPlanet(chart.planets, "Ketu");
      if (!rahu || !ketu) return null;

      const involved: string[] = [];
      const descriptions: string[] = [];

      if (sun && (sun.sign === rahu.sign || sun.sign === ketu.sign)) {
        involved.push("Sun");
        involved.push(sun.sign === rahu.sign ? "Rahu" : "Ketu");
        descriptions.push(`Sun is conjunct ${sun.sign === rahu.sign ? "Rahu" : "Ketu"} in ${sun.sign}`);
      }

      if (moon && (moon.sign === rahu.sign || moon.sign === ketu.sign)) {
        involved.push("Moon");
        const node = moon.sign === rahu.sign ? "Rahu" : "Ketu";
        if (!involved.includes(node)) involved.push(node);
        descriptions.push(`Moon is conjunct ${node} in ${moon.sign}`);
      }

      if (involved.length >= 2) {
        return {
          yoga_id: "grahan",
          name: "Grahan Yoga",
          sanskrit: "ग्रहण योग",
          category: "challenging",
          present: true,
          strength: involved.includes("Sun") && involved.includes("Moon") ? "strong" : "moderate",
          involved_planets: [...new Set(involved)],
          description: descriptions.join(". ") + ".",
          effects: "Eclipsed luminaries create identity challenges (Sun) or emotional confusion (Moon), requiring conscious self-work.",
        };
      }
      return null;
    },
  },

  // ── Viparita Raja Yoga ──
  {
    id: "viparita_raja",
    name: "Viparita Raja Yoga",
    sanskrit: "विपरीत राज योग",
    category: "viparita",
    description: "Lord of a dusthana (6/8/12) placed in another dusthana house.",
    effects: "Unexpected gains through adversity, resilience that converts hardship into advantage and hidden strength.",
    detect: (chart) => {
      const dusthanas = [6, 8, 12];
      const found: { lord: string; fromHouse: number; inHouse: number }[] = [];

      for (const dh of dusthanas) {
        const lordName = getHouseLord(dh, chart.houses, chart.ascendantSign);
        const lord = findPlanet(chart.planets, lordName);
        if (!lord) continue;

        if (isInDusthana(lord.house) && lord.house !== dh) {
          found.push({ lord: lordName, fromHouse: dh, inHouse: lord.house });
        }
      }

      if (found.length > 0) {
        const involved = [...new Set(found.map((f) => f.lord))];
        return {
          yoga_id: "viparita_raja",
          name: "Viparita Raja Yoga",
          sanskrit: "विपरीत राज योग",
          category: "viparita",
          present: true,
          strength: found.length >= 2 ? "strong" : "moderate",
          involved_planets: involved,
          description: found
            .map((f) => `Lord of the ${f.fromHouse}th house (${f.lord}) is placed in the ${f.inHouse}th house`)
            .join(". ") + ".",
          effects: "Unexpected gains through adversity, resilience that converts hardship into advantage and hidden strength.",
        };
      }
      return null;
    },
  },

  // ── Nabhasa Yogas ──
  {
    id: "kedara",
    name: "Kedara Yoga",
    sanskrit: "केदार योग",
    category: "nabhasa",
    description: "All seven classical planets occupy exactly four signs.",
    effects: "Indicates agricultural or land-based wealth, practical success, and grounded prosperity.",
    detect: (chart) => {
      const classical = chart.planets.filter((p) =>
        ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"].includes(p.name)
      );
      const uniqueSigns = new Set(classical.map((p) => p.sign));

      if (uniqueSigns.size === 4) {
        return {
          yoga_id: "kedara",
          name: "Kedara Yoga",
          sanskrit: "केदार योग",
          category: "nabhasa",
          present: true,
          strength: "moderate",
          involved_planets: classical.map((p) => p.name),
          description: `All seven classical planets are distributed across exactly 4 signs: ${[...uniqueSigns].join(", ")}.`,
          effects: "Indicates agricultural or land-based wealth, practical success, and grounded prosperity.",
        };
      }
      return null;
    },
  },
  {
    id: "yava",
    name: "Yava Yoga",
    sanskrit: "यव योग",
    category: "nabhasa",
    description: "All planets arranged in pairs of signs (every occupied sign has exactly two planets).",
    effects: "Moderate wealth, charitable disposition, and balanced approach to material life.",
    detect: (chart) => {
      const classical = chart.planets.filter((p) =>
        ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"].includes(p.name)
      );
      const signCounts: Record<string, number> = {};
      for (const p of classical) {
        signCounts[p.sign] = (signCounts[p.sign] || 0) + 1;
      }

      // Check: with 7 planets, perfect pairing is impossible (odd number).
      // Classical interpretation: planets arranged such that most signs have pairs.
      // Check if at least 3 signs have exactly 2 planets (6 of 7 paired).
      const pairCount = Object.values(signCounts).filter((c) => c === 2).length;

      if (pairCount >= 3) {
        return {
          yoga_id: "yava",
          name: "Yava Yoga",
          sanskrit: "यव योग",
          category: "nabhasa",
          present: true,
          strength: pairCount >= 3 ? "moderate" : "weak",
          involved_planets: classical.map((p) => p.name),
          description: `Classical planets form ${pairCount} pairs across signs, creating a barley-grain pattern.`,
          effects: "Moderate wealth, charitable disposition, and balanced approach to material life.",
        };
      }
      return null;
    },
  },
];

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

export function detectYogas(chart: YogaChartInput): YogaDetectionResult[] {
  const results: YogaDetectionResult[] = [];

  for (const definition of YOGA_DEFINITIONS) {
    try {
      const result = definition.detect(chart);
      if (result && result.present) {
        results.push(result);
      }
    } catch {
      // Skip any yoga that fails detection gracefully
    }
  }

  // Sort: strong first, then moderate, then weak
  const strengthOrder: Record<string, number> = { strong: 0, moderate: 1, weak: 2 };
  results.sort((a, b) => strengthOrder[a.strength] - strengthOrder[b.strength]);

  return results;
}

export { YOGA_DEFINITIONS };
