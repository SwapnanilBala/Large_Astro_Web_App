/**
 * Zod validation schemas for all API inputs.
 *
 * Each schema provides runtime validation **and** TypeScript type inference
 * via `z.infer<typeof Schema>`. It replaced a set of hand-written validators
 * in lib/api-validation.ts, which no route imported by the end and which has
 * since been deleted.
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

const birthTimeAccuracyField = z
  .preprocess(
    (value) => (value === "" || value === null || value === undefined ? "exact" : value),
    z.enum(["exact", "morning", "afternoon", "evening", "unknown"]),
  )
  .default("exact");

const birthTimeSourceField = z
  .preprocess(
    (value) => (value === "" || value === null || value === undefined ? "exact" : value),
    z.enum(["exact", "fallback"]),
  )
  .default("exact");

const booleanStringField = z
  .preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) return false;
      if (value === "true") return true;
      if (value === "false") return false;
      return value;
    },
    z.boolean(),
  )
  .default(false);

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
  birth_time_accuracy: birthTimeAccuracyField,
  birth_time_source: birthTimeSourceField,
  birth_time_fallback: booleanStringField,
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
// Chart sync
// ---------------------------------------------------------------------------

/**
 * What a client may ask the server to store.
 *
 * Deliberately thin. The birth facts are not sent as fields — they are derived
 * server-side from `queryString` by lib/sync/facts.ts, so the client cannot
 * describe a chart differently from the way /insights rendered it.
 */
export const ChartSyncRequestSchema = z.object({
  queryString: z.string().min(1, "queryString is required").max(4000),
  ascendantSign: z.string().max(20).nullish(),
  sunSign: z.string().max(20).nullish(),
  moonSign: z.string().max(20).nullish(),
  consent: z.object({
    /**
     * `true` and nothing else. A request that says `false` is not a request to
     * store without permission — it is a bug, and the type system should not
     * let it be mistaken for a valid shape the route has to remember to check.
     */
    granted: z.literal(true),
    /** The exact wording the visitor agreed to, kept as evidence. */
    prompt: z.string().min(1, "consent.prompt is required").max(500),
    captureSource: z.enum(["intake", "nudge", "settings"]),
  }),
});

export type ChartSyncRequest = z.infer<typeof ChartSyncRequestSchema>;

/**
 * The birth facts, once derived from the query string.
 *
 * Ranges here mirror the check constraints on `birth_profiles` so a bad value
 * is a 400 with a readable message rather than a 500 from Postgres. The
 * coordinate pair rule is enforced in lib/sync/facts.ts, which can only
 * produce both or neither.
 */
export const ChartSyncFactsSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(120),
  /* birthDateField already rejects a malformed or impossible date; the floor
     is birth_profiles_birth_date_check, restated so it fails as a 400. */
  birthDate: birthDateField.refine((value: string) => value >= "1900-01-01", {
    message: "birthDate must be 1900-01-01 or later",
  }),
  birthTime: birthTimeField,
  latitude: latitudeField.nullable(),
  longitude: longitudeField.nullable(),
  timezoneOffsetMinutes: z
    .number()
    .int("timezoneOffsetMinutes must be a whole number of minutes")
    .min(-720)
    .max(840),
  timeZoneId: z.string().max(100),
  country: z.string().max(120),
  state: z.string().max(120),
  city: z.string().max(120),
  town: z.string().max(120),
});

export type ChartSyncFacts = z.infer<typeof ChartSyncFactsSchema>;

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
