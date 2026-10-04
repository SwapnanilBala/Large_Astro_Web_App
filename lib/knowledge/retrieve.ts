import "server-only";

import { and, arrayOverlaps, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { knowledgePassages } from "../db/schema";
import type { PassageRow } from "./yoga-classics-reading";

/**
 * Every passage tagged with any of these yogas, as an exact array overlap on
 * the GIN-indexed `yoga_ids` -- no embedding call, no similarity threshold.
 *
 * Withheld rows are filtered here, in the query, rather than left to callers:
 * they are in the table for completeness and must never reach a prompt or a
 * page, so the one function that reads them out is the place to make sure.
 */
export async function passagesTaggedWith(yogaIds: string[]): Promise<PassageRow[]> {
  if (yogaIds.length === 0) return [];
  const rows = await getDb()
    .select({
      id: knowledgePassages.id,
      chapter: knowledgePassages.chapter,
      verse: knowledgePassages.verse,
      part: knowledgePassages.part,
      kind: knowledgePassages.kind,
      text: knowledgePassages.text,
      yogaIds: knowledgePassages.yogaIds,
      planets: knowledgePassages.planets,
      lifeAreas: knowledgePassages.lifeAreas,
    })
    .from(knowledgePassages)
    .where(and(eq(knowledgePassages.withheld, false), arrayOverlaps(knowledgePassages.yogaIds, yogaIds)));
  return rows.map((row) => ({ ...row, kind: row.kind === "note" ? "note" : "verse" }));
}
