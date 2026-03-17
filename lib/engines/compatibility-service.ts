
import type { PlanetPosition } from "./swiss-ephemeris-engine";
import { buildChart } from "./chart-service";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface SynastryAspectInfo {
  primary_planet: string;
  partner_planet: string;
  aspect_type: string;
  orb: number;
  harmonious: boolean;
}

export interface CompatibilityTheme {
  title: string;
  insight: string;
  confidence_score: number;
}

export interface ClientProfile {
  name: string;
  country: string;
  state: string;
  city: string;
  town: string;
  latitude: number;
  longitude: number;
  timezone_offset_minutes: number;
  time_zone_id: string;
}

export interface CompatibilityResponse {
  generated_at_utc: string;
  primary_client: ClientProfile;
  partner_client: ClientProfile;
  compatibility_score: number;
  summary: string;
  themes: CompatibilityTheme[];
  synastry_aspects: SynastryAspectInfo[];
  saved_comparison_id: string | null;
}

export interface BirthDetailsInput {
  name: string;
  birth_date: string;
  birth_time: string;
  engine_id?: string;
  timezone_offset_minutes: number;
  latitude: number;
  longitude: number;
  country?: string;
  state?: string;
  city?: string;
  town?: string;
  time_zone_id?: string;
}

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const SIGN_ELEMENTS: Record<string, string> = {
  Aries: "Fire", Leo: "Fire", Sagittarius: "Fire",
  Taurus: "Earth", Virgo: "Earth", Capricorn: "Earth",
  Gemini: "Air", Libra: "Air", Aquarius: "Air",
  Cancer: "Water", Scorpio: "Water", Pisces: "Water",
};

const ASPECT_DEFS: Record<string, [number, number]> = {
  Conjunction: [0, 8],
  Opposition: [180, 8],
  Trine: [120, 8],
  Square: [90, 7],
  Sextile: [60, 6],
};

const HARMONIOUS = new Set(["Conjunction", "Trine", "Sextile"]);
const PRIORITY_PLANETS = new Set(["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"]);

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function angleBetween(lon1: number, lon2: number): number {
  const diff = Math.abs(lon1 - lon2) % 360;
  return diff <= 180 ? diff : 360 - diff;
}

function buildSynastryAspects(
  primaryPlanets: PlanetPosition[],
  partnerPlanets: PlanetPosition[]
): SynastryAspectInfo[] {
  const aspects: SynastryAspectInfo[] = [];

  for (const primary of primaryPlanets) {
    if (!PRIORITY_PLANETS.has(primary.name)) continue;
    for (const partner of partnerPlanets) {
      if (!PRIORITY_PLANETS.has(partner.name)) continue;

      const angle = angleBetween(primary.longitude, partner.longitude);
      for (const [aspectType, [target, maxOrb]] of Object.entries(ASPECT_DEFS)) {
        const orb = Math.abs(angle - target);
        if (orb <= maxOrb) {
          aspects.push({
            primary_planet: primary.name,
            partner_planet: partner.name,
            aspect_type: aspectType,
            orb: Math.round(orb * 10000) / 10000,
            harmonious: HARMONIOUS.has(aspectType),
          });
          break; // Only the first matching aspect per pair
        }
      }
    }
  }

  aspects.sort((a, b) => a.orb - b.orb);
  return aspects.slice(0, 18);
}

function clientProfileFromBirth(birth: BirthDetailsInput): ClientProfile {
  return {
    name: birth.name,
    country: birth.country ?? "",
    state: birth.state ?? "",
    city: birth.city ?? "",
    town: birth.town ?? "",
    latitude: birth.latitude,
    longitude: birth.longitude,
    timezone_offset_minutes: birth.timezone_offset_minutes,
    time_zone_id: birth.time_zone_id ?? "",
  };
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

export function buildCompatibility(
  primary: BirthDetailsInput,
  partner: BirthDetailsInput
): CompatibilityResponse {
  const primaryChart = buildChart(primary, {
    includeTransits: false,
    includePremium: false,
    includeUltimate: false,
    subscriptionTier: "premium",
  });
  const partnerChart = buildChart(partner, {
    includeTransits: false,
    includePremium: false,
    includeUltimate: false,
    subscriptionTier: "premium",
  });

  const synastryAspects = buildSynastryAspects(
    primaryChart.chart.planets,
    partnerChart.chart.planets
  );

  const primaryMoon = primaryChart.chart.planets.find((p) => p.name === "Moon")!;
  const partnerMoon = partnerChart.chart.planets.find((p) => p.name === "Moon")!;
  const primarySun = primaryChart.chart.planets.find((p) => p.name === "Sun")!;
  const partnerSun = partnerChart.chart.planets.find((p) => p.name === "Sun")!;
  const primaryVenus = primaryChart.chart.planets.find((p) => p.name === "Venus")!;
  const partnerMars = partnerChart.chart.planets.find((p) => p.name === "Mars")!;
  const primaryMercury = primaryChart.chart.planets.find((p) => p.name === "Mercury")!;
  const partnerMercury = partnerChart.chart.planets.find((p) => p.name === "Mercury")!;

  const harmoniousCount = synastryAspects.filter((a) => a.harmonious).length;
  const tenseCount = synastryAspects.length - harmoniousCount;

  let score = 58;
  if (SIGN_ELEMENTS[primaryMoon.sign] === SIGN_ELEMENTS[partnerMoon.sign]) score += 12;
  if (SIGN_ELEMENTS[primarySun.sign] === SIGN_ELEMENTS[partnerSun.sign]) score += 8;

  const venusMarsLink = synastryAspects.find(
    (a) => a.primary_planet === "Venus" && a.partner_planet === "Mars"
  );
  if (venusMarsLink) {
    score += venusMarsLink.harmonious ? 14 : -8;
  }

  const moonLinks = synastryAspects.filter((a) => {
    const pair = new Set([a.primary_planet, a.partner_planet]);
    return pair.has("Moon") || pair.has("Sun");
  });
  if (moonLinks.some((a) => a.harmonious)) score += 10;

  const mercuryLink = synastryAspects.find(
    (a) => a.primary_planet === "Mercury" && a.partner_planet === "Mercury"
  );
  if (mercuryLink) {
    score += mercuryLink.harmonious ? 8 : -5;
  }

  score += harmoniousCount * 1.5;
  score -= tenseCount * 1.2;
  score = Math.max(20, Math.min(98, Math.round(score * 10) / 10));

  const themes: CompatibilityTheme[] = [
    {
      title: "Emotional Rhythm",
      insight: `${primary.name}'s Moon in ${primaryMoon.sign} meets ${partner.name}'s Moon in ${partnerMoon.sign}. Both charts lean into ${SIGN_ELEMENTS[primaryMoon.sign].toLowerCase()} and ${SIGN_ELEMENTS[partnerMoon.sign].toLowerCase()} emotional styles, which shapes how safety and closeness are built.`,
      confidence_score: 0.86,
    },
    {
      title: "Attraction Pattern",
      insight: `${primary.name}'s Venus in ${primaryVenus.sign} and ${partner.name}'s Mars in ${partnerMars.sign} show the chemistry between affection and desire. Harmonious contact increases natural pull; harder contact creates heat that needs maturity.`,
      confidence_score: 0.82,
    },
    {
      title: "Communication Style",
      insight: `Mercury links between ${primary.name} and ${partner.name} indicate how quickly misunderstandings get resolved. With Mercury in ${primaryMercury.sign} and ${partnerMercury.sign}, clarity depends on whether both people process feelings through the same element.`,
      confidence_score: 0.74,
    },
  ];

  if (tenseCount > harmoniousCount) {
    themes.push({
      title: "Growth Edge",
      insight: "This pairing has real magnetism, but it also carries enough friction that conscious communication and pacing matter. The bond improves when both people build structure around conflict instead of relying on chemistry alone.",
      confidence_score: 0.77,
    });
  } else {
    themes.push({
      title: "Long-Term Potential",
      insight: "The synastry leans more supportive than difficult, which usually means this connection has enough ease to grow. Shared rituals, emotional honesty, and clear commitments can turn attraction into durability.",
      confidence_score: 0.79,
    });
  }

  const summary = `${primary.name} and ${partner.name} show a compatibility score of ${score.toFixed(1)}/100. The connection is shaped by ${harmoniousCount} supportive synastry contacts and ${tenseCount} high-friction contacts.`;

  return {
    generated_at_utc: new Date().toISOString(),
    primary_client: clientProfileFromBirth(primary),
    partner_client: clientProfileFromBirth(partner),
    compatibility_score: score,
    summary,
    themes,
    synastry_aspects: synastryAspects,
    saved_comparison_id: null,
  };
}
