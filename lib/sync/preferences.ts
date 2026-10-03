import "server-only";

/**
 * A signed-in person's display preferences, one row per account
 * (drizzle/0009_user_preferences.sql).
 *
 * Only the chart style so far. The route in app/api/account/preferences is
 * the one caller; it owns authentication, this module owns the row.
 */

import { eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { userPreferences } from "@/lib/db/schema";
import { isChartStyle, type ChartStyle } from "@/lib/chart-style";

export type AccountPreferences = {
  /** null until the person has chosen on some device. */
  chartStyle: ChartStyle | null;
};

export async function readPreferences(userId: string): Promise<AccountPreferences> {
  const [row] = await getDb()
    .select({ chartStyle: userPreferences.chartStyle })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  /* The column's check constraint makes anything else impossible, but a value
     a client cannot draw is worse than none, so it is filtered here too. */
  return { chartStyle: isChartStyle(row?.chartStyle) ? row.chartStyle : null };
}

/** One upsert: the first choice creates the row, later ones update it. */
export async function saveChartStyle(userId: string, chartStyle: ChartStyle): Promise<void> {
  await getDb()
    .insert(userPreferences)
    .values({ userId, chartStyle })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { chartStyle, updatedAt: sql`now()` },
    });
}
