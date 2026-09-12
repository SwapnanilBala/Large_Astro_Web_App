import styles from "./IntakeBackdrop.module.css";

/**
 * Abstract decorative backdrop for the landing intake.
 *
 * The first viewport used to be a flat plane: `.professionalIntake` paints an
 * opaque background, which covers the layout's <GradientBlobs /> star field
 * entirely, so the only decoration reaching the screen was the one rotated
 * chart-square in `.professionalIntake::before`. Both pseudo-elements on that
 * selector are already spoken for, hence a real element.
 *
 * ── Rules this file obeys ──────────────────────────────────────────────────
 *
 * 1. COLOUR COMES FROM `currentColor`. Each shape carries a hue class that
 *    sets `color` from an accent token, and both themes redefine those tokens,
 *    so the whole layer re-themes with no duplicate markup. This is the flaw in
 *    GradientBlobs.tsx, which hardcodes six hex values and ignores
 *    `data-theme`. Same rule as insights/components/decor/insights-decor.tsx.
 *
 * 2. NO `<linearGradient>`/`<radialGradient>`. SVG ids are document-global and
 *    ArcFan renders twice below, so two instances would collide on one id.
 *    Gradient stops cannot be `currentColor` either, which would break rule 1.
 *    The soft colour fields are CSS radial-gradients on `.backdrop::before`,
 *    which is the house pattern for a wash.
 *
 * 3. NOTHING ANIMATES. The landing layer's own comment ("keeps all decoration
 *    static so low-end devices do not pay for ambient motion") is a decision,
 *    not an omission — this layer is composed rather than animated, so it costs
 *    one paint and never touches the main thread again.
 *
 * 4. SHAPES ARE ANCHORED, NOT SLICED. One full-bleed SVG with
 *    `preserveAspectRatio="slice"` crops its own corners at the aspect ratios
 *    it was not drawn for, which is exactly where corner decor lives. Each
 *    shape is instead its own small viewBox positioned by CSS, so it stays
 *    undistorted and keeps the edge it was drawn against.
 *
 * Placement follows where the page is actually empty at desktop widths: the
 * band above the form card, the band below it, and the outer gutters. The
 * cards cover the middle, so shapes that cross it are drawn to read from both
 * ends.
 */

/* `vector-effect` keeps every stroke at the px width its class asks for,
   whatever scale its viewBox is rendered at — otherwise the 400-unit orbit box
   at 34rem would draw twice as heavy as the 200-unit lattice at 12rem. */
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
  focusable: "false" as const,
};

/** Three tilted orbits around a common centre — the page's one bold shape. */
function OrbitCluster({ className }: { className: string }) {
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
function Rosette({ className }: { className: string }) {
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
 * Rendered twice, mirrored by CSS, rather than carried here as two drawings
 * that would have to be kept in sync.
 */
function ArcFan({ className }: { className: string }) {
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

/** Three parallel curves, for the long sweep across the open bands. */
function Ribbon({ className }: { className: string }) {
  return (
    <svg {...svgProps} viewBox="0 0 600 200" className={className}>
      <path {...line} d="M0 104 C 130 14, 250 176, 372 86 S 512 34, 600 92" />
      <path {...line} d="M0 122 C 130 32, 250 194, 372 104 S 512 52, 600 110" />
      <path {...line} d="M0 140 C 130 50, 250 212, 372 122 S 512 70, 600 128" />
    </svg>
  );
}

/** Nested squares on the diagonal, echoing the North-Indian chart frame. */
function DiamondLattice({ className }: { className: string }) {
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

/** Scattered points with three four-pointed stars, for the open top band. */
function StarField({ className }: { className: string }) {
  return (
    <svg {...svgProps} viewBox="0 0 400 200" className={className}>
      {[
        [18, 44, 1.6], [63, 122, 1.1], [96, 28, 1.8], [131, 168, 1.2],
        [158, 74, 1.5], [192, 18, 1.1], [214, 140, 1.7], [248, 96, 1.2],
        [274, 38, 1.4], [299, 158, 1.1], [322, 84, 1.8], [351, 126, 1.2],
        [378, 52, 1.5], [44, 186, 1.2], [122, 96, 1.3], [236, 190, 1.1],
        [336, 10, 1.2], [388, 176, 1.4],
      ].map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="currentColor" />
      ))}
      {/* The Lahiri glyph from TraditionGlyph, so the page has one star shape
          rather than two that almost match. */}
      {[
        [40, 88, 0.9], [180, 118, 1.15], [300, 58, 0.8],
      ].map(([x, y, s]) => (
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

export default function IntakeBackdrop() {
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <Rosette className={`${styles.shape} ${styles.rosette} ${styles.violet}`} />
      <StarField className={`${styles.shape} ${styles.stars} ${styles.gold}`} />
      <ArcFan className={`${styles.shape} ${styles.arcsTop} ${styles.teal}`} />
      <Ribbon className={`${styles.shape} ${styles.ribbon} ${styles.teal}`} />
      <OrbitCluster className={`${styles.shape} ${styles.orbits} ${styles.gold}`} />
      <ArcFan className={`${styles.shape} ${styles.arcsBottom} ${styles.coral}`} />
      <DiamondLattice className={`${styles.shape} ${styles.lattice} ${styles.gold}`} />
    </div>
  );
}
