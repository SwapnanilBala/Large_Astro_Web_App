import "server-only";

import { and, arrayContained, arrayOverlaps, eq, or, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { knowledgePassages } from "../db/schema";
import type { PassageRow } from "./yoga-classics-reading";

/*
 * Reading passages out of knowledge_passages for the classical notes.
 *
 * Withheld rows are filtered here, in the query, rather than left to callers:
 * they are in the table for completeness and must never reach a prompt or a
 * page, so the functions that read rows out are the place to make sure.
 */

const COLUMNS = {
  id: knowledgePassages.id,
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
export async function passagesTaggedWith(yogaIds: string[]): Promise<PassageRow[]> {
  if (yogaIds.length === 0) return [];
  const rows = await getDb()
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
export async function passagesForChart(args: {
  topics: string[];
  chartKeys: string[];
  yogaIds: string[];
}): Promise<PassageRow[]> {
  const byPlacement = and(
    sql`cardinality(${knowledgePassages.placements}) + cardinality(${knowledgePassages.placementsAny}) > 0`,
    arrayContained(knowledgePassages.placements, args.chartKeys),
    or(
      sql`cardinality(${knowledgePassages.placementsAny}) = 0`,
      arrayOverlaps(knowledgePassages.placementsAny, args.chartKeys),
    ),
  );
  const applies =
    args.yogaIds.length > 0 ? or(byPlacement, arrayOverlaps(knowledgePassages.yogaIds, args.yogaIds)) : byPlacement;
  const rows = await getDb()
    .select(COLUMNS)
    .from(knowledgePassages)
    .where(and(eq(knowledgePassages.withheld, false), arrayOverlaps(knowledgePassages.lifeAreas, args.topics), applies));
  return rows.map(asPassage);
}
