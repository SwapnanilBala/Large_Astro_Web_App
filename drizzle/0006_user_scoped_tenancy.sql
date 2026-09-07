-- Replace `workspaces` as the tenant root with `auth_users`.
--
-- `workspaces` + `workspace_members` existed so that a browser with no login
-- still had a row to hang data off: a device wrote as `anon:<device>`, a
-- signed-in person as `user:<id>`, both were the same shape, and signing in
-- claimed the device's workspace rather than migrating out of it. Google is now
-- the only way in (see `lib/local-scope.ts`, which retired the local profile
-- picker), so there is no second kind of subject left for the indirection to
-- abstract over, and one account owning exactly one workspace made the join
-- table a rename of `auth_users` with extra steps.
--
-- What this costs, stated plainly rather than discovered later: **a visitor who
-- has not signed in has nowhere on the server to put a chart.** Guest
-- persistence was a real feature and this removes it. The browser still keeps
-- their charts; nothing reaches Postgres until they sign in.
--
-- `workspace_id` was not a leaf column. It was the first column of 6 composite
-- unique constraints, 18 composite foreign keys and 11 indexes across 12
-- tables, so this is a re-key rather than a drop: add `user_id`, backfill it
-- from `workspace_members`, rebuild every constraint on it, and only then drop
-- the old column and the two tables.
--
-- Rows in a workspace that no account ever claimed cannot be mapped, and the
-- guard below aborts instead of deleting them. That direction is deliberate:
-- these are birth dates, times and places, and quietly destroying them to let a
-- migration finish is the wrong trade. On the branch this was written against
-- the count is zero — the two `anon:` workspaces hold no rows in any table.

ALTER TABLE "assets" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "birth_profiles" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "chart_aspects" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "chart_calculations" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "chart_findings" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "chart_houses" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "chart_placements" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "compatibility_reports" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "consent_records" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "dasha_periods" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "generated_artifacts" ADD COLUMN "user_id" uuid;--> statement-breakpoint

-- The mapping, applied 12 times. `DISTINCT ON ... ORDER BY joined_at` picks the
-- earliest owner, because the primary key is (workspace_id, auth_user_id) and
-- nothing stopped a workspace from having two `user:` members.
UPDATE "assets" AS t SET "user_id" = o."user_id" FROM (SELECT DISTINCT ON (workspace_id) workspace_id, (substring(auth_user_id FROM 6))::uuid AS "user_id" FROM "workspace_members" WHERE auth_user_id LIKE 'user:%' AND removed_at IS NULL ORDER BY workspace_id, joined_at) AS o WHERE o.workspace_id = t."workspace_id";--> statement-breakpoint
UPDATE "birth_profiles" AS t SET "user_id" = o."user_id" FROM (SELECT DISTINCT ON (workspace_id) workspace_id, (substring(auth_user_id FROM 6))::uuid AS "user_id" FROM "workspace_members" WHERE auth_user_id LIKE 'user:%' AND removed_at IS NULL ORDER BY workspace_id, joined_at) AS o WHERE o.workspace_id = t."workspace_id";--> statement-breakpoint
UPDATE "chart_aspects" AS t SET "user_id" = o."user_id" FROM (SELECT DISTINCT ON (workspace_id) workspace_id, (substring(auth_user_id FROM 6))::uuid AS "user_id" FROM "workspace_members" WHERE auth_user_id LIKE 'user:%' AND removed_at IS NULL ORDER BY workspace_id, joined_at) AS o WHERE o.workspace_id = t."workspace_id";--> statement-breakpoint
UPDATE "chart_calculations" AS t SET "user_id" = o."user_id" FROM (SELECT DISTINCT ON (workspace_id) workspace_id, (substring(auth_user_id FROM 6))::uuid AS "user_id" FROM "workspace_members" WHERE auth_user_id LIKE 'user:%' AND removed_at IS NULL ORDER BY workspace_id, joined_at) AS o WHERE o.workspace_id = t."workspace_id";--> statement-breakpoint
UPDATE "chart_findings" AS t SET "user_id" = o."user_id" FROM (SELECT DISTINCT ON (workspace_id) workspace_id, (substring(auth_user_id FROM 6))::uuid AS "user_id" FROM "workspace_members" WHERE auth_user_id LIKE 'user:%' AND removed_at IS NULL ORDER BY workspace_id, joined_at) AS o WHERE o.workspace_id = t."workspace_id";--> statement-breakpoint
UPDATE "chart_houses" AS t SET "user_id" = o."user_id" FROM (SELECT DISTINCT ON (workspace_id) workspace_id, (substring(auth_user_id FROM 6))::uuid AS "user_id" FROM "workspace_members" WHERE auth_user_id LIKE 'user:%' AND removed_at IS NULL ORDER BY workspace_id, joined_at) AS o WHERE o.workspace_id = t."workspace_id";--> statement-breakpoint
UPDATE "chart_placements" AS t SET "user_id" = o."user_id" FROM (SELECT DISTINCT ON (workspace_id) workspace_id, (substring(auth_user_id FROM 6))::uuid AS "user_id" FROM "workspace_members" WHERE auth_user_id LIKE 'user:%' AND removed_at IS NULL ORDER BY workspace_id, joined_at) AS o WHERE o.workspace_id = t."workspace_id";--> statement-breakpoint
UPDATE "clients" AS t SET "user_id" = o."user_id" FROM (SELECT DISTINCT ON (workspace_id) workspace_id, (substring(auth_user_id FROM 6))::uuid AS "user_id" FROM "workspace_members" WHERE auth_user_id LIKE 'user:%' AND removed_at IS NULL ORDER BY workspace_id, joined_at) AS o WHERE o.workspace_id = t."workspace_id";--> statement-breakpoint
UPDATE "compatibility_reports" AS t SET "user_id" = o."user_id" FROM (SELECT DISTINCT ON (workspace_id) workspace_id, (substring(auth_user_id FROM 6))::uuid AS "user_id" FROM "workspace_members" WHERE auth_user_id LIKE 'user:%' AND removed_at IS NULL ORDER BY workspace_id, joined_at) AS o WHERE o.workspace_id = t."workspace_id";--> statement-breakpoint
UPDATE "consent_records" AS t SET "user_id" = o."user_id" FROM (SELECT DISTINCT ON (workspace_id) workspace_id, (substring(auth_user_id FROM 6))::uuid AS "user_id" FROM "workspace_members" WHERE auth_user_id LIKE 'user:%' AND removed_at IS NULL ORDER BY workspace_id, joined_at) AS o WHERE o.workspace_id = t."workspace_id";--> statement-breakpoint
UPDATE "dasha_periods" AS t SET "user_id" = o."user_id" FROM (SELECT DISTINCT ON (workspace_id) workspace_id, (substring(auth_user_id FROM 6))::uuid AS "user_id" FROM "workspace_members" WHERE auth_user_id LIKE 'user:%' AND removed_at IS NULL ORDER BY workspace_id, joined_at) AS o WHERE o.workspace_id = t."workspace_id";--> statement-breakpoint
UPDATE "generated_artifacts" AS t SET "user_id" = o."user_id" FROM (SELECT DISTINCT ON (workspace_id) workspace_id, (substring(auth_user_id FROM 6))::uuid AS "user_id" FROM "workspace_members" WHERE auth_user_id LIKE 'user:%' AND removed_at IS NULL ORDER BY workspace_id, joined_at) AS o WHERE o.workspace_id = t."workspace_id";--> statement-breakpoint

-- Refuse rather than delete. An unmapped row means data in a workspace no
-- account ever signed in to claim; the `NOT NULL` below would fail anyway, and
-- this says which table and how many instead of leaving that to be guessed.
DO $unmapped_rows$
DECLARE
  offending text := '';
  n bigint;
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['assets','birth_profiles','chart_aspects','chart_calculations','chart_findings','chart_houses','chart_placements','clients','compatibility_reports','consent_records','dasha_periods','generated_artifacts'] LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE user_id IS NULL', t) INTO n;
    IF n > 0 THEN
      offending := offending || format('%s: %s row(s); ', t, n);
    END IF;
  END LOOP;

  IF offending <> '' THEN
    RAISE EXCEPTION
      'migration 0006 stopped: rows belong to a workspace with no signed-in owner -- %', offending
      USING HINT = 'These are anonymous guest rows. Decide explicitly: attach them to an auth_users row, or delete them, then re-run.';
  END IF;
END
$unmapped_rows$;--> statement-breakpoint

-- Every foreign key whose definition mentions workspace_id: 2 simple, to
-- workspaces, and 18 composite, between the data tables. The other 7 foreign
-- keys in the schema reference single-column primary keys and are untouched.
ALTER TABLE "assets" DROP CONSTRAINT "assets_workspace_id_workspaces_id_fk";--> statement-breakpoint
ALTER TABLE "clients" DROP CONSTRAINT "clients_workspace_id_workspaces_id_fk";--> statement-breakpoint
ALTER TABLE "assets" DROP CONSTRAINT "assets_workspace_client_fk";--> statement-breakpoint
ALTER TABLE "birth_profiles" DROP CONSTRAINT "birth_profiles_workspace_client_fk";--> statement-breakpoint
ALTER TABLE "birth_profiles" DROP CONSTRAINT "birth_profiles_workspace_consent_fk";--> statement-breakpoint
ALTER TABLE "chart_aspects" DROP CONSTRAINT "chart_aspects_workspace_chart_fk";--> statement-breakpoint
ALTER TABLE "chart_calculations" DROP CONSTRAINT "chart_calculations_workspace_birth_profile_fk";--> statement-breakpoint
ALTER TABLE "chart_findings" DROP CONSTRAINT "chart_findings_workspace_chart_fk";--> statement-breakpoint
ALTER TABLE "chart_houses" DROP CONSTRAINT "chart_houses_workspace_chart_fk";--> statement-breakpoint
ALTER TABLE "chart_placements" DROP CONSTRAINT "chart_placements_workspace_chart_fk";--> statement-breakpoint
ALTER TABLE "compatibility_reports" DROP CONSTRAINT "compatibility_reports_workspace_primary_client_fk";--> statement-breakpoint
ALTER TABLE "compatibility_reports" DROP CONSTRAINT "compatibility_reports_workspace_partner_client_fk";--> statement-breakpoint
ALTER TABLE "compatibility_reports" DROP CONSTRAINT "compatibility_reports_workspace_primary_chart_fk";--> statement-breakpoint
ALTER TABLE "compatibility_reports" DROP CONSTRAINT "compatibility_reports_workspace_partner_chart_fk";--> statement-breakpoint
ALTER TABLE "consent_records" DROP CONSTRAINT "consent_records_workspace_client_fk";--> statement-breakpoint
ALTER TABLE "dasha_periods" DROP CONSTRAINT "dasha_periods_workspace_chart_fk";--> statement-breakpoint
ALTER TABLE "generated_artifacts" DROP CONSTRAINT "generated_artifacts_workspace_client_fk";--> statement-breakpoint
ALTER TABLE "generated_artifacts" DROP CONSTRAINT "generated_artifacts_workspace_chart_fk";--> statement-breakpoint
ALTER TABLE "generated_artifacts" DROP CONSTRAINT "generated_artifacts_workspace_source_asset_fk";--> statement-breakpoint
ALTER TABLE "generated_artifacts" DROP CONSTRAINT "generated_artifacts_workspace_output_asset_fk";--> statement-breakpoint

ALTER TABLE "assets" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "birth_profiles" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "chart_aspects" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "chart_calculations" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "chart_findings" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "chart_houses" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "chart_placements" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "compatibility_reports" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "consent_records" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "dasha_periods" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "generated_artifacts" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint

-- The composite uniques the composite foreign keys point at. These have to
-- exist before the keys referencing them can be created.
ALTER TABLE "assets" ADD CONSTRAINT "assets_user_id_id_unique" UNIQUE("user_id","id");--> statement-breakpoint
ALTER TABLE "birth_profiles" ADD CONSTRAINT "birth_profiles_user_id_id_unique" UNIQUE("user_id","id");--> statement-breakpoint
ALTER TABLE "chart_calculations" ADD CONSTRAINT "chart_calculations_user_id_id_unique" UNIQUE("user_id","id");--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_id_unique" UNIQUE("user_id","id");--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_id_unique" UNIQUE("user_id","id");--> statement-breakpoint
ALTER TABLE "dasha_periods" ADD CONSTRAINT "dasha_periods_user_id_id_unique" UNIQUE("user_id","id");--> statement-breakpoint

-- Only `clients` and `assets` point straight at the tenant root, exactly as
-- they were the only two pointing at `workspaces`. Everything below them is
-- reached through a composite key, so a row cannot change owner halfway down.
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "assets" ADD CONSTRAINT "assets_user_client_fk" FOREIGN KEY ("user_id","client_id") REFERENCES "public"."clients"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_profiles" ADD CONSTRAINT "birth_profiles_user_client_fk" FOREIGN KEY ("user_id","client_id") REFERENCES "public"."clients"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_client_fk" FOREIGN KEY ("user_id","client_id") REFERENCES "public"."clients"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- `no action`, not `restrict`, and the difference matters: deleting a client
-- cascades to the consent row and to the birth profile in one statement, and
-- `restrict` is checked immediately -- it would fire on the consent row while
-- the profile still pointed at it and block a legitimate delete.
ALTER TABLE "birth_profiles" ADD CONSTRAINT "birth_profiles_user_consent_fk" FOREIGN KEY ("user_id","consent_record_id") REFERENCES "public"."consent_records"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_calculations" ADD CONSTRAINT "chart_calculations_user_birth_profile_fk" FOREIGN KEY ("user_id","birth_profile_id") REFERENCES "public"."birth_profiles"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_aspects" ADD CONSTRAINT "chart_aspects_user_chart_fk" FOREIGN KEY ("user_id","chart_id") REFERENCES "public"."chart_calculations"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_findings" ADD CONSTRAINT "chart_findings_user_chart_fk" FOREIGN KEY ("user_id","chart_id") REFERENCES "public"."chart_calculations"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_houses" ADD CONSTRAINT "chart_houses_user_chart_fk" FOREIGN KEY ("user_id","chart_id") REFERENCES "public"."chart_calculations"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_placements" ADD CONSTRAINT "chart_placements_user_chart_fk" FOREIGN KEY ("user_id","chart_id") REFERENCES "public"."chart_calculations"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dasha_periods" ADD CONSTRAINT "dasha_periods_user_chart_fk" FOREIGN KEY ("user_id","chart_id") REFERENCES "public"."chart_calculations"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compatibility_reports" ADD CONSTRAINT "compatibility_reports_user_primary_client_fk" FOREIGN KEY ("user_id","primary_client_id") REFERENCES "public"."clients"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compatibility_reports" ADD CONSTRAINT "compatibility_reports_user_partner_client_fk" FOREIGN KEY ("user_id","partner_client_id") REFERENCES "public"."clients"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compatibility_reports" ADD CONSTRAINT "compatibility_reports_user_primary_chart_fk" FOREIGN KEY ("user_id","primary_chart_id") REFERENCES "public"."chart_calculations"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compatibility_reports" ADD CONSTRAINT "compatibility_reports_user_partner_chart_fk" FOREIGN KEY ("user_id","partner_chart_id") REFERENCES "public"."chart_calculations"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_user_client_fk" FOREIGN KEY ("user_id","client_id") REFERENCES "public"."clients"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_user_chart_fk" FOREIGN KEY ("user_id","chart_id") REFERENCES "public"."chart_calculations"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_user_source_asset_fk" FOREIGN KEY ("user_id","source_asset_id") REFERENCES "public"."assets"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_user_output_asset_fk" FOREIGN KEY ("user_id","output_asset_id") REFERENCES "public"."assets"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- The 11 indexes led by workspace_id, re-led by user_id. Dropping the column
-- below would take the old ones with it, but naming them keeps this file a
-- readable account of what happened rather than a list of side effects.
DROP INDEX IF EXISTS "chart_calculations_signs_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "chart_calculations_workspace_computed_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "chart_findings_selected_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "chart_houses_analytics_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "chart_placements_analytics_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "clients_workspace_email_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "clients_workspace_external_reference_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "clients_workspace_name_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "clients_workspace_status_updated_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "compatibility_reports_reproducible_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "compatibility_reports_workspace_computed_idx";--> statement-breakpoint

CREATE INDEX "chart_calculations_signs_idx" ON "chart_calculations" USING btree ("user_id","ascendant_sign","moon_sign","sun_sign");--> statement-breakpoint
CREATE INDEX "chart_calculations_user_computed_idx" ON "chart_calculations" USING btree ("user_id","computed_at");--> statement-breakpoint
CREATE INDEX "chart_findings_selected_idx" ON "chart_findings" USING btree ("user_id","category","selected","rank");--> statement-breakpoint
CREATE INDEX "chart_houses_analytics_idx" ON "chart_houses" USING btree ("user_id","house_number","sign_code");--> statement-breakpoint
CREATE INDEX "chart_placements_analytics_idx" ON "chart_placements" USING btree ("user_id","point_code","sign_code","house_number");--> statement-breakpoint
CREATE INDEX "clients_user_email_idx" ON "clients" USING btree ("user_id",lower("email")) WHERE "clients"."email" is not null and "clients"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_user_external_reference_unique" ON "clients" USING btree ("user_id","external_reference") WHERE "clients"."external_reference" is not null and "clients"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "clients_user_name_idx" ON "clients" USING btree ("user_id",lower("display_name"));--> statement-breakpoint
CREATE INDEX "clients_user_status_updated_idx" ON "clients" USING btree ("user_id","status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "compatibility_reports_reproducible_unique" ON "compatibility_reports" USING btree ("user_id","input_fingerprint","algorithm_version");--> statement-breakpoint
CREATE INDEX "compatibility_reports_user_computed_idx" ON "compatibility_reports" USING btree ("user_id","computed_at");--> statement-breakpoint

ALTER TABLE "assets" DROP COLUMN "workspace_id";--> statement-breakpoint
ALTER TABLE "birth_profiles" DROP COLUMN "workspace_id";--> statement-breakpoint
ALTER TABLE "chart_aspects" DROP COLUMN "workspace_id";--> statement-breakpoint
ALTER TABLE "chart_calculations" DROP COLUMN "workspace_id";--> statement-breakpoint
ALTER TABLE "chart_findings" DROP COLUMN "workspace_id";--> statement-breakpoint
ALTER TABLE "chart_houses" DROP COLUMN "workspace_id";--> statement-breakpoint
ALTER TABLE "chart_placements" DROP COLUMN "workspace_id";--> statement-breakpoint
ALTER TABLE "clients" DROP COLUMN "workspace_id";--> statement-breakpoint
ALTER TABLE "compatibility_reports" DROP COLUMN "workspace_id";--> statement-breakpoint
ALTER TABLE "consent_records" DROP COLUMN "workspace_id";--> statement-breakpoint
ALTER TABLE "dasha_periods" DROP COLUMN "workspace_id";--> statement-breakpoint
ALTER TABLE "generated_artifacts" DROP COLUMN "workspace_id";--> statement-breakpoint

DROP TABLE IF EXISTS "workspace_members" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "workspaces" CASCADE;
