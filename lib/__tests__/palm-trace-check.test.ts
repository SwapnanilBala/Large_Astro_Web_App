/**
 * The palm reading's traced lines are drawn over the photo, so a trace that
 * cannot be right is left out rather than drawn (lib/palm-readings/
 * trace-check.ts). Tuned on every saved reading (palm-trace-readings.ts): no
 * good trace may go, and every plainly wrong one should.
 */
import { describe, expect, it } from "vitest";
import {
  checkLineTraces,
  palmBounds,
  type PalmBounds,
  type TraceLine,
} from "../palm-readings/trace-check";
import type { PalmLineCoordinates } from "../palm-readings/types";
import { SAVED_TRACE_READINGS, type SavedTraceReading } from "./palm-trace-readings";

const PORTRAIT = { width: 1200, height: 1600 };
const LANDSCAPE = { width: 1280, height: 720 };

const pts = (...xy: Array<[number, number]>) => xy.map(([x, y]) => ({ x, y }));
const coordinatesOf = (reading: SavedTraceReading): PalmLineCoordinates =>
  Object.fromEntries(Object.entries(reading.lines).map(([line, xy]) => [line, pts(...xy!)]));

/* The photo's size, and the palm_bounds the model gave when it was asked for them. */
const contextOf = (reading: SavedTraceReading) => ({ frame: reading.frame, bounds: palmBounds(reading.palmBounds) });

/* A hand on a portrait photo, each line on its crease. */
const GOOD: PalmLineCoordinates = {
  heart_line: pts([0.25, 0.6], [0.4, 0.55], [0.55, 0.52], [0.62, 0.52]),
  head_line: pts([0.7, 0.6], [0.55, 0.63], [0.4, 0.64], [0.27, 0.65]),
  life_line: pts([0.7, 0.59], [0.64, 0.68], [0.6, 0.78], [0.57, 0.88]),
  fate_line: pts([0.55, 0.86], [0.53, 0.76], [0.52, 0.66]),
};

describe("the trace check on every saved reading", () => {
  it.each(SAVED_TRACE_READINGS.map((reading) => [reading.label, reading] as const))(
    "%s: keeps every good trace and drops every bad one",
    (_label, reading) => {
      const { coordinates, dropped } = checkLineTraces(coordinatesOf(reading), contextOf(reading));
      const droppedLines = dropped.map((entry) => entry.line);
      for (const line of Object.keys(reading.lines) as TraceLine[]) {
        if (reading.unsure.includes(line)) continue;
        if (reading.bad.includes(line)) {
          expect(droppedLines, `${line} is drawn too low and should go`).toContain(line);
          expect(coordinates?.[line]).toBeUndefined();
        } else {
          expect(droppedLines, `${line} is on its crease and should stay`).not.toContain(line);
          expect(coordinates?.[line]).toEqual(pts(...reading.lines[line]!));
        }
      }
    },
  );

  it("drops every bad trace across the set, and no good one", () => {
    let bad = 0;
    let caught = 0;
    let goodDropped = 0;
    for (const reading of SAVED_TRACE_READINGS) {
      const { dropped } = checkLineTraces(coordinatesOf(reading), contextOf(reading));
      const droppedLines = new Set(dropped.map((entry) => entry.line));
      for (const line of Object.keys(reading.lines) as TraceLine[]) {
        if (reading.unsure.includes(line)) continue;
        if (reading.bad.includes(line)) {
          bad += 1;
          if (droppedLines.has(line)) caught += 1;
        } else if (droppedLines.has(line)) goodDropped += 1;
      }
    }
    expect(bad).toBeGreaterThanOrEqual(10);
    expect(SAVED_TRACE_READINGS.filter((reading) => palmBounds(reading.palmBounds)).length).toBeGreaterThanOrEqual(8);
    expect(caught).toBe(bad);
    expect(goodDropped).toBe(0);
  });
});

describe("the shape rules, on any photo", () => {
  it("keeps a reading whose lines are all where they belong", () => {
    expect(checkLineTraces(GOOD, { frame: PORTRAIT })).toEqual({ coordinates: GOOD, dropped: [] });
  });

  it("has nothing to check when there are no traces", () => {
    expect(checkLineTraces(undefined, { frame: PORTRAIT })).toEqual({ coordinates: undefined, dropped: [] });
  });

  it("drops a line of fewer than three points", () => {
    const { coordinates, dropped } = checkLineTraces({ ...GOOD, fate_line: pts([0.55, 0.86], [0.52, 0.66]) });
    expect(dropped).toEqual([{ line: "fate_line", reason: "too_few_points" }]);
    expect(coordinates?.fate_line).toBeUndefined();
    expect(coordinates?.heart_line).toEqual(GOOD.heart_line);
  });

  it("drops a line with no length", () => {
    const { dropped } = checkLineTraces({ ...GOOD, fate_line: pts([0.5, 0.7], [0.5, 0.7], [0.51, 0.71]) });
    expect(dropped).toEqual([{ line: "fate_line", reason: "no_length" }]);
  });

  it("drops a line that crosses the whole image", () => {
    const { dropped } = checkLineTraces({
      ...GOOD,
      heart_line: pts([0.02, 0.6], [0.5, 0.55], [0.98, 0.52]),
      fate_line: pts([0.5, 0.98], [0.5, 0.5], [0.5, 0.05]),
    });
    expect(dropped).toEqual([
      { line: "heart_line", reason: "spans_image" },
      { line: "fate_line", reason: "spans_image" },
    ]);
  });

  it("drops both the heart and the head line when the heart line is the lower of the two", () => {
    const { coordinates, dropped } = checkLineTraces({ ...GOOD, heart_line: GOOD.head_line, head_line: GOOD.heart_line });
    expect(dropped.map((entry) => entry.line).sort()).toEqual(["head_line", "heart_line"]);
    expect(dropped.every((entry) => entry.reason === "heart_below_head")).toBe(true);
    expect(Object.keys(coordinates ?? {})).toEqual(["life_line", "fate_line"]);
  });

  it("does not let a heart line dropped for its own reason take the head line with it", () => {
    const { coordinates, dropped } = checkLineTraces({ ...GOOD, heart_line: pts([0.5, 0.7], [0.5, 0.7], [0.5, 0.7]) });
    expect(dropped).toEqual([{ line: "heart_line", reason: "no_length" }]);
    expect(coordinates?.head_line).toEqual(GOOD.head_line);
  });

  it("leaves out line_coordinates altogether when nothing is left to draw", () => {
    const stub = pts([0.5, 0.5], [0.6, 0.5]);
    const { coordinates, dropped } = checkLineTraces({ heart_line: stub, life_line: stub });
    expect(coordinates).toBeUndefined();
    expect(dropped).toHaveLength(2);
  });
});

describe("the frame rules, on a portrait photo", () => {
  it("drops a line wholly in the top third, where the fingers are", () => {
    const { dropped } = checkLineTraces({ ...GOOD, fate_line: pts([0.5, 0.3], [0.5, 0.2], [0.5, 0.1]) }, { frame: PORTRAIT });
    expect(dropped).toEqual([{ line: "fate_line", reason: "in_finger_band" }]);
  });

  it("drops a line wholly in the bottom tenth, where the wrist is", () => {
    const { dropped } = checkLineTraces({ ...GOOD, fate_line: pts([0.4, 0.98], [0.5, 0.95], [0.6, 0.92]) }, { frame: PORTRAIT });
    expect(dropped).toEqual([{ line: "fate_line", reason: "in_wrist_band" }]);
  });

  it("drops a heart, head or life line below the lowest place it can lie", () => {
    const { coordinates, dropped } = checkLineTraces(
      {
        heart_line: pts([0.25, 0.86], [0.44, 0.8], [0.62, 0.75]),
        head_line: pts([0.72, 0.88], [0.47, 0.92], [0.26, 0.93]),
        life_line: pts([0.73, 0.85], [0.66, 0.95], [0.6, 0.99]),
        fate_line: pts([0.56, 0.93], [0.55, 0.86], [0.56, 0.78]),
      },
      { frame: PORTRAIT },
    );
    expect(dropped).toEqual([
      { line: "heart_line", reason: "too_low_for_line" },
      { line: "head_line", reason: "too_low_for_line" },
      { line: "life_line", reason: "too_low_for_line" },
    ]);
    expect(Object.keys(coordinates ?? {})).toEqual(["fate_line"]);
  });

  it("applies none of them to a landscape photo, or one whose size is unknown", () => {
    const low = { ...GOOD, heart_line: pts([0.25, 0.86], [0.44, 0.8], [0.62, 0.75]), head_line: pts([0.7, 0.9], [0.4, 0.94], [0.27, 0.95]) };
    expect(checkLineTraces(low, { frame: LANDSCAPE }).dropped).toEqual([]);
    expect(checkLineTraces(low, { frame: null }).dropped).toEqual([]);
    expect(checkLineTraces(low).dropped).toEqual([]);
  });
});

describe("palm_bounds", () => {
  const BOUNDS: PalmBounds = { top: 0.47, bottom: 0.9, thumbSide: 0.72, littleFingerSide: 0.22 };

  it("reads a box a palm could fill, and nothing else", () => {
    expect(palmBounds({ top: 0.47, bottom: 0.9, thumb_side: 0.72, little_finger_side: 0.22 })).toEqual(BOUNDS);
    expect(palmBounds({ top: 0.9, bottom: 0.47, thumb_side: 0.72, little_finger_side: 0.22 })).toBeNull();
    expect(palmBounds({ top: 0.47, bottom: 0.52, thumb_side: 0.72, little_finger_side: 0.22 })).toBeNull();
    expect(palmBounds({ top: 0.47, bottom: 1.4, thumb_side: 0.72, little_finger_side: 0.22 })).toBeNull();
    expect(palmBounds({ top: "0.47", bottom: 0.9, thumb_side: 0.72, little_finger_side: 0.22 })).toBeNull();
    expect(palmBounds([0.47, 0.9, 0.72, 0.22])).toBeNull();
    expect(palmBounds(undefined)).toBeNull();
  });

  it("keeps lines inside the box, and drops one that is mostly outside it", () => {
    const { coordinates, dropped } = checkLineTraces(
      { ...GOOD, fate_line: pts([0.5, 0.4], [0.5, 0.3], [0.5, 0.25], [0.5, 0.6]) },
      { bounds: BOUNDS },
    );
    expect(dropped).toEqual([{ line: "fate_line", reason: "outside_palm" }]);
    expect(Object.keys(coordinates ?? {})).toEqual(["heart_line", "head_line", "life_line"]);
  });
});
