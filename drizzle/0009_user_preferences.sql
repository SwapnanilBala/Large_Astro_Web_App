-- A place on the account for how a person likes the site drawn.
--
-- The results page can draw the birth chart as the constellation wheel or as a
-- North Indian diamond. The browser remembers the choice (astro_chart_style),
-- but a browser is one device; this row is what a second device adopts when
-- the same person signs in there.
--
-- One row per account, created on the first choice, gone with the account
-- (ON DELETE CASCADE). A typed column per preference rather than a jsonb bag,
-- so the check below keeps an unknown style from ever reaching a client that
-- cannot draw it. Null means "never chosen", which lets the device's own
-- choice stand.
--
-- Purely additive. Until this is applied, /api/account/preferences answers 503
-- and the page keeps the choice on the device, exactly as before.

CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"chart_style" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_chart_style_check" CHECK ("user_preferences"."chart_style" in ('constellation', 'north-indian'))
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;