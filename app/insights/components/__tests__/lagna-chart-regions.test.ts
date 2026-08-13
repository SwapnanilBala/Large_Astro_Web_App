import { describe, expect, it } from "vitest";
import { HOUSE_REGIONS as RASI_REGIONS } from "../lagna-chart";
import { HOUSE_REGIONS as PLACIDUS_REGIONS } from "../lahiri-placidus-lagna-chart";

/*
  Both diamond charts once numbered the four centre rhombi 1, 3, 5, 7 and swept
  the corner triangles up afterwards, which put every house but the first in the
  wrong region. These assertions pin the North Indian layout: houses run
  counter-clockwise from the top centre rhombus, so the kendras 1/4/7/10 land on
  the four rhombi and the other eight fill the corner triangles in order.
*/

type Region = { cx: number; cy: number; path: string };
type RegionTable = Record<number, Region>;

const HOUSES = Array.from({ length: 12 }, (_, i) => i + 1);
const SIZE = 600;
const CENTRE = SIZE / 2;

function vertices(region: Region): [number, number][] {
  return (region.path.match(/-?\d+,-?\d+/g) ?? []).map((pair) => {
    const [x, y] = pair.split(",").map(Number);
    return [x, y] as [number, number];
  });
}

/* Shoelace area, sign-independent. */
function area(points: [number, number][]): number {
  const sum = points.reduce((acc, [x, y], i) => {
    const [nx, ny] = points[(i + 1) % points.length];
    return acc + (x * ny - nx * y);
  }, 0);
  return Math.abs(sum) / 2;
}

/* Even-odd ray cast; regions here never place a label exactly on an edge. */
function contains(point: [number, number], points: [number, number][]): boolean {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/* Signed turn from one house's label to the next, normalised to (-pi, pi]. */
function turnTo(table: RegionTable, from: number, to: number): number {
  const angle = (h: number) =>
    Math.atan2(table[h].cy - CENTRE, table[h].cx - CENTRE);
  let delta = angle(to) - angle(from);
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta <= -Math.PI) delta += 2 * Math.PI;
  return delta;
}

describe.each([
  ["rasi chart", RASI_REGIONS as RegionTable],
  ["lahiri-placidus chart", PLACIDUS_REGIONS as RegionTable],
])("%s house regions", (_label, table) => {
  it("defines all twelve houses", () => {
    expect(Object.keys(table).map(Number).sort((a, b) => a - b)).toEqual(HOUSES);
  });

  it("tiles the chart square exactly once", () => {
    const total = HOUSES.reduce((sum, h) => sum + area(vertices(table[h])), 0);
    expect(total).toBe(SIZE * SIZE);

    const shapes = HOUSES.map((h) =>
      vertices(table[h])
        .map((p) => p.join(","))
        .sort()
        .join(" "),
    );
    expect(new Set(shapes).size).toBe(12);
  });

  it("puts the kendras on the four centre rhombi", () => {
    // 1 top, 4 left, 7 bottom, 10 right — the arrangement that was broken.
    const kendras: Record<number, [number, number]> = {
      1: [300, 150],
      4: [150, 300],
      7: [300, 450],
      10: [450, 300],
    };
    for (const [house, [cx, cy]] of Object.entries(kendras)) {
      const region = table[Number(house)];
      expect(vertices(region)).toHaveLength(4);
      expect([region.cx, region.cy]).toEqual([cx, cy]);
    }
  });

  it("gives the other eight houses corner triangles", () => {
    for (const house of HOUSES.filter((h) => h % 3 !== 1)) {
      expect(vertices(table[house])).toHaveLength(3);
    }
  });

  it("anchors every label inside its own region and no other", () => {
    for (const house of HOUSES) {
      const label: [number, number] = [table[house].cx, table[house].cy];
      const owners = HOUSES.filter((other) =>
        contains(label, vertices(table[other])),
      );
      expect(owners).toEqual([house]);
    }
  });

  it("orders the houses counter-clockwise around the centre", () => {
    const turns = HOUSES.map((h) => turnTo(table, h, h === 12 ? 1 : h + 1));
    // SVG y grows downward, so counter-clockwise reads as a negative turn.
    expect(turns.every((t) => t < 0)).toBe(true);
    expect(turns.reduce((a, b) => a + b, 0)).toBeCloseTo(-2 * Math.PI, 9);
  });
});
