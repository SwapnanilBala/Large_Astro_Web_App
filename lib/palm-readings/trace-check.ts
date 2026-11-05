import type { PhotoFrame } from "./image-size";
import type { PalmLineCoordinates } from "./types";

/*
 * The traced lines the reading may draw over the photo, with the ones that
 * cannot be right taken out.
 *
 * The site and the Android app draw line_coordinates over the photo, so a
 * line in the wrong place is the most visible mistake a reading can make,
 * and a confident one: a heart line drawn across the wrist reads as the
 * reading being wrong about the hand, though the words about the hand may be
 * fine. Measured 2026-11-02 to 11-04 on three test photos, about one reading
 * in three put all four lines 0.15 to 0.3 of the image height too low, some
 * of them onto the wrist, and prompt wording did not stop it. So this drops
 * a trace that cannot be right rather than draw it: the reading's text is
 * kept, the line's key is left out, and both clients draw a missing key as
 * no line at all.
 *
 * The rules come in three kinds:
 *
 *   shape      too few points, no length, or a line that crosses the whole
 *              image. Any photo.
 *   order      a heart line below the head line. Any photo; both are dropped,
 *              since there is no telling which of the two is wrong.
 *   frame      zones of a portrait photo of a hand, fingers to wrist, which
 *              is what the panel asks for: nothing lies wholly in the top
 *              third (the fingers) or the bottom tenth (the wrist), and the
 *              heart, head and life lines each have a lowest place they can
 *              be. Only when the photo's header says it is portrait, since a
 *              webcam frame is landscape and the hand can be anywhere in it.
 *   palm       when the reading gave palm_bounds, a line whose points mostly
 *              fall outside that box, with room to spare.
 *
 * The frame limits were tuned on all 24 saved readings of the test photos
 * (lib/__tests__/palm-trace-readings.ts, run by palm-trace-check.test.ts):
 * no trace that sits on its crease is dropped, and all ten that were drawn
 * a whole line-spacing too low are. The good readings' heart lines average
 * at most 0.64 of the height and the shifted ones at least 0.72; head lines
 * 0.76 against 0.82; the life line's top 0.70 against 0.77. The margins are
 * a few hundredths, so a photo of a whole hand held low in the frame could
 * lose a true trace; that costs a line not drawn, never a wrong one.
 */

export type TraceLine = keyof PalmLineCoordinates;
type Point = { x: number; y: number };

export type TraceDropReason =
  | "too_few_points"
  | "no_length"
  | "spans_image"
  | "heart_below_head"
  | "in_finger_band"
  | "in_wrist_band"
  | "too_low_for_line"
  | "outside_palm";

export type DroppedTrace = { line: TraceLine; reason: TraceDropReason };

/** Where the palm lies, as fractions of the whole image (palm_bounds). */
export type PalmBounds = { top: number; bottom: number; thumbSide: number; littleFingerSide: number };

export type TraceContext = {
  /** The photo's pixel size from its header, or null when it could not be read. */
  frame?: PhotoFrame | null;
  bounds?: PalmBounds | null;
};

const LINES: readonly TraceLine[] = ["heart_line", "head_line", "life_line", "fate_line"];

/** The prompt asks for 3 to 6 points a line. */
export const MIN_TRACE_POINTS = 3;
/** Path length, in fractions of the image. A palm line is a good deal longer. */
export const MIN_TRACE_LENGTH = 0.05;
/** A line that crosses nearly the whole image is not on a palm. */
export const MAX_TRACE_SPAN_X = 0.9;
export const MAX_TRACE_SPAN_Y = 0.85;

/** Height over width at which a photo counts as portrait for the frame rules. */
export const PORTRAIT_RATIO = 1.1;
/** Wholly above this is the fingers. */
export const FINGER_BAND_BOTTOM = 1 / 3;
/** Wholly below this is the wrist. */
export const WRIST_BAND_TOP = 0.9;
/** The lowest each line can sit in a portrait photo of the whole hand. */
export const HEART_MAX_MEAN_Y = 0.7;
export const HEAD_MAX_MEAN_Y = 0.8;
export const LIFE_MAX_TOP_Y = 0.75;

/** Room around palm_bounds, as a share of the box's size, before a point counts as off the palm. */
export const BOUNDS_MARGIN = 0.15;

const meanY = (points: Point[]) => points.reduce((sum, p) => sum + p.y, 0) / points.length;
const minY = (points: Point[]) => Math.min(...points.map((p) => p.y));
const span = (values: number[]) => Math.max(...values) - Math.min(...values);

function pathLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

function shapeProblem(points: Point[]): TraceDropReason | null {
  if (points.length < MIN_TRACE_POINTS) return "too_few_points";
  if (pathLength(points) < MIN_TRACE_LENGTH) return "no_length";
  if (span(points.map((p) => p.x)) > MAX_TRACE_SPAN_X || span(points.map((p) => p.y)) > MAX_TRACE_SPAN_Y) {
    return "spans_image";
  }
  return null;
}

function frameProblem(line: TraceLine, points: Point[]): TraceDropReason | null {
  if (points.every((p) => p.y < FINGER_BAND_BOTTOM)) return "in_finger_band";
  if (points.every((p) => p.y > WRIST_BAND_TOP)) return "in_wrist_band";
  if (line === "heart_line" && meanY(points) > HEART_MAX_MEAN_Y) return "too_low_for_line";
  if (line === "head_line" && meanY(points) > HEAD_MAX_MEAN_Y) return "too_low_for_line";
  if (line === "life_line" && minY(points) > LIFE_MAX_TOP_Y) return "too_low_for_line";
  return null;
}

/** The line's y where it crosses `x`, or undefined when it does not reach that far. */
function yAt(points: Point[], x: number): number | undefined {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if ((a.x <= x && x <= b.x) || (b.x <= x && x <= a.x)) {
      return a.x === b.x ? (a.y + b.y) / 2 : a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y);
    }
  }
  return undefined;
}

/*
 * Compared where both lines run, not by their averages: on a hand turned in
 * the frame, a heart line rising to the index finger and a head line falling
 * from the thumb web can have the same mean height and still never cross.
 * Below at most of the shared stretch is what counts, and lines that share
 * no stretch are not compared.
 */
function heartBelowHead(heart: Point[], head: Point[]): boolean {
  const lo = Math.max(Math.min(...heart.map((p) => p.x)), Math.min(...head.map((p) => p.x)));
  const hi = Math.min(Math.max(...heart.map((p) => p.x)), Math.max(...head.map((p) => p.x)));
  if (hi - lo < 0.05) return false;
  let below = 0;
  let compared = 0;
  for (let i = 0; i <= 10; i++) {
    const x = lo + ((hi - lo) * i) / 10;
    const heartY = yAt(heart, x);
    const headY = yAt(head, x);
    if (heartY === undefined || headY === undefined) continue;
    compared += 1;
    if (heartY > headY) below += 1;
  }
  return compared > 0 && below * 2 > compared;
}

function outsidePalm(points: Point[], bounds: PalmBounds): boolean {
  const left = Math.min(bounds.thumbSide, bounds.littleFingerSide);
  const right = Math.max(bounds.thumbSide, bounds.littleFingerSide);
  const mx = (right - left) * BOUNDS_MARGIN;
  const my = (bounds.bottom - bounds.top) * BOUNDS_MARGIN;
  const off = points.filter(
    (p) => p.x < left - mx || p.x > right + mx || p.y < bounds.top - my || p.y > bounds.bottom + my,
  );
  return off.length * 2 > points.length;
}

/**
 * palm_bounds as the reading gave it, or null unless it is a box a palm could
 * fill: four numbers in 0-1, the top above the bottom, and at least a tenth
 * of the image each way.
 */
export function palmBounds(value: unknown): PalmBounds | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const read = (key: string) => {
    const n = raw[key];
    return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1 ? n : undefined;
  };
  const top = read("top");
  const bottom = read("bottom");
  const thumbSide = read("thumb_side");
  const littleFingerSide = read("little_finger_side");
  if (top === undefined || bottom === undefined || thumbSide === undefined || littleFingerSide === undefined) {
    return null;
  }
  if (bottom - top < 0.1 || Math.abs(thumbSide - littleFingerSide) < 0.1) return null;
  return { top, bottom, thumbSide, littleFingerSide };
}

/**
 * The traces worth drawing, and the ones left out with the reason. The
 * coordinates are the shaped ones (reading-shape.ts): fractions in 0-1.
 */
export function checkLineTraces(
  coordinates: PalmLineCoordinates | undefined,
  context: TraceContext = {},
): { coordinates: PalmLineCoordinates | undefined; dropped: DroppedTrace[] } {
  if (!coordinates) return { coordinates: undefined, dropped: [] };
  const dropped: DroppedTrace[] = [];
  const kept: PalmLineCoordinates = {};
  const portrait = !!context.frame && context.frame.height >= context.frame.width * PORTRAIT_RATIO;

  for (const line of LINES) {
    const points = coordinates[line];
    if (!points || points.length === 0) continue;
    const reason =
      shapeProblem(points) ??
      (portrait ? frameProblem(line, points) : null) ??
      (context.bounds && outsidePalm(points, context.bounds) ? "outside_palm" : null);
    if (reason) dropped.push({ line, reason });
    else kept[line] = points;
  }

  /* Checked on what is left, so a heart line already dropped for its own
     reason does not take a good head line with it. */
  if (kept.heart_line && kept.head_line && heartBelowHead(kept.heart_line, kept.head_line)) {
    delete kept.heart_line;
    delete kept.head_line;
    dropped.push({ line: "heart_line", reason: "heart_below_head" }, { line: "head_line", reason: "heart_below_head" });
  }

  return { coordinates: Object.keys(kept).length > 0 ? kept : undefined, dropped };
}
