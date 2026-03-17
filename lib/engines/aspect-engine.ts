// Planetary aspect calculation engine - port of backend/app/services/aspect_engine.py

import type { PlanetPosition } from "./swiss-ephemeris-engine";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface AspectData {
  planet1: string;
  planet2: string;
  aspect_type: string;
  exact_angle: number;
  orb: number;
  applying: boolean;
  vedic: boolean;
}

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const WESTERN_ASPECTS: Record<string, { angle: number; orb: number }> = {
  Conjunction: { angle: 0, orb: 8 },
  Opposition: { angle: 180, orb: 8 },
  Trine: { angle: 120, orb: 8 },
  Square: { angle: 90, orb: 7 },
  Sextile: { angle: 60, orb: 6 },
};

const VEDIC_SPECIAL_ASPECTS: Record<string, number[]> = {
  Mars: [4, 8],
  Jupiter: [5, 9],
  Saturn: [3, 10],
};

const PLANET_SPEED_ORDER: string[] = [
  "Moon", "Mercury", "Venus", "Sun", "Mars", "Jupiter", "Saturn", "Rahu", "Ketu",
];

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function angleBetween(lon1: number, lon2: number): number {
  const diff = Math.abs(lon1 - lon2) % 360;
  return diff <= 180 ? diff : 360 - diff;
}

function isApplying(p1: PlanetPosition, p2: PlanetPosition, targetAngle: number): boolean {
  const speedRank: Record<string, number> = {};
  PLANET_SPEED_ORDER.forEach((name, idx) => {
    speedRank[name] = idx;
  });

  const rank1 = speedRank[p1.name] ?? 99;
  const rank2 = speedRank[p2.name] ?? 99;

  const faster = rank1 < rank2 ? p1 : p2;
  const slower = rank1 < rank2 ? p2 : p1;

  const currentAngle = angleBetween(faster.longitude, slower.longitude);
  return currentAngle >= targetAngle;
}

// --------------------------------------------------------------------------
// Main calculation
// --------------------------------------------------------------------------

export function calculateAspects(
  planets: PlanetPosition[],
  includeVedic = true
): AspectData[] {
  const aspects: AspectData[] = [];
  const seenPairs = new Set<string>();

  const n = planets.length;

  // Western aspects
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const p1 = planets[i];
      const p2 = planets[j];
      const angle = angleBetween(p1.longitude, p2.longitude);

      for (const [aspectName, spec] of Object.entries(WESTERN_ASPECTS)) {
        const orb = Math.abs(angle - spec.angle);
        if (orb <= spec.orb) {
          const applying = isApplying(p1, p2, spec.angle);
          aspects.push({
            planet1: p1.name,
            planet2: p2.name,
            aspect_type: aspectName,
            exact_angle: spec.angle,
            orb: Math.round(orb * 10000) / 10000,
            applying,
            vedic: false,
          });
          const pairKey = [p1.name, p2.name].sort().join("|");
          seenPairs.add(pairKey);
        }
      }
    }
  }

  // Vedic special aspects (graha-drishti)
  if (includeVedic) {
    const vedicOrb = 10;

    for (const caster of planets) {
      const houseOffsets = VEDIC_SPECIAL_ASPECTS[caster.name];
      if (!houseOffsets) continue;

      for (const offset of houseOffsets) {
        const targetLon = (caster.longitude + offset * 30) % 360;

        for (const receiver of planets) {
          if (receiver.name === caster.name) continue;

          const pairKey = [caster.name, receiver.name].sort().join("|");
          if (seenPairs.has(pairKey)) continue;

          const orb = angleBetween(receiver.longitude, targetLon);
          if (orb <= vedicOrb) {
            const aspectLabel = `Vedic-${caster.name}-${offset}th`;
            const applying = isApplying(caster, receiver, 0);
            aspects.push({
              planet1: caster.name,
              planet2: receiver.name,
              aspect_type: aspectLabel,
              exact_angle: Math.round(targetLon * 10000) / 10000,
              orb: Math.round(orb * 10000) / 10000,
              applying,
              vedic: true,
            });
            seenPairs.add(pairKey);
          }
        }
      }
    }
  }

  // Sort by tightest orb
  aspects.sort((a, b) => a.orb - b.orb);
  return aspects;
}
