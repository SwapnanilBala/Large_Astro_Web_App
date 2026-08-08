/**
 * Chart-specific strength.
 *
 * Rarity answers "how unusual is this pattern in general". Strength answers
 * "how loudly is it expressed in THIS chart". They are multiplied to get the
 * ranking score, so a rare-but-faint pattern does not automatically outrank a
 * common-but-emphatic one.
 *
 * Strength is declared per rule rather than computed globally: what counts as
 * a strong 10th house has nothing in common with what counts as a strong nodal
 * axis, and a single global formula would have to pretend otherwise.
 */

import type { RuleContext } from "./context";
import type { Bindings } from "./paths";
import { evaluate } from "./predicates";
import type { RuleDefinition } from "./schema";

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** base + every bonus whose predicate matches, clamped to [0, 1]. */
export function computeStrength(def: RuleDefinition, ctx: RuleContext, bindings: Bindings): number {
  let total = def.strength.base;
  for (const bonus of def.strength.bonuses) {
    if (evaluate(bonus.when, ctx, bindings).matched) total += bonus.add;
  }
  return clamp01(total);
}
