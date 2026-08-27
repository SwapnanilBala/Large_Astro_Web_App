CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid,
	"storage_provider" varchar(40) NOT NULL,
	"object_key" varchar(1024) NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"byte_size" bigint NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "assets_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "assets_byte_size_check" CHECK ("assets"."byte_size" >= 0),
	CONSTRAINT "assets_sha256_check" CHECK ("assets"."sha256" ~ '^[0-9a-fA-F]{64}$')
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor_auth_user_id" varchar(255),
	"client_id" uuid,
	"entity_type" varchar(60) NOT NULL,
	"entity_id" uuid,
	"action" varchar(60) NOT NULL,
	"changed_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"request_id" varchar(120),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_entity_type_not_blank" CHECK (char_length(btrim("audit_events"."entity_type")) > 0),
	CONSTRAINT "audit_events_action_not_blank" CHECK (char_length(btrim("audit_events"."action")) > 0)
);
--> statement-breakpoint
CREATE TABLE "birth_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"label" varchar(80) DEFAULT 'Primary' NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"birth_date" date NOT NULL,
	"reported_birth_time" time(0),
	"calculation_birth_time" time(0) NOT NULL,
	"birth_time_accuracy" varchar(24) DEFAULT 'unknown' NOT NULL,
	"birth_record_source" varchar(32) DEFAULT 'unknown' NOT NULL,
	"calculation_time_is_fallback" boolean DEFAULT false NOT NULL,
	"country" varchar(120),
	"state" varchar(120),
	"city" varchar(120),
	"town" varchar(120),
	"place_label" varchar(255),
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"time_zone_id" varchar(100),
	"supplied_utc_offset_minutes" smallint,
	"resolved_utc_offset_minutes" smallint,
	"timezone_source" varchar(32),
	"birth_instant_utc" timestamp with time zone,
	"source_notes" text,
	"supersedes_birth_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "birth_profiles_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "birth_profiles_accuracy_check" CHECK ("birth_profiles"."birth_time_accuracy" in ('exact', 'morning', 'afternoon', 'evening', 'unknown')),
	CONSTRAINT "birth_profiles_record_source_check" CHECK ("birth_profiles"."birth_record_source" in ('certificate', 'hospital_record', 'family', 'self_report', 'rectified', 'estimated', 'unknown')),
	CONSTRAINT "birth_profiles_timezone_source_check" CHECK ("birth_profiles"."timezone_source" is null or "birth_profiles"."timezone_source" in ('coordinates', 'time_zone_id', 'numeric_offset')),
	CONSTRAINT "birth_profiles_latitude_check" CHECK ("birth_profiles"."latitude" is null or "birth_profiles"."latitude" between -90 and 90),
	CONSTRAINT "birth_profiles_longitude_check" CHECK ("birth_profiles"."longitude" is null or "birth_profiles"."longitude" between -180 and 180),
	CONSTRAINT "birth_profiles_coordinate_pair_check" CHECK (("birth_profiles"."latitude" is null) = ("birth_profiles"."longitude" is null)),
	CONSTRAINT "birth_profiles_supplied_offset_check" CHECK ("birth_profiles"."supplied_utc_offset_minutes" is null or "birth_profiles"."supplied_utc_offset_minutes" between -720 and 840),
	CONSTRAINT "birth_profiles_resolved_offset_check" CHECK ("birth_profiles"."resolved_utc_offset_minutes" is null or "birth_profiles"."resolved_utc_offset_minutes" between -720 and 840),
	CONSTRAINT "birth_profiles_exact_time_check" CHECK ("birth_profiles"."birth_time_accuracy" <> 'exact' or "birth_profiles"."reported_birth_time" is not null),
	CONSTRAINT "birth_profiles_fallback_consistency_check" CHECK ("birth_profiles"."calculation_time_is_fallback" = true or "birth_profiles"."reported_birth_time" is not null)
);
--> statement-breakpoint
CREATE TABLE "chart_aspects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"chart_id" uuid NOT NULL,
	"division" smallint DEFAULT 1 NOT NULL,
	"from_point" varchar(40) NOT NULL,
	"to_point" varchar(40) NOT NULL,
	"aspect_type" varchar(40) NOT NULL,
	"exact_angle" numeric(10, 6),
	"orb" numeric(10, 6) NOT NULL,
	"applying" boolean DEFAULT false NOT NULL,
	"is_vedic" boolean DEFAULT false NOT NULL,
	CONSTRAINT "chart_aspects_division_check" CHECK ("chart_aspects"."division" between 1 and 144),
	CONSTRAINT "chart_aspects_angle_check" CHECK ("chart_aspects"."exact_angle" is null or ("chart_aspects"."exact_angle" >= 0 and "chart_aspects"."exact_angle" <= 360)),
	CONSTRAINT "chart_aspects_orb_check" CHECK ("chart_aspects"."orb" >= 0 and "chart_aspects"."orb" <= 30)
);
--> statement-breakpoint
CREATE TABLE "chart_calculations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"birth_profile_id" uuid NOT NULL,
	"chart_type" varchar(40) DEFAULT 'natal' NOT NULL,
	"input_fingerprint" varchar(128) NOT NULL,
	"engine_id" varchar(80) NOT NULL,
	"calculation_version" varchar(80) NOT NULL,
	"rules_dataset_version" varchar(80),
	"schema_version" integer DEFAULT 1 NOT NULL,
	"ephemeris_provider" varchar(120),
	"ayanamsha" varchar(80),
	"house_system" varchar(80),
	"house_system_code" varchar(24),
	"julian_day_ut" numeric(18, 8),
	"status" varchar(24) DEFAULT 'completed' NOT NULL,
	"error_code" varchar(80),
	"error_message" text,
	"fallback_mode" boolean DEFAULT false NOT NULL,
	"ascendant_sign" varchar(20),
	"ascendant_longitude" numeric(12, 8),
	"ascendant_degree" numeric(10, 8),
	"sun_sign" varchar(20),
	"moon_sign" varchar(20),
	"moon_nakshatra" varchar(40),
	"moon_nakshatra_pada" smallint,
	"summary" text,
	"result_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"calculation_audit_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "chart_calculations_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "chart_calculations_status_check" CHECK ("chart_calculations"."status" in ('pending', 'completed', 'failed', 'stale')),
	CONSTRAINT "chart_calculations_ascendant_longitude_check" CHECK ("chart_calculations"."ascendant_longitude" is null or ("chart_calculations"."ascendant_longitude" >= 0 and "chart_calculations"."ascendant_longitude" < 360)),
	CONSTRAINT "chart_calculations_ascendant_degree_check" CHECK ("chart_calculations"."ascendant_degree" is null or ("chart_calculations"."ascendant_degree" >= 0 and "chart_calculations"."ascendant_degree" < 30)),
	CONSTRAINT "chart_calculations_nakshatra_pada_check" CHECK ("chart_calculations"."moon_nakshatra_pada" is null or "chart_calculations"."moon_nakshatra_pada" between 1 and 4)
);
--> statement-breakpoint
CREATE TABLE "chart_findings" (
	"workspace_id" uuid NOT NULL,
	"chart_id" uuid NOT NULL,
	"instance_key" varchar(255) NOT NULL,
	"rule_id" varchar(160) NOT NULL,
	"category" varchar(40) NOT NULL,
	"tier" varchar(40) NOT NULL,
	"priority" varchar(20) NOT NULL,
	"strength" numeric(7, 6) NOT NULL,
	"score" numeric(7, 6) NOT NULL,
	"selected" boolean DEFAULT false NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	"rarity_band" varchar(24),
	"display_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"evidence_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "chart_findings_chart_id_instance_key_pk" PRIMARY KEY("chart_id","instance_key"),
	CONSTRAINT "chart_findings_strength_check" CHECK ("chart_findings"."strength" between 0 and 1),
	CONSTRAINT "chart_findings_score_check" CHECK ("chart_findings"."score" between 0 and 1),
	CONSTRAINT "chart_findings_rank_check" CHECK ("chart_findings"."rank" >= 0)
);
--> statement-breakpoint
CREATE TABLE "chart_houses" (
	"workspace_id" uuid NOT NULL,
	"chart_id" uuid NOT NULL,
	"division" smallint DEFAULT 1 NOT NULL,
	"house_number" smallint NOT NULL,
	"sign_code" varchar(20) NOT NULL,
	"cusp_longitude" numeric(12, 8),
	CONSTRAINT "chart_houses_chart_id_division_house_number_pk" PRIMARY KEY("chart_id","division","house_number"),
	CONSTRAINT "chart_houses_division_check" CHECK ("chart_houses"."division" between 1 and 144),
	CONSTRAINT "chart_houses_number_check" CHECK ("chart_houses"."house_number" between 1 and 12),
	CONSTRAINT "chart_houses_cusp_check" CHECK ("chart_houses"."cusp_longitude" is null or ("chart_houses"."cusp_longitude" >= 0 and "chart_houses"."cusp_longitude" < 360))
);
--> statement-breakpoint
CREATE TABLE "chart_placements" (
	"workspace_id" uuid NOT NULL,
	"chart_id" uuid NOT NULL,
	"division" smallint DEFAULT 1 NOT NULL,
	"point_code" varchar(40) NOT NULL,
	"longitude" numeric(12, 8) NOT NULL,
	"sign_code" varchar(20) NOT NULL,
	"degree_in_sign" numeric(10, 8) NOT NULL,
	"house_number" smallint,
	"speed" numeric(12, 8),
	"is_retrograde" boolean DEFAULT false NOT NULL,
	"is_combust" boolean DEFAULT false NOT NULL,
	"nakshatra_code" varchar(40),
	"pada" smallint,
	"dignity" varchar(32),
	CONSTRAINT "chart_placements_chart_id_division_point_code_pk" PRIMARY KEY("chart_id","division","point_code"),
	CONSTRAINT "chart_placements_division_check" CHECK ("chart_placements"."division" between 1 and 144),
	CONSTRAINT "chart_placements_longitude_check" CHECK ("chart_placements"."longitude" >= 0 and "chart_placements"."longitude" < 360),
	CONSTRAINT "chart_placements_degree_check" CHECK ("chart_placements"."degree_in_sign" >= 0 and "chart_placements"."degree_in_sign" < 30),
	CONSTRAINT "chart_placements_house_check" CHECK ("chart_placements"."house_number" is null or "chart_placements"."house_number" between 1 and 12),
	CONSTRAINT "chart_placements_pada_check" CHECK ("chart_placements"."pada" is null or "chart_placements"."pada" between 1 and 4)
);
--> statement-breakpoint
CREATE TABLE "client_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"consultation_id" uuid,
	"note_type" varchar(40) DEFAULT 'general' NOT NULL,
	"body" text NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"author_auth_user_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "client_notes_body_not_blank" CHECK (char_length(btrim("client_notes"."body")) > 0)
);
--> statement-breakpoint
CREATE TABLE "client_tags" (
	"workspace_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"assigned_by_auth_user_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_tags_client_id_tag_id_pk" PRIMARY KEY("client_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"preferred_name" varchar(120),
	"email" varchar(320),
	"phone_e164" varchar(32),
	"preferred_contact_method" varchar(24),
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"source" varchar(80),
	"external_reference" varchar(120),
	"locale" varchar(35),
	"time_zone_id" varchar(100),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_auth_user_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "clients_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "clients_display_name_not_blank" CHECK (char_length(btrim("clients"."display_name")) > 0),
	CONSTRAINT "clients_status_check" CHECK ("clients"."status" in ('lead', 'active', 'inactive', 'archived')),
	CONSTRAINT "clients_contact_method_check" CHECK ("clients"."preferred_contact_method" is null or "clients"."preferred_contact_method" in ('email', 'phone', 'sms', 'whatsapp', 'none')),
	CONSTRAINT "clients_phone_e164_check" CHECK ("clients"."phone_e164" is null or "clients"."phone_e164" ~ '^\+[1-9][0-9]{7,14}$')
);
--> statement-breakpoint
CREATE TABLE "compatibility_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"primary_client_id" uuid NOT NULL,
	"partner_client_id" uuid NOT NULL,
	"primary_chart_id" uuid NOT NULL,
	"partner_chart_id" uuid NOT NULL,
	"compatibility_score" numeric(5, 2) NOT NULL,
	"summary" text,
	"result_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"algorithm_version" varchar(80) NOT NULL,
	"input_fingerprint" varchar(128) NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "compatibility_reports_score_check" CHECK ("compatibility_reports"."compatibility_score" between 0 and 100),
	CONSTRAINT "compatibility_reports_distinct_clients_check" CHECK ("compatibility_reports"."primary_client_id" <> "compatibility_reports"."partner_client_id")
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"purpose" varchar(80) NOT NULL,
	"policy_version" varchar(40) NOT NULL,
	"granted_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"capture_source" varchar(60),
	"evidence_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consent_records_purpose_not_blank" CHECK (char_length(btrim("consent_records"."purpose")) > 0),
	CONSTRAINT "consent_records_revoke_window_check" CHECK ("consent_records"."revoked_at" is null or "consent_records"."revoked_at" >= "consent_records"."granted_at")
);
--> statement-breakpoint
CREATE TABLE "consultations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"chart_id" uuid,
	"status" varchar(24) DEFAULT 'scheduled' NOT NULL,
	"consultation_type" varchar(60),
	"channel" varchar(40),
	"scheduled_start" timestamp with time zone,
	"scheduled_end" timestamp with time zone,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"goals" text,
	"summary" text,
	"recommendations" text,
	"follow_up_at" timestamp with time zone,
	"practitioner_auth_user_id" varchar(255),
	"fee_minor" integer,
	"currency" varchar(3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "consultations_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "consultations_status_check" CHECK ("consultations"."status" in ('draft', 'scheduled', 'completed', 'cancelled', 'no_show')),
	CONSTRAINT "consultations_schedule_window_check" CHECK ("consultations"."scheduled_end" is null or "consultations"."scheduled_start" is null or "consultations"."scheduled_end" > "consultations"."scheduled_start"),
	CONSTRAINT "consultations_actual_window_check" CHECK ("consultations"."ended_at" is null or "consultations"."started_at" is null or "consultations"."ended_at" > "consultations"."started_at"),
	CONSTRAINT "consultations_fee_check" CHECK ("consultations"."fee_minor" is null or "consultations"."fee_minor" >= 0),
	CONSTRAINT "consultations_currency_check" CHECK ("consultations"."currency" is null or "consultations"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "dasha_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"chart_id" uuid NOT NULL,
	"parent_period_id" uuid,
	"level" smallint NOT NULL,
	"lord" varchar(40) NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"sequence_start_at" timestamp with time zone,
	"sequence_end_at" timestamp with time zone,
	"is_partial" boolean DEFAULT false NOT NULL,
	CONSTRAINT "dasha_periods_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "dasha_periods_level_check" CHECK ("dasha_periods"."level" between 1 and 5),
	CONSTRAINT "dasha_periods_window_check" CHECK ("dasha_periods"."end_at" > "dasha_periods"."start_at")
);
--> statement-breakpoint
CREATE TABLE "generated_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"chart_id" uuid,
	"consultation_id" uuid,
	"source_asset_id" uuid,
	"output_asset_id" uuid,
	"artifact_type" varchar(60) NOT NULL,
	"status" varchar(24) DEFAULT 'completed' NOT NULL,
	"title" varchar(255),
	"target_start" date,
	"target_end" date,
	"provider" varchar(80),
	"model_id" varchar(120),
	"generator_version" varchar(80),
	"prompt_version" varchar(80),
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_microusd" bigint,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_code" varchar(80),
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generated_artifacts_status_check" CHECK ("generated_artifacts"."status" in ('pending', 'completed', 'failed', 'expired')),
	CONSTRAINT "generated_artifacts_target_window_check" CHECK ("generated_artifacts"."target_end" is null or "generated_artifacts"."target_start" is null or "generated_artifacts"."target_end" >= "generated_artifacts"."target_start"),
	CONSTRAINT "generated_artifacts_token_check" CHECK (("generated_artifacts"."input_tokens" is null or "generated_artifacts"."input_tokens" >= 0) and ("generated_artifacts"."output_tokens" is null or "generated_artifacts"."output_tokens" >= 0)),
	CONSTRAINT "generated_artifacts_cost_check" CHECK ("generated_artifacts"."cost_microusd" is null or "generated_artifacts"."cost_microusd" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"color" varchar(24),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tags_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "tags_name_not_blank" CHECK (char_length(btrim("tags"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"workspace_id" uuid NOT NULL,
	"auth_user_id" varchar(255) NOT NULL,
	"role" varchar(24) DEFAULT 'owner' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "workspace_members_workspace_id_auth_user_id_pk" PRIMARY KEY("workspace_id","auth_user_id"),
	CONSTRAINT "workspace_members_role_check" CHECK ("workspace_members"."role" in ('owner', 'admin', 'practitioner', 'viewer'))
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(80),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "workspaces_name_not_blank" CHECK (char_length(btrim("workspaces"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_workspace_client_fk" FOREIGN KEY ("workspace_id","client_id") REFERENCES "public"."clients"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_profiles" ADD CONSTRAINT "birth_profiles_supersedes_birth_profile_id_birth_profiles_id_fk" FOREIGN KEY ("supersedes_birth_profile_id") REFERENCES "public"."birth_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_profiles" ADD CONSTRAINT "birth_profiles_workspace_client_fk" FOREIGN KEY ("workspace_id","client_id") REFERENCES "public"."clients"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_aspects" ADD CONSTRAINT "chart_aspects_workspace_chart_fk" FOREIGN KEY ("workspace_id","chart_id") REFERENCES "public"."chart_calculations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_calculations" ADD CONSTRAINT "chart_calculations_workspace_birth_profile_fk" FOREIGN KEY ("workspace_id","birth_profile_id") REFERENCES "public"."birth_profiles"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_findings" ADD CONSTRAINT "chart_findings_workspace_chart_fk" FOREIGN KEY ("workspace_id","chart_id") REFERENCES "public"."chart_calculations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_houses" ADD CONSTRAINT "chart_houses_workspace_chart_fk" FOREIGN KEY ("workspace_id","chart_id") REFERENCES "public"."chart_calculations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_placements" ADD CONSTRAINT "chart_placements_workspace_chart_fk" FOREIGN KEY ("workspace_id","chart_id") REFERENCES "public"."chart_calculations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_workspace_client_fk" FOREIGN KEY ("workspace_id","client_id") REFERENCES "public"."clients"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_tags" ADD CONSTRAINT "client_tags_workspace_client_fk" FOREIGN KEY ("workspace_id","client_id") REFERENCES "public"."clients"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_tags" ADD CONSTRAINT "client_tags_workspace_tag_fk" FOREIGN KEY ("workspace_id","tag_id") REFERENCES "public"."tags"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compatibility_reports" ADD CONSTRAINT "compatibility_reports_workspace_primary_client_fk" FOREIGN KEY ("workspace_id","primary_client_id") REFERENCES "public"."clients"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compatibility_reports" ADD CONSTRAINT "compatibility_reports_workspace_partner_client_fk" FOREIGN KEY ("workspace_id","partner_client_id") REFERENCES "public"."clients"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compatibility_reports" ADD CONSTRAINT "compatibility_reports_workspace_primary_chart_fk" FOREIGN KEY ("workspace_id","primary_chart_id") REFERENCES "public"."chart_calculations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compatibility_reports" ADD CONSTRAINT "compatibility_reports_workspace_partner_chart_fk" FOREIGN KEY ("workspace_id","partner_chart_id") REFERENCES "public"."chart_calculations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_workspace_client_fk" FOREIGN KEY ("workspace_id","client_id") REFERENCES "public"."clients"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_chart_id_chart_calculations_id_fk" FOREIGN KEY ("chart_id") REFERENCES "public"."chart_calculations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_workspace_client_fk" FOREIGN KEY ("workspace_id","client_id") REFERENCES "public"."clients"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dasha_periods" ADD CONSTRAINT "dasha_periods_parent_period_id_dasha_periods_id_fk" FOREIGN KEY ("parent_period_id") REFERENCES "public"."dasha_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dasha_periods" ADD CONSTRAINT "dasha_periods_workspace_chart_fk" FOREIGN KEY ("workspace_id","chart_id") REFERENCES "public"."chart_calculations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_chart_id_chart_calculations_id_fk" FOREIGN KEY ("chart_id") REFERENCES "public"."chart_calculations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_source_asset_id_assets_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_output_asset_id_assets_id_fk" FOREIGN KEY ("output_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_workspace_client_fk" FOREIGN KEY ("workspace_id","client_id") REFERENCES "public"."clients"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assets_provider_object_key_unique" ON "assets" USING btree ("storage_provider","object_key");--> statement-breakpoint
CREATE INDEX "assets_client_created_idx" ON "assets" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_workspace_occurred_idx" ON "audit_events" USING btree ("workspace_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "birth_profiles_one_primary_per_client_unique" ON "birth_profiles" USING btree ("client_id") WHERE "birth_profiles"."is_primary" = true and "birth_profiles"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "birth_profiles_client_updated_idx" ON "birth_profiles" USING btree ("client_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "chart_aspects_calculation_unique" ON "chart_aspects" USING btree ("chart_id","division","from_point","to_point","aspect_type");--> statement-breakpoint
CREATE INDEX "chart_aspects_chart_idx" ON "chart_aspects" USING btree ("chart_id","division");--> statement-breakpoint
CREATE UNIQUE INDEX "chart_calculations_reproducible_unique" ON "chart_calculations" USING btree ("birth_profile_id","chart_type","input_fingerprint","engine_id","calculation_version");--> statement-breakpoint
CREATE INDEX "chart_calculations_workspace_computed_idx" ON "chart_calculations" USING btree ("workspace_id","computed_at");--> statement-breakpoint
CREATE INDEX "chart_calculations_birth_profile_computed_idx" ON "chart_calculations" USING btree ("birth_profile_id","computed_at");--> statement-breakpoint
CREATE INDEX "chart_calculations_signs_idx" ON "chart_calculations" USING btree ("workspace_id","ascendant_sign","moon_sign","sun_sign");--> statement-breakpoint
CREATE INDEX "chart_findings_selected_idx" ON "chart_findings" USING btree ("workspace_id","category","selected","rank");--> statement-breakpoint
CREATE INDEX "chart_houses_analytics_idx" ON "chart_houses" USING btree ("workspace_id","house_number","sign_code");--> statement-breakpoint
CREATE INDEX "chart_placements_analytics_idx" ON "chart_placements" USING btree ("workspace_id","point_code","sign_code","house_number");--> statement-breakpoint
CREATE INDEX "client_notes_client_updated_idx" ON "client_notes" USING btree ("client_id","updated_at");--> statement-breakpoint
CREATE INDEX "client_notes_workspace_pinned_idx" ON "client_notes" USING btree ("workspace_id","is_pinned");--> statement-breakpoint
CREATE INDEX "clients_workspace_status_updated_idx" ON "clients" USING btree ("workspace_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "clients_workspace_name_idx" ON "clients" USING btree ("workspace_id",lower("display_name"));--> statement-breakpoint
CREATE INDEX "clients_workspace_email_idx" ON "clients" USING btree ("workspace_id",lower("email")) WHERE "clients"."email" is not null and "clients"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_workspace_external_reference_unique" ON "clients" USING btree ("workspace_id","external_reference") WHERE "clients"."external_reference" is not null and "clients"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "compatibility_reports_reproducible_unique" ON "compatibility_reports" USING btree ("workspace_id","input_fingerprint","algorithm_version");--> statement-breakpoint
CREATE INDEX "compatibility_reports_workspace_computed_idx" ON "compatibility_reports" USING btree ("workspace_id","computed_at");--> statement-breakpoint
CREATE INDEX "consent_records_client_purpose_granted_idx" ON "consent_records" USING btree ("client_id","purpose","granted_at");--> statement-breakpoint
CREATE INDEX "consultations_client_schedule_idx" ON "consultations" USING btree ("client_id","scheduled_start");--> statement-breakpoint
CREATE INDEX "consultations_workspace_status_schedule_idx" ON "consultations" USING btree ("workspace_id","status","scheduled_start");--> statement-breakpoint
CREATE INDEX "dasha_periods_chart_window_idx" ON "dasha_periods" USING btree ("chart_id","start_at","end_at");--> statement-breakpoint
CREATE INDEX "generated_artifacts_client_type_generated_idx" ON "generated_artifacts" USING btree ("client_id","artifact_type","generated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_workspace_lower_name_unique" ON "tags" USING btree ("workspace_id",lower("name")) WHERE "tags"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "workspace_members_auth_user_idx" ON "workspace_members" USING btree ("auth_user_id","removed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_slug_unique" ON "workspaces" USING btree ("slug") WHERE "workspaces"."slug" is not null and "workspaces"."archived_at" is null;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	NEW.updated_at = now();
	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "workspaces_set_updated_at"
BEFORE UPDATE ON "workspaces"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER "workspace_members_set_updated_at"
BEFORE UPDATE ON "workspace_members"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER "clients_set_updated_at"
BEFORE UPDATE ON "clients"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER "birth_profiles_set_updated_at"
BEFORE UPDATE ON "birth_profiles"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER "tags_set_updated_at"
BEFORE UPDATE ON "tags"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER "consultations_set_updated_at"
BEFORE UPDATE ON "consultations"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER "client_notes_set_updated_at"
BEFORE UPDATE ON "client_notes"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER "compatibility_reports_set_updated_at"
BEFORE UPDATE ON "compatibility_reports"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER "generated_artifacts_set_updated_at"
BEFORE UPDATE ON "generated_artifacts"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
