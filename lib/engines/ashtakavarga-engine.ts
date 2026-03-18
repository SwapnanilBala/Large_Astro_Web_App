// Ashtakavarga Engine — Classical Vedic point-based transit strength system
//
// Computes Bhinnashtakavarga (individual planet bindu tables) and
// Sarvashtakavarga (aggregate 12-sign totals) from natal positions.

import { SIGNS } from "./swiss-ephemeris-engine";
import type { PlanetPosition } from "./swiss-ephemeris-engine";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface AshtakavargaResult {
  bhinnashtakavarga: Record<string, number[]>; // planet -> 12 sign scores
  sarvashtakavarga: number[];                  // 12 sign totals
  totalBindus: number;                         // should be 337
  strongSigns: string[];                       // signs with >= 28 SAV bindus
  weakSigns: string[];                         // signs with <= 25 SAV bindus
}

// --------------------------------------------------------------------------
// Contributing house tables (classical Ashtakavarga)
//
// For each planet whose BAV we compute, these are the houses (counted from
// each source's natal sign) that contribute 1 bindu.
// --------------------------------------------------------------------------

type SourceContributions = Record<string, number[]>;

const ASHTAKAVARGA_TABLES: Record<string, SourceContributions> = {
  Sun: {
    Sun:       [1, 2, 4, 7, 8, 9, 10, 11],
    Moon:      [3, 6, 10, 11],
    Mars:      [1, 2, 4, 7, 8, 9, 10, 11],
    Mercury:   [3, 5, 6, 9, 10, 11, 12],
    Jupiter:   [5, 6, 9, 11],
    Venus:     [6, 7, 12],
    Saturn:    [1, 2, 4, 7, 8, 9, 10, 11],
    Ascendant: [3, 4, 6, 10, 11, 12],
  },
  Moon: {
    Sun:       [3, 6, 7, 8, 10, 11],
    Moon:      [1, 3, 6, 7, 10, 11],
    Mars:      [2, 3, 5, 6, 9, 10, 11],
    Mercury:   [1, 3, 5, 6, 9, 10, 11],
    Jupiter:   [1, 4, 7, 8, 10, 11, 12],
    Venus:     [3, 4, 5, 7, 9, 10, 11],
    Saturn:    [3, 5, 6, 11],
    Ascendant: [3, 6, 10, 11],
  },
  Mars: {
    Sun:       [3, 5, 6, 10, 11],
    Moon:      [3, 6, 11],
    Mars:      [1, 2, 4, 7, 8, 10, 11],
    Mercury:   [3, 5, 6, 11],
    Jupiter:   [6, 10, 11, 12],
    Venus:     [6, 8, 11, 12],
    Saturn:    [1, 4, 7, 8, 9, 10, 11],
    Ascendant: [1, 3, 6, 10, 11],
  },
  Mercury: {
    Sun:       [5, 6, 9, 11, 12],
    Moon:      [2, 4, 6, 8, 10, 11],
    Mars:      [1, 2, 4, 7, 8, 9, 10, 11],
    Mercury:   [1, 3, 5, 6, 9, 10, 11, 12],
    Jupiter:   [6, 8, 11, 12],
    Venus:     [1, 2, 3, 4, 5, 8, 9, 11],
    Saturn:    [1, 2, 4, 7, 8, 9, 10, 11],
    Ascendant: [1, 2, 4, 6, 8, 10, 11],
  },
  Jupiter: {
    Sun:       [1, 2, 3, 4, 7, 8, 9, 10, 11],
    Moon:      [2, 5, 7, 9, 11],
    Mars:      [1, 2, 4, 7, 8, 10, 11],
    Mercury:   [1, 2, 4, 5, 6, 9, 10, 11],
    Jupiter:   [1, 2, 3, 4, 7, 8, 10, 11],
    Venus:     [2, 5, 6, 9, 10, 11],
    Saturn:    [3, 5, 6, 12],
    Ascendant: [1, 2, 4, 5, 6, 7, 9, 10, 11],
  },
  Venus: {
    Sun:       [8, 11, 12],
    Moon:      [1, 2, 3, 4, 5, 8, 9, 11, 12],
    Mars:      [3, 5, 6, 9, 11, 12],
    Mercury:   [3, 5, 6, 9, 11],
    Jupiter:   [5, 8, 9, 10, 11],
    Venus:     [1, 2, 3, 4, 5, 8, 9, 10, 11],
    Saturn:    [3, 4, 5, 8, 9, 10, 11],
    Ascendant: [1, 2, 3, 4, 5, 8, 9, 11],
  },
  Saturn: {
    Sun:       [1, 2, 4, 7, 8, 10, 11],
    Moon:      [3, 6, 11],
    Mars:      [3, 5, 6, 10, 11, 12],
    Mercury:   [6, 8, 9, 10, 11, 12],
    Jupiter:   [5, 6, 11, 12],
    Venus:     [6, 11, 12],
    Saturn:    [3, 5, 6, 11],
    Ascendant: [1, 3, 4, 6, 10, 11],
  },
};

// The 7 planets used in Ashtakavarga (Rahu/Ketu excluded)
const BAV_PLANETS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function signIndex(signName: string): number {
  const idx = SIGNS.indexOf(signName);
  if (idx === -1) throw new Error(`Unknown sign: ${signName}`);
  return idx;
}

// --------------------------------------------------------------------------
// Computation
// --------------------------------------------------------------------------

export function computeAshtakavarga(
  planets: PlanetPosition[],
  ascendantSign: string
): AshtakavargaResult {
  // Build lookup: planet name -> sign index
  const sourceSignIndex: Record<string, number> = {};
  for (const p of planets) {
    if (BAV_PLANETS.includes(p.name)) {
      sourceSignIndex[p.name] = signIndex(p.sign);
    }
  }
  sourceSignIndex["Ascendant"] = signIndex(ascendantSign);

  const bhinnashtakavarga: Record<string, number[]> = {};

  for (const planet of BAV_PLANETS) {
    const table = ASHTAKAVARGA_TABLES[planet];
    if (!table) continue;

    // Initialize 12-sign bindu array
    const bindus = new Array(12).fill(0) as number[];

    // For each source (7 planets + ascendant)
    for (const [source, houses] of Object.entries(table)) {
      const srcIdx = sourceSignIndex[source];
      if (srcIdx === undefined) continue;

      for (const houseNum of houses) {
        const targetSign = (srcIdx + houseNum - 1) % 12;
        bindus[targetSign] += 1;
      }
    }

    bhinnashtakavarga[planet] = bindus;
  }

  // Sarvashtakavarga: sum all BAV tables sign-by-sign
  const sarvashtakavarga = new Array(12).fill(0) as number[];
  for (const planet of BAV_PLANETS) {
    const bindus = bhinnashtakavarga[planet];
    if (!bindus) continue;
    for (let i = 0; i < 12; i++) {
      sarvashtakavarga[i] += bindus[i];
    }
  }

  const totalBindus = sarvashtakavarga.reduce((sum, v) => sum + v, 0);

  const strongSigns: string[] = [];
  const weakSigns: string[] = [];
  for (let i = 0; i < 12; i++) {
    if (sarvashtakavarga[i] >= 28) strongSigns.push(SIGNS[i]);
    if (sarvashtakavarga[i] <= 25) weakSigns.push(SIGNS[i]);
  }

  return {
    bhinnashtakavarga,
    sarvashtakavarga,
    totalBindus,
    strongSigns,
    weakSigns,
  };
}
