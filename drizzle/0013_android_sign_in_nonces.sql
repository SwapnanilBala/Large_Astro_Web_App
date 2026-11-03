CREATE TABLE "auth_nonces" (
	"nonce_hash" varchar(64) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "auth_nonces_hash_check" CHECK ("auth_nonces"."nonce_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "auth_nonces_window_check" CHECK ("auth_nonces"."expires_at" > "auth_nonces"."created_at")
);
--> statement-breakpoint
CREATE INDEX "auth_nonces_expiry_idx" ON "auth_nonces" USING btree ("expires_at");