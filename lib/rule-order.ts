import type { DeterministicRule } from "@/lib/astro-types";

/**
 * Order by the measured rank, with unselected rules after the selected ones.
 *
 * `rank` is 0 for anything the selection layer did not pick, so a naive
 * ascending sort would float every unselected rule to the top.
 *
 * Shared by the full reading, which lists every rule, and the results page's
 * evidence preview, which shows the first few -- the two must agree on which
 * findings count as first.
 */
export function bySelectionRank(left: DeterministicRule, right: DeterministicRule): number {
  const leftRank = left.selection?.selected ? left.selection.rank : Number.MAX_SAFE_INTEGER;
  const rightRank = right.selection?.selected ? right.selection.rank : Number.MAX_SAFE_INTEGER;
  if (leftRank !== rightRank) return leftRank - rightRank;
  return (right.selection?.score ?? 0) - (left.selection?.score ?? 0);
}
