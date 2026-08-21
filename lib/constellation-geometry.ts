/**
 * Wheel geometry and symbol tables for the constellation chart.
 *
 * Pulled out of app/(desktop)/insights/components/constellation-chart.tsx so
 * the mobile tree can draw the same wheel without importing that component.
 *
 * The desktop version is built on framer-motion — 21 motion elements, plus
 * AnimatePresence — and framer-motion is not reachable from /m at all today.
 * Pulling it in would add tens of KB gzipped to a tree that has roughly 5KB of
 * headroom under its budget, so the mobile chart is a separate, plainer
 * renderer over these same numbers. The maths is shared; only the presentation
 * differs, which is the same split the rest of the /m tree uses.
 *
 * No React, no DOM: everything here is a pure function or a constant table.
 */

export const PLANET_SYMBOLS: Record<string, string> = {
  Sun: "☉",
  Moon: "☽",
  Mars: "♂",
  Mercury: "☿",
  Jupiter: "♃",
  Venus: "♀",
  Saturn: "♄",
  Rahu: "☊",
  Ketu: "☋",
};

export const PLANET_COLORS: Record<string, string> = {
  Sun: "#f2c26c",
  Moon: "#c8d8e8",
  Mars: "#ff6b5b",
  Mercury: "#6ce1a0",
  Jupiter: "#ffd966",
  Venus: "#f0a0c8",
  Saturn: "#7eaadf",
  Rahu: "#a0a8b0",
  Ketu: "#c49a6c",
};

export const SIGN_SYMBOLS: Record<string, string> = {
  Aries: "♈",
  Taurus: "♉",
  Gemini: "♊",
  Cancer: "♋",
  Leo: "♌",
  Virgo: "♍",
  Libra: "♎",
  Scorpio: "♏",
  Sagittarius: "♐",
  Capricorn: "♑",
  Aquarius: "♒",
  Pisces: "♓",
};

export const SIGN_ORDER = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;

export const ELEMENT_MAP: Record<string, "fire" | "earth" | "air" | "water"> = {
  Aries: "fire", Leo: "fire", Sagittarius: "fire",
  Taurus: "earth", Virgo: "earth", Capricorn: "earth",
  Gemini: "air", Libra: "air", Aquarius: "air",
  Cancer: "water", Scorpio: "water", Pisces: "water",
};

export const ELEMENT_COLORS: Record<string, string> = {
  fire: "rgba(255,100,80,0.06)",
  earth: "rgba(100,200,120,0.06)",
  air: "rgba(100,180,255,0.06)",
  water: "rgba(160,100,220,0.06)",
};

/* The wheel is drawn in a 600x600 viewBox and scaled by CSS, so these are
   fixed regardless of how large the chart is rendered. */
export const CX = 300;
export const CY = 300;
export const ZODIAC_R = 260;
export const INNER_R = 230;
export const PLANET_R = 195;
export const HOUSE_NUM_R = 140;

/**
 * Longitude to wheel angle: 0° Aries sits at the top and the wheel runs
 * clockwise, so the angle is the longitude rotated back a quarter turn.
 */
export function lonToAngle(longitude: number): number {
  return longitude - 90;
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Rounded to 2dp, and that matters for more than tidiness.
 *
 * ECMAScript does not require Math.sin/Math.cos to be bit-identical across
 * implementations, so the server's V8 and the browser's V8 can disagree in the
 * last digits. Emitting `x="363.4106660501176"` from one and
 * `x="363.4106660501177"` from the other is a hydration mismatch on every
 * coordinate in the chart — React warns and gives up patching the subtree.
 *
 * Two decimals in a 600-unit viewBox is well below a device pixel at any size
 * this renders at, so nothing is lost, and the markup gets appreciably smaller.
 */
export function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = degToRad(angleDeg);
  return {
    x: Math.round((cx + r * Math.cos(rad)) * 100) / 100,
    y: Math.round((cy + r * Math.sin(rad)) * 100) / 100,
  };
}

/** An SVG arc along a circle of radius r, drawn anticlockwise. */
export function describeArc(
  cx: number, cy: number, r: number, startAngle: number, endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

/** A pie-slice band between two radii — one zodiac sign's arc. */
export function describeWedge(
  cx: number, cy: number, rInner: number, rOuter: number,
  startAngle: number, endAngle: number,
): string {
  const outerStart = polarToCartesian(cx, cy, rOuter, startAngle);
  const outerEnd = polarToCartesian(cx, cy, rOuter, endAngle);
  const innerEnd = polarToCartesian(cx, cy, rInner, endAngle);
  const innerStart = polarToCartesian(cx, cy, rInner, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

/**
 * Spread planets that would otherwise overlap.
 *
 * Two grahas within a couple of degrees render as one blob at this scale, so
 * anything closer than `minGap` is pushed apart along the rim. Returns the
 * angle each planet should be drawn at, in input order.
 *
 * 12° is set from the geometry rather than by eye: at PLANET_R the arc length
 * is r * theta = 195 * 12 * pi/180, about 41 units, against the 32-unit marker
 * diameter. 9° gave roughly 31 and the Moon/Saturn/Rahu stack still touched.
 */
export function spreadAngles(angles: number[], minGap = 12): number[] {
  const order = angles
    .map((angle, index) => ({ angle, index }))
    .sort((a, b) => a.angle - b.angle);

  for (let i = 1; i < order.length; i++) {
    const gap = order[i].angle - order[i - 1].angle;
    if (gap < minGap) order[i].angle = order[i - 1].angle + minGap;
  }

  const out = new Array<number>(angles.length);
  for (const { angle, index } of order) out[index] = angle;
  return out;
}
