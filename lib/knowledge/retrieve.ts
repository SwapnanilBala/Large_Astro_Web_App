import "server-only";

import { getDb } from "../db/client";
import {
  queryPassagesForChart,
  queryPassagesForPeriod,
  queryPassagesNearQuestion,
  queryPassagesTaggedWith,
  type ScoredPassage,
} from "./passage-queries";
import type { PassageRow } from "./yoga-classics-reading";

/*
 * Reading passages out of knowledge_passages for the classical notes, on the
 * app's own database client. The queries, and why each is shaped as it is,
 * are in passage-queries.ts, where a script can run them on a client of its
 * own.
 */

export type { ScoredPassage };

/** Every shown passage tagged with any of these yogas; see queryPassagesTaggedWith. */
export function passagesTaggedWith(yogaIds: string[]): Promise<PassageRow[]> {
  return queryPassagesTaggedWith(getDb(), yogaIds);
}

/** The shown passages for a chart's life areas; see queryPassagesForChart. */
export function passagesForChart(args: { topics: string[]; chartKeys: string[]; yogaIds: string[] }): Promise<PassageRow[]> {
  return queryPassagesForChart(getDb(), args);
}

/** Hybrid retrieval for a reader's question, nearest first; see queryPassagesNearQuestion. */
export function passagesNearQuestion(args: {
  embedding: number[];
  topics: readonly string[];
  chartKeys: string[];
  yogaIds: string[];
  limit: number;
}): Promise<ScoredPassage[]> {
  return queryPassagesNearQuestion(getDb(), args);
}

/** The chart's passages a period's reading may draw on, scored against the period when it was embedded; see queryPassagesForPeriod. */
export function passagesForPeriod(args: {
  chartKeys: string[];
  yogaIds: string[];
  embedding?: number[] | null;
  limit: number;
}): Promise<Array<PassageRow & { similarity?: number }>> {
  return queryPassagesForPeriod(getDb(), args);
}
