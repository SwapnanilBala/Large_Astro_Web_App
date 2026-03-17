
import type { PlanetPosition } from "./swiss-ephemeris-engine";
import { computeTransitPositions } from "./swiss-ephemeris-engine";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface TransitPosition {
  name: string;
  longitude: number;
  sign: string;
  degree_in_sign: number;
}

export interface TransitAspect {
  transit_planet: string;
  natal_planet: string;
  aspect_type: string;
  orb: number;
}

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const ASPECT_ANGLES: Record<string, number> = {
  Conjunction: 0,
  Opposition: 180,
  Trine: 120,
  Square: 90,
  Sextile: 60,
};

// --------------------------------------------------------------------------
// Transit calculations
// --------------------------------------------------------------------------

export function getTransitPositions(
  referenceDate: Date,
  engineId?: string
): TransitPosition[] {
  return computeTransitPositions(referenceDate, engineId);
}

export function getCurrentTransitPositions(engineId?: string): TransitPosition[] {
  return computeTransitPositions(new Date(), engineId);
}

export function computeTransitAspects(
  natalPlanets: PlanetPosition[],
  transitPositions: TransitPosition[]
): TransitAspect[] {
  const orbLimit = 8;
  const aspects: TransitAspect[] = [];

  for (const transit of transitPositions) {
    for (const natal of natalPlanets) {
      const rawDiff = Math.abs(transit.longitude - natal.longitude);
      const angularDistance = Math.min(rawDiff, 360 - rawDiff);

      for (const [aspectType, targetAngle] of Object.entries(ASPECT_ANGLES)) {
        const orb = Math.abs(angularDistance - targetAngle);
        if (orb <= orbLimit) {
          aspects.push({
            transit_planet: transit.name,
            natal_planet: natal.name,
            aspect_type: aspectType,
            orb: Math.round(orb * 10000) / 10000,
          });
        }
      }
    }
  }

  // Sort by tightest orb
  aspects.sort((a, b) => a.orb - b.orb);
  return aspects;
}
