/**
 * Pure helpers for computing structured deltas between two stored
 * palm readings. Used by `/api/palm-readings/compare`.
 */

import type {
  PalmLineStrength,
  PalmReadingJSON,
  PalmReadingRecord,
} from "./types";

const LINE_KEYS = [
  "heart_line",
  "head_line",
  "life_line",
  "fate_line",
] as const;

type LineKey = (typeof LINE_KEYS)[number];

/** Numeric ordering used to decide if a line strength got "stronger" or "weaker". */
const STRENGTH_RANK: Record<PalmLineStrength, number> = {
  absent: 0,
  faint: 1,
  moderate: 2,
  strong: 3,
};

export type LineStrengthChange = {
  line: LineKey;
  from: string;
  to: string;
  direction: "stronger" | "weaker" | "unchanged";
};

export type LineVisibilityChange = {
  line: string;
  from: string;
  to: string;
};

export type ComputedDiff = {
  days_apart: number;
  line_strength_changes: LineStrengthChange[];
  line_visibility_changes: LineVisibilityChange[];
  summary_diff: {
    a_summary: string;
    b_summary: string;
  };
  new_special_markings: string[];
  lost_special_markings: string[];
  new_prominent_mounts: string[];
  lost_prominent_mounts: string[];
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function safeStrength(value: unknown): PalmLineStrength | null {
  if (
    value === "strong" ||
    value === "moderate" ||
    value === "faint" ||
    value === "absent"
  ) {
    return value;
  }
  return null;
}

function compareStrengths(
  fromRaw: unknown,
  toRaw: unknown,
): "stronger" | "weaker" | "unchanged" {
  const from = safeStrength(fromRaw);
  const to = safeStrength(toRaw);
  if (from == null || to == null) return "unchanged";
  if (STRENGTH_RANK[to] > STRENGTH_RANK[from]) return "stronger";
  if (STRENGTH_RANK[to] < STRENGTH_RANK[from]) return "weaker";
  return "unchanged";
}

function normalizedSet(values: unknown): Set<string> {
  if (!Array.isArray(values)) return new Set();
  return new Set(
    values
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter((v) => v.length > 0),
  );
}

function setDifference(a: Set<string>, b: Set<string>): string[] {
  const out: string[] = [];
  for (const value of a) {
    if (!b.has(value)) out.push(value);
  }
  return out;
}

function daysBetween(aIso: string, bIso: string): number {
  const aTime = Date.parse(aIso);
  const bTime = Date.parse(bIso);
  if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
  const diffMs = Math.abs(bTime - aTime);
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compare two stored palm readings and produce a structured diff.
 * Pure function — does not perform any IO.
 */
export function computeReadingDiff(
  a: PalmReadingRecord,
  b: PalmReadingRecord,
): ComputedDiff {
  const readingA: PalmReadingJSON = a.reading;
  const readingB: PalmReadingJSON = b.reading;

  // ---- Line strength changes ---------------------------------------------
  const line_strength_changes: LineStrengthChange[] = LINE_KEYS.map((line) => {
    const fromVal = readingA.lines?.[line]?.strength;
    const toVal = readingB.lines?.[line]?.strength;
    return {
      line,
      from: typeof fromVal === "string" ? fromVal : "unknown",
      to: typeof toVal === "string" ? toVal : "unknown",
      direction: compareStrengths(fromVal, toVal),
    };
  });

  // ---- Line visibility changes (NEW optional field) ----------------------
  const line_visibility_changes: LineVisibilityChange[] = [];
  for (const line of LINE_KEYS) {
    const fromVis = readingA.lines?.[line]?.visibility;
    const toVis = readingB.lines?.[line]?.visibility;
    if (typeof fromVis === "string" || typeof toVis === "string") {
      const from = typeof fromVis === "string" ? fromVis : "unknown";
      const to = typeof toVis === "string" ? toVis : "unknown";
      if (from !== to) {
        line_visibility_changes.push({ line, from, to });
      }
    }
  }

  // ---- Special markings delta --------------------------------------------
  const aMarkings = normalizedSet(readingA.special_markings?.observed);
  const bMarkings = normalizedSet(readingB.special_markings?.observed);

  // ---- Prominent mounts delta --------------------------------------------
  const aMounts = normalizedSet(readingA.mounts?.prominent);
  const bMounts = normalizedSet(readingB.mounts?.prominent);

  return {
    days_apart: daysBetween(a.created_at, b.created_at),
    line_strength_changes,
    line_visibility_changes,
    summary_diff: {
      a_summary: readingA.overall_summary ?? "",
      b_summary: readingB.overall_summary ?? "",
    },
    new_special_markings: setDifference(bMarkings, aMarkings),
    lost_special_markings: setDifference(aMarkings, bMarkings),
    new_prominent_mounts: setDifference(bMounts, aMounts),
    lost_prominent_mounts: setDifference(aMounts, bMounts),
  };
}
