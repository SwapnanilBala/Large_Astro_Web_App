import "server-only";

/**
 * The shared half of the paid-LLM daily ceiling: two numbers in Postgres.
 *
 * Split out from lib/llm-budget.ts on purpose. That module is policy — which
 * ceiling applies, which layer refused, what happens when the database is
 * unreachable — and it is worth being able to read and test without a driver
 * in the way. This module is one statement and knows nothing about limits.
 */

import { lt, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { llmBudgetCounters } from "@/lib/db/schema";

/**
 * The `caller` value on the row that totals a whole route.
 *
 * `*` and not the empty string: the two rows the increment writes must be
 * distinct, or Postgres rejects the statement with "ON CONFLICT DO UPDATE
 * command cannot affect row a second time". `getClientIp` normalises away
 * everything outside `[0-9a-fA-F:.%]` and falls back to `unknown`, so no caller
 * can ever be spelled `*` and collide with the total.
 */
export const ROUTE_TOTAL_CALLER = "*";

/** Both counters for one route as of the increment that just ran. */
export type SharedLlmCounts = {
  /** The route's total across every caller and every instance, today. */
  routeTotal: number;
  /** This caller's total against this route, today. */
  caller: number;
};

/**
 * Whether there is a database to count in.
 *
 * Checked before the call rather than caught after it, because `getDb()` throws
 * on a missing `DATABASE_URL` and "nobody configured a database" is a normal
 * state (local dev, the test run) rather than an outage worth logging.
 */
export function isSharedLlmCounterConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Add one to the route total and to this caller's total, and return both.
 *
 * The whole design rests on this being a single statement. `INSERT .. VALUES
 * (total), (caller) .. ON CONFLICT DO UPDATE SET count = count + 1 RETURNING`
 * is atomic per row under concurrency: two instances racing on the same key
 * serialise, and each gets a distinct number back. That is why the caller must
 * decide from the returned value and never from a count it read earlier — a
 * read-then-write would reintroduce exactly the race this replaces.
 *
 * The increment happens before anyone knows whether the call is allowed, so a
 * refused attempt is counted too and the stored number can drift above the
 * limit. That is the correct direction (over the limit still means refuse) and
 * it does not run away: lib/llm-budget.ts mirrors the returned count into
 * process memory, so an instance that has seen a refusal stops issuing the
 * round trip at all.
 */
export async function bumpSharedLlmCounters(
  utcDay: string,
  route: string,
  caller: string,
): Promise<SharedLlmCounts> {
  const rows = await getDb()
    .insert(llmBudgetCounters)
    .values([
      { utcDay, route, caller: ROUTE_TOTAL_CALLER, count: 1 },
      { utcDay, route, caller, count: 1 },
    ])
    .onConflictDoUpdate({
      target: [llmBudgetCounters.utcDay, llmBudgetCounters.route, llmBudgetCounters.caller],
      /* `llm_budget_counters.count` is the row already there; `excluded.count`
         would be the literal 1 above and would pin every counter at 1. */
      set: {
        count: sql`${llmBudgetCounters.count} + 1`,
        updatedAt: sql`now()`,
      },
    })
    .returning({
      caller: llmBudgetCounters.caller,
      count: llmBudgetCounters.count,
    });

  /* RETURNING does not promise the order of VALUES, so match on the key. */
  let routeTotal = 0;
  let callerCount = 0;
  for (const row of rows) {
    if (row.caller === ROUTE_TOTAL_CALLER) {
      routeTotal = row.count;
    } else {
      callerCount = row.count;
    }
  }

  return { routeTotal, caller: callerCount };
}

/**
 * Drop counters for days that are over.
 *
 * A `DELETE` on the leading column of the primary key, called at most once per
 * process per UTC day and never awaited by a request. A scheduled job would be
 * more precise and is not worth the moving part: the table only grows by one
 * row per (route, caller) per day, and the rows are two integers and a string.
 */
export async function pruneSharedLlmCounters(oldestUtcDayToKeep: string): Promise<void> {
  await getDb()
    .delete(llmBudgetCounters)
    .where(lt(llmBudgetCounters.utcDay, oldestUtcDayToKeep));
}
