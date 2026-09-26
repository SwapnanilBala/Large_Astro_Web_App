import type { YogaChartInput, YogaDefinition, YogaDetectionResult } from "./types";
import { YOGA_OCCURRENCE_THRESHOLD } from "./tables";
import { withOccurrenceChance } from "./helpers";
import { CORE_YOGA_DEFINITIONS } from "./definitions/core";
import { GENERATED_YOGA_DEFINITIONS } from "./definitions/generated";
import { ADDITIONAL_YOGA_DEFINITIONS } from "./definitions/additional";
import { NABHASA_YOGA_DEFINITIONS } from "./definitions/nabhasa";
import { CLASSICAL_RECIPE_DEFINITIONS } from "./definitions/classical";
import { NAMED_CLASSICAL_YOGA_DEFINITIONS } from "./definitions/named";
import { NAVAMSA_YOGA_DEFINITIONS } from "./definitions/navamsa";

/**
 * The whole catalogue, 205 definitions, in an order the reader sees the
 * consequences of.
 *
 * `detectYogas` sorts by strength and then by occurrence chance, and
 * Array.prototype.sort is stable, so every tie falls back to the order below.
 * It is therefore the order the panel lists equally-rated yogas in, and it is
 * the order the single file declared them in before it was split. Reordering
 * these lines reorders the page.
 *
 * How the groups came to be, since the split is otherwise the only thing
 * explaining the shape of this list:
 *
 *   core         22   the definitions the engine opened with
 *   generated    50   the first recipe batch
 *   additional   28   one-off definitions written out by hand
 *   nabhasa      30 ┐ the hundred added on 2026-09-25: 30 Nabhasa figures
 *   classical    64 │ (completing the classical 32), 22 parivartana, 15
 *   named         6 ┘ house-lord placements, 11 single-planet placements,
 *                     11 conjunctions, 5 reckoned from a karaka, 6 named
 *   navamsa       5   the combinations that read the D9, added 2026-09-26
 */
const YOGA_DEFINITIONS: YogaDefinition[] = [
  ...CORE_YOGA_DEFINITIONS,
  ...GENERATED_YOGA_DEFINITIONS,
  ...ADDITIONAL_YOGA_DEFINITIONS,
  ...NABHASA_YOGA_DEFINITIONS,
  ...CLASSICAL_RECIPE_DEFINITIONS,
  ...NAMED_CLASSICAL_YOGA_DEFINITIONS,
  ...NAVAMSA_YOGA_DEFINITIONS,
];

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

export function detectYogas(chart: YogaChartInput): YogaDetectionResult[] {
  const results: YogaDetectionResult[] = [];

  for (const definition of YOGA_DEFINITIONS) {
    try {
      const result = definition.detect(chart);
      const scoredResult = result ? withOccurrenceChance(result) : null;
      if (
        scoredResult &&
        scoredResult.present &&
        scoredResult.occurrence_chance >= YOGA_OCCURRENCE_THRESHOLD
      ) {
        results.push(scoredResult);
      }
    } catch {
      // Skip any yoga that fails detection gracefully
    }
  }

  // Sort: strong first, then moderate, then highest probability within each band.
  const strengthOrder: Record<string, number> = { strong: 0, moderate: 1, weak: 2 };
  results.sort((a, b) => {
    const strengthDelta = strengthOrder[a.strength] - strengthOrder[b.strength];
    if (strengthDelta !== 0) return strengthDelta;
    return b.occurrence_chance - a.occurrence_chance;
  });

  return results;
}

export { YOGA_DEFINITIONS };
export type { YogaChartInput, YogaDetectionResult, YogaDefinition };
export {
  getSignLord,
  isInKendra,
  isInTrikona,
  isExalted,
  isDebilitated,
  isOwnSign,
  isInDusthana,
  arePlanetsConjunct,
  getHouseLord,
} from "./helpers";
