/**
 * Zod validation schemas for all API inputs.
 *
 * Each schema provides runtime validation **and** TypeScript type inference
 * via `z.infer<typeof Schema>`, replacing the hand-written validators in
 * lib/api-validation.ts.
 */

import { z } from "zod";
import { ENGINE_PRESETS } from "@/lib/engines/engine-registry";

const validEngineIds = Object.keys(ENGINE_PRESETS);

// ---------------------------------------------------------------------------
// Shared field schemas
// ---------------------------------------------------------------------------

const nameField = z
  .string({ error: "name is required" })
  .min(2, "name must be at least 2 characters")
  .max(120, "name must be at most 120 characters");

const birthDateField = z
  .string({ error: "birth_date is required" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "birth_date must match YYYY-MM-DD format")
  .refine(
    (v) => {
      const [y, m, d] = v.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      return (
        date.getFullYear() === y &&
        date.getMonth() === m - 1 &&
        date.getDate() === d
      );
    },
    { message: "birth_date is not a valid calendar date" },
  );

const birthTimeField = z
  .string({ error: "birth_time is required" })
  .regex(
    /^\d{2}:\d{2}(:\d{2})?$/,
    "birth_time must match HH:MM or HH:MM:SS format",
  )
  .refine(
    (v) => {
      const [h, m, s = 0] = v.split(":").map(Number);
      return h >= 0 && h <= 23 && m >= 0 && m <= 59 && s >= 0 && s <= 59;
    },
    { message: "birth_time contains an invalid hour, minute, or second" },
  );

const engineIdField = z
  .string()
  .refine((v) => !v || validEngineIds.includes(v), {
    message: `engine_id must be one of: ${validEngineIds.join(", ")}`,
  })
  .default("lahiri_classic");

const latitudeField = z.coerce
  .number({ error: "latitude is required" })
  .min(-90, "latitude must be between -90 and 90")
  .max(90, "latitude must be between -90 and 90");

const longitudeField = z.coerce
  .number({ error: "longitude is required" })
  .min(-180, "longitude must be between -180 and 180")
  .max(180, "longitude must be between -180 and 180");

const timezoneOffsetField = z.coerce
  .number({ error: "timezone_offset_minutes is required" })
  .int("timezone_offset_minutes must be an integer")
  .min(-720, "timezone_offset_minutes must be between -720 and 840")
  .max(840, "timezone_offset_minutes must be between -720 and 840");

const targetDateField = z
  .string({ error: "target_date is required" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "target_date must match YYYY-MM-DD format")
  .refine(
    (v) => {
      const [y, m, d] = v.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      return (
        date.getFullYear() === y &&
        date.getMonth() === m - 1 &&
        date.getDate() === d
      );
    },
    { message: "target_date is not a valid calendar date" },
  );

// ---------------------------------------------------------------------------
// Composite schemas
// ---------------------------------------------------------------------------

/** Core birth details shared across chart, forecast, and compatibility. */
export const BirthInputSchema = z.object({
  name: nameField,
  birth_date: birthDateField,
  birth_time: birthTimeField,
  engine_id: engineIdField,
  timezone_offset_minutes: timezoneOffsetField,
  latitude: latitudeField,
  longitude: longitudeField,
  // Optional location strings (not validated beyond type)
  country: z.string().default(""),
  state: z.string().default(""),
  city: z.string().default(""),
  town: z.string().default(""),
  time_zone_id: z.string().default(""),
});

export type BirthInput = z.infer<typeof BirthInputSchema>;

/** Forecast endpoint: birth details + target date. */
export const ForecastInputSchema = BirthInputSchema.extend({
  target_date: targetDateField,
});

export type ForecastInput = z.infer<typeof ForecastInputSchema>;

/** Dasha sub-period expansion. */
export const DashaSubperiodsInputSchema = z.object({
  parent_lord: z.string().min(1, "parent_lord is required"),
  parent_start: z.string().min(1, "parent_start is required"),
  parent_end: z.string().min(1, "parent_end is required"),
  level: z.coerce.number().int().min(2).max(5).default(2),
  parent_lords: z.string().default(""),
  sequence_start: z.string().optional(),
  sequence_end: z.string().optional(),
});

export type DashaSubperiodsInput = z.infer<typeof DashaSubperiodsInputSchema>;

/** Compatibility endpoint: two birth inputs. */
export const CompatibilityInputSchema = z.object({
  primary: BirthInputSchema,
  partner: BirthInputSchema,
});

export type CompatibilityInput = z.infer<typeof CompatibilityInputSchema>;

/** Geocode endpoint. */
export const GeocodeInputSchema = z.object({
  city: z.string().default(""),
  state: z.string().default(""),
  country: z.string().default(""),
  birthDate: z.string().default(""),
  birthTime: z.string().default(""),
}).refine(
  (v) => v.city || v.state || v.country,
  { message: "At least one location param required" },
);

export type GeocodeInput = z.infer<typeof GeocodeInputSchema>;

/** Muhurta endpoint: find auspicious times for an activity. */
export const MuhurtaInputSchema = z.object({
  activity: z.enum([
    "marriage", "business_start", "travel", "education",
    "property_purchase", "medical_procedure", "job_interview",
    "investment", "spiritual_practice", "general_auspicious",
  ], { error: "activity must be a valid muhurta activity type" }),
  start_date: z
    .string({ error: "start_date is required" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "start_date must match YYYY-MM-DD format"),
  end_date: z
    .string({ error: "end_date is required" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "end_date must match YYYY-MM-DD format"),
  latitude: latitudeField,
  longitude: longitudeField,
  timezone_offset_minutes: timezoneOffsetField,
});

export type MuhurtaInput = z.infer<typeof MuhurtaInputSchema>;

/** Suggest (autocomplete) endpoint. */
export const SuggestInputSchema = z.object({
  q: z.string().min(2, "query must be at least 2 characters"),
  type: z.enum(["country", "state", "city"]).default("city"),
  country: z.string().default(""),
  state: z.string().default(""),
});

export type SuggestInput = z.infer<typeof SuggestInputSchema>;

// ---------------------------------------------------------------------------
// Helper: extract first Zod error message
// ---------------------------------------------------------------------------

/**
 * Pull the first human-readable message from a Zod error result.
 * Useful for returning a single error string in API responses.
 */
export function firstZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Validation failed";
  const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue.message}`;
}
