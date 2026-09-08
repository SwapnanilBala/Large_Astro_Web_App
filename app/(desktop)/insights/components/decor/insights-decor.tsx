/**
 * Decorative glyphs for the results page bands.
 *
 * Hand-authored SVG rather than photographs: `public/` has two backdrop webps
 * and twelve zodiac images and nothing else, so there is no foliage or texture
 * to reach for. Drawing them keeps the decorative layer vector-crisp, weightless
 * and -- the reason that matters most here -- theme-aware.
 *
 * Follows app/components/TraditionGlyph.tsx, which is the existing pattern for
 * this: one file of small named exports over a shared `commonProps`, no
 * "use client", so these stay server components.
 *
 * ── Two rules these all obey ───────────────────────────────────────────────
 *
 * 1. COLOUR COMES FROM `currentColor`, never from a literal. The wrapper class
 *    sets `color` from an accent token and both themes redefine those tokens,
 *    so the decor re-themes with no extra CSS. This is the flaw in
 *    GradientBlobs.tsx, which hardcodes six hex values and therefore ignores
 *    `data-theme` entirely.
 *
 * 2. NO `<linearGradient>` OR `<radialGradient>`. SVG ids are document-global
 *    and FoliageSprig renders twice in the hero, so two instances would collide
 *    on one id and both take the first definition. Gradient stops also cannot
 *    be `currentColor`, so they would have to hardcode hex and break rule 1.
 *    Where a soft wash is wanted, .hero::before does it with a CSS
 *    radial-gradient, which is the house pattern.
 *
 * Every glyph is `aria-hidden` and `focusable="false"`, so none of them reach
 * the accessibility tree or the tab order.
 */

const commonProps = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  /* TraditionGlyph omits this; decorative SVG should not be tabbable in
     browsers that still treat <svg> as focusable. */
  focusable: "false" as const,
};

type GlyphProps = { className?: string };

/**
 * A sprig of paired leaves on a curving stem, for the hero's top corners.
 *
 * One path serves both corners -- the CSS mirrors it with scaleX(-1) rather
 * than this file carrying a second, subtly different drawing to keep in sync.
 */
export function FoliageSprig({ className }: GlyphProps) {
  return (
    <svg {...commonProps} viewBox="0 0 120 120" className={className}>
      {/* main stem */}
      <path d="M4 4 C 34 18, 58 42, 74 76" />
      {/* paired leaves down the stem, widest at the base */}
      <path d="M20 12 C 30 4, 42 8, 44 18 C 34 24, 24 21, 20 12 Z" />
      <path d="M17 17 C 10 27, 14 38, 24 40 C 29 30, 26 20, 17 17 Z" />
      <path d="M38 30 C 49 23, 60 28, 61 38 C 51 43, 41 39, 38 30 Z" />
      <path d="M35 36 C 29 47, 34 57, 44 58 C 48 48, 44 38, 35 36 Z" />
      <path d="M55 54 C 65 48, 75 53, 76 62 C 67 66, 58 62, 55 54 Z" />
      {/* a smaller offshoot, so the sprig is not perfectly regular */}
      <path d="M52 50 C 47 60, 51 69, 60 70" />
    </svg>
  );
}

/**
 * Four-point star.
 *
 * The path is TraditionGlyph's Lahiri glyph verbatim -- it is already the
 * app's star, and redrawing it slightly differently would give the page two
 * stars that almost match.
 */
export function Sparkle({ className }: GlyphProps) {
  return (
    <svg {...commonProps} viewBox="0 0 24 24" className={className}>
      <path d="M12 3 L14 10 L21 12 L14 14 L12 21 L10 14 L3 12 L10 10 Z" />
    </svg>
  );
}

/** A single swash, for under a pull-quote. */
export function Flourish({ className }: GlyphProps) {
  return (
    <svg {...commonProps} viewBox="0 0 120 20" className={className}>
      <path d="M2 12 C 22 2, 40 2, 60 10 C 80 18, 98 18, 118 8" />
      <circle cx="60" cy="10" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Sun with eight rays, for the fortune band.
 *
 * Same construction as TraditionGlyph's compass rose: a circle plus spokes,
 * with the ray lengths alternating so it reads as light rather than as a dial.
 */
export function SunGlyph({ className }: GlyphProps) {
  return (
    <svg {...commonProps} viewBox="0 0 32 32" className={className}>
      <circle cx="16" cy="16" r="6.5" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="16" y1="26" x2="16" y2="30" />
      <line x1="2" y1="16" x2="6" y2="16" />
      <line x1="26" y1="16" x2="30" y2="16" />
      <line x1="6.5" y1="6.5" x2="9" y2="9" />
      <line x1="23" y1="23" x2="25.5" y2="25.5" />
      <line x1="6.5" y1="25.5" x2="9" y2="23" />
      <line x1="23" y1="9" x2="25.5" y2="6.5" />
    </svg>
  );
}

/** A stem of alternating leaves, for the fortune band's far end. */
export function LeafSprig({ className }: GlyphProps) {
  return (
    <svg {...commonProps} viewBox="0 0 60 120" className={className}>
      <path d="M30 116 C 26 88, 28 54, 34 6" />
      <path d="M31 96 C 20 92, 13 82, 17 73 C 27 74, 33 85, 31 96 Z" />
      <path d="M31 84 C 42 81, 50 72, 47 63 C 37 65, 30 74, 31 84 Z" />
      <path d="M32 68 C 21 65, 14 56, 18 47 C 28 49, 34 58, 32 68 Z" />
      <path d="M33 54 C 44 51, 51 42, 48 34 C 38 36, 32 45, 33 54 Z" />
      <path d="M34 40 C 24 37, 18 29, 22 21 C 31 23, 36 31, 34 40 Z" />
    </svg>
  );
}

/** A tapering hairline, to sit under a line of script. */
export function ScriptRule({ className }: GlyphProps) {
  return (
    <svg {...commonProps} viewBox="0 0 100 6" className={className}>
      <path d="M1 3 C 26 6, 74 6, 99 2" strokeWidth={1} />
    </svg>
  );
}
