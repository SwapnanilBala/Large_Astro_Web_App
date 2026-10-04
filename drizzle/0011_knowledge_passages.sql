-- Passages from classical texts, for readings to quote.
--
-- Reference data rather than anyone's records: no user_id, no foreign keys.
-- Rows are written only by `npm run knowledge:load`, from the checked-in corpus
-- files in lib/knowledge/corpus, so the table can be emptied and rebuilt from
-- them at any time.
--
-- Lookups go two ways. yoga_ids carries the yoga engine's own ids, and its GIN
-- index serves `yoga_ids && $ids`, which is how a reading finds the passages for
-- the yogas a chart has. The HNSW index serves cosine search on embedding for
-- free-text questions. At a few hundred rows a sequential scan would do just as
-- well; the index is there for when more books join.
--
-- embedding is nullable so a row can exist before its vector does, and
-- vector(1024) has to match KNOWLEDGE_EMBEDDING_DIMENSIONS in
-- lib/knowledge/embedding.ts. Needs the extension from 0010.
--
-- Purely additive. Nothing in the app reads this table yet.

CREATE TABLE "knowledge_passages" (
	"id" varchar(120) PRIMARY KEY NOT NULL,
	"source" varchar(60) NOT NULL,
	"chapter" smallint NOT NULL,
	"verse" smallint NOT NULL,
	"chapter_title" text NOT NULL,
	"text" text NOT NULL,
	"notes" text,
	"summary" text NOT NULL,
	"yoga_ids" text[] NOT NULL,
	"planets" text[] NOT NULL,
	"life_areas" text[] NOT NULL,
	"withheld" boolean NOT NULL,
	"withheld_reason" text,
	"content_hash" varchar(64) NOT NULL,
	"embedding" vector(1024),
	"embedding_model" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_passages_source_chapter_verse_unique" UNIQUE("source","chapter","verse"),
	CONSTRAINT "knowledge_passages_withheld_reason_check" CHECK ("knowledge_passages"."withheld" = ("knowledge_passages"."withheld_reason" is not null))
);
--> statement-breakpoint
CREATE INDEX "knowledge_passages_yoga_ids_idx" ON "knowledge_passages" USING gin ("yoga_ids");--> statement-breakpoint
CREATE INDEX "knowledge_passages_life_areas_idx" ON "knowledge_passages" USING gin ("life_areas");--> statement-breakpoint
CREATE INDEX "knowledge_passages_embedding_idx" ON "knowledge_passages" USING hnsw ("embedding" vector_cosine_ops);