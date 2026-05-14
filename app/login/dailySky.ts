// Server-only utility that produces a single short line describing today's sky.
// Used above the Lagna Atelier login form. Reuses the existing pure-JS
// astronomy stack (astronomy-engine via lib/engines/swiss-ephemeris-engine).
//
// The codebase is a Vedic / sidereal app (Lahiri ayanamsa, Vimshottari dasha,
// nakshatras), so we report the sidereal Moon sign and Mercury direct/retrograde
// status — two facets that meaningfully change day-to-day.

import { computeTransitPositions } from "@/lib/engines/swiss-ephemeris-engine";
import { calculateNakshatra } from "@/lib/engines/nakshatra-engine";

// Day-keyed cache. The line only changes day-to-day, so a tiny in-memory map
// keyed by YYYY-MM-DD (UTC) is sufficient — no need for unstable_cache.
const dailyCache = new Map<string, string>();

const MIDDOT = "·"; // U+00B7

function dayKeyUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isMercuryRetrograde(reference: Date): boolean {
  // Sample Mercury's sidereal longitude one day apart and check direction.
  // Sidereal vs tropical doesn't matter for the sign of the daily delta
  // (the ayanamsa drift is ~50″/year — utterly negligible per day).
  const dayMs = 86_400_000;
  const t1 = new Date(reference.getTime() - dayMs / 2);
  const t2 = new Date(reference.getTime() + dayMs / 2);

  const p1 = computeTransitPositions(t1).find((p) => p.name === "Mercury");
  const p2 = computeTransitPositions(t2).find((p) => p.name === "Mercury");
  if (!p1 || !p2) return false;

  let diff = p2.longitude - p1.longitude;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff < 0;
}

/**
 * Return a short evocative line describing today's sky, suitable for display
 * above the login form. Format: `"<facet> · <facet>"`.
 *
 * The string is cached at module level keyed by UTC date — same value for all
 * callers within a given day, recomputed at the next UTC midnight.
 */
export async function getDailySkyLine(date?: Date): Promise<string> {
  const now = date ?? new Date();
  const key = dayKeyUTC(now);

  const cached = dailyCache.get(key);
  if (cached !== undefined) return cached;

  let line: string;
  try {
    const positions = computeTransitPositions(now);
    const moon = positions.find((p) => p.name === "Moon");
    const mercuryRetro = isMercuryRetrograde(now);

    if (!moon) {
      // Astronomy engine should always return Moon — this is paranoia.
      line = `Skies aligned ${MIDDOT} New beginnings`;
    } else {
      const nak = calculateNakshatra(moon.longitude);
      const mercuryStatus = mercuryRetro ? "retrograde" : "direct";
      line = `Moon in ${moon.sign} ${MIDDOT} Mercury ${mercuryStatus}`;

      // If the line is long, fall back to a more compact composition that
      // pairs Moon sign with the current nakshatra instead of Mercury.
      if (line.length > 50) {
        line = `Moon in ${moon.sign} ${MIDDOT} ${nak.name}`;
      }
    }
  } catch {
    // Defensive fallback so the login page never breaks because of an
    // ephemeris hiccup. Pure-date sun-sign approximation (tropical).
    line = `Sun in ${tropicalSunSignFromDate(now)} ${MIDDOT} Skies clear`;
  }

  dailyCache.set(key, line);
  return line;
}

// --------------------------------------------------------------------------
// Last-resort fallback: tropical sun sign from calendar date alone.
// Only reached if the astronomy engine throws.
// --------------------------------------------------------------------------

function tropicalSunSignFromDate(d: Date): string {
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  // Standard tropical sun-sign date ranges (approximate cusps).
  const cusps: Array<[number, number, string]> = [
    [1, 20, "Aquarius"],
    [2, 19, "Pisces"],
    [3, 21, "Aries"],
    [4, 20, "Taurus"],
    [5, 21, "Gemini"],
    [6, 21, "Cancer"],
    [7, 23, "Leo"],
    [8, 23, "Virgo"],
    [9, 23, "Libra"],
    [10, 23, "Scorpio"],
    [11, 22, "Sagittarius"],
    [12, 22, "Capricorn"],
  ];
  let sign = "Capricorn"; // Jan 1 - Jan 19
  for (const [cm, cd, name] of cusps) {
    if (m > cm || (m === cm && day >= cd)) sign = name;
  }
  return sign;
}
