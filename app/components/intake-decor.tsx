/**
 * The abstract figures the two intake backdrops are drawn from.
 *
 * Shapes only — no CSS import, no placement, no opinion about where any of
 * this goes. IntakeBackdrop.tsx composes them for the desktop landing page and
 * app/m/mobile-backdrop.tsx composes them for the handset one; the two canvases
 * have almost nothing in common (a 1440-wide page with two cards and wide
 * gutters, against a 390-wide column with a fixed action bar), so they share
 * the drawings and nothing else.
 *
 * Follows app/(desktop)/insights/components/decor/insights-decor.tsx, which is
 * the existing pattern for this: one file of small named exports over a shared
 * `commonProps`, no "use client", so these stay server components wherever the
 * tree they land in allows it.
 *
 * ── Three rules every figure here obeys ────────────────────────────────────
 *
 * 1. COLOUR COMES FROM `currentColor`, never from a literal. The caller's
 *    wrapper class sets `color`, and both themes redefine whatever token it
 *    sets it from, so one set of markup re-themes with no duplicate. This is
 *    the flaw in GradientBlobs.tsx, which hardcodes six hex values and
 *    therefore ignores `data-theme` entirely.
 *
 * 2. NO `<linearGradient>`/`<radialGradient>`. SVG ids are document-global and
 *    ArcFan is rendered twice by both callers, so two instances would collide
 *    on one id and both take the first definition. Gradient stops cannot be
 *    `currentColor` either, which would break rule 1. Where a soft wash is
 *    wanted, the caller's `::before` does it with a CSS radial-gradient.
 *
 * 3. STROKE WIDTH IS THE CALLER'S. `vector-effect: non-scaling-stroke` pins
 *    every stroke to the px width the caller's class asks for, whatever scale
 *    its viewBox is rendered at — otherwise the same drawing at 36rem on
 *    desktop and 20rem on a handset would come out at two different weights.
 *
 * Every figure is `aria-hidden` and `focusable="false"`, so none of them reach
 * the accessibility tree or the tab order.
 */

const line = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  vectorEffect: "non-scaling-stroke" as const,
};

const svgProps = {
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": true,
  /* insights-decor.tsx carries this for the same reason: decorative SVG should
     not be tabbable in browsers that still treat <svg> as focusable. */
  focusable: "false" as const,
};

type GlyphProps = { className?: string };

/** Three tilted orbits around a common centre — the boldest of the figures. */
export function OrbitCluster({ className }: GlyphProps) {
  return (
    <svg {...svgProps} viewBox="0 0 400 400" className={className}>
      <ellipse {...line} cx="200" cy="200" rx="190" ry="76" transform="rotate(-20 200 200)" />
      <ellipse {...line} cx="200" cy="200" rx="190" ry="76" transform="rotate(40 200 200)" />
      <ellipse {...line} cx="200" cy="200" rx="190" ry="76" transform="rotate(100 200 200)" />
      <circle {...line} cx="200" cy="200" r="27" />
      <circle {...line} cx="200" cy="200" r="13" />
      {/* A body parked on each orbit, at the far end of its major axis. */}
      <circle cx="378.5" cy="135" r="5" fill="currentColor" />
      <circle cx="345.5" cy="322" r="4" fill="currentColor" />
      <circle cx="167" cy="387" r="3.5" fill="currentColor" />
    </svg>
  );
}

/** Seven-circle rosette inside two rings — a flower-of-life fragment. */
export function Rosette({ className }: GlyphProps) {
  return (
    <svg {...svgProps} viewBox="0 0 300 300" className={className}>
      <circle {...line} cx="150" cy="150" r="52" />
      <circle {...line} cx="202" cy="150" r="52" />
      <circle {...line} cx="98" cy="150" r="52" />
      <circle {...line} cx="176" cy="105" r="52" />
      <circle {...line} cx="124" cy="105" r="52" />
      <circle {...line} cx="176" cy="195" r="52" />
      <circle {...line} cx="124" cy="195" r="52" />
      <circle {...line} cx="150" cy="150" r="104" />
      <circle {...line} cx="150" cy="150" r="132" />
    </svg>
  );
}

/**
 * Five quarter-arcs radiating from the bottom-left of their own box.
 *
 * Both callers render it twice and mirror one copy with CSS, rather than this
 * file carrying a second drawing that would have to be kept in sync.
 */
export function ArcFan({ className }: GlyphProps) {
  return (
    <svg {...svgProps} viewBox="0 0 300 300" className={className}>
      <path {...line} d="M90 300 A 90 90 0 0 0 0 210" />
      <path {...line} d="M140 300 A 140 140 0 0 0 0 160" />
      <path {...line} d="M190 300 A 190 190 0 0 0 0 110" />
      <path {...line} d="M240 300 A 240 240 0 0 0 0 60" />
      <path {...line} d="M290 300 A 290 290 0 0 0 0 10" />
    </svg>
  );
}

/** Three parallel curves, for a long sweep across an open band. */
export function Ribbon({ className }: GlyphProps) {
  return (
    <svg {...svgProps} viewBox="0 0 600 200" className={className}>
      <path {...line} d="M0 104 C 130 14, 250 176, 372 86 S 512 34, 600 92" />
      <path {...line} d="M0 122 C 130 32, 250 194, 372 104 S 512 52, 600 110" />
      <path {...line} d="M0 140 C 130 50, 250 212, 372 122 S 512 70, 600 128" />
    </svg>
  );
}

/** Nested squares on the diagonal, echoing the North-Indian chart frame. */
export function DiamondLattice({ className }: GlyphProps) {
  return (
    <svg {...svgProps} viewBox="0 0 200 200" className={className}>
      <g transform="rotate(45 100 100)">
        <rect {...line} x="30" y="30" width="140" height="140" />
        <rect {...line} x="55" y="55" width="90" height="90" />
        <rect {...line} x="80" y="80" width="40" height="40" />
      </g>
      <path {...line} d="M100 6 V 194 M6 100 H 194" />
    </svg>
  );
}

/**
 * Scattered points with three four-pointed stars, for an open band.
 *
 * `portrait` turns the 400x200 field on its side for a narrow column. Two
 * coordinate lists rather than a CSS rotation, because rotating the box would
 * carry the sparkles round with it and stand them on their corners.
 */
export function StarField({ className, portrait }: GlyphProps & { portrait?: boolean }) {
  const dots: Array<[number, number, number]> = portrait
    ? [
        [44, 18, 1.6], [122, 63, 1.1], [28, 96, 1.8], [168, 131, 1.2],
        [74, 158, 1.5], [18, 192, 1.1], [140, 214, 1.7], [96, 248, 1.2],
        [38, 274, 1.4], [158, 299, 1.1], [84, 322, 1.8], [126, 351, 1.2],
        [52, 378, 1.5], [186, 44, 1.2], [96, 122, 1.3], [190, 236, 1.1],
        [10, 336, 1.2], [176, 388, 1.4],
      ]
    : [
        [18, 44, 1.6], [63, 122, 1.1], [96, 28, 1.8], [131, 168, 1.2],
        [158, 74, 1.5], [192, 18, 1.1], [214, 140, 1.7], [248, 96, 1.2],
        [274, 38, 1.4], [299, 158, 1.1], [322, 84, 1.8], [351, 126, 1.2],
        [378, 52, 1.5], [44, 186, 1.2], [122, 96, 1.3], [236, 190, 1.1],
        [336, 10, 1.2], [388, 176, 1.4],
      ];
  const sparkles: Array<[number, number, number]> = portrait
    ? [[88, 40, 0.9], [118, 180, 1.15], [58, 300, 0.8]]
    : [[40, 88, 0.9], [180, 118, 1.15], [300, 58, 0.8]];

  return (
    <svg
      {...svgProps}
      viewBox={portrait ? "0 0 200 400" : "0 0 400 200"}
      className={className}
    >
      {dots.map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="currentColor" />
      ))}
      {/* The Lahiri glyph from TraditionGlyph, so the app has one star shape
          rather than two that almost match. */}
      {sparkles.map(([x, y, s]) => (
        <path
          key={`${x}-${y}`}
          {...line}
          strokeWidth={1.2 / s}
          d="M12 3 L14 10 L21 12 L14 14 L12 21 L10 14 L3 12 L10 10 Z"
          transform={`translate(${x} ${y}) scale(${s}) translate(-12 -12)`}
        />
      ))}
    </svg>
  );
}
