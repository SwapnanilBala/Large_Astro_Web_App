/**
 * Fixed-precision SVG coordinates.
 *
 * `Math.sin` and `Math.cos` are not required by the ECMAScript spec to be
 * correctly rounded, and implementations are free to differ in the last place.
 * Node and the browser are two such implementations, so a coordinate computed
 * from trigonometry during render can serialise as
 *
 *   server: y2="83.49364905389038"
 *   client: y2="83.49364905389041"
 *
 * which React treats as a hydration mismatch. It is not cosmetic: a mismatch
 * makes React discard the server tree, and on the intake form that left the
 * Continue button unresponsive until a reload. It is also intermittent, which
 * is what made it expensive to chase — the same page hydrates cleanly on most
 * loads.
 *
 * Rounding collapses the two values to one before they ever reach an
 * attribute. Three decimals is far below a pixel on the viewBoxes here (the
 * largest is 600 units), so nothing moves.
 *
 * Use this for any number computed at render time that lands in SVG markup.
 * Values computed inside an effect or an event handler never reach the server
 * and do not need it.
 */
export function svgCoord(value: number): number {
  return Math.round(value * 1000) / 1000;
}
