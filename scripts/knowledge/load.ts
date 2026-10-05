/**
 * Loads the knowledge corpora (lib/knowledge/corpus/*.json) into the
 * knowledge_passages table, embedding whatever changed.
 *
 *   npm run knowledge:load -- --dry-run   # what would change; no embedding calls, no writes
 *   npm run knowledge:load                # embed what changed, upsert every passage, delete dropped ones
 *
 * Target: KNOWLEDGE_DATABASE_URL when it is set (a Neon test branch, say),
 * otherwise DATABASE_URL_UNPOOLED, the database `npm run db:migrate` writes to.
 * The host is printed before anything happens, so which branch is being written
 * is never a guess. Both come from .env.local.
 *
 * A passage is re-embedded only when the text it is embedded from changes, or
 * the embedding model does; every other column is simply overwritten, so a
 * re-tagged verse costs nothing. The corpus file is the source of truth: rows
 * for verses it no longer has are deleted.
 *
 * Needs OPENAI_API_KEY for the embeddings, except with --dry-run.
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import OpenAI from "openai";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { knowledgePassages } from "../../lib/db/schema";
import { YOGA_DEFINITIONS } from "../../lib/engines/yoga-engine";
import { knowledgeCorpusSchema, type KnowledgeCorpus } from "../../lib/knowledge/corpus";
import {
  KNOWLEDGE_EMBEDDING_DIMENSIONS,
  KNOWLEDGE_EMBEDDING_MODEL,
  embeddingInput,
} from "../../lib/knowledge/embedding";
import { PLACEMENT_KEYS } from "../../lib/knowledge/placements";
import { KNOWLEDGE_SOURCES } from "../../lib/knowledge/sources";

const PLACEMENTS = new Set(PLACEMENT_KEYS);

config({ path: ".env.local", quiet: true });

const CORPUS_DIR = resolve("lib/knowledge/corpus");
const EMBED_BATCH = 64;
/* About 25 vectors of 1024 floats per statement keeps each HTTP request well under a megabyte. */
const WRITE_BATCH = 25;

function corpora(): KnowledgeCorpus[] {
  const known = new Set(YOGA_DEFINITIONS.map((definition) => definition.id));
  return readdirSync(CORPUS_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const corpus = knowledgeCorpusSchema.parse(JSON.parse(readFileSync(resolve(CORPUS_DIR, file), "utf8")));
      if (!KNOWLEDGE_SOURCES[corpus.source]) throw new Error(`${file}: ${corpus.source} is not in lib/knowledge/sources.ts.`);
      for (const passage of corpus.passages) {
        const unknown = passage.yogaIds.filter((id) => !known.has(id));
        if (unknown.length > 0) throw new Error(`${passage.id}: unknown yoga ids ${unknown.join(", ")}.`);
        const strange = [...passage.placements, ...passage.placementsAny].filter((key) => !PLACEMENTS.has(key));
        if (strange.length > 0) throw new Error(`${passage.id}: unknown placement keys ${strange.join(", ")}.`);
      }
      return corpus;
    });
}

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

async function embed(inputs: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is needed to embed passages (in .env.local).");
  const openai = new OpenAI({ apiKey });
  const vectors: number[][] = [];
  for (let start = 0; start < inputs.length; start += EMBED_BATCH) {
    const response = await openai.embeddings.create({
      model: KNOWLEDGE_EMBEDDING_MODEL,
      input: inputs.slice(start, start + EMBED_BATCH),
      dimensions: KNOWLEDGE_EMBEDDING_DIMENSIONS,
    });
    const ordered = [...response.data].sort((a, b) => a.index - b.index);
    vectors.push(...ordered.map((item) => item.embedding));
  }
  return vectors;
}

/** Postgres's "relation does not exist", however deep the driver wrapped it. */
function isMissingTable(error: unknown): boolean {
  for (let current = error; current; current = (current as { cause?: unknown }).cause) {
    if ((current as { code?: string }).code === "42P01") return true;
  }
  return false;
}

/** `excluded.<column>`: the value the upsert tried to insert. */
const inserted = (column: string) => sql.raw(`excluded."${column}"`);

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const variable = process.env.KNOWLEDGE_DATABASE_URL ? "KNOWLEDGE_DATABASE_URL" : "DATABASE_URL_UNPOOLED";
  const url = process.env[variable];
  if (!url) throw new Error("Set KNOWLEDGE_DATABASE_URL or DATABASE_URL_UNPOOLED in .env.local.");
  console.log(`database: ${new URL(url).host} (from ${variable})${dryRun ? ", dry run" : ""}`);

  const db = drizzle({ client: neon(url) });

  for (const corpus of corpora()) {
    let existing;
    try {
      existing = await db
        .select({
          id: knowledgePassages.id,
          contentHash: knowledgePassages.contentHash,
          embeddingModel: knowledgePassages.embeddingModel,
          embedded: sql<boolean>`${knowledgePassages.embedding} is not null`,
        })
        .from(knowledgePassages)
        .where(eq(knowledgePassages.source, corpus.source));
    } catch (error) {
      if (isMissingTable(error)) {
        throw new Error("knowledge_passages does not exist here yet. Run `npm run db:migrate` against this database first.");
      }
      throw error;
    }

    const stored = new Map(existing.map((row) => [row.id, row]));
    const rows = corpus.passages.map((passage) => {
      const input = embeddingInput(passage);
      return { passage, input, hash: sha256(input) };
    });
    const stale = rows.filter(({ passage, hash }) => {
      const row = stored.get(passage.id);
      return !row || row.contentHash !== hash || row.embeddingModel !== KNOWLEDGE_EMBEDDING_MODEL || !row.embedded;
    });
    const keep = new Set(corpus.passages.map((passage) => passage.id));
    const dropped = existing.filter((row) => !keep.has(row.id));
    console.log(
      `${corpus.source}: ${rows.length} passages, ${existing.length} already stored,`,
      `${stale.length} to embed, ${dropped.length} to delete`,
    );
    if (dryRun) continue;

    const vectors = new Map<string, number[]>();
    if (stale.length > 0) {
      const embedded = await embed(stale.map((row) => row.input));
      stale.forEach((row, index) => vectors.set(row.passage.id, embedded[index]));
    }

    for (let start = 0; start < rows.length; start += WRITE_BATCH) {
      const values = rows.slice(start, start + WRITE_BATCH).map(({ passage, hash }) => ({
        id: passage.id,
        source: passage.source,
        chapter: passage.chapter,
        verse: passage.verse,
        part: passage.part,
        kind: passage.kind,
        chapterTitle: passage.chapterTitle,
        text: passage.text,
        notes: passage.notes,
        summary: passage.summary,
        yogaIds: passage.yogaIds,
        placements: passage.placements,
        placementsAny: passage.placementsAny,
        planets: passage.planets,
        lifeAreas: passage.lifeAreas,
        withheld: passage.withheld,
        withheldReason: passage.withheldReason,
        contentHash: hash,
        /* Null for an unchanged passage: the upsert then keeps the stored vector. */
        embedding: vectors.get(passage.id) ?? null,
        embeddingModel: vectors.has(passage.id) ? KNOWLEDGE_EMBEDDING_MODEL : null,
      }));
      await db
        .insert(knowledgePassages)
        .values(values)
        .onConflictDoUpdate({
          target: knowledgePassages.id,
          set: {
            source: inserted("source"),
            chapter: inserted("chapter"),
            verse: inserted("verse"),
            part: inserted("part"),
            kind: inserted("kind"),
            chapterTitle: inserted("chapter_title"),
            text: inserted("text"),
            notes: inserted("notes"),
            summary: inserted("summary"),
            yogaIds: inserted("yoga_ids"),
            placements: inserted("placements"),
            placementsAny: inserted("placements_any"),
            planets: inserted("planets"),
            lifeAreas: inserted("life_areas"),
            withheld: inserted("withheld"),
            withheldReason: inserted("withheld_reason"),
            contentHash: inserted("content_hash"),
            embedding: sql`coalesce(${inserted("embedding")}, ${knowledgePassages.embedding})`,
            embeddingModel: sql`coalesce(${inserted("embedding_model")}, ${knowledgePassages.embeddingModel})`,
            updatedAt: sql`now()`,
          },
        });
    }

    if (dropped.length > 0) {
      await db
        .delete(knowledgePassages)
        .where(and(eq(knowledgePassages.source, corpus.source), notInArray(knowledgePassages.id, [...keep])));
    }
    console.log(`${corpus.source}: loaded`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
