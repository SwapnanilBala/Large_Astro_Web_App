ALTER TABLE "generated_artifacts" DROP CONSTRAINT "generated_artifacts_consultation_id_consultations_id_fk";
--> statement-breakpoint
ALTER TABLE "generated_artifacts" DROP CONSTRAINT "generated_artifacts_workspace_consultation_fk";
--> statement-breakpoint
ALTER TABLE "generated_artifacts" DROP COLUMN "consultation_id";
--> statement-breakpoint
DROP TABLE "client_notes";
--> statement-breakpoint
DROP TABLE "client_tags";
--> statement-breakpoint
DROP TABLE "consent_records";
--> statement-breakpoint
DROP TABLE "audit_events";
--> statement-breakpoint
DROP TABLE "consultations";
--> statement-breakpoint
DROP TABLE "tags";
