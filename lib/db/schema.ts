import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

type JsonObject = Record<string, unknown>;

const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** A tenant boundary. One practitioner still receives one workspace. */
export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 80 }),
    metadata: jsonb("metadata").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    ...timestamps(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("workspaces_slug_unique")
      .on(table.slug)
      .where(sql`${table.slug} is not null and ${table.archivedAt} is null`),
    check("workspaces_name_not_blank", sql`char_length(btrim(${table.name})) > 0`),
  ],
);

/** Authentication subjects are external text ids, so auth providers remain replaceable. */
export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    authUserId: varchar("auth_user_id", { length: 255 }).notNull(),
    role: varchar("role", { length: 24 }).default("owner").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.authUserId] }),
    index("workspace_members_auth_user_idx").on(table.authUserId, table.removedAt),
    check(
      "workspace_members_role_check",
      sql`${table.role} in ('owner', 'admin', 'practitioner', 'viewer')`,
    ),
  ],
);

/** A person whose contact information and astrology records are managed. */
export const clients = pgTable(
  "clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    displayName: varchar("display_name", { length: 120 }).notNull(),
    preferredName: varchar("preferred_name", { length: 120 }),
    email: varchar("email", { length: 320 }),
    phoneE164: varchar("phone_e164", { length: 32 }),
    preferredContactMethod: varchar("preferred_contact_method", { length: 24 }),
    status: varchar("status", { length: 24 }).default("active").notNull(),
    source: varchar("source", { length: 80 }),
    externalReference: varchar("external_reference", { length: 120 }),
    locale: varchar("locale", { length: 35 }),
    timeZoneId: varchar("time_zone_id", { length: 100 }),
    metadata: jsonb("metadata").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    createdByAuthUserId: varchar("created_by_auth_user_id", { length: 255 }),
    ...timestamps(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    unique("clients_workspace_id_id_unique").on(table.workspaceId, table.id),
    index("clients_workspace_status_updated_idx").on(
      table.workspaceId,
      table.status,
      table.updatedAt,
    ),
    index("clients_workspace_name_idx").on(table.workspaceId, sql`lower(${table.displayName})`),
    index("clients_workspace_email_idx")
      .on(table.workspaceId, sql`lower(${table.email})`)
      .where(sql`${table.email} is not null and ${table.deletedAt} is null`),
    uniqueIndex("clients_workspace_external_reference_unique")
      .on(table.workspaceId, table.externalReference)
      .where(sql`${table.externalReference} is not null and ${table.deletedAt} is null`),
    check("clients_display_name_not_blank", sql`char_length(btrim(${table.displayName})) > 0`),
    check(
      "clients_status_check",
      sql`${table.status} in ('lead', 'active', 'inactive', 'archived')`,
    ),
    check(
      "clients_contact_method_check",
      sql`${table.preferredContactMethod} is null or ${table.preferredContactMethod} in ('email', 'phone', 'sms', 'whatsapp', 'none')`,
    ),
    check(
      "clients_phone_e164_check",
      sql`${table.phoneE164} is null or ${table.phoneE164} ~ '^\\+[1-9][0-9]{7,14}$'`,
    ),
    check(
      "clients_preferred_contact_value_check",
      sql`${table.preferredContactMethod} is null or ${table.preferredContactMethod} = 'none' or (${table.preferredContactMethod} = 'email' and ${table.email} is not null) or (${table.preferredContactMethod} in ('phone', 'sms', 'whatsapp') and ${table.phoneE164} is not null)`,
    ),
  ],
);

/**
 * A permission someone gave, pinned to the wording they were shown.
 *
 * Created in 0000, dropped in 0002 as deferred, restored here because
 * `birth_profiles.consent_record_id` is `not null`: birth facts cannot reach
 * the database without a row in this table. That makes the gate structural
 * rather than a rule each new write path has to remember.
 *
 * `policy_version` is the point of the table. Knowing that someone agreed is
 * worth little a year later; knowing *which* wording they agreed to is what
 * the record is for.
 */
export const consentRecords = pgTable(
  "consent_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull(),
    clientId: uuid("client_id").notNull(),
    purpose: varchar("purpose", { length: 80 }).notNull(),
    policyVersion: varchar("policy_version", { length: 40 }).notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    captureSource: varchar("capture_source", { length: 60 }),
    evidenceJson: jsonb("evidence_json").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("consent_records_workspace_id_id_unique").on(table.workspaceId, table.id),
    foreignKey({
      name: "consent_records_workspace_client_fk",
      columns: [table.workspaceId, table.clientId],
      foreignColumns: [clients.workspaceId, clients.id],
    }).onDelete("cascade"),
    uniqueIndex("consent_records_one_active_purpose_unique")
      .on(table.clientId, table.purpose)
      .where(sql`${table.revokedAt} is null`),
    index("consent_records_client_purpose_granted_idx").on(
      table.clientId,
      table.purpose,
      table.grantedAt,
    ),
    check("consent_records_purpose_not_blank", sql`char_length(btrim(${table.purpose})) > 0`),
    check(
      "consent_records_revoke_window_check",
      sql`${table.revokedAt} is null or ${table.revokedAt} >= ${table.grantedAt}`,
    ),
  ],
);

/** Immutable-friendly birth facts; corrections create a new profile/version. */
export const birthProfiles = pgTable(
  "birth_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull(),
    clientId: uuid("client_id").notNull(),
    /**
     * Not nullable on purpose. Every other guard against storing birth facts
     * without permission is a line of application code someone can forget to
     * write; this one is the database refusing the insert.
     */
    consentRecordId: uuid("consent_record_id").notNull(),
    label: varchar("label", { length: 80 }).default("Primary").notNull(),
    isPrimary: boolean("is_primary").default(true).notNull(),
    birthDate: date("birth_date", { mode: "string" }).notNull(),
    reportedBirthTime: time("reported_birth_time", { precision: 0 }),
    calculationBirthTime: time("calculation_birth_time", { precision: 0 }).notNull(),
    birthTimeAccuracy: varchar("birth_time_accuracy", { length: 24 }).default("unknown").notNull(),
    birthRecordSource: varchar("birth_record_source", { length: 32 }).default("unknown").notNull(),
    calculationTimeIsFallback: boolean("calculation_time_is_fallback").default(false).notNull(),
    country: varchar("country", { length: 120 }),
    state: varchar("state", { length: 120 }),
    city: varchar("city", { length: 120 }),
    town: varchar("town", { length: 120 }),
    placeLabel: varchar("place_label", { length: 255 }),
    latitude: numeric("latitude", { precision: 9, scale: 6, mode: "number" }),
    longitude: numeric("longitude", { precision: 9, scale: 6, mode: "number" }),
    timeZoneId: varchar("time_zone_id", { length: 100 }),
    suppliedUtcOffsetMinutes: smallint("supplied_utc_offset_minutes"),
    resolvedUtcOffsetMinutes: smallint("resolved_utc_offset_minutes"),
    timezoneSource: varchar("timezone_source", { length: 32 }),
    birthInstantUtc: timestamp("birth_instant_utc", { withTimezone: true }),
    sourceNotes: text("source_notes"),
    supersedesBirthProfileId: uuid("supersedes_birth_profile_id").references(
      (): AnyPgColumn => birthProfiles.id,
      { onDelete: "set null" },
    ),
    ...timestamps(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    unique("birth_profiles_workspace_id_id_unique").on(table.workspaceId, table.id),
    foreignKey({
      name: "birth_profiles_workspace_client_fk",
      columns: [table.workspaceId, table.clientId],
      foreignColumns: [clients.workspaceId, clients.id],
    }).onDelete("cascade"),
    /**
     * Deliberately `no action` rather than `restrict`. Deleting a client
     * cascades to the consent record and to this row in the same statement,
     * and `restrict` is checked immediately -- it would fire on the consent
     * row while this one still pointed at it and block a legitimate delete.
     * `no action` defers the check to the end of the statement, by which time
     * both rows are gone. Revoking consent is a `revoked_at` write plus a
     * delete of the birth profile, not a delete of the consent record.
     */
    foreignKey({
      name: "birth_profiles_workspace_consent_fk",
      columns: [table.workspaceId, table.consentRecordId],
      foreignColumns: [consentRecords.workspaceId, consentRecords.id],
    }),
    uniqueIndex("birth_profiles_one_primary_per_client_unique")
      .on(table.clientId)
      .where(sql`${table.isPrimary} = true and ${table.archivedAt} is null`),
    index("birth_profiles_client_updated_idx").on(table.clientId, table.updatedAt),
    check(
      "birth_profiles_accuracy_check",
      sql`${table.birthTimeAccuracy} in ('exact', 'morning', 'afternoon', 'evening', 'unknown')`,
    ),
    check(
      "birth_profiles_record_source_check",
      sql`${table.birthRecordSource} in ('certificate', 'hospital_record', 'family', 'self_report', 'rectified', 'estimated', 'unknown')`,
    ),
    check(
      "birth_profiles_timezone_source_check",
      sql`${table.timezoneSource} is null or ${table.timezoneSource} in ('coordinates', 'time_zone_id', 'numeric_offset')`,
    ),
    check(
      "birth_profiles_latitude_check",
      sql`${table.latitude} is null or ${table.latitude} between -90 and 90`,
    ),
    check(
      "birth_profiles_longitude_check",
      sql`${table.longitude} is null or ${table.longitude} between -180 and 180`,
    ),
    check(
      "birth_profiles_coordinate_pair_check",
      sql`(${table.latitude} is null) = (${table.longitude} is null)`,
    ),
    check(
      "birth_profiles_supplied_offset_check",
      sql`${table.suppliedUtcOffsetMinutes} is null or ${table.suppliedUtcOffsetMinutes} between -720 and 840`,
    ),
    check(
      "birth_profiles_resolved_offset_check",
      sql`${table.resolvedUtcOffsetMinutes} is null or ${table.resolvedUtcOffsetMinutes} between -720 and 840`,
    ),
    check(
      "birth_profiles_exact_time_check",
      sql`${table.birthTimeAccuracy} <> 'exact' or (${table.reportedBirthTime} is not null and ${table.reportedBirthTime} = ${table.calculationBirthTime} and ${table.calculationTimeIsFallback} = false)`,
    ),
    check(
      "birth_profiles_fallback_consistency_check",
      sql`${table.calculationTimeIsFallback} = true or ${table.reportedBirthTime} is not null`,
    ),
    check("birth_profiles_birth_date_check", sql`${table.birthDate} >= date '1900-01-01'`),
  ],
);

/** One immutable, reproducible calculation for one version of the birth facts. */
export const chartCalculations = pgTable(
  "chart_calculations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull(),
    birthProfileId: uuid("birth_profile_id").notNull(),
    chartType: varchar("chart_type", { length: 40 }).default("natal").notNull(),
    inputFingerprint: varchar("input_fingerprint", { length: 128 }).notNull(),
    inputSnapshotJson: jsonb("input_snapshot_json")
      .$type<JsonObject>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    engineId: varchar("engine_id", { length: 80 }).notNull(),
    calculationVersion: varchar("calculation_version", { length: 80 }).notNull(),
    rulesDatasetVersion: varchar("rules_dataset_version", { length: 80 }),
    schemaVersion: integer("schema_version").default(1).notNull(),
    ephemerisProvider: varchar("ephemeris_provider", { length: 120 }),
    ayanamsha: varchar("ayanamsha", { length: 80 }),
    houseSystem: varchar("house_system", { length: 80 }),
    houseSystemCode: varchar("house_system_code", { length: 24 }),
    julianDayUt: numeric("julian_day_ut", { precision: 18, scale: 8, mode: "number" }),
    status: varchar("status", { length: 24 }).default("completed").notNull(),
    errorCode: varchar("error_code", { length: 80 }),
    errorMessage: text("error_message"),
    fallbackMode: boolean("fallback_mode").default(false).notNull(),
    ascendantSign: varchar("ascendant_sign", { length: 20 }),
    ascendantLongitude: numeric("ascendant_longitude", { precision: 12, scale: 8, mode: "number" }),
    ascendantDegree: numeric("ascendant_degree", { precision: 10, scale: 8, mode: "number" }),
    sunSign: varchar("sun_sign", { length: 20 }),
    moonSign: varchar("moon_sign", { length: 20 }),
    moonNakshatra: varchar("moon_nakshatra", { length: 40 }),
    moonNakshatraPada: smallint("moon_nakshatra_pada"),
    summary: text("summary"),
    resultJson: jsonb("result_json").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    calculationAuditJson: jsonb("calculation_audit_json")
      .$type<JsonObject>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    unique("chart_calculations_workspace_id_id_unique").on(table.workspaceId, table.id),
    foreignKey({
      name: "chart_calculations_workspace_birth_profile_fk",
      columns: [table.workspaceId, table.birthProfileId],
      foreignColumns: [birthProfiles.workspaceId, birthProfiles.id],
    }).onDelete("cascade"),
    uniqueIndex("chart_calculations_reproducible_unique").on(
      table.birthProfileId,
      table.chartType,
      table.inputFingerprint,
      table.engineId,
      table.calculationVersion,
    ),
    index("chart_calculations_workspace_computed_idx").on(table.workspaceId, table.computedAt),
    index("chart_calculations_birth_profile_computed_idx").on(
      table.birthProfileId,
      table.computedAt,
    ),
    index("chart_calculations_signs_idx").on(
      table.workspaceId,
      table.ascendantSign,
      table.moonSign,
      table.sunSign,
    ),
    check(
      "chart_calculations_status_check",
      sql`${table.status} in ('pending', 'completed', 'failed', 'stale')`,
    ),
    check(
      "chart_calculations_ascendant_longitude_check",
      sql`${table.ascendantLongitude} is null or (${table.ascendantLongitude} >= 0 and ${table.ascendantLongitude} < 360)`,
    ),
    check(
      "chart_calculations_ascendant_degree_check",
      sql`${table.ascendantDegree} is null or (${table.ascendantDegree} >= 0 and ${table.ascendantDegree} < 30)`,
    ),
    check(
      "chart_calculations_nakshatra_pada_check",
      sql`${table.moonNakshatraPada} is null or ${table.moonNakshatraPada} between 1 and 4`,
    ),
  ],
);

/** Queryable D1 and divisional point placements. */
export const chartPlacements = pgTable(
  "chart_placements",
  {
    workspaceId: uuid("workspace_id").notNull(),
    chartId: uuid("chart_id").notNull(),
    division: smallint("division").default(1).notNull(),
    pointCode: varchar("point_code", { length: 40 }).notNull(),
    longitude: numeric("longitude", { precision: 12, scale: 8, mode: "number" }).notNull(),
    signCode: varchar("sign_code", { length: 20 }).notNull(),
    degreeInSign: numeric("degree_in_sign", { precision: 10, scale: 8, mode: "number" }).notNull(),
    houseNumber: smallint("house_number"),
    speed: numeric("speed", { precision: 12, scale: 8, mode: "number" }),
    isRetrograde: boolean("is_retrograde").default(false).notNull(),
    isCombust: boolean("is_combust").default(false).notNull(),
    nakshatraCode: varchar("nakshatra_code", { length: 40 }),
    pada: smallint("pada"),
    dignity: varchar("dignity", { length: 32 }),
  },
  (table) => [
    primaryKey({ columns: [table.chartId, table.division, table.pointCode] }),
    foreignKey({
      name: "chart_placements_workspace_chart_fk",
      columns: [table.workspaceId, table.chartId],
      foreignColumns: [chartCalculations.workspaceId, chartCalculations.id],
    }).onDelete("cascade"),
    index("chart_placements_analytics_idx").on(
      table.workspaceId,
      table.pointCode,
      table.signCode,
      table.houseNumber,
    ),
    check("chart_placements_division_check", sql`${table.division} between 1 and 144`),
    check(
      "chart_placements_longitude_check",
      sql`${table.longitude} >= 0 and ${table.longitude} < 360`,
    ),
    check(
      "chart_placements_degree_check",
      sql`${table.degreeInSign} >= 0 and ${table.degreeInSign} < 30`,
    ),
    check(
      "chart_placements_house_check",
      sql`${table.houseNumber} is null or ${table.houseNumber} between 1 and 12`,
    ),
    check("chart_placements_pada_check", sql`${table.pada} is null or ${table.pada} between 1 and 4`),
  ],
);

export const chartHouses = pgTable(
  "chart_houses",
  {
    workspaceId: uuid("workspace_id").notNull(),
    chartId: uuid("chart_id").notNull(),
    division: smallint("division").default(1).notNull(),
    houseNumber: smallint("house_number").notNull(),
    signCode: varchar("sign_code", { length: 20 }).notNull(),
    cuspLongitude: numeric("cusp_longitude", { precision: 12, scale: 8, mode: "number" }),
  },
  (table) => [
    primaryKey({ columns: [table.chartId, table.division, table.houseNumber] }),
    foreignKey({
      name: "chart_houses_workspace_chart_fk",
      columns: [table.workspaceId, table.chartId],
      foreignColumns: [chartCalculations.workspaceId, chartCalculations.id],
    }).onDelete("cascade"),
    index("chart_houses_analytics_idx").on(
      table.workspaceId,
      table.houseNumber,
      table.signCode,
    ),
    check("chart_houses_division_check", sql`${table.division} between 1 and 144`),
    check("chart_houses_number_check", sql`${table.houseNumber} between 1 and 12`),
    check(
      "chart_houses_cusp_check",
      sql`${table.cuspLongitude} is null or (${table.cuspLongitude} >= 0 and ${table.cuspLongitude} < 360)`,
    ),
  ],
);

export const chartAspects = pgTable(
  "chart_aspects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull(),
    chartId: uuid("chart_id").notNull(),
    division: smallint("division").default(1).notNull(),
    fromPoint: varchar("from_point", { length: 40 }).notNull(),
    toPoint: varchar("to_point", { length: 40 }).notNull(),
    aspectType: varchar("aspect_type", { length: 40 }).notNull(),
    exactAngle: numeric("exact_angle", { precision: 10, scale: 6, mode: "number" }),
    orb: numeric("orb", { precision: 10, scale: 6, mode: "number" }).notNull(),
    applying: boolean("applying").default(false).notNull(),
    isVedic: boolean("is_vedic").default(false).notNull(),
  },
  (table) => [
    foreignKey({
      name: "chart_aspects_workspace_chart_fk",
      columns: [table.workspaceId, table.chartId],
      foreignColumns: [chartCalculations.workspaceId, chartCalculations.id],
    }).onDelete("cascade"),
    uniqueIndex("chart_aspects_calculation_unique").on(
      table.chartId,
      table.division,
      table.fromPoint,
      table.toPoint,
      table.aspectType,
    ),
    index("chart_aspects_chart_idx").on(table.chartId, table.division),
    check("chart_aspects_division_check", sql`${table.division} between 1 and 144`),
    check(
      "chart_aspects_angle_check",
      sql`${table.exactAngle} is null or (${table.exactAngle} >= 0 and ${table.exactAngle} <= 360)`,
    ),
    check("chart_aspects_orb_check", sql`${table.orb} >= 0 and ${table.orb} <= 30`),
  ],
);

export const dashaPeriods = pgTable(
  "dasha_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull(),
    chartId: uuid("chart_id").notNull(),
    parentPeriodId: uuid("parent_period_id").references((): AnyPgColumn => dashaPeriods.id, {
      onDelete: "cascade",
    }),
    level: smallint("level").notNull(),
    lord: varchar("lord", { length: 40 }).notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    sequenceStartAt: timestamp("sequence_start_at", { withTimezone: true }),
    sequenceEndAt: timestamp("sequence_end_at", { withTimezone: true }),
    isPartial: boolean("is_partial").default(false).notNull(),
  },
  (table) => [
    unique("dasha_periods_workspace_id_id_unique").on(table.workspaceId, table.id),
    foreignKey({
      name: "dasha_periods_workspace_chart_fk",
      columns: [table.workspaceId, table.chartId],
      foreignColumns: [chartCalculations.workspaceId, chartCalculations.id],
    }).onDelete("cascade"),
    index("dasha_periods_chart_window_idx").on(table.chartId, table.startAt, table.endAt),
    check("dasha_periods_level_check", sql`${table.level} between 1 and 5`),
    check("dasha_periods_window_check", sql`${table.endAt} > ${table.startAt}`),
  ],
);

export const chartFindings = pgTable(
  "chart_findings",
  {
    workspaceId: uuid("workspace_id").notNull(),
    chartId: uuid("chart_id").notNull(),
    instanceKey: varchar("instance_key", { length: 255 }).notNull(),
    ruleId: varchar("rule_id", { length: 160 }).notNull(),
    category: varchar("category", { length: 40 }).notNull(),
    tier: varchar("tier", { length: 40 }).notNull(),
    priority: varchar("priority", { length: 20 }).notNull(),
    strength: numeric("strength", { precision: 7, scale: 6, mode: "number" }).notNull(),
    score: numeric("score", { precision: 7, scale: 6, mode: "number" }).notNull(),
    selected: boolean("selected").default(false).notNull(),
    rank: integer("rank").default(0).notNull(),
    rarityBand: varchar("rarity_band", { length: 24 }),
    displayJson: jsonb("display_json").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    evidenceJson: jsonb("evidence_json").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.chartId, table.instanceKey] }),
    foreignKey({
      name: "chart_findings_workspace_chart_fk",
      columns: [table.workspaceId, table.chartId],
      foreignColumns: [chartCalculations.workspaceId, chartCalculations.id],
    }).onDelete("cascade"),
    index("chart_findings_selected_idx").on(
      table.workspaceId,
      table.category,
      table.selected,
      table.rank,
    ),
    check("chart_findings_strength_check", sql`${table.strength} between 0 and 1`),
    check("chart_findings_score_check", sql`${table.score} between 0 and 1`),
    check("chart_findings_rank_check", sql`${table.rank} >= 0`),
  ],
);

export const compatibilityReports = pgTable(
  "compatibility_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull(),
    primaryClientId: uuid("primary_client_id").notNull(),
    partnerClientId: uuid("partner_client_id").notNull(),
    primaryChartId: uuid("primary_chart_id").notNull(),
    partnerChartId: uuid("partner_chart_id").notNull(),
    compatibilityScore: numeric("compatibility_score", { precision: 5, scale: 2, mode: "number" })
      .notNull(),
    summary: text("summary"),
    resultJson: jsonb("result_json").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    notes: text("notes").default("").notNull(),
    algorithmVersion: varchar("algorithm_version", { length: 80 }).notNull(),
    inputFingerprint: varchar("input_fingerprint", { length: 128 }).notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: "compatibility_reports_workspace_primary_client_fk",
      columns: [table.workspaceId, table.primaryClientId],
      foreignColumns: [clients.workspaceId, clients.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "compatibility_reports_workspace_partner_client_fk",
      columns: [table.workspaceId, table.partnerClientId],
      foreignColumns: [clients.workspaceId, clients.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "compatibility_reports_workspace_primary_chart_fk",
      columns: [table.workspaceId, table.primaryChartId],
      foreignColumns: [chartCalculations.workspaceId, chartCalculations.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "compatibility_reports_workspace_partner_chart_fk",
      columns: [table.workspaceId, table.partnerChartId],
      foreignColumns: [chartCalculations.workspaceId, chartCalculations.id],
    }).onDelete("cascade"),
    uniqueIndex("compatibility_reports_reproducible_unique").on(
      table.workspaceId,
      table.inputFingerprint,
      table.algorithmVersion,
    ),
    index("compatibility_reports_workspace_computed_idx").on(table.workspaceId, table.computedAt),
    check(
      "compatibility_reports_score_check",
      sql`${table.compatibilityScore} between 0 and 100`,
    ),
    check(
      "compatibility_reports_distinct_clients_check",
      sql`${table.primaryClientId} <> ${table.partnerClientId}`,
    ),
  ],
);

/** Object metadata only; image/PDF bytes live in object storage. */
export const assets = pgTable(
  "assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    clientId: uuid("client_id"),
    storageProvider: varchar("storage_provider", { length: 40 }).notNull(),
    objectKey: varchar("object_key", { length: 1024 }).notNull(),
    mimeType: varchar("mime_type", { length: 120 }).notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    unique("assets_workspace_id_id_unique").on(table.workspaceId, table.id),
    foreignKey({
      name: "assets_workspace_client_fk",
      columns: [table.workspaceId, table.clientId],
      foreignColumns: [clients.workspaceId, clients.id],
    }).onDelete("cascade"),
    uniqueIndex("assets_provider_object_key_unique").on(table.storageProvider, table.objectKey),
    index("assets_client_created_idx").on(table.clientId, table.createdAt),
    check("assets_byte_size_check", sql`${table.byteSize} >= 0`),
    check("assets_sha256_check", sql`${table.sha256} ~ '^[0-9a-fA-F]{64}$'`),
  ],
);

export const generatedArtifacts = pgTable(
  "generated_artifacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull(),
    clientId: uuid("client_id").notNull(),
    chartId: uuid("chart_id").references(() => chartCalculations.id, {
      onDelete: "set null",
    }),
    sourceAssetId: uuid("source_asset_id").references(() => assets.id, {
      onDelete: "set null",
    }),
    outputAssetId: uuid("output_asset_id").references(() => assets.id, {
      onDelete: "set null",
    }),
    artifactType: varchar("artifact_type", { length: 60 }).notNull(),
    status: varchar("status", { length: 24 }).default("completed").notNull(),
    title: varchar("title", { length: 255 }),
    targetStart: date("target_start", { mode: "string" }),
    targetEnd: date("target_end", { mode: "string" }),
    provider: varchar("provider", { length: 80 }),
    modelId: varchar("model_id", { length: 120 }),
    generatorVersion: varchar("generator_version", { length: 80 }),
    promptVersion: varchar("prompt_version", { length: 80 }),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costMicrousd: bigint("cost_microusd", { mode: "number" }),
    payloadJson: jsonb("payload_json").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    errorCode: varchar("error_code", { length: 80 }),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    foreignKey({
      name: "generated_artifacts_workspace_client_fk",
      columns: [table.workspaceId, table.clientId],
      foreignColumns: [clients.workspaceId, clients.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "generated_artifacts_workspace_chart_fk",
      columns: [table.workspaceId, table.chartId],
      foreignColumns: [chartCalculations.workspaceId, chartCalculations.id],
    }),
    foreignKey({
      name: "generated_artifacts_workspace_source_asset_fk",
      columns: [table.workspaceId, table.sourceAssetId],
      foreignColumns: [assets.workspaceId, assets.id],
    }),
    foreignKey({
      name: "generated_artifacts_workspace_output_asset_fk",
      columns: [table.workspaceId, table.outputAssetId],
      foreignColumns: [assets.workspaceId, assets.id],
    }),
    index("generated_artifacts_client_type_generated_idx").on(
      table.clientId,
      table.artifactType,
      table.generatedAt,
    ),
    check(
      "generated_artifacts_status_check",
      sql`${table.status} in ('pending', 'completed', 'failed', 'expired')`,
    ),
    check(
      "generated_artifacts_target_window_check",
      sql`${table.targetEnd} is null or ${table.targetStart} is null or ${table.targetEnd} >= ${table.targetStart}`,
    ),
    check(
      "generated_artifacts_token_check",
      sql`(${table.inputTokens} is null or ${table.inputTokens} >= 0) and (${table.outputTokens} is null or ${table.outputTokens} >= 0)`,
    ),
    check(
      "generated_artifacts_cost_check",
      sql`${table.costMicrousd} is null or ${table.costMicrousd} >= 0`,
    ),
  ],
);

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type BirthProfile = typeof birthProfiles.$inferSelect;
export type NewBirthProfile = typeof birthProfiles.$inferInsert;
export type ChartCalculation = typeof chartCalculations.$inferSelect;
export type NewChartCalculation = typeof chartCalculations.$inferInsert;
