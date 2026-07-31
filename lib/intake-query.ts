import { getBirthTimeFallback, hasCoarseTimeFallback } from "@/lib/birth-time";
import type { ProfileQueryInput } from "@/lib/astro-types";

/**
 * Build the chart query string from an intake draft.
 *
 * Both the desktop and the mobile intake produce the same URL, so the chart
 * that comes out the other side is identical regardless of which tree the
 * visitor filled in. Extracted here rather than duplicated because a drift
 * between the two would be silent — the chart would simply be subtly wrong
 * on one device, with nothing to flag it.
 */
export type BirthTimeIntent = {
  unknownTime: boolean;
  coarseTime: string;
};

export function buildChartQuery(
  draft: ProfileQueryInput,
  { unknownTime, coarseTime }: BirthTimeIntent,
): URLSearchParams {
  const params = new URLSearchParams();

  /* When the exact time is unknown we record which coarse window the visitor
   * chose, and derive a representative time from it. birthTimeAccuracy is
   * what the engine reads to decide how far it can trust time-sensitive
   * output such as the ascendant and the divisional charts. */
  const birthTimeAccuracy = unknownTime
    ? hasCoarseTimeFallback(coarseTime)
      ? coarseTime
      : "unknown"
    : "exact";

  const birthTime = unknownTime
    ? getBirthTimeFallback(birthTimeAccuracy)
    : draft.birthTime.trim();

  (Object.entries(draft) as [keyof ProfileQueryInput, string][]).forEach(([key, value]) => {
    params.set(key, typeof value === "string" ? value.trim() : String(value ?? ""));
  });

  params.set("birthTime", birthTime);
  params.set("birthTimeAccuracy", birthTimeAccuracy);
  params.set("birthTimeSource", unknownTime ? "fallback" : "exact");
  params.set("birthTimeFallback", unknownTime ? "true" : "false");

  return params;
}
