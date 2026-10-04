/**
 * Geometry and label layout for the North Indian (diamond) chart.
 *
 * Pure numbers, no React, so the drawing can be tested on its own. The
 * results page had a diamond chart until 2026-08-21 (342a086), removed because
 * houses 2 and 12 were drawn above the chart's top edge and the sign labels
 * did not sit in the regions they belonged to. Everything here is derived from
 * one square and its fixed construction lines, and
 * lib/__tests__/north-indian-chart.test.ts asserts that every region, sign
 * number and label box lands inside the square and inside its own house.
 *
 * The construction: a square, both diagonals, and the diamond joining the
 * midpoints of its sides. That cuts the square into four kites (houses 1, 4,
 * 7, 10 -- the angles) and eight triangles. The houses are fixed and run
 * anticlockwise from the top kite, which is always the ascendant; the signs
 * rotate, and each house shows the number of its sign (Aries = 1).
 */

import type { PlanetPosition } from "./astro-types";
import { wheelPlacement, type WheelPlacement } from "./constellation-geometry";

export const NORTH_INDIAN_SIZE = 400;

export type Point = readonly [number, number];
export type Box = { x: number; y: number; w: number; h: number };

const S = NORTH_INDIAN_SIZE;
const H = S / 2;
const Q = S / 4;

/* Corners, side midpoints, centre, and the four points where the diagonals
   cross the diamond. */
const TL: Point = [0, 0];
const TR: Point = [S, 0];
const BR: Point = [S, S];
const BL: Point = [0, S];
const TOP: Point = [H, 0];
const RIGHT: Point = [S, H];
const BOTTOM: Point = [H, S];
const LEFT: Point = [0, H];
const CENTRE: Point = [H, H];
const INNER_TL: Point = [Q, Q];
const INNER_TR: Point = [S - Q, Q];
const INNER_BR: Point = [S - Q, S - Q];
const INNER_BL: Point = [Q, S - Q];

/** Each house's region, anticlockwise from the top kite. */
export const HOUSE_POLYGONS: Record<number, readonly Point[]> = {
  1: [TOP, INNER_TR, CENTRE, INNER_TL],
  2: [TL, TOP, INNER_TL],
  3: [TL, INNER_TL, LEFT],
  4: [LEFT, INNER_TL, CENTRE, INNER_BL],
  5: [LEFT, INNER_BL, BL],
  6: [BL, INNER_BL, BOTTOM],
  7: [BOTTOM, INNER_BL, CENTRE, INNER_BR],
  8: [BOTTOM, INNER_BR, BR],
  9: [BR, INNER_BR, RIGHT],
  10: [RIGHT, INNER_BR, CENTRE, INNER_TR],
  11: [RIGHT, INNER_TR, TR],
  12: [TR, INNER_TR, TOP],
};

/**
 * Where each house's sign number sits: just inside its inner corner, the
 * traditional spot. For the four kites that clusters the angle numbers around
 * the centre of the chart, which is how the chart is usually read.
 */
export const SIGN_NUMBER_POINTS: Record<number, Point> = {
  1: [H, H - 24],
  4: [H - 24, H],
  7: [H, H + 24],
  10: [H + 24, H],
  2: [Q, Q - 20],
  12: [S - Q, Q - 20],
  3: [Q - 20, Q],
  11: [S - Q + 20, Q],
  5: [Q - 20, S - Q],
  9: [S - Q + 20, S - Q],
  6: [Q, S - Q + 20],
  8: [S - Q, S - Q + 20],
};

/*
 * The box planet labels are laid out in, per house: the largest comfortable
 * rectangle inside the region, kept clear of the sign number. A kite box
 * satisfies w + h <= S / 2 about the kite's centre; a triangle box sits on the
 * triangle's outer edge, 6 units in, and stops where the sloping sides would
 * cut it.
 */
const KITE_BOX = { w: 112, h: 76 };
const EDGE_BOX = { long: 84, short: 46, inset: 6 };

function kiteBox(cx: number, cy: number): Box {
  return { x: cx - KITE_BOX.w / 2, y: cy - KITE_BOX.h / 2, w: KITE_BOX.w, h: KITE_BOX.h };
}

export const LABEL_BOXES: Record<number, Box> = {
  1: kiteBox(H, Q),
  4: kiteBox(Q, H),
  7: kiteBox(H, S - Q),
  10: kiteBox(S - Q, H),
  2: { x: Q - EDGE_BOX.long / 2, y: EDGE_BOX.inset, w: EDGE_BOX.long, h: EDGE_BOX.short },
  12: { x: S - Q - EDGE_BOX.long / 2, y: EDGE_BOX.inset, w: EDGE_BOX.long, h: EDGE_BOX.short },
  6: { x: Q - EDGE_BOX.long / 2, y: S - EDGE_BOX.inset - EDGE_BOX.short, w: EDGE_BOX.long, h: EDGE_BOX.short },
  8: { x: S - Q - EDGE_BOX.long / 2, y: S - EDGE_BOX.inset - EDGE_BOX.short, w: EDGE_BOX.long, h: EDGE_BOX.short },
  3: { x: EDGE_BOX.inset, y: Q - EDGE_BOX.long / 2, w: EDGE_BOX.short, h: EDGE_BOX.long },
  5: { x: EDGE_BOX.inset, y: S - Q - EDGE_BOX.long / 2, w: EDGE_BOX.short, h: EDGE_BOX.long },
  11: { x: S - EDGE_BOX.inset - EDGE_BOX.short, y: Q - EDGE_BOX.long / 2, w: EDGE_BOX.short, h: EDGE_BOX.long },
  9: { x: S - EDGE_BOX.inset - EDGE_BOX.short, y: S - Q - EDGE_BOX.long / 2, w: EDGE_BOX.short, h: EDGE_BOX.long },
};

export const HOUSES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export const ZODIAC_ORDER = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;

/** The sign on a house, counting whole signs from the ascendant's. */
export function signForHouse(ascendantSign: string, house: number): string {
  const start = ZODIAC_ORDER.indexOf(ascendantSign as (typeof ZODIAC_ORDER)[number]);
  if (start < 0) throw new Error(`Unknown ascendant sign: ${ascendantSign}`);
  return ZODIAC_ORDER[(start + house - 1) % 12];
}

/** Aries = 1 ... Pisces = 12, the number written in the house. */
export function signNumber(sign: string): number {
  return ZODIAC_ORDER.indexOf(sign as (typeof ZODIAC_ORDER)[number]) + 1;
}

/** A planet and where the rasi chart puts it. */
export type RasiPlacement = WheelPlacement & { planet: PlanetPosition };

/**
 * Where each planet sits on the rasi chart: in the sign the constellation
 * wheel draws it in, and in that sign's house.
 *
 * Not in the API's `house`. That number follows the engine's house system,
 * and the cusp-based ones (Equal, Placidus, Koch and the rest) draw a house's
 * edge at a cusp rather than at a sign boundary, so it can name a house whose
 * sign is not the planet's own. The diamond writes each house's sign number in
 * it, and a planet placed by that `house` turned up in signs it was not in --
 * under Placidus, eight planets in one house. A rasi chart is a chart of signs,
 * so the house is the sign's, whatever system the rest of the reading uses.
 */
export function rasiPlacements(
  planets: readonly PlanetPosition[],
  ascendantSign: string,
): RasiPlacement[] {
  return planets.map((planet) => ({ planet, ...wheelPlacement(planet.longitude, ascendantSign) }));
}

/** Points-in-polygon by ray casting; edges count as inside. */
export function pointInPolygon([x, y]: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    /* On an edge: collinear and within the segment's bounds. */
    const cross = (xj - xi) * (y - yi) - (yj - yi) * (x - xi);
    if (
      Math.abs(cross) < 1e-9 &&
      x >= Math.min(xi, xj) - 1e-9 && x <= Math.max(xi, xj) + 1e-9 &&
      y >= Math.min(yi, yj) - 1e-9 && y <= Math.max(yi, yj) + 1e-9
    ) {
      return true;
    }
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function polygonArea(polygon: readonly Point[]): number {
  let twice = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    twice += polygon[j][0] * polygon[i][1] - polygon[i][0] * polygon[j][1];
  }
  return Math.abs(twice) / 2;
}

/* ── Label layout ── */

export type ChartLabel = {
  /** Two-letter planet abbreviation, or the ascendant's. */
  abbrev: string;
  /** Whole degrees in the sign, already formatted ("14°"). */
  degree: string;
  retrograde: boolean;
};

export type PlacedLabel = ChartLabel & {
  x: number;
  y: number;
  /** False when the house was too crowded to print degrees. */
  showDegree: boolean;
};

export type LabelLayout = { labels: PlacedLabel[]; scale: number };

/* Font sizes in chart units, at scale 1. The chart renders at 400-560px for a
   400-unit viewBox, so these come out at their nominal size or larger. */
export const LABEL_FONT = { abbrev: 13, degree: 11, retro: 8 };
const LINE_HEIGHT = 15;
const COLUMN_GAP = 6;

/* Rough advance widths, generous on purpose: an overestimate costs a little
   space, an underestimate puts text over a line. */
function labelWidth(label: ChartLabel, showDegree: boolean, scale: number): number {
  let width = label.abbrev.length * LABEL_FONT.abbrev * 0.62;
  if (showDegree) width += 3 + label.degree.length * LABEL_FONT.degree * 0.6;
  if (label.retrograde) width += 1.5 + LABEL_FONT.retro * 0.7;
  return width * scale;
}

/**
 * Fit a house's labels into its box: one column if it fits, then two or three,
 * dropping the degrees before shrinking the type, and shrinking only as a last
 * resort. Returns the labels with centre points, row by row.
 *
 * `fontScale` is for a chart that prints its labels larger than LABEL_FONT,
 * relative to it: the atlas thumbnails draw this geometry at under half size,
 * so they print at 25 units, nearly twice the 13 here. Line height, widths and
 * gaps grow with it, so stacked labels never overprint one another.
 */
export function layoutHouseLabels(labels: ChartLabel[], box: Box, fontScale = 1): LabelLayout {
  if (labels.length === 0) return { labels: [], scale: 1 };
  const gap = COLUMN_GAP * fontScale;

  for (const scale of [1, 0.88, 0.76, 0.66]) {
    for (const showDegree of [true, false]) {
      for (const columns of [1, 2, 3]) {
        const rows = Math.ceil(labels.length / columns);
        const lineHeight = LINE_HEIGHT * scale * fontScale;
        if (rows * lineHeight > box.h) continue;
        const columnWidth = Math.max(...labels.map((label) => labelWidth(label, showDegree, scale))) * fontScale;
        if (columns * columnWidth + (columns - 1) * gap > box.w) continue;

        const blockHeight = rows * lineHeight;
        const top = box.y + (box.h - blockHeight) / 2;
        const blockWidth = columns * columnWidth + (columns - 1) * gap;
        const left = box.x + (box.w - blockWidth) / 2;
        return {
          scale,
          labels: labels.map((label, index) => {
            const row = Math.floor(index / columns);
            const column = index % columns;
            /* A last row with fewer labels is centred rather than left-aligned. */
            const inRow = Math.min(columns, labels.length - row * columns);
            const rowWidth = inRow * columnWidth + (inRow - 1) * gap;
            const rowLeft = columns === 1 ? left : box.x + (box.w - rowWidth) / 2;
            return {
              ...label,
              showDegree,
              x: rowLeft + column * (columnWidth + gap) + columnWidth / 2,
              y: top + row * lineHeight + lineHeight / 2,
            };
          }),
        };
      }
    }
  }

  /* Nine bodies in one triangle is not a real chart; still draw something. */
  const scale = 0.6;
  return {
    scale,
    labels: labels.map((label, index) => ({
      ...label,
      showDegree: false,
      x: box.x + box.w / 2,
      y: box.y + (index + 0.5) * Math.min(LINE_HEIGHT * scale * fontScale, box.h / labels.length),
    })),
  };
}

/** Whole degrees for the chart face. Never rounds up into the next sign. */
export function formatWholeDegree(degreeInSign: number): string {
  return `${Math.floor(degreeInSign)}°`;
}

/** Degrees and minutes for the positions table, e.g. 14°20′. */
export function formatDegreeMinutes(degreeInSign: number): string {
  const totalMinutes = Math.floor(degreeInSign * 60 + 1e-9);
  const degrees = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${degrees}°${String(minutes).padStart(2, "0")}′`;
}
