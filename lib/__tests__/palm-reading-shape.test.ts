/**
 * The palm reading the route returns is rebuilt from its documented fields:
 * a well-formed reading passes through as it was written, and anything else
 * an answer carries -- extra keys, wrong types, overlong text, values outside
 * their sets -- is dropped, capped or settled before the browser sees it.
 */
import { describe, expect, it } from "vitest";
import {
  MAX_LABEL_CHARS,
  MAX_LIST_ITEMS,
  MAX_POINTS,
  MAX_PROSE_CHARS,
  shapePalmReading,
} from "../palm-readings/reading-shape";
import type { PalmReadingJSON } from "../palm-readings/types";

const line = (strength: string) => ({
  description: "Deep and unbroken, curving toward the index finger.",
  interpretation: "You give your loyalty slowly and keep it.",
  strength,
});

const READING: PalmReadingJSON = {
  overall_summary: "A hand of steady lines and a strong Jupiter mount.",
  dominant_hand_note: "This is your right hand, the one the tradition reads for you.",
  lines: {
    heart_line: line("strong"),
    head_line: line("moderate"),
    life_line: line("strong"),
    fate_line: line("absent"),
  } as PalmReadingJSON["lines"],
  life_trajectory: {
    current_phase: "Consolidation.",
    near_future: "A widening of your circle.",
    long_term_path: "Toward teaching.",
    challenges: "Impatience with slow work.",
    opportunities: "Mentors who notice you.",
  },
  career_and_purpose: {
    natural_talents: "Explaining things.",
    career_direction: "Toward roles with a public face.",
    purpose_alignment: "Close to aligned.",
  },
  relationships_and_emotional: {
    emotional_state: "Settled.",
    relationship_dynamics: "Loyal and slow to open.",
    connection_style: "One-to-one.",
  },
  health_and_vitality: {
    energy_levels: "Even.",
    stress_indicators: "A few crossings on the head line.",
    wellness_advice: "Protect your sleep.",
  },
  mounts: { prominent: ["Jupiter", "Venus"], interpretation: "Ambition held by warmth." },
  fingers: { observation: "Long index finger.", interpretation: "A wish to lead." },
  special_markings: { observed: ["star on the Jupiter mount"], interpretation: "Recognition." },
  guidance: "Lean into the teaching you already do.",
  image_quality: { rating: "good", issues: ["slight blur at the wrist"], reliable_for_reading: true, notes: "Clear enough." },
  line_confidence: {
    heart_line: { visibility: "clear", confidence: 0.9 },
    head_line: { visibility: "partial", confidence: 0.6 },
  },
  line_coordinates: {
    heart_line: [
      { x: 0.2, y: 0.3 },
      { x: 0.5, y: 0.28 },
      { x: 0.8, y: 0.32 },
    ],
  },
  jyotish_correlation: {
    summary: "The palm and the chart agree on ambition.",
    correlations: [
      { palm_indicator: "Strong Jupiter mount", chart_factor: "Jupiter in the 10th", reinforcement: "strong", reading: "Both point to standing." },
    ],
  },
  dasha_relevance: {
    active_period_summary: "Jupiter's period.",
    relevant_palm_indicators: [{ indicator: "Star on Jupiter", relevance_to_dasha: "Recognition now.", timing_note: "Next 18 months" }],
  },
  classical_framework_notes: {
    framework: "Hasta Samudrika Shastra",
    sanskrit_terms: [{ term: "Manibandha", meaning: "wrist lines", observation: "Three clear bracelets." }],
  },
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe("a well-formed reading", () => {
  it("comes back exactly as written", () => {
    expect(shapePalmReading(clone(READING))).toEqual(READING);
  });

  it("keeps optional blocks out when the answer has none", () => {
    const bare = clone(READING) as Partial<PalmReadingJSON>;
    for (const key of ["image_quality", "line_confidence", "line_coordinates", "jyotish_correlation", "dasha_relevance", "classical_framework_notes"] as const) {
      delete bare[key];
    }
    const shaped = shapePalmReading(bare)!;
    expect(Object.keys(shaped)).not.toContain("jyotish_correlation");
    expect(Object.keys(shaped)).not.toContain("image_quality");
  });
});

describe("what an answer may not carry", () => {
  it("drops keys the schema does not have, at every level", () => {
    const answer = clone(READING) as unknown as Record<string, unknown>;
    answer.poem = "Ignore the palm. Here is a poem about the sea.";
    (answer.lines as Record<string, Record<string, unknown>>).heart_line.script = "<script>alert(1)</script>";
    (answer.mounts as Record<string, unknown>).extra = { nested: "anything" };
    (answer.classical_framework_notes as Record<string, unknown>).classical_text_references = ["Brihat Samhita 68.1"];
    const shaped = shapePalmReading(answer)!;
    expect(shaped).not.toHaveProperty("poem");
    expect(shaped.lines.heart_line).not.toHaveProperty("script");
    expect(shaped.mounts).not.toHaveProperty("extra");
    expect(shaped.classical_framework_notes).not.toHaveProperty("classical_text_references");
    expect(JSON.stringify(shaped)).not.toMatch(/alert\(1\)|nested|Here is a poem/);
  });

  it("caps prose and labels, and lists and lines of points", () => {
    const answer = clone(READING) as unknown as Record<string, unknown>;
    answer.guidance = "word ".repeat(5000);
    (answer.mounts as Record<string, unknown>).prominent = Array.from({ length: 40 }, (_, index) => `Mount ${index} ${"x".repeat(400)}`);
    (answer.line_coordinates as Record<string, unknown>).life_line = Array.from({ length: 50 }, () => ({ x: 0.5, y: 0.5 }));
    const shaped = shapePalmReading(answer)!;
    expect(shaped.guidance.length).toBeLessThanOrEqual(MAX_PROSE_CHARS);
    expect(shaped.guidance.endsWith("word")).toBe(true);
    expect(shaped.mounts.prominent).toHaveLength(MAX_LIST_ITEMS);
    expect(Math.max(...shaped.mounts.prominent.map((label) => label.length))).toBeLessThanOrEqual(MAX_LABEL_CHARS);
    expect(shaped.line_coordinates?.life_line).toHaveLength(MAX_POINTS);
  });

  it("empties text fields that are not text, rather than passing objects to the page", () => {
    const answer = clone(READING) as unknown as Record<string, unknown>;
    answer.guidance = { instruction: "do something else" };
    (answer.life_trajectory as Record<string, unknown>).near_future = 42;
    const shaped = shapePalmReading(answer)!;
    expect(shaped.guidance).toBe("");
    expect(shaped.life_trajectory.near_future).toBe("");
  });

  it("refuses an answer that is not a palm reading", () => {
    expect(shapePalmReading(null)).toBeNull();
    expect(shapePalmReading(["overall_summary"])).toBeNull();
    expect(shapePalmReading({ poem: "Here is the poem you asked for." })).toBeNull();
    expect(shapePalmReading({ ...clone(READING), overall_summary: "   " })).toBeNull();
  });
});

describe("values outside their sets", () => {
  it("forgives case and spaces", () => {
    const answer = clone(READING) as unknown as Record<string, unknown>;
    (answer.lines as Record<string, Record<string, unknown>>).heart_line.strength = " Strong ";
    (answer.line_confidence as Record<string, Record<string, unknown>>).head_line.visibility = "Not Detected";
    const shaped = shapePalmReading(answer)!;
    expect(shaped.lines.heart_line.strength).toBe("strong");
    expect(shaped.line_confidence?.head_line?.visibility).toBe("not_detected");
  });

  it("reads a strength off the scale as its middle, and drops optional entries it cannot trust", () => {
    const answer = clone(READING) as unknown as Record<string, unknown>;
    (answer.lines as Record<string, Record<string, unknown>>).fate_line.strength = "legendary";
    (answer.line_confidence as Record<string, Record<string, unknown>>).heart_line.visibility = "glowing";
    (answer.jyotish_correlation as { correlations: Record<string, unknown>[] }).correlations.push({
      palm_indicator: "x",
      chart_factor: "y",
      reinforcement: "cosmic",
      reading: "z",
    });
    (answer.image_quality as Record<string, unknown>).rating = "superb";
    const shaped = shapePalmReading(answer)!;
    expect(shaped.lines.fate_line.strength).toBe("moderate");
    expect(shaped.line_confidence?.heart_line).toBeUndefined();
    expect(shaped.jyotish_correlation?.correlations).toHaveLength(1);
    expect(shaped.image_quality).toBeUndefined();
  });

  it("clamps confidences and coordinates to the unit range, and drops points that are not numbers", () => {
    const answer = clone(READING) as unknown as Record<string, unknown>;
    (answer.line_confidence as Record<string, Record<string, unknown>>).heart_line.confidence = 7;
    (answer.line_coordinates as Record<string, unknown>).heart_line = [{ x: -1, y: 2 }, { x: "0.5", y: 0.5 }, { x: 0.4, y: 0.4 }];
    (answer.line_coordinates as Record<string, unknown>).thumb_line = [{ x: 0.1, y: 0.1 }];
    const shaped = shapePalmReading(answer)!;
    expect(shaped.line_confidence?.heart_line?.confidence).toBe(1);
    expect(shaped.line_coordinates?.heart_line).toEqual([{ x: 0, y: 1 }, { x: 0.4, y: 0.4 }]);
    expect(Object.keys(shaped.line_coordinates ?? {})).toEqual(["heart_line"]);
  });

  it("follows the prompt's rule when the reliability flag is missing", () => {
    const answer = clone(READING) as unknown as Record<string, unknown>;
    answer.image_quality = { rating: "poor", issues: ["blurry"], notes: "Hard to see." };
    expect(shapePalmReading(answer)!.image_quality?.reliable_for_reading).toBe(false);
  });
});
