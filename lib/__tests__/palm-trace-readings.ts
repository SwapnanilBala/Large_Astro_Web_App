/*
 * Every saved palm reading's traced lines, from the measurements of
 * 2026-11-02 to 11-04 (Claude Opus 5 at low effort through
 * /api/palm-reading), and three traced by hand on the crease map, each with
 * the size of the photo it was read from.
 *
 * The photos: right-hand-palm.png (960 x 1508, the whole hand on white, the
 * wrist at the bottom edge), left-mirrored.png (its mirror image),
 * right-720.jpg (it at 720 wide), and two built from it to look like phone
 * photos: wood-right.jpg (1200 x 1600, smaller in frame, turned 9 degrees)
 * and fabric-left.jpg (1080 x 1440, mirrored, turned 13 degrees the other
 * way).
 *
 * The readings marked "told the photo size" were read with the [PHOTO] line
 * and palm_bounds the route asks for since then, and carry the bounds the
 * model gave.
 *
 * `bad` lists the traces that are plainly wrong: drawn a whole line-spacing
 * or more below their crease, onto the wrist or across the wrong part of the
 * palm. `unsure` lists traces partly off their crease that a reader could
 * still recognise. Every other trace sits on its crease, or near enough.
 */
import type { PhotoFrame } from "../palm-readings/image-size";
import type { TraceLine } from "../palm-readings/trace-check";

export type SavedTraceReading = {
  label: string;
  frame: PhotoFrame;
  /** palm_bounds as the model wrote it, for the readings that were asked for it. */
  palmBounds?: { top: number; bottom: number; thumb_side: number; little_finger_side: number };
  bad: TraceLine[];
  unsure: TraceLine[];
  lines: Partial<Record<TraceLine, Array<[number, number]>>>;
};

export const SAVED_TRACE_READINGS: SavedTraceReading[] = [
  {
    label: "2026-11-02 run0, right-hand-palm.png",
    frame: { width: 960, height: 1508 },
    bad: ["heart_line", "head_line"],
    unsure: [],
    lines: {
      heart_line: [[0.13, 0.86], [0.3, 0.82], [0.48, 0.77], [0.63, 0.72], [0.72, 0.67]],
      head_line: [[0.2, 0.86], [0.36, 0.9], [0.52, 0.93], [0.66, 0.93], [0.75, 0.9]],
      life_line: [[0.72, 0.63], [0.66, 0.72], [0.56, 0.84], [0.46, 0.93], [0.38, 0.98]],
      fate_line: [[0.42, 0.97], [0.47, 0.89], [0.5, 0.8], [0.5, 0.72]],
    },
  },
  {
    label: "2026-11-02 run1, left-mirrored.png",
    frame: { width: 960, height: 1508 },
    bad: [],
    unsure: [],
    lines: {
      heart_line: [[0.91, 0.655], [0.75, 0.6], [0.6, 0.565], [0.46, 0.555], [0.36, 0.565]],
      head_line: [[0.26, 0.63], [0.42, 0.68], [0.58, 0.74], [0.72, 0.81], [0.84, 0.87]],
      life_line: [[0.27, 0.62], [0.2, 0.73], [0.21, 0.85], [0.28, 0.94], [0.37, 0.99]],
      fate_line: [[0.56, 0.97], [0.58, 0.86], [0.6, 0.75]],
    },
  },
  {
    label: "2026-11-02 run2, right-hand-palm.png",
    frame: { width: 960, height: 1508 },
    bad: [],
    unsure: [],
    lines: {
      heart_line: [[0.1, 0.555], [0.25, 0.545], [0.42, 0.555], [0.58, 0.59], [0.68, 0.625]],
      head_line: [[0.72, 0.63], [0.58, 0.64], [0.42, 0.625], [0.26, 0.615], [0.13, 0.63]],
      life_line: [[0.73, 0.62], [0.7, 0.7], [0.65, 0.79], [0.57, 0.88], [0.5, 0.96]],
      fate_line: [[0.44, 0.92], [0.46, 0.8], [0.47, 0.69], [0.47, 0.6]],
    },
  },
  {
    label: "2026-11-02 run3, left-mirrored.png",
    frame: { width: 960, height: 1508 },
    bad: [],
    unsure: [],
    lines: {
      heart_line: [[0.88, 0.63], [0.72, 0.6], [0.57, 0.58], [0.44, 0.57], [0.37, 0.59]],
      head_line: [[0.29, 0.67], [0.42, 0.7], [0.57, 0.74], [0.7, 0.78], [0.8, 0.81]],
      life_line: [[0.28, 0.65], [0.25, 0.73], [0.27, 0.82], [0.32, 0.9], [0.39, 0.97]],
      fate_line: [[0.51, 0.95], [0.55, 0.86], [0.59, 0.76], [0.61, 0.69]],
    },
  },
  {
    label: "2026-11-02 run4, right-720.jpg",
    frame: { width: 720, height: 1131 },
    bad: [],
    unsure: [],
    lines: {
      heart_line: [[0.13, 0.645], [0.3, 0.625], [0.48, 0.612], [0.63, 0.636], [0.72, 0.672]],
      head_line: [[0.7, 0.715], [0.55, 0.73], [0.38, 0.755], [0.22, 0.79], [0.12, 0.818]],
      life_line: [[0.7, 0.7], [0.63, 0.77], [0.54, 0.855], [0.46, 0.935], [0.4, 0.995]],
      fate_line: [[0.4, 0.945], [0.42, 0.84], [0.44, 0.74], [0.45, 0.665]],
    },
  },
  {
    label: "2026-11-04 before, right-hand-palm.png",
    frame: { width: 960, height: 1508 },
    bad: [],
    unsure: [],
    lines: {
      heart_line: [[0.11, 0.6], [0.24, 0.57], [0.38, 0.56], [0.5, 0.57], [0.6, 0.6]],
      head_line: [[0.62, 0.6], [0.5, 0.63], [0.38, 0.67], [0.28, 0.71], [0.21, 0.75]],
      life_line: [[0.68, 0.56], [0.66, 0.66], [0.6, 0.76], [0.51, 0.86], [0.41, 0.95]],
      fate_line: [[0.46, 0.88], [0.47, 0.78], [0.48, 0.7], [0.48, 0.63]],
    },
  },
  {
    label: "2026-11-04 before, wood-right.jpg",
    frame: { width: 1200, height: 1600 },
    bad: [],
    unsure: [],
    lines: {
      heart_line: [[0.26, 0.67], [0.38, 0.62], [0.5, 0.58], [0.62, 0.56], [0.7, 0.55]],
      head_line: [[0.72, 0.6], [0.62, 0.64], [0.5, 0.69], [0.36, 0.73]],
      life_line: [[0.72, 0.58], [0.69, 0.68], [0.63, 0.79], [0.56, 0.88], [0.5, 0.94]],
      fate_line: [[0.55, 0.92], [0.56, 0.82], [0.57, 0.73]],
    },
  },
  {
    label: "2026-11-04 before, fabric-left.jpg",
    frame: { width: 1080, height: 1440 },
    bad: ["heart_line", "head_line", "life_line"],
    unsure: ["fate_line"],
    lines: {
      heart_line: [[0.79, 0.73], [0.68, 0.7], [0.56, 0.69], [0.46, 0.72], [0.4, 0.76]],
      head_line: [[0.31, 0.78], [0.42, 0.81], [0.54, 0.84], [0.64, 0.86]],
      life_line: [[0.31, 0.77], [0.33, 0.83], [0.39, 0.88], [0.45, 0.9]],
      fate_line: [[0.52, 0.89], [0.54, 0.83], [0.56, 0.78]],
    },
  },
  {
    label: "2026-11-04 after, right-hand-palm.png",
    frame: { width: 960, height: 1508 },
    bad: ["heart_line", "head_line"],
    unsure: ["life_line"],
    lines: {
      heart_line: [[0.1, 0.79], [0.24, 0.77], [0.38, 0.73], [0.49, 0.69], [0.56, 0.64]],
      head_line: [[0.7, 0.73], [0.58, 0.79], [0.44, 0.84], [0.28, 0.88], [0.14, 0.9]],
      life_line: [[0.71, 0.7], [0.68, 0.79], [0.62, 0.88], [0.54, 0.95], [0.46, 0.99]],
      fate_line: [[0.42, 0.98], [0.44, 0.9], [0.46, 0.82], [0.48, 0.75]],
    },
  },
  {
    label: "2026-11-04 after, wood-right.jpg",
    frame: { width: 1200, height: 1600 },
    bad: [],
    unsure: [],
    lines: {
      heart_line: [[0.25, 0.6], [0.34, 0.57], [0.44, 0.54], [0.54, 0.52], [0.62, 0.52]],
      head_line: [[0.7, 0.6], [0.58, 0.61], [0.46, 0.63], [0.34, 0.64], [0.27, 0.65]],
      life_line: [[0.7, 0.59], [0.65, 0.66], [0.6, 0.74], [0.57, 0.82], [0.56, 0.88]],
      fate_line: [[0.55, 0.86], [0.53, 0.76], [0.52, 0.68]],
    },
  },
  {
    label: "2026-11-04 after2, right-hand-palm.png",
    frame: { width: 960, height: 1508 },
    bad: [],
    unsure: [],
    lines: {
      heart_line: [[0.1, 0.545], [0.26, 0.535], [0.42, 0.555], [0.56, 0.585], [0.68, 0.6]],
      head_line: [[0.72, 0.615], [0.58, 0.645], [0.42, 0.7], [0.3, 0.75], [0.22, 0.79]],
      life_line: [[0.72, 0.62], [0.72, 0.72], [0.67, 0.83], [0.58, 0.92], [0.5, 0.97]],
      fate_line: [[0.44, 0.95], [0.45, 0.82], [0.47, 0.7]],
    },
  },
  {
    label: "2026-11-04 after2, wood-right.jpg",
    frame: { width: 1200, height: 1600 },
    bad: ["heart_line", "head_line", "life_line"],
    unsure: ["fate_line"],
    lines: {
      heart_line: [[0.245, 0.865], [0.33, 0.835], [0.44, 0.795], [0.54, 0.765], [0.62, 0.745]],
      head_line: [[0.72, 0.875], [0.6, 0.905], [0.47, 0.925], [0.33, 0.935], [0.255, 0.93]],
      life_line: [[0.73, 0.845], [0.7, 0.9], [0.655, 0.955], [0.6, 0.995]],
      fate_line: [[0.56, 0.775], [0.555, 0.86], [0.555, 0.935]],
    },
  },
  {
    label: "2026-11-04 after2, fabric-left.jpg",
    frame: { width: 1080, height: 1440 },
    bad: [],
    unsure: [],
    lines: {
      heart_line: [[0.75, 0.556], [0.64, 0.546], [0.54, 0.543], [0.47, 0.535], [0.43, 0.518]],
      head_line: [[0.33, 0.598], [0.43, 0.624], [0.54, 0.645], [0.63, 0.657], [0.69, 0.66]],
      life_line: [[0.32, 0.588], [0.28, 0.66], [0.29, 0.74], [0.36, 0.82], [0.45, 0.872]],
      fate_line: [[0.5, 0.86], [0.53, 0.75], [0.55, 0.66]],
    },
  },
  {
    label: "hand-traced, right-hand-palm.png",
    frame: { width: 960, height: 1508 },
    bad: [],
    unsure: [],
    lines: {
      heart_line: [[0.1, 0.645], [0.24, 0.63], [0.36, 0.595], [0.46, 0.56], [0.54, 0.53]],
      head_line: [[0.7, 0.6], [0.6, 0.565], [0.48, 0.585], [0.36, 0.62], [0.24, 0.655]],
      life_line: [[0.66, 0.61], [0.55, 0.64], [0.5, 0.72], [0.45, 0.82], [0.4, 0.93]],
      fate_line: [[0.42, 0.95], [0.43, 0.8], [0.45, 0.66]],
    },
  },
  {
    label: "hand-traced, wood-right.jpg",
    frame: { width: 1200, height: 1600 },
    bad: [],
    unsure: [],
    lines: {
      heart_line: [[0.244, 0.656], [0.343, 0.631], [0.424, 0.591], [0.49, 0.552], [0.543, 0.519]],
      head_line: [[0.672, 0.566], [0.593, 0.544], [0.509, 0.572], [0.428, 0.612], [0.347, 0.652]],
      life_line: [[0.645, 0.578], [0.57, 0.613], [0.548, 0.686], [0.53, 0.776], [0.513, 0.874]],
      fate_line: [[0.532, 0.89], [0.512, 0.76], [0.501, 0.639]],
    },
  },
  {
    label: "hand-traced, fabric-left.jpg",
    frame: { width: 1080, height: 1440 },
    bad: [],
    unsure: [],
    lines: {
      heart_line: [[0.741, 0.668], [0.648, 0.639], [0.573, 0.596], [0.513, 0.556], [0.465, 0.522]],
      head_line: [[0.336, 0.56], [0.415, 0.543], [0.493, 0.574], [0.567, 0.617], [0.641, 0.66]],
      life_line: [[0.362, 0.573], [0.43, 0.61], [0.445, 0.682], [0.454, 0.769], [0.461, 0.865]],
      fate_line: [[0.443, 0.879], [0.473, 0.755], [0.495, 0.639]],
    },
  },
  {
    label: "2026-11-04 told the photo size, right-hand-palm.png 1",
    frame: { width: 960, height: 1508 },
    palmBounds: { top: 0.46, bottom: 0.98, thumb_side: 0.9, little_finger_side: 0.08 },
    bad: [],
    unsure: [],
    lines: {
      heart_line: [[0.1, 0.565], [0.26, 0.555], [0.42, 0.56], [0.57, 0.58], [0.66, 0.6]],
      head_line: [[0.73, 0.605], [0.58, 0.64], [0.42, 0.675], [0.26, 0.7], [0.15, 0.712]],
      life_line: [[0.75, 0.585], [0.7, 0.69], [0.62, 0.8], [0.51, 0.895], [0.41, 0.96]],
      fate_line: [[0.53, 0.95], [0.51, 0.84], [0.49, 0.73], [0.48, 0.665]],
    },
  },
  {
    label: "2026-11-04 told the photo size, right-hand-palm.png 2",
    frame: { width: 960, height: 1508 },
    palmBounds: { top: 0.47, bottom: 0.97, thumb_side: 0.9, little_finger_side: 0.09 },
    bad: [],
    unsure: [],
    lines: {
      heart_line: [[0.11, 0.555], [0.27, 0.555], [0.45, 0.575], [0.6, 0.6], [0.7, 0.62]],
      head_line: [[0.72, 0.625], [0.58, 0.655], [0.42, 0.675], [0.26, 0.685], [0.14, 0.695]],
      life_line: [[0.71, 0.615], [0.72, 0.69], [0.68, 0.78], [0.59, 0.87], [0.48, 0.94]],
      fate_line: [[0.46, 0.95], [0.47, 0.84], [0.46, 0.73]],
    },
  },
  {
    label: "2026-11-04 told the photo size, wood-right.jpg 1",
    frame: { width: 1200, height: 1600 },
    palmBounds: { top: 0.5, bottom: 0.93, thumb_side: 0.87, little_finger_side: 0.24 },
    bad: [],
    unsure: [],
    lines: {
      heart_line: [[0.25, 0.66], [0.37, 0.61], [0.5, 0.575], [0.6, 0.56], [0.67, 0.555]],
      head_line: [[0.7, 0.615], [0.59, 0.66], [0.47, 0.69], [0.35, 0.71], [0.28, 0.72]],
      life_line: [[0.71, 0.6], [0.68, 0.68], [0.63, 0.76], [0.58, 0.84], [0.55, 0.9]],
      fate_line: [[0.6, 0.88], [0.585, 0.78], [0.575, 0.69]],
    },
  },
  {
    label: "2026-11-04 told the photo size, wood-right.jpg 2",
    frame: { width: 1200, height: 1600 },
    palmBounds: { top: 0.5, bottom: 0.92, thumb_side: 0.87, little_finger_side: 0.23 },
    bad: [],
    unsure: [],
    lines: {
      heart_line: [[0.25, 0.665], [0.37, 0.625], [0.5, 0.59], [0.62, 0.565], [0.69, 0.555]],
      head_line: [[0.7, 0.615], [0.58, 0.65], [0.45, 0.675], [0.33, 0.69], [0.26, 0.695]],
      life_line: [[0.71, 0.6], [0.68, 0.69], [0.62, 0.78], [0.57, 0.86], [0.54, 0.92]],
      fate_line: [[0.56, 0.87], [0.58, 0.78], [0.59, 0.7]],
    },
  },
  {
    label: "2026-11-04 told the photo size, wood-right.jpg 3",
    frame: { width: 1200, height: 1600 },
    palmBounds: { top: 0.5, bottom: 0.93, thumb_side: 0.88, little_finger_side: 0.23 },
    bad: [],
    unsure: [],
    lines: {
      heart_line: [[0.26, 0.657], [0.37, 0.625], [0.48, 0.596], [0.57, 0.573], [0.63, 0.556]],
      head_line: [[0.69, 0.592], [0.59, 0.632], [0.48, 0.672], [0.37, 0.695], [0.29, 0.7]],
      life_line: [[0.7, 0.585], [0.65, 0.67], [0.61, 0.76], [0.57, 0.85], [0.56, 0.91]],
      fate_line: [[0.56, 0.9], [0.55, 0.79], [0.54, 0.69], [0.53, 0.62]],
    },
  },
  {
    label: "2026-11-04 told the photo size, fabric-left.jpg 1",
    frame: { width: 1080, height: 1440 },
    palmBounds: { top: 0.5, bottom: 0.89, thumb_side: 0.19, little_finger_side: 0.82 },
    bad: [],
    unsure: [],
    lines: {
      heart_line: [[0.79, 0.63], [0.68, 0.59], [0.57, 0.57], [0.47, 0.56], [0.41, 0.56]],
      head_line: [[0.36, 0.6], [0.46, 0.64], [0.57, 0.68], [0.68, 0.72]],
      life_line: [[0.36, 0.58], [0.33, 0.66], [0.34, 0.75], [0.39, 0.83], [0.44, 0.87]],
      fate_line: [[0.52, 0.84], [0.53, 0.76], [0.54, 0.69]],
    },
  },
  {
    label: "2026-11-04 told the photo size, fabric-left.jpg 2",
    frame: { width: 1080, height: 1440 },
    palmBounds: { top: 0.47, bottom: 0.89, thumb_side: 0.18, little_finger_side: 0.8 },
    bad: [],
    unsure: [],
    lines: {
      heart_line: [[0.77, 0.535], [0.66, 0.545], [0.56, 0.555], [0.47, 0.565], [0.41, 0.575]],
      head_line: [[0.33, 0.59], [0.44, 0.625], [0.55, 0.655], [0.66, 0.69], [0.73, 0.715]],
      life_line: [[0.33, 0.585], [0.29, 0.66], [0.29, 0.74], [0.34, 0.82], [0.42, 0.87]],
      fate_line: [[0.47, 0.86], [0.49, 0.76], [0.52, 0.67], [0.54, 0.59]],
    },
  },
  {
    label: "2026-11-04 told the photo size, fabric-left.jpg 3",
    frame: { width: 1080, height: 1440 },
    palmBounds: { top: 0.5, bottom: 0.89, thumb_side: 0.17, little_finger_side: 0.8 },
    bad: [],
    unsure: [],
    lines: {
      heart_line: [[0.77, 0.7], [0.66, 0.63], [0.55, 0.58], [0.45, 0.56]],
      head_line: [[0.31, 0.6], [0.42, 0.65], [0.53, 0.7], [0.64, 0.76]],
      life_line: [[0.33, 0.59], [0.27, 0.69], [0.28, 0.78], [0.36, 0.86]],
      fate_line: [[0.49, 0.86], [0.51, 0.75], [0.54, 0.64]],
    },
  },
];
