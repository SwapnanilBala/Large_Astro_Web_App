/**
 * The yoga engine's public entry point.
 *
 * The implementation moved to ./yoga/ when the single file reached 3,500
 * lines. This re-export exists so that callers, and the two test files that
 * reach for `YOGA_DEFINITIONS`, keep importing the path they always have.
 *
 *   yoga/types.ts        the shapes, including the recipe inputs
 *   yoga/tables.ts       signs, rulers, dignities, planet groupings
 *   yoga/helpers.ts      predicates, chart lookups, scoring, prose builders
 *   yoga/factories.ts    the six recipe-to-definition builders
 *   yoga/navamsa.ts      the only place this engine reads a second chart
 *   yoga/definitions/    the 205 definitions, grouped by how they are built
 *   yoga/index.ts        assembly and detectYogas
 */
export {
  detectYogas,
  YOGA_DEFINITIONS,
  getSignLord,
  isInKendra,
  isInTrikona,
  isExalted,
  isDebilitated,
  isOwnSign,
  isInDusthana,
  arePlanetsConjunct,
  getHouseLord,
} from "./yoga";
export type { YogaChartInput, YogaDetectionResult, YogaDefinition } from "./yoga";
