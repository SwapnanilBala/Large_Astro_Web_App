"use client";

import { useSyncExternalStore } from "react";
import { latestChartQuery, subscribeToChartHistory } from "@/lib/chart-history-store";

const noChartOnTheServer = () => "";

/**
 * The query string of the most recently saved chart, or "" when there is none.
 *
 * Read through useSyncExternalStore rather than an effect: the history lives
 * in localStorage, which the server cannot see, so getServerSnapshot lets
 * React render the fallback during hydration and swap in the real value
 * afterwards without a mismatch. Strings compare by value, so a fresh one
 * from each read does not loop -- and because the read runs on every render,
 * a navigation that saved a chart is reflected on the next page without any
 * subscription firing.
 */
export function useLatestChartQuery(): string {
  return useSyncExternalStore(subscribeToChartHistory, latestChartQuery, noChartOnTheServer);
}
