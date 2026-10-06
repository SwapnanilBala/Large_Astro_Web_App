import { and, arrayContained, arrayOverlaps, cosineDistance, desc, eq, isNotNull, not, or, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { knowledgePassages } from "../db/schema";
import type { PassageRow } from "./yoga-classics-reading";

/*
 * The queries that read passages out of knowledge_passages for the classical
 * notes, taking the database as an argument. The routes reach them through
 * retrieve.ts, which binds them to the app's client and is server-only; a
 * script passes its own client and so runs exactly what the routes run.
 *
 * Withheld rows are filtered here, in the query, rather than left to callers:
 * they are in the table for completeness and must never reach a prompt or a
 * page, so the functions that read rows out are the place to make sure.
 */

export type PassageDb = Pick<NeonHttpDatabase, "select">;

const COLUMNS = {
  id: knowledgePassages.id,
  source: knowledgePassages.source,
  chapter: knowledgePassages.chapter,
  verse: knowledgePassages.verse,
  part: knowledgePassages.part,
  kind: knowledgePassages.kind,
  text: knowledgePassages.text,
  yogaIds: knowledgePassages.yogaIds,
  planets: knowledgePassages.planets,
  lifeAreas: knowledgePassages.lifeAreas,
  placements: knowledgePassages.placements,
  placementsAny: knowledgePassages.placementsAny,
};

type Row = { [K in keyof typeof COLUMNS]: (typeof COLUMNS)[K]["_"]["data"] };

function asPassage(row: Row): PassageRow {
  return { ...row, kind: row.kind === "note" ? "note" : "verse" };
}

/**
 * Every passage tagged with any of these yogas, as an exact array overlap on
 * the GIN-indexed `yoga_ids` -- no embedding call, no similarity threshold.
 */
export async function queryPassagesTaggedWith(db: PassageDb, yogaIds: string[]): Promise<PassageRow[]> {
  if (yogaIds.length === 0) return [];
  const rows = await db
    .select(COLUMNS)
    .from(knowledgePassages)
    .where(and(eq(knowledgePassages.withheld, false), arrayOverlaps(knowledgePassages.yogaIds, yogaIds)));
  return rows.map(asPassage);
}

/**
 * The candidates for a chart's life areas: shown passages tagged with one of
 * these topics that apply to the chart, either because their placement
 * conditions hold (every key of `placements` among the chart's, and one of
 * `placements_any` when it has any; the cardinality test keeps out a passage
 * with neither, which `<@` alone would match) or because they are tagged with
 * a yoga the chart has. The selection in area-classics-reading.ts then
 * checks each yoga passage against the planets the chart's yoga is formed by,
 * and ranks per area.
 */
export async function queryPassagesForChart(
  db: PassageDb,
  args: { topics: string[]; chartKeys: string[]; yogaIds: string[] },
): Promise<PassageRow[]> {
  const rows = await db
    .select(COLUMNS)
    .from(knowledgePassages)
    .where(
      and(
        eq(knowledgePassages.withheld, false),
        arrayOverlaps(knowledgePassages.lifeAreas, args.topics),
        appliesCondition(args.chartKeys, args.yogaIds),
      ),
    );
  return rows.map(asPassage);
}

/** The applies-to-this-chart condition both chart queries share; see queryPassagesForChart. */
function appliesCondition(chartKeys: string[], yogaIds: string[]) {
  const byPlacement = and(
    sql`cardinality(${knowledgePassages.placements}) + cardinality(${knowledgePassages.placementsAny}) > 0`,
    arrayContained(knowledgePassages.placements, chartKeys),
    or(
      sql`cardinality(${knowledgePassages.placementsAny}) = 0`,
      arrayOverlaps(knowledgePassages.placementsAny, chartKeys),
    ),
  );
  return yogaIds.length > 0 ? or(byPlacement, arrayOverlaps(knowledgePassages.yogaIds, yogaIds)) : byPlacement;
}

/** A passage as the question search returns it: how near the question it is, from -1 to 1. */
export type ScoredPassage = PassageRow & { similarity: number };

/**
 * Hybrid retrieval for a reader's question: the shown passages that apply to
 * the chart (the same conditions as queryPassagesForChart) and carry one of
 * the question's topics, nearest the question first, by cosine similarity
 * between the question's embedding and each passage's.
 *
 * The chart decides which passages may answer; the question only orders them.
 * A passage about a placement this chart does not have is about somebody
 * else, however near the question it reads.
 *
 * Scored exactly rather than through the HNSW index, on purpose. The chart's
 * conditions leave a few dozen passages, and an approximate index scan that
 * filters afterwards can hand back fewer rows than asked for, when most of its
 * nearest neighbours belong to other charts. Ordering by similarity (one minus
 * the distance) rather than by the distance operator keeps the planner off the
 * index, so every passage that applies is scored; at this table's size that
 * costs nothing.
 *
 * Passages tagged with lifespan are never candidates: the content line keeps
 * lifespan out of every note, and a question is no reason to go near it.
 */
export async function queryPassagesNearQuestion(
  db: PassageDb,
  args: { embedding: number[]; topics: readonly string[]; chartKeys: string[]; yogaIds: string[]; limit: number },
): Promise<ScoredPassage[]> {
  const similarity = sql<number>`1 - (${cosineDistance(knowledgePassages.embedding, args.embedding)})`;
  const rows = await db
    .select({ ...COLUMNS, similarity })
    .from(knowledgePassages)
    .where(
      and(
        eq(knowledgePassages.withheld, false),
        isNotNull(knowledgePassages.embedding),
        arrayOverlaps(knowledgePassages.lifeAreas, [...args.topics]),
        not(arrayOverlaps(knowledgePassages.lifeAreas, ["longevity"])),
        appliesCondition(args.chartKeys, args.yogaIds),
      ),
    )
    .orderBy(desc(similarity))
    .limit(args.limit);
  return rows.map(({ similarity: score, ...row }) => ({ ...asPassage(row), similarity: Number(score) }));
}
