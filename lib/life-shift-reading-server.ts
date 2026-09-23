import "server-only";
import { createHash } from "node:crypto";
import type { LifeShiftDepth, LifeShiftFacts } from "./life-shift-reading";

/*
 * The half of the life-shift reading helpers that only the route needs.
 *
 * Split out of lib/life-shift-reading.ts because that module is also imported
 * by the panel and its hook in the browser, and a single `node:crypto` import
 * there made the bundler ship crypto-browserify -- about 400 KB, with Node's
 * stream, util and vm shims behind it -- to every page that draws the life
 * shifts, for a hash the browser never computes. The vm shim's eval was also
 * the one Content-Security-Policy violation left on those pages. The
 * `server-only` import turns any future client import of this file into a
 * build error rather than a silent 400 KB.
 */

/**
 * The cache key for one request.
 *
 * Hashed rather than concatenated: the facts carry free text, and a key
 * built by joining them would collide on any value containing the separator.
 *
 * The depth is part of the key rather than a detail of it, and that is the
 * whole reason this is a function with a test rather than three lines inside
 * the route. The two pages ask about overlapping chapters, so leaving it out
 * lets whichever page is visited first decide how long the other one's
 * readings are -- a results page warmed by a visit to /insights/life-shifts
 * would quietly serve the three-sentence version of the very reading the
 * headline length exists to lengthen. That failure is invisible: the card
 * renders a perfectly good reading, just the wrong one.
 */
export function lifeShiftCacheKey(
  depth: LifeShiftDepth,
  facts: LifeShiftFacts[],
): string {
  return createHash("sha256").update(JSON.stringify({ depth, facts })).digest("hex");
}
