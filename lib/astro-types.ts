export type ProfileQueryInput = {
  name: string;
  birthDate: string;
  birthTime: string;
  engineId: string;
  timezoneOffsetMinutes: string;
  latitude: string;
  longitude: string;
  country: string;
  state: string;
  city: string;
  town: string;
  timeZoneId: string;
  birthTimeAccuracy: string;
  birthTimeSource: string;
  birthTimeFallback: string;
};

// ---------------------------------------------------------------------------
// Rule engine
//
// This file is the SINGLE declaration site for DeterministicRule and
// LifeDomainInsight. lib/engines/rule-engine.ts re-exports these types rather
// than declaring its own copies -- a field added to only one of two structurally
// similar declarations is present at runtime but invisible to the UI at compile
// time, which is the worst failure mode available here.
// ---------------------------------------------------------------------------

export type RuleCategory = "core" | "career" | "love";
export type RulePriority = "high" | "medium" | "low";
export type RuleTier = "foundation" | "signature" | "combination";
export type PlanetDignity = "exalted" | "own_sign" | "debilitated" | "neutral";

/** One machine-readable provenance fact. Rendered by the UI, never by the engine. */
export type EvidenceClaim = {
  /** Short technical label, e.g. "10th house sign", "10th lord placement". */
  label: string;
  /** Already-formatted value, e.g. "Taurus", "6th house", "own sign", "12.47 deg". */
  value: string;
  /** Optional one-clause elaboration. An astrologer-facing register is fine here. */
  detail?: string;
  /** Degrees, JSON dumps and raw counters are only legal with kind "measurement". */
  kind: "placement" | "lordship" | "dignity" | "aspect" | "count" | "measurement";
};

export type RarityBand =
  | "common" // fire_rate > 0.35
  | "notable" // 0.15 < fire_rate <= 0.35
  | "uncommon" // 0.05 < fire_rate <= 0.15
  | "rare" // 0.01 < fire_rate <= 0.05
  | "very_rare"; // fire_rate <= 0.01

export type RuleRarity = {
  /** Observed fraction of the synthetic sample in which this rule fired. (0,1]. */
  fire_rate: number;
  /** 1 - fire_rate. HIGH means rare means noteworthy. Always [0,1). */
  score: number;
  band: RarityBand;
  /** Absolute number of sample charts in which it fired. */
  observed_count: number;
  /** Monte Carlo sample size the rate was measured against. */
  sample_size: number;
  /** True when observed_count < 30 -- band is capped and the label goes non-numeric. */
  low_confidence: boolean;
  /** Matches rarity.json `version`. Used for cache busting and audit. */
  dataset_version: string;
};

/** The client-facing tier. Contains no degrees, no JSON, no un-glossed Sanskrit. */
export type RuleDisplay = {
  /** Plain-language title. Replaces `title` in the default view. */
  headline: string;
  /** Plain-language paragraph. Replaces `insight` in the default view. */
  body: string;
  /** The honest counterweight, in plain language. Replaces `tension_note`. */
  tension?: string;
  /** e.g. "Shows up in about 3 of every 100 charts." Never a bare decimal. */
  rarity_label: string;
};

/** The technical tier. Everything here sits inside the collapsed disclosure. */
export type RuleEvidence = {
  /** The legacy `basis` string, verbatim. Astrologer-facing. */
  technical_note: string;
  claims: EvidenceClaim[];
  rarity: RuleRarity;
  /** Which predicate clauses matched, for audit. Rendered only in advanced view. */
  matched_conditions: string[];
};

export type RuleSelectionMeta = {
  /** Chart-specific magnitude of the pattern, [0,1]. Declared per rule. */
  strength: number;
  /** rarity.score * strength, [0,1]. The only ranking key. */
  score: number;
  selected: boolean;
  /** 1-based rank within the selected set; 0 when not selected. */
  rank: number;
};

export type DeterministicRule = {
  /** Stable, copy-independent id from the data file, e.g. "career.tenth_house_axis". */
  id: string;
  /** id plus bound discriminators, unique within one chart. Use as the React key. */
  instance_key: string;
  tier: RuleTier;

  display: RuleDisplay;
  evidence: RuleEvidence;
  selection: RuleSelectionMeta;

  priority: RulePriority;
  /**
   * Narrowed from `string | undefined`. Load-bearing for page structure: the
   * desktop split buckets by this, so a fourth value would drop those rules off
   * the page entirely. Enforced by Zod at rule-load time.
   */
  category: RuleCategory;
};

export type PlanetPosition = {
  name: string;
  longitude: number;
  sign: string;
  degree_in_sign: number;
  house: number;
  speed?: number;           // degrees per day (negative = retrograde)
  is_retrograde?: boolean;  // true if speed < 0
  is_combust?: boolean;     // true if within combustion orb of Sun
};

export type HousePlacement = {
  house_number: number;
  sign: string;
  planets: string[];
};

export type NakshatraInfo = {
  name: string;
  index: number;
  lord: string;
  pada: number;
  degree_in_nakshatra: number;
};

export type DashaPeriodInfo = {
  planet: string;
  start_date: string;
  end_date: string;
  years: number;
  sequence_start_date?: string;
  sequence_end_date?: string;
  is_partial?: boolean;
};

export type DashaInfo = {
  current_dasha: string;
  current_antardasha: string;
  current_dasha_start: string;
  current_dasha_end: string;
  current_antardasha_start: string;
  current_antardasha_end: string;
  current_pratyantar?: string;
  current_pratyantar_start?: string;
  current_pratyantar_end?: string;
  pratyantar_periods?: DashaPeriodInfo[];
  periods: DashaPeriodInfo[];
};

export type CalculationAuditInfo = {
  engine_id: string;
  engine_label: string;
  ayanamsha: string;
  house_system: string;
  time_zone_id?: string;
  timezone_offset_minutes: number;
  latitude: number;
  longitude: number;
  birth_local_iso: string;
  birth_utc_iso: string;
  reference_local_iso: string;
  reference_utc_iso: string;
  moon_sidereal_longitude: number;
  moon_sign: string;
  moon_degree_in_sign: number;
  nakshatra_name: string;
  nakshatra_lord: string;
  nakshatra_pada: number;
  degree_in_nakshatra: number;
  nakshatra_progress_percent: number;
  dasha_seed_lord: string;
  dasha_seed_total_years: number;
  dasha_seed_elapsed_years: number;
  dasha_seed_remaining_years: number;
  dasha_seed_start_local_iso: string;
  dasha_seed_end_local_iso: string;
};

export type SubPeriodInfo = {
  level: number;
  planet: string;
  lords: string[];
  start_date: string;
  end_date: string;
  sequence_start_date?: string;
  sequence_end_date?: string;
  is_partial?: boolean;
};

export type AspectInfo = {
  planet1: string;
  planet2: string;
  aspect_type: string;
  exact_angle: number;
  orb: number;
  applying: boolean;
  vedic: boolean;
};

export type NavamsaDignity =
  | "exalted"
  | "own"
  | "moolatrikona"
  | "friend"
  | "neutral"
  | "enemy"
  | "debilitated";

export type NavamsaPositionInfo = {
  name: string;
  rashi_sign: string;
  navamsa_sign: string;
  navamsa_division: number;
  dignity?: NavamsaDignity;
};

export type DivisionalPositionInfo = {
  name: string;
  rashi_sign: string;
  divisional_sign: string;
  division_number: number;
};

export type DivisionalChartInfo = {
  division: number;
  label: string;
  description: string;
  positions: DivisionalPositionInfo[];
};

export type TransitPositionInfo = {
  name: string;
  longitude: number;
  sign: string;
  degree_in_sign: number;
};

export type TransitAspectInfo = {
  transit_planet: string;
  natal_planet: string;
  aspect_type: string;
  orb: number;
};

export type TransitData = {
  computed_at_utc: string;
  positions: TransitPositionInfo[];
  active_aspects: TransitAspectInfo[];
};

export type YogaDetectionResult = {
  yoga_id: string;
  name: string;
  sanskrit: string;
  category: "mahapurusha" | "wealth" | "benefic" | "challenging" | "viparita" | "nabhasa";
  present: boolean;
  strength: "strong" | "moderate" | "weak";
  occurrence_chance: number;
  involved_planets: string[];
  description: string;
  effects: string;
  activation_timing?: string;
  key_traits?: string[];
  detailed_description?: string;
  cancellation?: string;
};

export type AshtakavargaData = {
  bhinnashtakavarga: Record<string, number[]>;
  sarvashtakavarga: number[];
  totalBindus: number;
  strongSigns: string[];
  weakSigns: string[];
};

export type LifeDomainKey =
  | "love_life"
  | "career"
  | "family"
  | "inheritance"
  | "influence"
  | "life_cycle"
  | "travel_destinations";

/**
 * The client-facing tier for a life domain.
 *
 * Plain language throughout: no "Label: Sign house N, led by Lord" headlines,
 * no transit or house vocabulary in `timing`. The technical versions of all of
 * this survive verbatim on the legacy fields and in `DomainEvidence`.
 */
export type DomainDisplay = {
  headline: string;
  body: string;
  guidance: string;
  long_game: string;
  /** At most 3. */
  strengths: string[];
  /** At most 2. */
  watchouts: string[];
  /** At most 2, and free of transit/house vocabulary. */
  timing: string[];
};

export type DomainEvidence = {
  /** The old headline + overview, verbatim. */
  technical_note: string;
  claims: EvidenceClaim[];
  /**
   * Identical to `confidence_score`. This is a STRENGTH signal, not a rarity
   * signal, and is never rendered as a percentage.
   */
  signal_score: number;
};

export type LifeDomainInsight = {
  key: LifeDomainKey;
  label: string;

  display: DomainDisplay;
  evidence: DomainEvidence;

  // Computed exactly as before; demoted to the evidence tier at the render sites.
  headline: string;
  overview: string;
  strengths: string[];
  watchouts: string[];
  timing_triggers: string[];
  supporting_patterns: string[];
  guidance: string;
  long_game: string;
  /** Still calculateDomainSignalScore(), still clamped [0.55, 0.94]. */
  confidence_score: number;
};

export type LifeDomainInsightsResponse = {
  generated_at_utc: string;
  insights: LifeDomainInsight[];
};

export type EnginePresetInfo = {
  engine_id: string;
  label: string;
  ayanamsha: string;
  house_system: string;
  house_system_code: string;
  description: string;
};

export type ForecastAspectInsight = {
  transit_planet: string;
  natal_planet: string;
  aspect_type: string;
  orb: number;
  tone: "supportive" | "challenging" | "mixed";
  interpretation: string;
};

export type ForecastReading = {
  target_date: string;
  headline: string;
  overview: string;
  dasha: DashaInfo;
  focus_areas: string[];
  opportunities: string[];
  cautions: string[];
  supportive_transits: ForecastAspectInsight[];
  challenging_transits: ForecastAspectInsight[];
};

export type CalendarPlannerIntent =
  | "action"
  | "rest"
  | "communication"
  | "relationships"
  | "money"
  | "study"
  | "travel";

export type CalendarPlannerIntentAdvice = {
  intent: CalendarPlannerIntent;
  score: number;
  quality: "excellent" | "good" | "fair" | "poor";
  summary: string;
  reasons: string[];
};

export type CalendarPlannerWindow = {
  intent: CalendarPlannerIntent;
  start: string;
  end: string;
  score: number;
  quality: "excellent" | "good" | "fair" | "poor";
  recommendation: string;
};

export type CalendarPlannerWatchout = {
  date: string;
  severity: "low" | "medium" | "high";
  score: number;
  reasons: string[];
};

export type CalendarPlannerDashaContext = {
  week_start: string;
  week_end: string;
  current_dasha: string;
  current_antardasha: string;
  current_dasha_start: string;
  current_dasha_end: string;
  current_antardasha_start: string;
  current_antardasha_end: string;
  pressure: "low" | "medium" | "high";
  summary: string;
};

export type CalendarPlannerDay = {
  date: string;
  headline: string;
  overview: string;
  intents: CalendarPlannerIntentAdvice[];
  watchout?: CalendarPlannerWatchout;
  muhurta_windows: CalendarPlannerWindow[];
  dasha: {
    current_dasha: string;
    current_antardasha: string;
    pressure: "low" | "medium" | "high";
  };
};

export type CalendarPlannerResponse = {
  generated_at_utc: string;
  client: {
    name: string;
    latitude: number;
    longitude: number;
    timezone_offset_minutes: number;
    country?: string;
    state?: string;
    city?: string;
    town?: string;
    time_zone_id?: string;
  };
  search_window: {
    start_date: string;
    end_date: string;
    day_count: number;
  };
  requested_intent?: CalendarPlannerIntent;
  intents: CalendarPlannerIntent[];
  weekly_dasha_context: CalendarPlannerDashaContext[];
  watchouts: CalendarPlannerWatchout[];
  days: CalendarPlannerDay[];
};

export type LuckyElementsInfo = {
  primary_colors: string[];
  secondary_colors: string[];
  lucky_numbers: number[];
  primary_gemstone: string;
  secondary_gemstone: string;
  lucky_day: string;
  secondary_day: string;
  primary_metal: string;
  secondary_metal: string;
  auspicious_directions: string[];
  unlucky_colors: string[];
  unlucky_items: string[];
  bad_omens: string[];
  gemstone_guidance: {
    primary: {
      gemstone: string;
      governing_planet: string;
      recommended_day: string;
      metal: string;
      intention: string;
    };
    secondary: {
      gemstone: string;
      governing_planet: string;
      recommended_day: string;
      metal: string;
      intention: string;
    };
    safety_note: string;
  };
  fortune_domains: Array<{
    title: string;
    focus: string;
    key_planet: string;
    planet_house: number | null;
    basis: string;
  }>;
  basis: {
    ascendant_lord: string;
    moon_sign_lord: string;
    ninth_house_lord: string;
    nakshatra_lord: string | null;
    yogakaraka_lord: string | null;
  };
};

export type ChartApiResponse = {
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
    time_zone_id?: string;
  };
  chart: {
    julian_day_ut: number;
    ascendant: {
      longitude: number;
      sign: string;
      degree_in_sign: number;
    };
    planets: PlanetPosition[];
    houses: HousePlacement[];
    house_cusps?: number[];
    deterministic_rules: DeterministicRule[];
    /** Rank-ordered instance_keys of the selected rules. Length <= topN. */
    selected_rule_ids?: string[];
    /** Mirrors rarity.json's version, so a stale cached payload is detectable. */
    rules_dataset_version?: string;
    summary: string;
    nakshatra?: NakshatraInfo;
    dasha?: DashaInfo;
    calculation_audit?: CalculationAuditInfo;
    aspects?: AspectInfo[];
    navamsa?: NavamsaPositionInfo[];
    divisional_charts?: Record<number, DivisionalChartInfo>;
    life_domain_insights?: LifeDomainInsight[];
    shadbala?: ShadbalaResult[];
    yogas?: YogaDetectionResult[];
    lucky_elements?: LuckyElementsInfo;
  };
  engine: {
    engine_id: string;
    engine_label: string;
    ephemeris_provider: string;
    ayanamsha: string;
    house_system: string;
    fallback_mode: boolean;
    available_engines: EnginePresetInfo[];
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
  transits?: TransitData;
  ashtakavarga?: AshtakavargaData;
};

export type SavedChartRecord = {
  saved_chart_id: string;
  name: string;
  city: string;
  birth_date: string;
  birth_time: string;
  timezone_offset_minutes: number;
  country: string;
  state: string;
  town: string;
  latitude: number;
  longitude: number;
  time_zone_id: string;
  ascendant_sign: string;
  query_string: string;
  notes: string;
  saved_at: string;
  updated_at: string;
  archived_at?: string | null;
};

export type SavedComparisonRecord = {
  saved_comparison_id: string;
  primary_name: string;
  partner_name: string;
  compatibility_score: number;
  summary: string;
  query_string: string;
  notes: string;
  saved_at: string;
  updated_at: string;
  archived_at?: string | null;
};

export type ClientReadingRecord = {
  reading_id: string;
  user_id: string;
  name: string;
  birth_date: string;
  birth_time: string;
  city: string;
  country: string;
  state: string;
  town: string;
  latitude: number;
  longitude: number;
  timezone_offset: number;
  time_zone_id: string;
  engine_id: string;
  ascendant_sign: string;
  brief_career: string;
  brief_love: string;
  brief_family: string;
  brief_travel: string;
  created_at: string;
  updated_at: string;
};

export type GuestReadingRecord = {
  reading_id: string;
  name: string;
  birth_date: string;
  birth_time: string;
  city: string;
  country: string;
  state: string;
  latitude: number;
  longitude: number;
  timezone_offset: number;
  time_zone_id: string;
  engine_id: string;
  brief_general: string;
  created_at: string;
};

export type ShadbalaResult = {
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
};

export type CompatibilityTheme = {
  title: string;
  insight: string;
  confidence_score: number;
};

export type SynastryAspect = {
  primary_planet: string;
  partner_planet: string;
  aspect_type: string;
  orb: number;
  harmonious: boolean;
};

export type CompatibilityApiResponse = {
  generated_at_utc: string;
  primary_client: ChartApiResponse["client"];
  partner_client: ChartApiResponse["client"];
  compatibility_score: number;
  summary: string;
  themes: CompatibilityTheme[];
  synastry_aspects: SynastryAspect[];
  saved_comparison_id?: string | null;
};

export const profileInitialState: ProfileQueryInput = {
  name: "",
  birthDate: "",
  birthTime: "",
  engineId: "lahiri_classic",
  timezoneOffsetMinutes: "0",
  latitude: "",
  longitude: "",
  country: "",
  state: "",
  city: "",
  town: "",
  timeZoneId: "",
  birthTimeAccuracy: "",
  birthTimeSource: "",
  birthTimeFallback: ""
};
