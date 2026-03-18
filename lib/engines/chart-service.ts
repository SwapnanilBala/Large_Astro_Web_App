
import {
  calculate,
  computeTransitPositions,
  type PlanetPosition,
  type HousePlacement,
  type AscendantData,
} from "./swiss-ephemeris-engine";
import { generateRules, generateLifeDomainInsights, HOUSE_THEMES } from "./rule-engine";
import type { DeterministicRule, LifeDomainInsight } from "./rule-engine";
import {
  calculateNakshatra,
  calculateDashaTimeline,
  DASHA_YEARS,
  NAKSHATRA_SPAN,
  YEAR_DAYS,
} from "./nakshatra-engine";
import type { NakshatraData } from "./nakshatra-engine";
import { calculateAspects } from "./aspect-engine";
import { calculateNavamsa } from "./navamsa-engine";
import { computeTransitAspects } from "./transit-engine";
import { detectYogas } from "./yoga-engine";
import type { YogaDetectionResult } from "./yoga-engine";
import {
  getEnginePreset,
  listEnginePresets,
  presetToMetadata,
  type EnginePreset,
} from "./engine-registry";
import type { BirthDetailsInput } from "./compatibility-service";

// --------------------------------------------------------------------------
// Response types (matching ChartApiResponse in astro-types.ts)
// --------------------------------------------------------------------------

export interface ChartResponse {
  generated_at_utc: string;
  client: {
    name: string;
    country: string;
    state: string;
    city: string;
    town: string;
    latitude: number;
    longitude: number;
    timezone_offset_minutes: number;
    time_zone_id: string;
  };
  chart: {
    julian_day_ut: number;
    ascendant: AscendantData;
    planets: PlanetPosition[];
    houses: HousePlacement[];
    deterministic_rules: DeterministicRule[];
    summary: string;
    nakshatra?: {
      name: string;
      index: number;
      lord: string;
      pada: number;
      degree_in_nakshatra: number;
    } | null;
    dasha?: {
      current_dasha: string;
      current_antardasha: string;
      current_dasha_start: string;
      current_dasha_end: string;
      current_antardasha_start: string;
      current_antardasha_end: string;
      periods: Array<{
        planet: string;
        start_date: string;
        end_date: string;
        years: number;
        sequence_start_date?: string;
        sequence_end_date?: string;
        is_partial?: boolean;
      }>;
    } | null;
    calculation_audit?: Record<string, unknown> | null;
    aspects?: Array<{
      planet1: string;
      planet2: string;
      aspect_type: string;
      exact_angle: number;
      orb: number;
      applying: boolean;
      vedic: boolean;
    }> | null;
    navamsa?: Array<{
      name: string;
      rashi_sign: string;
      navamsa_sign: string;
      navamsa_division: number;
    }> | null;
    life_domain_insights?: LifeDomainInsight[] | null;
    yogas?: YogaDetectionResult[] | null;
  };
  engine: {
    engine_id: string;
    engine_label: string;
    ephemeris_provider: string;
    ayanamsha: string;
    house_system: string;
    fallback_mode: boolean;
    available_engines: Array<{
      engine_id: string;
      label: string;
      ayanamsha: string;
      house_system: string;
      description: string;
    }>;
  };
  storage: {
    configured: boolean;
    persisted: boolean;
    message: string;
  };
  access: {
    subscription_tier: string;
    premium_features_enabled: boolean;
    ultimate_features_enabled: boolean;
    locked_features: string[];
  };
  transits?: {
    computed_at_utc: string;
    positions: Array<{
      name: string;
      longitude: number;
      sign: string;
      degree_in_sign: number;
    }>;
    active_aspects: Array<{
      transit_planet: string;
      natal_planet: string;
      aspect_type: string;
      orb: number;
    }>;
  } | null;
}

export interface ForecastReading {
  target_date: string;
  headline: string;
  overview: string;
  dasha: NonNullable<ChartResponse["chart"]["dasha"]>;
  focus_areas: string[];
  opportunities: string[];
  cautions: string[];
  supportive_transits: ForecastAspectInsight[];
  challenging_transits: ForecastAspectInsight[];
}

interface ForecastAspectInsight {
  transit_planet: string;
  natal_planet: string;
  aspect_type: string;
  orb: number;
  tone: "supportive" | "challenging" | "mixed";
  interpretation: string;
}

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const PREMIUM_FEATURES = [
  "nakshatra_dasha",
  "planetary_aspects",
  "navamsa_d9",
  "live_transits",
];
const ULTIMATE_FEATURES = ["life_domain_readings"];

const PLANET_THEMES: Record<string, string> = {
  Sun: "identity, confidence, leadership, and visibility",
  Moon: "emotions, home life, and inner steadiness",
  Mars: "drive, conflict tolerance, and decisive action",
  Mercury: "learning, negotiation, trade, and communication",
  Jupiter: "growth, wisdom, guidance, and opportunity",
  Venus: "relationships, pleasure, money flow, and aesthetics",
  Saturn: "discipline, duty, structure, and long-range results",
  Rahu: "ambition, disruption, foreign links, and unconventional openings",
  Ketu: "release, spiritualization, detachment, and inner reset",
};

const DASHA_FORECAST_THEMES: Record<
  string,
  { focus: string; opportunity: string; caution: string }
> = {
  Sun: {
    focus: "visibility, leadership, and self-definition",
    opportunity: "Take ownership of decisions that need clarity, authority, and cleaner positioning.",
    caution: "Do not let ego battles or overexertion drain momentum that should be invested in durable progress.",
  },
  Moon: {
    focus: "emotional life, family patterns, and responsiveness",
    opportunity: "Strengthen home rhythms, emotional support, and work that depends on public trust or care.",
    caution: "Mood-led decisions and overstretching for others can blur judgment if rest is inconsistent.",
  },
  Mars: {
    focus: "action, competition, initiative, and courage",
    opportunity: "Push into tasks that reward bold execution, technical effort, and direct problem-solving.",
    caution: "Watch impatience, reactive speech, conflict escalation, and physically draining overcommitment.",
  },
  Mercury: {
    focus: "strategy, communication, education, and commerce",
    opportunity: "This is useful for writing, planning, study, trade, interviews, and clearer deal-making.",
    caution: "Scattered focus, overanalysis, or saying yes too quickly can create avoidable noise.",
  },
  Jupiter: {
    focus: "growth, guidance, faith, and higher opportunity",
    opportunity: "Lean into teaching, mentorship, planning, and long-horizon decisions that need wisdom.",
    caution: "Optimism still needs structure; avoid assuming expansion is automatically sustainable.",
  },
  Venus: {
    focus: "relationships, comfort, resources, and artistry",
    opportunity: "Favorable for alliances, attraction, aesthetics, and improving lifestyle quality with intention.",
    caution: "Pleasure spending, passive avoidance, or idealizing people can weaken the practical signal.",
  },
  Saturn: {
    focus: "discipline, karma, responsibility, and endurance",
    opportunity: "Work that needs consistency, maturity, and long-range restructuring can deepen substantially here.",
    caution: "Delays are not always denials, but bitterness, exhaustion, and rigid thinking need active management.",
  },
  Rahu: {
    focus: "ambition, sudden openings, innovation, and appetite",
    opportunity: "Foreign links, technology, reinvention, and unconventional pathways can produce sharp breakthroughs.",
    caution: "Be extra careful with obsession, mixed signals, risky shortcuts, and people who oversell certainty.",
  },
  Ketu: {
    focus: "detachment, inner realignment, closure, and spiritual pruning",
    opportunity: "Excellent for stepping back, refining intuition, and releasing patterns that no longer fit.",
    caution: "Withdrawal, confusion, and loss of worldly motivation can appear if grounding routines are neglected.",
  },
};

const ASPECT_TONES: Record<string, string> = {
  Trine: "supportive",
  Sextile: "supportive",
  Square: "challenging",
  Opposition: "challenging",
  Conjunction: "mixed",
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
  // birth_date: "YYYY-MM-DD", birth_time: "HH:MM" or "HH:MM:SS"
  const [y, m, d] = birth.birth_date.split("-").map(Number);
  const timeParts = birth.birth_time.split(":").map(Number);
  const hour = timeParts[0] ?? 0;
  const minute = timeParts[1] ?? 0;
  const second = timeParts[2] ?? 0;

  // Convert local to UTC using timezone_offset_minutes
  const localTotalMinutes = hour * 60 + minute;
  const utcTotalMinutes = localTotalMinutes - (birth.timezone_offset_minutes ?? 0);

  // Create a date and adjust
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

function birthLocalMomentStr(birth: BirthDetailsInput): string {
  // Returns "YYYY-MM-DD" of the birth date
  return birth.birth_date;
}

function currentLocalDateStr(birth: BirthDetailsInput): string {
  // Approximate current local time from UTC + offset
  const now = new Date();
  const localMs = now.getTime() + (birth.timezone_offset_minutes ?? 0) * 60000;
  const local = new Date(localMs);
  return local.toISOString().split("T")[0];
}

function isoMinute(date: Date): string {
  return date.toISOString().replace(/:\d{2}\.\d{3}Z$/, "").replace("Z", "");
}

function aspectTone(transitPlanet: string, aspectType: string): string {
  if (aspectType === "Conjunction") {
    if (["Jupiter", "Venus"].includes(transitPlanet)) return "supportive";
    if (["Saturn", "Mars", "Rahu", "Ketu"].includes(transitPlanet)) return "challenging";
  }
  return ASPECT_TONES[aspectType] ?? "mixed";
}

function forecastAspectInterpretation(
  transitPlanet: string,
  aspectType: string,
  natalPlanet: string
): string {
  const natalTheme = PLANET_THEMES[natalPlanet] ?? "that area of life";
  const tone = aspectTone(transitPlanet, aspectType);
  if (tone === "supportive") {
    return `${transitPlanet} ${aspectType.toLowerCase()} natal ${natalPlanet} supports ${natalTheme} with cleaner timing and less friction than usual.`;
  }
  if (tone === "challenging") {
    return `${transitPlanet} ${aspectType.toLowerCase()} natal ${natalPlanet} puts pressure on ${natalTheme}, so pacing and judgment matter more than speed.`;
  }
  return `${transitPlanet} ${aspectType.toLowerCase()} natal ${natalPlanet} strongly activates ${natalTheme}; the outcome depends on how deliberately you handle the surge.`;
}

function toForecastAspect(
  ta: { transit_planet: string; natal_planet: string; aspect_type: string; orb: number }
): ForecastAspectInsight {
  const tone = aspectTone(ta.transit_planet, ta.aspect_type) as ForecastAspectInsight["tone"];
  return {
    transit_planet: ta.transit_planet,
    natal_planet: ta.natal_planet,
    aspect_type: ta.aspect_type,
    orb: ta.orb,
    tone,
    interpretation: forecastAspectInterpretation(
      ta.transit_planet,
      ta.aspect_type,
      ta.natal_planet
    ),
  };
}

// --------------------------------------------------------------------------
// Build chart
// --------------------------------------------------------------------------

export interface BuildChartOptions {
  includeTransits?: boolean;
  includePremium?: boolean;
  includeUltimate?: boolean;
  subscriptionTier?: string;
}

export function buildChart(
  birth: BirthDetailsInput,
  options: BuildChartOptions = {}
): ChartResponse {
  const {
    includeTransits = false,
    includePremium = true,
    includeUltimate = false,
    subscriptionTier = "guest",
  } = options;

  const preset = getEnginePreset(birth.engine_id);
  const utc = parseBirthUTC(birth);
  const computed = calculate({
    ...utc,
    latitude: birth.latitude,
    longitude: birth.longitude,
    engine_id: birth.engine_id,
  });

  const currentLocalStr = currentLocalDateStr(birth);
  const birthLocalStr = birthLocalMomentStr(birth);

  const { rules, summary } = generateRules(
    computed.ascendant.sign,
    computed.planets,
    computed.houses
  );

  let nakshatraInfo: ChartResponse["chart"]["nakshatra"] = null;
  let dashaInfo: ChartResponse["chart"]["dasha"] = null;
  let calculationAudit: Record<string, unknown> | null = null;
  let aspectsInfo: ChartResponse["chart"]["aspects"] = null;
  let navamsaInfo: ChartResponse["chart"]["navamsa"] = null;
  let lifeDomainInsights: LifeDomainInsight[] | null = null;
  let yogasInfo: YogaDetectionResult[] | null = null;

  if (includePremium) {
    // Nakshatra & Dasha
    const moon = computed.planets.find((p) => p.name === "Moon")!;
    const nakData = calculateNakshatra(moon.longitude);
    const dashaTimeline = calculateDashaTimeline(
      nakData,
      birthLocalStr,
      currentLocalStr
    );

    nakshatraInfo = {
      name: nakData.name,
      index: nakData.index,
      lord: nakData.lord,
      pada: nakData.pada,
      degree_in_nakshatra: Math.round(nakData.degree_in_nakshatra * 10000) / 10000,
    };

    dashaInfo = {
      current_dasha: dashaTimeline.current_dasha?.planet ?? "Unknown",
      current_antardasha: dashaTimeline.current_antardasha?.sub_lord ?? "Unknown",
      current_dasha_start: dashaTimeline.current_dasha_start ?? "",
      current_dasha_end: dashaTimeline.current_dasha_end ?? "",
      current_antardasha_start: dashaTimeline.current_antardasha_start ?? "",
      current_antardasha_end: dashaTimeline.current_antardasha_end ?? "",
      periods: dashaTimeline.periods.map((p) => ({
        planet: p.planet,
        start_date: p.start_date,
        end_date: p.end_date,
        years: p.years,
        sequence_start_date: p.sequence_start_date,
        sequence_end_date: p.sequence_end_date,
        is_partial: p.is_partial,
      })),
    };

    // Calculation audit
    const fractionElapsed = nakData.degree_in_nakshatra / NAKSHATRA_SPAN;
    const dashaSeedTotalYears = DASHA_YEARS[nakData.lord];
    const dashaSeedElapsedYears = fractionElapsed * dashaSeedTotalYears;
    const dashaSeedRemainingYears = Math.max(dashaSeedTotalYears - dashaSeedElapsedYears, 0);

    // Build local/utc dates for audit
    const birthLocalDate = new Date(birth.birth_date + "T" + birth.birth_time + ":00");
    const birthUtcDate = new Date(
      birthLocalDate.getTime() - (birth.timezone_offset_minutes ?? 0) * 60000
    );
    const nowUtc = new Date();
    const nowLocal = new Date(
      nowUtc.getTime() + (birth.timezone_offset_minutes ?? 0) * 60000
    );

    const dashaSeedStartLocal = new Date(
      birthLocalDate.getTime() - dashaSeedElapsedYears * YEAR_DAYS * 86400000
    );
    const dashaSeedEndLocal = new Date(
      dashaSeedStartLocal.getTime() + dashaSeedTotalYears * YEAR_DAYS * 86400000
    );

    calculationAudit = {
      engine_id: preset.engine_id,
      engine_label: preset.label,
      ayanamsha: preset.ayanamsha,
      house_system: preset.house_system,
      time_zone_id: birth.time_zone_id ?? "",
      timezone_offset_minutes: birth.timezone_offset_minutes,
      latitude: Math.round(birth.latitude * 1000000) / 1000000,
      longitude: Math.round(birth.longitude * 1000000) / 1000000,
      birth_local_iso: isoMinute(birthLocalDate),
      birth_utc_iso: isoMinute(birthUtcDate),
      reference_local_iso: isoMinute(nowLocal),
      reference_utc_iso: isoMinute(nowUtc),
      moon_sidereal_longitude: moon.longitude,
      moon_sign: moon.sign,
      moon_degree_in_sign: moon.degree_in_sign,
      nakshatra_name: nakData.name,
      nakshatra_lord: nakData.lord,
      nakshatra_pada: nakData.pada,
      degree_in_nakshatra: Math.round(nakData.degree_in_nakshatra * 10000) / 10000,
      nakshatra_progress_percent: Math.round(fractionElapsed * 10000) / 100,
      dasha_seed_lord: nakData.lord,
      dasha_seed_total_years: Math.round(dashaSeedTotalYears * 100) / 100,
      dasha_seed_elapsed_years: Math.round(dashaSeedElapsedYears * 100) / 100,
      dasha_seed_remaining_years: Math.round(dashaSeedRemainingYears * 100) / 100,
      dasha_seed_start_local_iso: isoMinute(dashaSeedStartLocal),
      dasha_seed_end_local_iso: isoMinute(dashaSeedEndLocal),
    };

    // Aspects
    aspectsInfo = calculateAspects(computed.planets).map((a) => ({
      planet1: a.planet1,
      planet2: a.planet2,
      aspect_type: a.aspect_type,
      exact_angle: a.exact_angle,
      orb: a.orb,
      applying: a.applying,
      vedic: a.vedic,
    }));

    // Navamsa
    navamsaInfo = calculateNavamsa(computed.planets).map((n) => ({
      name: n.name,
      rashi_sign: n.rashi_sign,
      navamsa_sign: n.navamsa_sign,
      navamsa_division: n.navamsa_division,
    }));

    // Yogas
    yogasInfo = detectYogas({
      planets: computed.planets,
      houses: computed.houses,
      ascendantSign: computed.ascendant.sign,
    });
  }

  if (includeUltimate) {
    lifeDomainInsights = generateLifeDomainInsights(
      computed.ascendant.sign,
      computed.planets,
      computed.houses
    );
  }

  // Transits
  let transitsData: ChartResponse["transits"] = null;
  if (includePremium && includeTransits) {
    const transitPositions = computeTransitPositions(new Date(), birth.engine_id);
    const transitAspects = computeTransitAspects(computed.planets, transitPositions);
    transitsData = {
      computed_at_utc: new Date().toISOString(),
      positions: transitPositions.map((tp) => ({
        name: tp.name,
        longitude: tp.longitude,
        sign: tp.sign,
        degree_in_sign: tp.degree_in_sign,
      })),
      active_aspects: transitAspects.map((ta) => ({
        transit_planet: ta.transit_planet,
        natal_planet: ta.natal_planet,
        aspect_type: ta.aspect_type,
        orb: ta.orb,
      })),
    };
  }

  // Locked features
  const lockedFeatures: string[] = [];
  if (!includePremium) lockedFeatures.push(...PREMIUM_FEATURES);
  if (!includeUltimate) lockedFeatures.push(...ULTIMATE_FEATURES);

  return {
    generated_at_utc: new Date().toISOString(),
    client: {
      name: birth.name,
      country: birth.country ?? "",
      state: birth.state ?? "",
      city: birth.city ?? "",
      town: birth.town ?? "",
      latitude: birth.latitude,
      longitude: birth.longitude,
      timezone_offset_minutes: birth.timezone_offset_minutes,
      time_zone_id: birth.time_zone_id ?? "",
    },
    chart: {
      julian_day_ut: computed.julian_day_ut,
      ascendant: computed.ascendant,
      planets: computed.planets,
      houses: computed.houses,
      deterministic_rules: rules,
      summary,
      nakshatra: nakshatraInfo,
      dasha: dashaInfo,
      calculation_audit: calculationAudit,
      aspects: aspectsInfo,
      navamsa: navamsaInfo,
      life_domain_insights: lifeDomainInsights,
      yogas: yogasInfo,
    },
    engine: {
      engine_id: preset.engine_id,
      engine_label: preset.label,
      ephemeris_provider: "astronomy-engine (pure JS)",
      ayanamsha: preset.ayanamsha,
      house_system: preset.house_system,
      fallback_mode: computed.fallback_mode,
      available_engines: listEnginePresets().map(presetToMetadata),
    },
    storage: {
      configured: false,
      persisted: false,
      message:
        "Persistence is disabled in the chart engine. Save charts and workspace records through the Next.js app's Supabase layer.",
    },
    access: {
      subscription_tier: subscriptionTier,
      premium_features_enabled: includePremium,
      ultimate_features_enabled: includeUltimate,
      locked_features: lockedFeatures,
    },
    transits: transitsData,
  };
}

// --------------------------------------------------------------------------
// Build forecast
// --------------------------------------------------------------------------

export function buildForecast(
  birth: BirthDetailsInput,
  targetDateStr: string
): ForecastReading {
  const preset = getEnginePreset(birth.engine_id);
  const utc = parseBirthUTC(birth);
  const computed = calculate({
    ...utc,
    latitude: birth.latitude,
    longitude: birth.longitude,
    engine_id: birth.engine_id,
  });

  const birthLocalStr = birthLocalMomentStr(birth);

  // Build nakshatra/dasha for target date
  const moon = computed.planets.find((p) => p.name === "Moon")!;
  const nakData = calculateNakshatra(moon.longitude);
  const dashaTimeline = calculateDashaTimeline(nakData, birthLocalStr, targetDateStr);

  const dashaInfo = {
    current_dasha: dashaTimeline.current_dasha?.planet ?? "Unknown",
    current_antardasha: dashaTimeline.current_antardasha?.sub_lord ?? "Unknown",
    current_dasha_start: dashaTimeline.current_dasha_start ?? "",
    current_dasha_end: dashaTimeline.current_dasha_end ?? "",
    current_antardasha_start: dashaTimeline.current_antardasha_start ?? "",
    current_antardasha_end: dashaTimeline.current_antardasha_end ?? "",
    periods: dashaTimeline.periods.map((p) => ({
      planet: p.planet,
      start_date: p.start_date,
      end_date: p.end_date,
      years: p.years,
      sequence_start_date: p.sequence_start_date,
      sequence_end_date: p.sequence_end_date,
      is_partial: p.is_partial,
    })),
  };

  // Transit positions for target date at noon UTC (approximate)
  const targetDate = new Date(targetDateStr + "T12:00:00Z");
  // Adjust to UTC
  const targetUtc = new Date(
    targetDate.getTime() - (birth.timezone_offset_minutes ?? 0) * 60000
  );

  const transitPositions = computeTransitPositions(targetUtc, birth.engine_id);
  const transitAspects = computeTransitAspects(computed.planets, transitPositions).map(
    (a) => ({
      transit_planet: a.transit_planet,
      natal_planet: a.natal_planet,
      aspect_type: a.aspect_type,
      orb: a.orb,
    })
  );

  const supportiveTransits = transitAspects
    .filter((a) => aspectTone(a.transit_planet, a.aspect_type) === "supportive")
    .slice(0, 3)
    .map(toForecastAspect);

  const challengingTransits = transitAspects
    .filter((a) => aspectTone(a.transit_planet, a.aspect_type) === "challenging")
    .slice(0, 3)
    .map(toForecastAspect);

  const currentDashaPlanet = computed.planets.find(
    (p) => p.name === dashaInfo.current_dasha
  )!;
  const currentAntardashaPlanet = computed.planets.find(
    (p) => p.name === dashaInfo.current_antardasha
  )!;
  const dashaTheme = DASHA_FORECAST_THEMES[dashaInfo.current_dasha];
  const antardashaTheme = DASHA_FORECAST_THEMES[dashaInfo.current_antardasha];

  const focusAreas: string[] = [
    `${dashaInfo.current_dasha} Mahadasha keeps the long-range focus on ${HOUSE_THEMES[currentDashaPlanet.house]} via natal house ${currentDashaPlanet.house}.`,
    `${dashaInfo.current_antardasha} Antardasha sharpens the near-term story around ${HOUSE_THEMES[currentAntardashaPlanet.house]} via natal house ${currentAntardashaPlanet.house}.`,
  ];
  if (supportiveTransits.length > 0) focusAreas.push(supportiveTransits[0].interpretation);
  if (challengingTransits.length > 0) focusAreas.push(challengingTransits[0].interpretation);

  const opportunities: string[] = [
    dashaTheme.opportunity,
    antardashaTheme.opportunity,
  ];
  if (supportiveTransits.length > 0) {
    opportunities.push(...supportiveTransits.slice(0, 2).map((t) => t.interpretation));
  }

  const cautions: string[] = [
    dashaTheme.caution,
    antardashaTheme.caution,
  ];
  if (challengingTransits.length > 0) {
    cautions.push(...challengingTransits.slice(0, 2).map((t) => t.interpretation));
  }

  const headline = `${targetDateStr} falls in ${dashaInfo.current_dasha} / ${dashaInfo.current_antardasha}, a period centered on ${antardashaTheme.focus}.`;
  const overview =
    `On ${targetDateStr}, the broader timing cycle emphasizes ${dashaTheme.focus}, ` +
    `while the active sub-period concentrates on ${antardashaTheme.focus}. ` +
    `Natal house activation points toward ${HOUSE_THEMES[currentDashaPlanet.house]} and ` +
    `${HOUSE_THEMES[currentAntardashaPlanet.house]}, so this is best handled as a period of ` +
    `purposeful adjustment rather than passive waiting.`;

  return {
    target_date: targetDateStr,
    headline,
    overview,
    dasha: dashaInfo,
    focus_areas: focusAreas.slice(0, 4),
    opportunities: opportunities.slice(0, 4),
    cautions: cautions.slice(0, 4),
    supportive_transits: supportiveTransits,
    challenging_transits: challengingTransits,
  };
}
