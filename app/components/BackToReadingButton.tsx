"use client";

import { useSyncExternalStore } from "react";
import BackButton from "@/app/components/BackButton";
import { readChartHistory, subscribeToChartHistory } from "@/lib/chart-history-store";

/*
 * "Back" on a page that hangs off the reading.
 *
 * Both /insights and /insights/advanced refuse to render without a full set of
 * birth params: they show "Chart details are incomplete" and offer nothing but
 * "Back to Intake". So a back link that drops the query does not take you
 * back, it strands you on the birth-details form one hop later. That is what
 * the palm archive's <BackButton href="/insights/advanced" /> did, and what
 * the advanced page's own <BackButton href="/" /> did directly.
 *
 * A page that already holds the params passes them in. The two that cannot --
 * the palm archive and compatibility are static routes with no chart in the
 * URL -- fall back to the most recent chart history entry, the same source the
 * navbar's "My Chart" link uses. Only someone who has never cast a chart ends
 * up on intake, and for them that is the right place to be.
 */

/** The query of the most recently saved chart, or "" if there is none. */
function latestChartQuery(): string {
  const latest = [...readChartHistory()].sort(
    (left, right) => Date.parse(right.savedAt || "") - Date.parse(left.savedAt || "")
  )[0];
  return latest?.queryString?.trim().replace(/^\?/, "") ?? "";
}

/*
 * The store is read through useSyncExternalStore rather than an effect: it
 * lives in localStorage, so the server cannot see it, and getServerSnapshot
 * lets React render the fallback during hydration and swap in the real target
 * afterwards without a mismatch. Strings compare by value, so returning a
 * fresh one from getSnapshot does not loop.
 */
const serverSnapshot = () => "";

type BackToReadingButtonProps = {
  /** The chart query for this page, when the route already carries one. */
  queryString?: string;
  /** Where to return to. Defaults to the reading itself. */
  path?: string;
  label?: string;
};

export default function BackToReadingButton({
  queryString,
  path = "/insights",
  label = "Back to your reading",
}: BackToReadingButtonProps) {
  const own = queryString?.trim().replace(/^\?/, "") ?? "";
  const remembered = useSyncExternalStore(
    subscribeToChartHistory,
    latestChartQuery,
    serverSnapshot
  );

  const query = own || remembered;
  const href = query ? `${path}?${query}` : "/";

  return <BackButton href={href} label={label} />;
}
