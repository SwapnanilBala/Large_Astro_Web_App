CREATE TABLE "auth_credentials" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"password_hash" text NOT NULL,
	"password_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	CONSTRAINT "auth_credentials_failed_attempts_check" CHECK ("auth_credentials"."failed_attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "auth_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(40) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"email" varchar(320),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_identities_provider_check" CHECK ("auth_identities"."provider" in ('google'))
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" varchar(255),
	"ip_address" varchar(45),
	CONSTRAINT "auth_sessions_token_hash_check" CHECK ("auth_sessions"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "auth_sessions_window_check" CHECK ("auth_sessions"."expires_at" > "auth_sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "auth_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"email_verified_at" timestamp with time zone,
	"display_name" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disabled_at" timestamp with time zone,
	CONSTRAINT "auth_users_email_shape" CHECK ("auth_users"."email" ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);
--> statement-breakpoint
ALTER TABLE "auth_credentials" ADD CONSTRAINT "auth_credentials_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identities_provider_account_unique" ON "auth_identities" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identities_one_per_provider_unique" ON "auth_identities" USING btree ("user_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_token_hash_unique" ON "auth_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_expiry_idx" ON "auth_sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_users_email_unique" ON "auth_users" USING btree (lower("email"));