/**
 * Which rules lead the page.
 *
 * Selection is METADATA, not a filter. `chart.deterministic_rules` stays the
 * full fired list in declaration order; this module only marks which rules are
 * selected and in what order. That distinction is what makes the ranking safe
 * to change: the desktop category buckets cannot empty, mobile's
 * `priority === "high"` filter cannot return nothing, and no consumer surface
 * can be starved by a re-rank. The worst case is that a section shows
 * unselected rules, which is exactly the pre-migration behaviour.
 */

import type { RuleCategory, RuleTier } from "@/lib/astro-types";

export type SelectionOptions = {
  /** How many rules lead the page. */
  topN: number;
  /** Diversity constraint, so one loud area cannot take every slot. */
  maxPerCategory: number;
  /** Tiers guaranteed one slot per category regardless of score. */
  pinTiers: RuleTier[];
};

export const DEFAULT_SELECTION_OPTIONS: SelectionOptions = {
  topN: 7,
  maxPerCategory: 3,
  pinTiers: ["foundation"],
};

/** The minimum a rule must expose to be ranked. */
export type Selectable = {
  instance_key: string;
  category: RuleCategory;
  tier: RuleTier;
  /** rarity.score * strength. The only ranking key. */
  score: number;
};

export type SelectionResult = {
  /** instance_keys in rank order, rank 1 first. */
  selectedIds: string[];
  /** instance_key -> its selection metadata. Every input rule has an entry. */
  meta: Map<string, { selected: boolean; rank: number }>;
};

/** Fixed so pinning is deterministic rather than dependent on input ordering. */
const CATEGORY_ORDER: RuleCategory[] = ["core", "career", "love"];

export function selectRules(
  rules: Selectable[],
  options: Partial<SelectionOptions> = {},
): SelectionResult {
  const opts = { ...DEFAULT_SELECTION_OPTIONS, ...options };

  // Declaration order is the tie-break, so a chart with two equally scored
  // rules ranks them the same way on every recompute.
  const indexed = rules.map((rule, order) => ({ rule, order }));
  const sorted = [...indexed].sort((a, b) => b.rule.score - a.rule.score || a.order - b.order);

  const chosen = new Set<string>();
  const perCategory = new Map<RuleCategory, number>(CATEGORY_ORDER.map((c) => [c, 0]));

  const take = (entry: (typeof indexed)[number]) => {
    chosen.add(entry.rule.instance_key);
    perCategory.set(entry.rule.category, (perCategory.get(entry.rule.category) ?? 0) + 1);
  };

  // 1. Pin the strongest foundation rule in each category.
  //
  // "Your rising sign is Taurus" scores well on rarity once the key is
  // parameterised by sign, but a structurally always-present rule still
  // deserves a floor. Pinning is cheaper and more honest than inflating its
  // score to buy it a slot.
  for (const category of CATEGORY_ORDER) {
    if (chosen.size >= opts.topN) break;
    const pin = sorted.find(
      (e) =>
        e.rule.category === category &&
        opts.pinTiers.includes(e.rule.tier) &&
        !chosen.has(e.rule.instance_key),
    );
    if (pin) take(pin);
  }

  // 2. Greedy fill under the per-category quota, relaxing it if supply in the
  //    remaining categories is too thin to reach topN.
  let quota = opts.maxPerCategory;
  while (chosen.size < opts.topN) {
    let added = 0;
    for (const entry of sorted) {
      if (chosen.size >= opts.topN) break;
      if (chosen.has(entry.rule.instance_key)) continue;
      if ((perCategory.get(entry.rule.category) ?? 0) >= quota) continue;
      take(entry);
      added++;
    }
    if (added === 0) {
      // Either every rule is chosen, or the quota is the only thing blocking.
      if (chosen.size >= rules.length) break;
      quota++;
      continue;
    }
  }

  // 3. Rank the selected set by score. Pinning decides membership, not
  //    position -- a pinned rule that scores low honestly ranks low.
  const selectedIds = sorted
    .filter((e) => chosen.has(e.rule.instance_key))
    .map((e) => e.rule.instance_key);

  const meta = new Map<string, { selected: boolean; rank: number }>();
  for (const { rule } of indexed) {
    meta.set(rule.instance_key, { selected: false, rank: 0 });
  }
  selectedIds.forEach((id, i) => meta.set(id, { selected: true, rank: i + 1 }));

  return { selectedIds, meta };
}
