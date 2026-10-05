-- Placement keys on the knowledge passages, for the life areas.
--
-- The house and sign chapters of the Brihat Jataka state conditions -- "the
-- Sun in the 10th", "the Moon in Taurus aspected by Jupiter" -- and a reading
-- may quote one only for a chart that meets it. Each passage now carries the
-- conditions its claim requires, as keys from lib/knowledge/placements.ts: all
-- of `placements` must hold (`placements <@ $chartKeys`), and when the claim
-- offers alternatives ("Mars in Taurus or Libra"), at least one key of
-- `placements_any` must hold too (`placements_any && $chartKeys`). The GIN
-- indexes serve both operators.
--
-- Purely additive. The defaults fill existing rows with empty lists, which
-- never match by placement; the yoga chapters' rows stay that way and are
-- reached through yoga_ids as before. `npm run knowledge:load` fills the rest.

ALTER TABLE "knowledge_passages" ADD COLUMN "placements" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_passages" ADD COLUMN "placements_any" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
CREATE INDEX "knowledge_passages_placements_idx" ON "knowledge_passages" USING gin ("placements");--> statement-breakpoint
CREATE INDEX "knowledge_passages_placements_any_idx" ON "knowledge_passages" USING gin ("placements_any");
