-- pgvector, for the knowledge passages that follow in 0011.
--
-- Drizzle cannot express CREATE EXTENSION, so this is a custom migration
-- (`drizzle-kit generate --custom`) rather than a line added by hand to the
-- generated 0011: regenerating that file would drop the line, and the vector
-- column it creates fails without the type. Kept separate and first, as Neon's
-- own Drizzle guidance does it.
--
-- IF NOT EXISTS because Neon already had pgvector 0.8.0 installed on the main
-- branch when this was written (checked 2026-10-04), so there this is a no-op.

CREATE EXTENSION IF NOT EXISTS vector;
