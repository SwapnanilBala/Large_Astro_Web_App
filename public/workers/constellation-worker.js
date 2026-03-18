/**
 * Web Worker for constellation chart calculations.
 * Offloads star generation, planet position layout, and conjunction line
 * computation from the main thread.
 *
 * Message protocol:
 *   Input:  { planets: PlanetPosition[], ascendantSign: string }
 *   Output: { stars: StarData[], planetPositions: PlanetPosData[], conjunctionLines: LineData[] }
 */

// ── Constants (mirrored from constellation-chart.tsx) ──────────────────────

const CX = 300;
const CY = 300;
const PLANET_R = 195;

const ASPECT_CONFIG = [
  { type: "conjunction", angle: 0, orb: 10, color: "#f2c26c" },
  { type: "trine", angle: 120, orb: 8, color: "#6ce1d4" },
  { type: "square", angle: 90, orb: 8, color: "#ff6b5b" },
  { type: "opposition", angle: 180, orb: 10, color: "#c490e4" },
  { type: "sextile", angle: 60, orb: 6, color: "#6ce1a0" },
];

// ── Math helpers ───────────────────────────────────────────────────────────

function seededRandom(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return function () {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    return (hash % 10000) / 10000;
  };
}

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function lonToAngle(longitude) {
  return longitude - 90;
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = degToRad(angleDeg);
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function detectAspect(lon1, lon2) {
  let diff = Math.abs(lon1 - lon2);
  if (diff > 180) diff = 360 - diff;
  for (const cfg of ASPECT_CONFIG) {
    if (Math.abs(diff - cfg.angle) <= cfg.orb) {
      return { type: cfg.type, color: cfg.color };
    }
  }
  return null;
}

// ── Computation functions ─────────────────────────────────────────────────

function computeStars(ascendantSign) {
  const rng = seededRandom(ascendantSign);
  const count = 50;
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push({
      x: rng() * 600,
      y: rng() * 600,
      r: 0.5 + rng() * 1.5,
      dur: 2 + rng() * 3,
      delay: rng() * 5,
    });
  }
  return result;
}

function computePlanetPositions(planets) {
  if (!planets || planets.length === 0) return [];

  const positions = planets.map((p) => {
    const angle = lonToAngle(p.longitude);
    const pos = polarToCartesian(CX, CY, PLANET_R, angle);
    return {
      name: p.name,
      longitude: p.longitude,
      sign: p.sign,
      degree_in_sign: p.degree_in_sign,
      house: p.house,
      is_retrograde: p.is_retrograde || false,
      angle,
      cx: pos.x,
      cy: pos.y,
    };
  });

  // Spread out planets that are too close together
  const MIN_DIST = 28;
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const dx = positions[i].cx - positions[j].cx;
      const dy = positions[i].cy - positions[j].cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MIN_DIST) {
        const posI = polarToCartesian(CX, CY, PLANET_R - 16, positions[i].angle);
        positions[i] = { ...positions[i], cx: posI.x, cy: posI.y };
        const posJ = polarToCartesian(CX, CY, PLANET_R + 16, positions[j].angle);
        positions[j] = { ...positions[j], cx: posJ.x, cy: posJ.y };
      }
    }
  }

  return positions;
}

function computeConjunctionLines(planetPositions) {
  const lines = [];
  const houseGroups = {};
  for (const p of planetPositions) {
    if (!houseGroups[p.house]) houseGroups[p.house] = [];
    houseGroups[p.house].push(p);
  }
  for (const group of Object.values(houseGroups)) {
    if (group.length > 1) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          lines.push({
            x1: group[i].cx,
            y1: group[i].cy,
            x2: group[j].cx,
            y2: group[j].cy,
          });
        }
      }
    }
  }
  return lines;
}

// ── Worker message handler ────────────────────────────────────────────────

self.onmessage = function (e) {
  const { planets, ascendantSign } = e.data;

  const stars = computeStars(ascendantSign);
  const planetPositions = computePlanetPositions(planets);
  const conjunctionLines = computeConjunctionLines(planetPositions);

  self.postMessage({ stars, planetPositions, conjunctionLines });
};
