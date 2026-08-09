
import {
  calculate,
  computeTransitPositions,
  type PlanetPosition,
  type HousePlacement,
  type AscendantData,
  type SwissEngineResult,
} from "./swiss-ephemeris-engine";
import {
  generateRules,
  generateLifeDomainInsights,
  selectedRuleIds,
  rulesDatasetVersion,
  HOUSE_THEMES,
} from "./rule-engine";
import type { DeterministicRule, LifeDomainInsight } from "./rule-engine";
import { RULES_SCHEMA_VERSION } from "@/lib/rules";
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
import { computeMultipleDivisionalCharts } from "./divisional-engine";
import type { DivisionalChartResult } from "./divisional-engine";
import { computeTransitAspects } from "./transit-engine";
import { calculateShadbala } from "./shadbala-engine";
import type { ShadbalaResult } from "./shadbala-engine";
import { detectYogas } from "./yoga-engine";
import type { YogaDetectionResult } from "./yoga-engine";
import { computeAshtakavarga } from "./ashtakavarga-engine";
import type { AshtakavargaResult } from "./ashtakavarga-engine";
import {
  getEnginePreset,
  listEnginePresets,
  presetToMetadata,
  type EnginePreset,
} from "./engine-registry";
import type { BirthDetailsInput } from "./compatibility-service";
import { computeLuckyElements } from "./lucky-elements-engine";
import { ServerCache, makeCacheKey } from "../server-cache";

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
    house_cusps?: number[];
    deterministic_rules: DeterministicRule[];
    /** Rank-ordered instance_keys of the selected rules. Length <= topN. */
    selected_rule_ids: string[];
    /** Mirrors rarity.json's version, so a stale cached payload is detectable. */
    rules_dataset_version: string;
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
      current_pratyantar?: string;
      current_pratyantar_start?: string;
      current_pratyantar_end?: string;
      pratyantar_periods?: Array<{
        planet: string;
        start_date: string;
        end_date: string;
        years: number;
      }>;
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
    divisional_charts?: Record<number, {
      division: number;
      label: string;
      description: string;
      positions: Array<{
        name: string;
        rashi_sign: string;
        divisional_sign: string;
        division_number: number;
      }>;
    }> | null;
    life_domain_insights?: LifeDomainInsight[] | null;
    shadbala?: ShadbalaResult[] | null;
    yogas?: YogaDetectionResult[] | null;
    lucky_elements?: import("@/lib/astro-types").LuckyElementsInfo | null;
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
  ashtakavarga?: AshtakavargaResult | null;
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
  "divisional_charts",
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
// Stage-level cache instances (survive hot-reload via globalThis)
// --------------------------------------------------------------------------

const STAGE_CACHE_KEY = "__chartStageCaches";
const DAY_MS = 24 * 60 * 60 * 1000;

interface StageCaches {
  positions: ServerCache<CorePositionsResult>;
  dasha: ServerCache<DashaStageResult>;
  aspects: ServerCache<AspectStageResult>;
  navamsa: ServerCache<NavamsaStageResult>;
  insights: ServerCache<InsightsStageResult>;
}

function createStageCaches(): StageCaches {
  return {
    // Renamed alongside the rule-shape change so an already-warm process
    // starts cold rather than serving pre-migration rule objects.
    positions: new ServerCache<CorePositionsResult>("stage_positions_v2", 500, DAY_MS),
    dasha: new ServerCache<DashaStageResult>("stage_dasha", 300, DAY_MS),
    aspects: new ServerCache<AspectStageResult>("stage_aspects", 300, DAY_MS),
    navamsa: new ServerCache<NavamsaStageResult>("stage_navamsa", 300, DAY_MS),
    insights: new ServerCache<InsightsStageResult>("stage_insights", 300, DAY_MS),
  };
}

const sg = globalThis as unknown as Record<string, StageCaches>;
if (!sg[STAGE_CACHE_KEY]) {
  sg[STAGE_CACHE_KEY] = createStageCaches();
}
const stageCaches: StageCaches = sg[STAGE_CACHE_KEY];

// --------------------------------------------------------------------------
// Stage result types
// --------------------------------------------------------------------------

interface CorePositionsResult {
  julian_day_ut: number;
  ascendant: AscendantData;
  planets: PlanetPosition[];
  houses: HousePlacement[];
  house_cusps?: number[];
  fallback_mode: boolean;
  rules: DeterministicRule[];
  summary: string;
}

interface DashaStageResult {
  nakshatraInfo: NonNullable<ChartResponse["chart"]["nakshatra"]>;
  dashaInfo: NonNullable<ChartResponse["chart"]["dasha"]>;
  calculationAudit: Record<string, unknown>;
}

type AspectStageResult = NonNullable<ChartResponse["chart"]["aspects"]>;

type NavamsaStageResult = NonNullable<ChartResponse["chart"]["navamsa"]>;

interface InsightsStageResult {
  lifeDomainInsights: LifeDomainInsight[];
}

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

/**
 * Simple djb2 hash of a string of planet longitudes, used for cache keys
 * that depend on the computed positions rather than birth input.
 */
function hashLongitudes(planets: PlanetPosition[]): string {
  const raw = planets.map((p) => p.longitude.toFixed(4)).join(",");
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash + raw.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

// --------------------------------------------------------------------------
// Stage A: Core positions (planets, houses, ascendant, rules)
// --------------------------------------------------------------------------

function computeCorePositions(birth: BirthDetailsInput): CorePositionsResult {
  // RULES_SCHEMA_VERSION is load-bearing, not decorative. This stage holds
  // rule output for 24 hours; without it, a payload-cache miss two hours after
  // a deploy rebuilds from day-old cached rules and republishes the old shape
  // into a fresh entry, and consumers reading display.headline get undefined.
  const cacheKey = makeCacheKey("pos", {
    birth_date: birth.birth_date,
    birth_time: birth.birth_time,
    tz: birth.timezone_offset_minutes,
    lat: birth.latitude,
    lng: birth.longitude,
    engine_id: birth.engine_id ?? "lahiri_classic",
    rules_schema: RULES_SCHEMA_VERSION,
  });

  const cached = stageCaches.positions.get(cacheKey);
  if (cached) return cached;

  const utc = parseBirthUTC(birth);
  const computed = calculate({
    ...utc,
    latitude: birth.latitude,
    longitude: birth.longitude,
    engine_id: birth.engine_id,
  });

  const { rules, summary } = generateRules(
    computed.ascendant.sign,
    computed.planets,
    computed.houses
  );

  const result: CorePositionsResult = {
    julian_day_ut: computed.julian_day_ut,
    ascendant: computed.ascendant,
    planets: computed.planets,
    houses: computed.houses,
    house_cusps: computed.house_cusps,
    fallback_mode: computed.fallback_mode,
    rules,
    summary,
  };

  stageCaches.positions.set(cacheKey, result);
  return result;
}

// --------------------------------------------------------------------------
// Stage B: Dasha timeline (nakshatra + dasha periods + calculation audit)
// --------------------------------------------------------------------------

function computeDashaTimeline(
  birth: BirthDetailsInput,
  planets: PlanetPosition[],
  currentLocalStr: string,
): DashaStageResult {
  const moon = planets.find((p) => p.name === "Moon")!;
  // Round Moon longitude to 0.001 degrees for cache key stability
  const moonLngRounded = Math.round(moon.longitude * 1000) / 1000;

  const cacheKey = makeCacheKey("dasha_stage", {
    moon_lng: moonLngRounded,
    birth_date: birth.birth_date,
    birth_time: birth.birth_time,
    tz: birth.timezone_offset_minutes,
    ref_date: currentLocalStr,
  });

  const cached = stageCaches.dasha.get(cacheKey);
  if (cached) return cached;

  const birthLocalStr = birthLocalMomentStr(birth);
  const nakData = calculateNakshatra(moon.longitude);
  const dashaTimeline = calculateDashaTimeline(nakData, birthLocalStr, currentLocalStr);

  const nakshatraInfo = {
    name: nakData.name,
    index: nakData.index,
    lord: nakData.lord,
    pada: nakData.pada,
    degree_in_nakshatra: Math.round(nakData.degree_in_nakshatra * 10000) / 10000,
  };

  const dashaInfo: NonNullable<ChartResponse["chart"]["dasha"]> = {
    current_dasha: dashaTimeline.current_dasha?.planet ?? "Unknown",
    current_antardasha: dashaTimeline.current_antardasha?.sub_lord ?? "Unknown",
    current_dasha_start: dashaTimeline.current_dasha_start ?? "",
    current_dasha_end: dashaTimeline.current_dasha_end ?? "",
    current_antardasha_start: dashaTimeline.current_antardasha_start ?? "",
    current_antardasha_end: dashaTimeline.current_antardasha_end ?? "",
    current_pratyantar: dashaTimeline.current_pratyantar?.pratyantar_lord ?? undefined,
    current_pratyantar_start: dashaTimeline.current_pratyantar_start ?? undefined,
    current_pratyantar_end: dashaTimeline.current_pratyantar_end ?? undefined,
    pratyantar_periods: dashaTimeline.pratyantar_periods.map((pp) => ({
      planet: pp.pratyantar_lord,
      start_date: pp.start_date,
      end_date: pp.end_date,
      years: 0,
    })),
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
  const preset = getEnginePreset(birth.engine_id);
  const fractionElapsed = nakData.degree_in_nakshatra / NAKSHATRA_SPAN;
  const dashaSeedTotalYears = DASHA_YEARS[nakData.lord];
  const dashaSeedElapsedYears = fractionElapsed * dashaSeedTotalYears;
  const dashaSeedRemainingYears = Math.max(dashaSeedTotalYears - dashaSeedElapsedYears, 0);

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

  const calculationAudit: Record<string, unknown> = {
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

  const result: DashaStageResult = { nakshatraInfo, dashaInfo, calculationAudit };
  stageCaches.dasha.set(cacheKey, result);
  return result;
}

// --------------------------------------------------------------------------
// Stage C: Aspects
// --------------------------------------------------------------------------

function computeAspects(planets: PlanetPosition[]): AspectStageResult {
  const longHash = hashLongitudes(planets);
  const cacheKey = `asp_${longHash}`;

  const cached = stageCaches.aspects.get(cacheKey);
  if (cached) return cached;

  const result = calculateAspects(planets).map((a) => ({
    planet1: a.planet1,
    planet2: a.planet2,
    aspect_type: a.aspect_type,
    exact_angle: a.exact_angle,
    orb: a.orb,
    applying: a.applying,
    vedic: a.vedic,
  }));

  stageCaches.aspects.set(cacheKey, result);
  return result;
}

// --------------------------------------------------------------------------
// Stage D: Navamsa (D9)
// --------------------------------------------------------------------------

function computeNavamsa(planets: PlanetPosition[]): NavamsaStageResult {
  const longHash = hashLongitudes(planets);
  const cacheKey = `nav_${longHash}`;

  const cached = stageCaches.navamsa.get(cacheKey);
  if (cached) return cached;

  const result = calculateNavamsa(planets).map((n) => ({
    name: n.name,
    rashi_sign: n.rashi_sign,
    navamsa_sign: n.navamsa_sign,
    navamsa_division: n.navamsa_division,
  }));

  stageCaches.navamsa.set(cacheKey, result);
  return result;
}

// --------------------------------------------------------------------------
// Stage E: Life domain insights
// --------------------------------------------------------------------------

function computeInsights(
  ascendantSign: string,
  planets: PlanetPosition[],
  houses: HousePlacement[],
): InsightsStageResult {
  const longHash = hashLongitudes(planets);
  const houseSig = houses.map((h) => h.sign).join(",");
  let hHash = 5381;
  for (let i = 0; i < houseSig.length; i++) {
    hHash = ((hHash << 5) + hHash + houseSig.charCodeAt(i)) | 0;
  }
  const cacheKey = `ins_${longHash}_${(hHash >>> 0).toString(36)}`;

  const cached = stageCaches.insights.get(cacheKey);
  if (cached) return cached;

  const lifeDomainInsights = generateLifeDomainInsights(ascendantSign, planets, houses);
  const result: InsightsStageResult = { lifeDomainInsights };

  stageCaches.insights.set(cacheKey, result);
  return result;
}

/**
 * Compute only the core chart facts required by the Life Domain module, then
 * run the domain synthesis stage. This is intentionally separate from
 * buildChart() so the results page can defer the heavier seven-domain read
 * without recalculating dasha, divisional charts, shadbala, or transits.
 */
export function buildLifeDomainInsights(
  birth: BirthDetailsInput
): LifeDomainInsight[] {
  const core = computeCorePositions(birth);
  return computeInsights(
    core.ascendant.sign,
    core.planets,
    core.houses,
  ).lifeDomainInsights;
}

// --------------------------------------------------------------------------
// Build chart (same signature and return type as before)
// --------------------------------------------------------------------------

export interface BuildChartOptions {
  includeTransits?: boolean;
  includePremium?: boolean;
  includeUltimate?: boolean;
  deferLifeDomains?: boolean;
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
    deferLifeDomains = false,
    subscriptionTier = "guest",
  } = options;

  // Stage A: core positions (planets, houses, ascendant, rules)
  const core = computeCorePositions(birth);
  const preset = getEnginePreset(birth.engine_id);

  let nakshatraInfo: ChartResponse["chart"]["nakshatra"] = null;
  let dashaInfo: ChartResponse["chart"]["dasha"] = null;
  let calculationAudit: Record<string, unknown> | null = null;
  let aspectsInfo: ChartResponse["chart"]["aspects"] = null;
  let navamsaInfo: ChartResponse["chart"]["navamsa"] = null;
  let divisionalChartsInfo: ChartResponse["chart"]["divisional_charts"] = null;
  let lifeDomainInsights: LifeDomainInsight[] | null = null;
  let shadbalInfo: ShadbalaResult[] | null = null;
  let yogasInfo: YogaDetectionResult[] | null = null;
  let ashtakavargaData: AshtakavargaResult | null = null;

  if (includePremium) {
    const currentLocalStr = currentLocalDateStr(birth);

    // Stage B: dasha timeline
    const dashaStage = computeDashaTimeline(birth, core.planets, currentLocalStr);
    nakshatraInfo = dashaStage.nakshatraInfo;
    dashaInfo = dashaStage.dashaInfo;
    calculationAudit = dashaStage.calculationAudit;

    // Stage C: aspects
    aspectsInfo = computeAspects(core.planets);

    // Stage D: navamsa
    navamsaInfo = computeNavamsa(core.planets);

    // Stage D2: divisional charts (D2, D3, D4, D7, D10, D12)
    divisionalChartsInfo = computeMultipleDivisionalCharts(
      core.planets,
      [2, 3, 4, 7, 10, 12]
    );

    // Stage D3: shadbala (planetary strength)
    shadbalInfo = calculateShadbala(core.planets, navamsaInfo, aspectsInfo);

    // Stage D4: yogas (classical combinations)
    yogasInfo = detectYogas({
      planets: core.planets,
      houses: core.houses,
      ascendantSign: core.ascendant.sign,
    });

    // Stage D5: ashtakavarga
    ashtakavargaData = computeAshtakavarga(core.planets, core.ascendant.sign);
  }

  if (includeUltimate && !deferLifeDomains) {
    // Stage E: life domain insights
    const insightsStage = computeInsights(
      core.ascendant.sign,
      core.planets,
      core.houses,
    );
    lifeDomainInsights = insightsStage.lifeDomainInsights;
  }

  // Transits (not cached at stage level — short-lived, already cached at API layer)
  let transitsData: ChartResponse["transits"] = null;
  if (includePremium && includeTransits) {
    const transitPositions = computeTransitPositions(new Date(), birth.engine_id);
    const transitAspects = computeTransitAspects(core.planets, transitPositions);
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

  // Lucky elements (always computed, not premium-gated)
  const luckyElements = computeLuckyElements(
    core.ascendant.sign,
    core.planets,
    core.houses,
    nakshatraInfo?.lord ?? null,
  );

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
      julian_day_ut: core.julian_day_ut,
      ascendant: core.ascendant,
      planets: core.planets,
      houses: core.houses,
      house_cusps: core.house_cusps,
      deterministic_rules: core.rules,
      selected_rule_ids: selectedRuleIds(core.rules),
      rules_dataset_version: rulesDatasetVersion(),
      summary: core.summary,
      nakshatra: nakshatraInfo,
      dasha: dashaInfo,
      calculation_audit: calculationAudit,
      aspects: aspectsInfo,
      navamsa: navamsaInfo,
      divisional_charts: divisionalChartsInfo,
      life_domain_insights: lifeDomainInsights,
      shadbala: shadbalInfo,
      yogas: yogasInfo,
      lucky_elements: luckyElements,
    },
    engine: {
      engine_id: preset.engine_id,
      engine_label: preset.label,
      ephemeris_provider: "astronomy-engine (pure JS)",
      ayanamsha: preset.ayanamsha,
      house_system: preset.house_system,
      fallback_mode: core.fallback_mode,
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
    ashtakavarga: ashtakavargaData,
  };
}

// --------------------------------------------------------------------------
// computeTransitsOnly — reuses cached natal positions, only computes transits
// --------------------------------------------------------------------------

export function computeTransitsOnly(
  birth: BirthDetailsInput,
  transitDate?: Date,
): NonNullable<ChartResponse["transits"]> {
  // Reuse cached core positions (planets never change for same birth input)
  const core = computeCorePositions(birth);
  const when = transitDate ?? new Date();

  const transitPositions = computeTransitPositions(when, birth.engine_id);
  const transitAspects = computeTransitAspects(core.planets, transitPositions);

  return {
    computed_at_utc: when.toISOString(),
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

// --------------------------------------------------------------------------
// Build forecast
// --------------------------------------------------------------------------

export function buildForecast(
  birth: BirthDetailsInput,
  targetDateStr: string
): ForecastReading {
  // Reuse cached core positions instead of re-calculating
  const core = computeCorePositions(birth);

  const birthLocalStr = birthLocalMomentStr(birth);

  // Build nakshatra/dasha for target date
  const moon = core.planets.find((p) => p.name === "Moon")!;
  const nakData = calculateNakshatra(moon.longitude);
  const dashaTimeline = calculateDashaTimeline(nakData, birthLocalStr, targetDateStr);

  const dashaInfo = {
    current_dasha: dashaTimeline.current_dasha?.planet ?? "Unknown",
    current_antardasha: dashaTimeline.current_antardasha?.sub_lord ?? "Unknown",
    current_dasha_start: dashaTimeline.current_dasha_start ?? "",
    current_dasha_end: dashaTimeline.current_dasha_end ?? "",
    current_antardasha_start: dashaTimeline.current_antardasha_start ?? "",
    current_antardasha_end: dashaTimeline.current_antardasha_end ?? "",
    current_pratyantar: dashaTimeline.current_pratyantar?.pratyantar_lord ?? undefined,
    current_pratyantar_start: dashaTimeline.current_pratyantar_start ?? undefined,
    current_pratyantar_end: dashaTimeline.current_pratyantar_end ?? undefined,
    pratyantar_periods: dashaTimeline.pratyantar_periods.map((pp) => ({
      planet: pp.pratyantar_lord,
      start_date: pp.start_date,
      end_date: pp.end_date,
      years: 0,
    })),
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
  const transitAspects = computeTransitAspects(core.planets, transitPositions).map(
    (a) => ({
      transit_planet: a.transit_planet,
      natal_planet: a.natal_planet,
      aspect_type: a.aspect_type,
      orb: a.orb,
    })
  );

  const supportiveTransits = transitAspects
    .filter((a) => aspectTone(a.transit_planet, a.aspect_type) === "supportive")
    .slice(0, 1)
    .map(toForecastAspect);

  const challengingTransits = transitAspects
    .filter((a) => aspectTone(a.transit_planet, a.aspect_type) === "challenging")
    .slice(0, 1)
    .map(toForecastAspect);

  const currentDashaPlanet = core.planets.find(
    (p) => p.name === dashaInfo.current_dasha
  )!;
  const currentAntardashaPlanet = core.planets.find(
    (p) => p.name === dashaInfo.current_antardasha
  )!;
  const dashaTheme = DASHA_FORECAST_THEMES[dashaInfo.current_dasha];
  const antardashaTheme = DASHA_FORECAST_THEMES[dashaInfo.current_antardasha];

  const focusAreas: string[] = [
    `${dashaInfo.current_dasha} Mahadasha keeps the long-range focus on ${HOUSE_THEMES[currentDashaPlanet.house]} via natal house ${currentDashaPlanet.house}.`,
    `${dashaInfo.current_antardasha} Antardasha sharpens the near-term story around ${HOUSE_THEMES[currentAntardashaPlanet.house]} via natal house ${currentAntardashaPlanet.house}.`,
  ];
  const opportunities: string[] = [
    dashaTheme.opportunity,
    antardashaTheme.opportunity,
  ];

  const cautions: string[] = [
    dashaTheme.caution,
    antardashaTheme.caution,
  ];

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
    focus_areas: focusAreas.slice(0, 2),
    opportunities: opportunities.slice(0, 2),
    cautions: cautions.slice(0, 2),
    supportive_transits: supportiveTransits,
    challenging_transits: challengingTransits,
  };
}
