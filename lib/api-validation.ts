/**
 * Shared input-validation helpers for API routes.
 *
 * Each validator returns `null` when the value is valid, or a human-readable
 * error string when it is not. `validateBirthInput` runs all relevant checks
 * and returns an aggregated error message (or null).
 */

import { ENGINE_PRESETS } from "@/lib/engines/engine-registry";

// ---------------------------------------------------------------------------
// Primitive validators
// ---------------------------------------------------------------------------

export function validateLatitude(v: unknown): string | null {
  const n = Number(v);
  if (v === "" || v === null || v === undefined) return "latitude is required";
  if (Number.isNaN(n)) return "latitude must be a valid number";
  if (n < -90 || n > 90) return "latitude must be between -90 and 90";
  return null;
}

export function validateLongitude(v: unknown): string | null {
  const n = Number(v);
  if (v === "" || v === null || v === undefined) return "longitude is required";
  if (Number.isNaN(n)) return "longitude must be a valid number";
  if (n < -180 || n > 180) return "longitude must be between -180 and 180";
  return null;
}

export function validateTimezoneOffset(v: unknown): string | null {
  const n = Number(v);
  if (v === "" || v === null || v === undefined)
    return "timezone_offset_minutes is required";
  if (Number.isNaN(n)) return "timezone_offset_minutes must be a valid number";
  if (!Number.isInteger(n))
    return "timezone_offset_minutes must be an integer";
  if (n < -720 || n > 840)
    return "timezone_offset_minutes must be between -720 and 840";
  return null;
}

/**
 * Validate a YYYY-MM-DD date string.
 * Checks format AND that the date actually exists (e.g. rejects Feb 30).
 */
export function validateBirthDate(v: unknown): string | null {
  if (typeof v !== "string" || !v) return "birth_date is required";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v))
    return "birth_date must match YYYY-MM-DD format";

  const [y, m, d] = v.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return `birth_date "${v}" is not a valid calendar date`;
  }
  return null;
}

/**
 * Validate HH:MM or HH:MM:SS time strings.
 */
export function validateBirthTime(v: unknown): string | null {
  if (typeof v !== "string" || !v) return "birth_time is required";
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(v))
    return "birth_time must match HH:MM or HH:MM:SS format";

  const parts = v.split(":").map(Number);
  const [h, m, s = 0] = parts;
  if (h < 0 || h > 23) return "birth_time hour must be 0-23";
  if (m < 0 || m > 59) return "birth_time minute must be 0-59";
  if (s < 0 || s > 59) return "birth_time second must be 0-59";
  return null;
}

export function validateEngineId(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null; // will default
  if (typeof v !== "string") return "engine_id must be a string";
  const validIds = Object.keys(ENGINE_PRESETS);
  if (!validIds.includes(v)) {
    return `engine_id must be one of: ${validIds.join(", ")}`;
  }
  return null;
}

export function validateName(v: unknown): string | null {
  if (typeof v !== "string" || !v) return "name is required";
  if (v.length < 2) return "name must be at least 2 characters";
  if (v.length > 120) return "name must be at most 120 characters";
  return null;
}

// ---------------------------------------------------------------------------
// Composite validators
// ---------------------------------------------------------------------------

export interface BirthInputRaw {
  name?: unknown;
  birth_date?: unknown;
  birth_time?: unknown;
  engine_id?: unknown;
  timezone_offset_minutes?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  [key: string]: unknown;
}

/**
 * Validate all fields required for a birth-details input.
 * Returns null when valid, or a string describing the first error.
 */
export function validateBirthInput(input: BirthInputRaw): string | null {
  const checks = [
    validateName(input.name),
    validateBirthDate(input.birth_date),
    validateBirthTime(input.birth_time),
    validateEngineId(input.engine_id),
    validateLatitude(input.latitude),
    validateLongitude(input.longitude),
    validateTimezoneOffset(input.timezone_offset_minutes),
  ];
  // Return first error
  for (const err of checks) {
    if (err) return err;
  }
  return null;
}

/**
 * Validate target_date parameter (same rules as birth_date).
 */
export function validateTargetDate(v: unknown): string | null {
  if (typeof v !== "string" || !v) return "target_date is required";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v))
    return "target_date must match YYYY-MM-DD format";

  const [y, m, d] = v.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return `target_date "${v}" is not a valid calendar date`;
  }
  return null;
}
