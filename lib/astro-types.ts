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
};

export type DeterministicRule = {
  title: string;
  insight: string;
  basis: string;
  priority: "high" | "medium" | "low";
  category?: string;
  confidence_score?: number;
  tension_note?: string;
};

export type PlanetPosition = {
  name: string;
  longitude: number;
  sign: string;
  degree_in_sign: number;
  house: number;
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

export type LifeDomainInsight = {
  key: "love_life" | "career" | "family" | "inheritance" | "influence" | "life_cycle" | "travel_destinations";
  label: string;
  headline: string;
  overview: string;
  strengths: string[];
  watchouts: string[];
  timing_triggers: string[];
  supporting_patterns: string[];
  guidance: string;
  long_game: string;
  confidence_score: number;
};

export type EnginePresetInfo = {
  engine_id: string;
  label: string;
  ayanamsha: string;
  house_system: string;
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
    deterministic_rules: DeterministicRule[];
    summary: string;
    nakshatra?: NakshatraInfo;
    dasha?: DashaInfo;
    calculation_audit?: CalculationAuditInfo;
    aspects?: AspectInfo[];
    navamsa?: NavamsaPositionInfo[];
    life_domain_insights?: LifeDomainInsight[];
    shadbala?: ShadbalaResult[];
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
  timeZoneId: ""
};
