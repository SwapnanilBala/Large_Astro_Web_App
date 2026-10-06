import type {
  PalmClassicalFrameworkNotes,
  PalmDashaRelevance,
  PalmImageQuality,
  PalmJyotishCorrelation,
  PalmLineConfidenceEntry,
  PalmLineCoordinates,
  PalmLineReading,
  PalmLineStrength,
  PalmReadingJSON,
} from "./types";

/*
 * The palm reading as the route returns it: rebuilt from the documented
 * shape (BASE_SCHEMA_BLOCK in app/api/palm-reading/route.ts), not passed on
 * as the model wrote it.
 *
 * The photo is the one thing in this app a model reads that nobody checked
 * first, and a photo can carry writing. The prompt says that writing is
 * evidence, not instruction, and this is what holds if the model obeys it
 * anyway: only the documented keys survive, every value has the type its
 * field documents, and every string is capped. So an answer cannot carry an
 * essay, a script or a second document in a key of its own, and the route is
 * not a vision model for whatever a photo asks.
 *
 * Lenient where the reading is still a reading: a missing text field becomes
 * empty, a value outside its set is dropped, or for a line's strength replaced
 * by the scale's middle, and case and stray spaces are forgiven, since GPT-4o
 * serves this too. Only an answer with no summary at all is refused, because
 * that is not a palm reading.
 */

/* The whole reading is about five thousand output tokens (the route's
   header), a few hundred characters a field. This is several times that, so
   it only ever stops a field the prompt did not ask for. */
export const MAX_PROSE_CHARS = 4000;
/** A label: a mount, a marking, an image issue, a Sanskrit term. */
export const MAX_LABEL_CHARS = 200;
/** The longest list the prompt asks for is six; this is room, not a target. */
export const MAX_LIST_ITEMS = 12;
/** The prompt asks for 3 to 6 points a line. */
export const MAX_POINTS = 12;

const LINE_KEYS = ["heart_line", "head_line", "life_line", "fate_line"] as const;
const STRENGTHS: readonly PalmLineStrength[] = ["strong", "moderate", "faint", "absent"];
const VISIBILITIES: readonly PalmLineConfidenceEntry["visibility"][] = ["clear", "partial", "faint", "not_detected"];
const RATINGS: readonly PalmImageQuality["rating"][] = ["excellent", "good", "marginal", "poor"];
const REINFORCEMENTS: readonly PalmJyotishCorrelation["correlations"][number]["reinforcement"][] = [
  "strong",
  "moderate",
  "contradictory",
  "neutral",
];

type Raw = Record<string, unknown>;

const isObject = (value: unknown): value is Raw =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const objectOf = (value: unknown): Raw => (isObject(value) ? value : {});

/** A string cut at a word boundary under `max`, or "" for anything that is not a string. */
function text(value: unknown, max = MAX_PROSE_CHARS): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.8 ? cut.slice(0, space) : cut).trimEnd();
}

/** One of the set, forgiving case and spaces, or undefined. */
function oneOf<T extends string>(value: unknown, set: readonly T[]): T | undefined {
  if (typeof value !== "string") return undefined;
  const normalised = value.trim().toLowerCase().replace(/\s+/g, "_");
  return set.find((member) => member === normalised);
}

function labels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => text(entry, MAX_LABEL_CHARS))
    .filter((entry) => entry.length > 0)
    .slice(0, MAX_LIST_ITEMS);
}

/** The list's entries that are objects, at most MAX_LIST_ITEMS of them, each shaped by `shape` or dropped. */
function entries<T>(value: unknown, shape: (raw: Raw) => T | undefined): T[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isObject)
    .map(shape)
    .filter((entry): entry is T => entry !== undefined)
    .slice(0, MAX_LIST_ITEMS);
}

const unit = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : undefined;

const LINE_CONFIDENCES: readonly NonNullable<PalmLineReading["confidence"]>[] = ["high", "medium", "low"];

function line(value: unknown): PalmLineReading {
  const raw = objectOf(value);
  /* Not asked for in `lines` (line_confidence carries them), but typed there
     and compared by diff.ts, so kept when a reading has them. */
  const visibility = oneOf(raw.visibility, VISIBILITIES);
  const confidence = oneOf(raw.confidence, LINE_CONFIDENCES);
  return {
    description: text(raw.description),
    interpretation: text(raw.interpretation),
    /* Required by the type and printed on the card; a value outside the
       scale is not one to print, so it reads as the middle of it. */
    strength: oneOf(raw.strength, STRENGTHS) ?? "moderate",
    ...(visibility ? { visibility } : {}),
    ...(confidence ? { confidence } : {}),
  };
}

function imageQuality(value: unknown): PalmImageQuality | undefined {
  if (!isObject(value)) return undefined;
  const rating = oneOf(value.rating, RATINGS);
  if (!rating) return undefined;
  return {
    rating,
    issues: labels(value.issues),
    /* The prompt's own rule when the flag is missing: unreliable only when poor. */
    reliable_for_reading: typeof value.reliable_for_reading === "boolean" ? value.reliable_for_reading : rating !== "poor",
    notes: text(value.notes),
  };
}

function lineConfidence(value: unknown): PalmReadingJSON["line_confidence"] {
  if (!isObject(value)) return undefined;
  const out: NonNullable<PalmReadingJSON["line_confidence"]> = {};
  for (const key of LINE_KEYS) {
    const entry = objectOf(value[key]);
    const visibility = oneOf(entry.visibility, VISIBILITIES);
    const confidence = unit(entry.confidence);
    if (visibility && confidence !== undefined) out[key] = { visibility, confidence };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function lineCoordinates(value: unknown): PalmLineCoordinates | undefined {
  if (!isObject(value)) return undefined;
  const out: PalmLineCoordinates = {};
  for (const key of LINE_KEYS) {
    if (!Array.isArray(value[key])) continue;
    const points = (value[key] as unknown[])
      .filter(isObject)
      .map((point) => ({ x: unit(point.x), y: unit(point.y) }))
      .filter((point): point is { x: number; y: number } => point.x !== undefined && point.y !== undefined)
      .slice(0, MAX_POINTS);
    if (points.length > 0) out[key] = points;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function jyotishCorrelation(value: unknown): PalmJyotishCorrelation | undefined {
  if (!isObject(value)) return undefined;
  return {
    summary: text(value.summary),
    correlations: entries(value.correlations, (raw) => {
      const reinforcement = oneOf(raw.reinforcement, REINFORCEMENTS);
      if (!reinforcement) return undefined;
      return {
        palm_indicator: text(raw.palm_indicator, MAX_LABEL_CHARS),
        chart_factor: text(raw.chart_factor, MAX_LABEL_CHARS),
        reinforcement,
        reading: text(raw.reading),
      };
    }),
  };
}

function dashaRelevance(value: unknown): PalmDashaRelevance | undefined {
  if (!isObject(value)) return undefined;
  return {
    active_period_summary: text(value.active_period_summary),
    relevant_palm_indicators: entries(value.relevant_palm_indicators, (raw) => {
      const timing = text(raw.timing_note, MAX_LABEL_CHARS);
      return {
        indicator: text(raw.indicator, MAX_LABEL_CHARS),
        relevance_to_dasha: text(raw.relevance_to_dasha),
        ...(timing ? { timing_note: timing } : {}),
      };
    }),
  };
}

/* classical_text_references is no longer asked for (2026-10-04), so it is
   not passed on either. */
function classicalNotes(value: unknown): PalmClassicalFrameworkNotes | undefined {
  if (!isObject(value)) return undefined;
  return {
    framework: text(value.framework, MAX_LABEL_CHARS),
    sanskrit_terms: entries(value.sanskrit_terms, (raw) => ({
      term: text(raw.term, MAX_LABEL_CHARS),
      meaning: text(raw.meaning, MAX_LABEL_CHARS),
      observation: text(raw.observation),
    })),
  };
}

/**
 * The reading rebuilt from its documented fields, or null when the answer is
 * not a palm reading at all (not an object, or no summary).
 */
export function shapePalmReading(value: unknown): PalmReadingJSON | null {
  if (!isObject(value)) return null;
  const overall = text(value.overall_summary);
  if (!overall) return null;

  const lines = objectOf(value.lines);
  const trajectory = objectOf(value.life_trajectory);
  const career = objectOf(value.career_and_purpose);
  const relationships = objectOf(value.relationships_and_emotional);
  const health = objectOf(value.health_and_vitality);
  const mounts = objectOf(value.mounts);
  const fingers = objectOf(value.fingers);
  const markings = objectOf(value.special_markings);

  const reading: PalmReadingJSON = {
    overall_summary: overall,
    dominant_hand_note: text(value.dominant_hand_note),
    lines: {
      heart_line: line(lines.heart_line),
      head_line: line(lines.head_line),
      life_line: line(lines.life_line),
      fate_line: line(lines.fate_line),
    },
    life_trajectory: {
      current_phase: text(trajectory.current_phase),
      near_future: text(trajectory.near_future),
      long_term_path: text(trajectory.long_term_path),
      challenges: text(trajectory.challenges),
      opportunities: text(trajectory.opportunities),
    },
    career_and_purpose: {
      natural_talents: text(career.natural_talents),
      career_direction: text(career.career_direction),
      purpose_alignment: text(career.purpose_alignment),
    },
    relationships_and_emotional: {
      emotional_state: text(relationships.emotional_state),
      relationship_dynamics: text(relationships.relationship_dynamics),
      connection_style: text(relationships.connection_style),
    },
    health_and_vitality: {
      energy_levels: text(health.energy_levels),
      stress_indicators: text(health.stress_indicators),
      wellness_advice: text(health.wellness_advice),
    },
    mounts: { prominent: labels(mounts.prominent), interpretation: text(mounts.interpretation) },
    fingers: { observation: text(fingers.observation), interpretation: text(fingers.interpretation) },
    special_markings: { observed: labels(markings.observed), interpretation: text(markings.interpretation) },
    guidance: text(value.guidance),
  };

  const optional = {
    image_quality: imageQuality(value.image_quality),
    line_confidence: lineConfidence(value.line_confidence),
    line_coordinates: lineCoordinates(value.line_coordinates),
    jyotish_correlation: jyotishCorrelation(value.jyotish_correlation),
    dasha_relevance: dashaRelevance(value.dasha_relevance),
    classical_framework_notes: classicalNotes(value.classical_framework_notes),
  };
  for (const [key, block] of Object.entries(optional)) {
    if (block !== undefined) Object.assign(reading, { [key]: block });
  }
  return reading;
}
