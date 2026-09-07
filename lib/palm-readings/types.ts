/**
 * Type definitions for the palm-readings persistence layer.
 *
 * NOTE: All NEW fields recently added by sister agents (image_quality,
 * line_confidence, line_coordinates, jyotish_correlation, dasha_relevance,
 * classical_framework_notes) are intentionally OPTIONAL so that legacy
 * readings stored before those fields existed continue to type-check.
 */

// ---------------------------------------------------------------------------
// PalmReading JSON shape (mirrors /api/palm-reading response)
// ---------------------------------------------------------------------------

export type PalmLineStrength = "strong" | "moderate" | "faint" | "absent";

export type PalmLineReading = {
  description: string;
  interpretation: string;
  strength: PalmLineStrength;
  /** NEW (optional): qualitative confidence the model has in detecting this line. */
  confidence?: "high" | "medium" | "low";
  /** NEW (optional): visibility classification, when supplied by the model. */
  visibility?: string;
};

export type PalmLifeTrajectory = {
  current_phase: string;
  near_future: string;
  long_term_path: string;
  challenges: string;
  opportunities: string;
};

export type PalmCareerAndPurpose = {
  natural_talents: string;
  career_direction: string;
  purpose_alignment: string;
};

export type PalmRelationshipsAndEmotional = {
  emotional_state: string;
  relationship_dynamics: string;
  connection_style: string;
};

export type PalmHealthAndVitality = {
  energy_levels: string;
  stress_indicators: string;
  wellness_advice: string;
};

export type PalmMounts = {
  prominent: string[];
  interpretation: string;
};

export type PalmFingers = {
  observation: string;
  interpretation: string;
};

export type PalmSpecialMarkings = {
  observed: string[];
  interpretation: string;
};

/** NEW (optional): per-line normalized coordinates supplied by sister agent. */
export type PalmLineCoordinates = Partial<
  Record<
    "heart_line" | "head_line" | "life_line" | "fate_line",
    Array<{ x: number; y: number }>
  >
>;

/** Per-line detection quality, as emitted under `line_confidence`. */
export type PalmLineConfidenceEntry = {
  visibility: "clear" | "partial" | "faint" | "not_detected";
  /** 0–1. */
  confidence: number;
};

export type PalmImageQuality = {
  rating: "excellent" | "good" | "marginal" | "poor";
  issues: string[];
  reliable_for_reading: boolean;
  notes: string;
};

/** Jyotish correlation block, present when natal context was supplied. */
export type PalmJyotishCorrelation = {
  summary: string;
  correlations: Array<{
    palm_indicator: string;
    chart_factor: string;
    reinforcement: "strong" | "moderate" | "contradictory" | "neutral";
    reading: string;
  }>;
};

export type PalmDashaRelevance = {
  active_period_summary: string;
  relevant_palm_indicators: Array<{
    indicator: string;
    relevance_to_dasha: string;
    timing_note?: string;
  }>;
};

export type PalmClassicalFrameworkNotes = {
  framework: string;
  sanskrit_terms: Array<{ term: string; meaning: string; observation: string }>;
  classical_text_references: string[];
};

export type PalmReadingJSON = {
  overall_summary: string;
  dominant_hand_note: string;
  lines: {
    heart_line: PalmLineReading;
    head_line: PalmLineReading;
    life_line: PalmLineReading;
    fate_line: PalmLineReading;
  };
  life_trajectory: PalmLifeTrajectory;
  career_and_purpose: PalmCareerAndPurpose;
  relationships_and_emotional: PalmRelationshipsAndEmotional;
  health_and_vitality: PalmHealthAndVitality;
  mounts: PalmMounts;
  fingers: PalmFingers;
  special_markings: PalmSpecialMarkings;
  guidance: string;

  // ---- Optional blocks, present only when the model emits them -----------
  /** Qualitative judgement of the source image's clarity. */
  image_quality?: PalmImageQuality;
  /** Per-line visibility and confidence. */
  line_confidence?: Partial<
    Record<"heart_line" | "head_line" | "life_line" | "fate_line", PalmLineConfidenceEntry>
  >;
  /** Traced coordinates for each detected line. */
  line_coordinates?: PalmLineCoordinates;
  /** How the palm reading correlates with the natal chart context. */
  jyotish_correlation?: PalmJyotishCorrelation;
  /** Dasha-period relevance commentary. */
  dasha_relevance?: PalmDashaRelevance;
  /** Commentary in the classical Samudrika framework. */
  classical_framework_notes?: PalmClassicalFrameworkNotes;
};

// ---------------------------------------------------------------------------
// JyotishContext (mirrors the snapshot another agent is adding to the request)
// ---------------------------------------------------------------------------

export type JyotishContext = {
  ascendant?: { sign: string; degree: number; nakshatra: string };
  moonSign?: string;
  moonNakshatra?: string;
  sunSign?: string;
  currentMahadasha?: { lord: string; remaining_years: number };
  currentAntardasha?: { lord: string; remaining_months: number };
  keyPlacements?: Array<{
    planet: string;
    sign: string;
    house: number;
    nakshatra: string;
  }>;
};

// ---------------------------------------------------------------------------
// Persistence record shapes
// ---------------------------------------------------------------------------

export type PalmReadingRecord = {
  id: string;
  created_at: string;
  title: string | null;
  image_data_url: string;
  reading: PalmReadingJSON;
  jyotish_context: JyotishContext | null;
  classical_mode: boolean;
  notes: string | null;
};

export type PalmReadingSummary = {
  id: string;
  created_at: string;
  title: string | null;
  classical_mode: boolean;
  reading_summary: {
    overall_summary: string;
    dominant_hand_note: string;
  };
};
