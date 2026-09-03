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
	CONSTRAINT "consent_records_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "consent_records_purpose_not_blank" CHECK (char_length(btrim("consent_records"."purpose")) > 0),
	CONSTRAINT "consent_records_revoke_window_check" CHECK ("consent_records"."revoked_at" is null or "consent_records"."revoked_at" >= "consent_records"."granted_at")
);
--> statement-breakpoint
ALTER TABLE "birth_profiles" ADD COLUMN "consent_record_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_workspace_client_fk" FOREIGN KEY ("workspace_id","client_id") REFERENCES "public"."clients"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "consent_records_one_active_purpose_unique" ON "consent_records" USING btree ("client_id","purpose") WHERE "consent_records"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "consent_records_client_purpose_granted_idx" ON "consent_records" USING btree ("client_id","purpose","granted_at");--> statement-breakpoint
ALTER TABLE "birth_profiles" ADD CONSTRAINT "birth_profiles_workspace_consent_fk" FOREIGN KEY ("workspace_id","consent_record_id") REFERENCES "public"."consent_records"("workspace_id","id") ON DELETE no action ON UPDATE no action;