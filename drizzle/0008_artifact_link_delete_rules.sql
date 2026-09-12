-- Deleting a chart or an asset stops erroring and starts clearing the link.
--
-- `generated_artifacts` points at three optional rows -- the chart it was
-- generated from, the asset it read, the asset it wrote -- and each of those
-- columns is declared `ON DELETE SET NULL`. None of them behaved that way. 0006
-- put a second foreign key over each column, pairing it with `user_id` so that
-- an artifact and the row it references have to belong to the same account, and
-- those composite keys were written with no delete rule at all, which in
-- Postgres means NO ACTION. Where two rules cover one column the stricter one
-- decides, so the leaf `SET NULL` never ran and
--
--   DELETE FROM chart_calculations WHERE id = ..
--
-- failed on `generated_artifacts_user_chart_fk` instead. The fourth key in the
-- same table, `generated_artifacts_user_client_fk`, does carry `ON DELETE
-- CASCADE` -- which is what marks the other three as an omission rather than a
-- decision.
--
-- Nothing has hit this yet only because `generated_artifacts` still has zero
-- rows. The first artifact ever written would have made its chart undeletable.
--
-- The column list on each `SET NULL` is load-bearing rather than decorative. A
-- multi-column foreign key clears *every* referencing column by default, and
-- `user_id` is one of them and is NOT NULL, so the bare form merely trades a
-- foreign key violation for a not-null violation and the delete fails either
-- way. Naming `"chart_id"` clears the link and leaves the artifact attached to
-- its owner, which is the only reading that makes sense: losing the chart does
-- not make the report ownerless. This form is Postgres 15 and newer; Neon is on
-- 17.
--
-- `lib/db/schema.ts` declares these as a plain `.onDelete("set null")` because
-- drizzle-kit has no way to express the column list. That is why this file was
-- edited after it was generated, and why a regenerated version of it must not
-- be pasted back over this one.

ALTER TABLE "generated_artifacts" DROP CONSTRAINT "generated_artifacts_user_chart_fk";--> statement-breakpoint
ALTER TABLE "generated_artifacts" DROP CONSTRAINT "generated_artifacts_user_source_asset_fk";--> statement-breakpoint
ALTER TABLE "generated_artifacts" DROP CONSTRAINT "generated_artifacts_user_output_asset_fk";--> statement-breakpoint
ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_user_chart_fk" FOREIGN KEY ("user_id","chart_id") REFERENCES "public"."chart_calculations"("user_id","id") ON DELETE SET NULL ("chart_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_user_source_asset_fk" FOREIGN KEY ("user_id","source_asset_id") REFERENCES "public"."assets"("user_id","id") ON DELETE SET NULL ("source_asset_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_user_output_asset_fk" FOREIGN KEY ("user_id","output_asset_id") REFERENCES "public"."assets"("user_id","id") ON DELETE SET NULL ("output_asset_id") ON UPDATE no action;
