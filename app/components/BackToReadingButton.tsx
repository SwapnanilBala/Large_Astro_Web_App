"use client";

import BackButton from "@/app/components/BackButton";
import { useTranslation } from "@/lib/i18n-context";
import { useLatestChartQuery } from "@/lib/use-latest-chart-query";

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

/*
 * The labels a page can ask for, by catalog key. Most callers are server
 * pages, which have no translator of their own: they name the key, and the
 * button reads it in the visitor's language. A label passed as text from a
 * server page would stay English whatever language the visitor chose.
 */
export const BACK_TO_READING_LABELS = [
  "insights.backToReading",
  "insights.backToAdvanced",
  "home.back",
] as const;

type BackToReadingButtonProps = {
  /** The chart query for this page, when the route already carries one. */
  queryString?: string;
  /** Where to return to. Defaults to the reading itself. */
  path?: string;
  /** The label, as a catalog key. Defaults to "Back to your reading". */
  labelKey?: (typeof BACK_TO_READING_LABELS)[number];
  /** The label as text already in the visitor's language, from a client
      component's own `t`. Wins over `labelKey`. */
  label?: string;
};

export default function BackToReadingButton({
  queryString,
  path = "/insights",
  labelKey = "insights.backToReading",
  label,
}: BackToReadingButtonProps) {
  const { t } = useTranslation();
  const own = queryString?.trim().replace(/^\?/, "") ?? "";
  const remembered = useLatestChartQuery();

  const query = own || remembered;
  const href = query ? `${path}?${query}` : "/";

  return <BackButton href={href} label={label ?? t(labelKey)} />;
}
