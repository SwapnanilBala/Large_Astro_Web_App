/**
 * The North Indian chart's geometry, asserted rather than eyeballed.
 *
 * The first diamond on the results page (dropped in 342a086) drew houses 2 and
 * 12 above the chart's top edge and put sign labels in the wrong regions, and
 * nothing caught it because nothing checked where things landed. These tests
 * are that check: every region inside the square and tiling it, every sign
 * number and label box inside its own house, and the houses running
 * anticlockwise from the top.
 */
import { describe, expect, it } from "vitest";
import {
  HOUSES,
  HOUSE_POLYGONS,
  LABEL_BOXES,
  NORTH_INDIAN_SIZE as S,
  SIGN_NUMBER_POINTS,
  formatDegreeMinutes,
  formatWholeDegree,
  layoutHouseLabels,
  pointInPolygon,
  polygonArea,
  signForHouse,
  signNumber,
  type ChartLabel,
  type Point,
} from "../north-indian-chart";

const housesContaining = (point: Point) =>
  HOUSES.filter((house) => pointInPolygon(point, HOUSE_POLYGONS[house]));

function centroid(polygon: readonly Point[]): Point {
  const x = polygon.reduce((sum, [px]) => sum + px, 0) / polygon.length;
  const y = polygon.reduce((sum, [, py]) => sum + py, 0) / polygon.length;
  return [x, y];
}

describe("the North Indian chart's regions", () => {
  it("are twelve, all inside the square, and tile it exactly", () => {
    expect(Object.keys(HOUSE_POLYGONS)).toHaveLength(12);
    for (const house of HOUSES) {
      for (const [x, y] of HOUSE_POLYGONS[house]) {
        expect(x, `house ${house}`).toBeGreaterThanOrEqual(0);
        expect(x, `house ${house}`).toBeLessThanOrEqual(S);
        expect(y, `house ${house}`).toBeGreaterThanOrEqual(0);
        expect(y, `house ${house}`).toBeLessThanOrEqual(S);
      }
    }
    const total = HOUSES.reduce((sum, house) => sum + polygonArea(HOUSE_POLYGONS[house]), 0);
    expect(total).toBeCloseTo(S * S, 6);
  });

  it("do not overlap: each region's centre lies in that region alone", () => {
    for (const house of HOUSES) {
      expect(housesContaining(centroid(HOUSE_POLYGONS[house])), `house ${house}`).toEqual([house]);
    }
  });

  it("run anticlockwise from the ascendant at the top", () => {
    const at = (x: number, y: number) => housesContaining([x * S, y * S]);
    expect(at(0.5, 0.15)).toEqual([1]); // top kite
    expect(at(0.25, 0.05)).toEqual([2]); // top edge, left of the ascendant
    expect(at(0.05, 0.25)).toEqual([3]);
    expect(at(0.15, 0.5)).toEqual([4]); // left kite
    expect(at(0.05, 0.75)).toEqual([5]);
    expect(at(0.25, 0.95)).toEqual([6]);
    expect(at(0.5, 0.85)).toEqual([7]); // bottom kite
    expect(at(0.75, 0.95)).toEqual([8]);
    expect(at(0.95, 0.75)).toEqual([9]);
    expect(at(0.85, 0.5)).toEqual([10]); // right kite
    expect(at(0.95, 0.25)).toEqual([11]);
    expect(at(0.75, 0.05)).toEqual([12]); // top edge, right of the ascendant
  });

  it("put every sign number inside its own house and no other", () => {
    for (const house of HOUSES) {
      expect(housesContaining(SIGN_NUMBER_POINTS[house]), `house ${house}`).toEqual([house]);
    }
  });

  it("keep every label box inside its own house, clear of the sign number", () => {
    for (const house of HOUSES) {
      const box = LABEL_BOXES[house];
      const corners: Point[] = [
        [box.x, box.y],
        [box.x + box.w, box.y],
        [box.x, box.y + box.h],
        [box.x + box.w, box.y + box.h],
      ];
      for (const corner of corners) {
        expect(pointInPolygon(corner, HOUSE_POLYGONS[house]), `house ${house} corner ${corner}`).toBe(true);
      }
      /* The number is drawn ~12 units tall around its point; keep 8 clear. */
      const [nx, ny] = SIGN_NUMBER_POINTS[house];
      const clear =
        nx < box.x - 8 || nx > box.x + box.w + 8 || ny < box.y - 8 || ny > box.y + box.h + 8;
      expect(clear, `house ${house} sign number collides with its labels`).toBe(true);
    }
  });
});

describe("signs on the houses", () => {
  it("count whole signs from the ascendant", () => {
    expect(signForHouse("Cancer", 1)).toBe("Cancer");
    expect(signForHouse("Cancer", 7)).toBe("Capricorn");
    expect(signForHouse("Cancer", 10)).toBe("Aries");
    expect(signForHouse("Cancer", 12)).toBe("Gemini");
    expect(signForHouse("Aries", 12)).toBe("Pisces");
    expect(signForHouse("Pisces", 2)).toBe("Aries");
  });

  it("number the signs from Aries", () => {
    expect(signNumber("Aries")).toBe(1);
    expect(signNumber("Cancer")).toBe(4);
    expect(signNumber("Pisces")).toBe(12);
  });

  it("refuse an unknown ascendant rather than drawing a wrong chart", () => {
    expect(() => signForHouse("Ophiuchus", 1)).toThrow();
  });
});

describe("label layout", () => {
  const widest: ChartLabel = { abbrev: "Me", degree: "29°", retrograde: true };
  const estimate = (label: ChartLabel, showDegree: boolean, scale: number) =>
    (label.abbrev.length * 13 * 0.62 +
      (showDegree ? 3 + label.degree.length * 11 * 0.6 : 0) +
      (label.retrograde ? 1.5 + 8 * 0.7 : 0)) *
    scale;

  it("keeps up to six of the widest labels inside every house's box", () => {
    for (const house of HOUSES) {
      const box = LABEL_BOXES[house];
      for (let count = 1; count <= 6; count++) {
        const { labels, scale } = layoutHouseLabels(Array(count).fill(widest), box);
        expect(labels).toHaveLength(count);
        for (const label of labels) {
          const half = estimate(label, label.showDegree, scale) / 2;
          expect(label.x - half, `house ${house}, ${count} labels`).toBeGreaterThanOrEqual(box.x - 0.01);
          expect(label.x + half, `house ${house}, ${count} labels`).toBeLessThanOrEqual(box.x + box.w + 0.01);
          expect(label.y, `house ${house}, ${count} labels`).toBeGreaterThan(box.y);
          expect(label.y, `house ${house}, ${count} labels`).toBeLessThan(box.y + box.h);
        }
      }
    }
  });

  it("prints degrees at full size for the ordinary case of two or three planets", () => {
    for (const house of HOUSES) {
      const { labels, scale } = layoutHouseLabels(
        [{ abbrev: "Sa", degree: "1°", retrograde: true }, { abbrev: "Ra", degree: "17°", retrograde: false }],
        LABEL_BOXES[house],
      );
      expect(scale, `house ${house}`).toBe(1);
      expect(labels.every((label) => label.showDegree), `house ${house}`).toBe(true);
    }
  });

  it("drops degrees before it shrinks the type", () => {
    const crowded = layoutHouseLabels(Array(5).fill(widest), LABEL_BOXES[2]);
    expect(crowded.labels.some((label) => !label.showDegree)).toBe(true);
    expect(crowded.scale).toBe(1);
  });
});

describe("degree formatting", () => {
  it("never rounds a planet into the next sign", () => {
    expect(formatWholeDegree(29.99)).toBe("29°");
    expect(formatDegreeMinutes(29.9999)).toBe("29°59′");
  });

  it("shows degrees and minutes for the positions list", () => {
    expect(formatDegreeMinutes(14.5)).toBe("14°30′");
    expect(formatDegreeMinutes(0.4)).toBe("0°24′");
    expect(formatDegreeMinutes(2.4166667)).toBe("2°25′");
  });
});
