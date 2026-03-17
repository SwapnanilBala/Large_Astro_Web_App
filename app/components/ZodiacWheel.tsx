"use client";

import type { ReactNode } from "react";

/* ─────────────────────────────────────────────────────────
   ZodiacWheel — slow-rotating decorative SVG background
   600×600 viewport, 12 equal segments, outer image ring.
   Colour: ultra-subtle semi-transparent white/violet.
   ───────────────────────────────────────────────────────── */

const ZODIAC_IMAGES = [
  "/zodiac/aries.jpg",
  "/zodiac/taurus.jpg",
  "/zodiac/gemini.jpg",
  "/zodiac/cancer.jpg",
  "/zodiac/leo.jpg",
  "/zodiac/virgo.jpg",
  "/zodiac/libra.jpg",
  "/zodiac/scorpio.jpg",
  "/zodiac/sagittarius.jpg",
  "/zodiac/capricorn.png",
  "/zodiac/aquarius.png",
  "/zodiac/pisces.jpg",
];

const ZODIAC_NAMES = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const CX = 300;
const CY = 300;
const R_INNER = 60;   // inner hub radius
const R_SPOKE = 250;  // spoke length (outer boundary of segments)
const R_RING  = 268;  // decorative ring radius
const R_GLYPH = 235;  // radius at which sign images are placed (inside outer ring)
const R_DOT   = 278;  // dot marker radius (just outside ring)

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

export default function ZodiacWheel() {
  const spokes: ReactNode[] = [];
  const glyphs: ReactNode[] = [];
  const dots:   ReactNode[] = [];

  for (let i = 0; i < 12; i++) {
    const angle = i * 30; // each sign = 30°

    // Spoke lines from inner hub to outer boundary
    const inner = polarToCartesian(CX, CY, R_INNER, angle);
    const outer = polarToCartesian(CX, CY, R_SPOKE, angle);
    spokes.push(
      <line
        key={`spoke-${i}`}
        x1={inner.x}
        y1={inner.y}
        x2={outer.x}
        y2={outer.y}
        stroke="rgba(255,255,255,0.10)"
        strokeWidth="0.8"
      />
    );

    // Sign image at midpoint of each segment (angle + 15°)
    const glyphAngle = angle + 15;
    const gp = polarToCartesian(CX, CY, R_GLYPH, glyphAngle);
    glyphs.push(
      <g key={`sign-${i}`}>
        {/* Circular border ring behind the image */}
        <circle
          cx={gp.x}
          cy={gp.y}
          r="19"
          fill="none"
          stroke="rgba(200,180,255,0.20)"
          strokeWidth="1"
        />
        {/* The actual sign image, clipped to a circle */}
        <image
          href={ZODIAC_IMAGES[i]}
          x={gp.x - 18}
          y={gp.y - 18}
          width="36"
          height="36"
          clipPath={`url(#clip-${ZODIAC_NAMES[i]})`}
          opacity="0.55"
          style={{ filter: "saturate(0.7) brightness(0.9)" }}
        />
      </g>
    );

    // Dot markers at every 30° on the outer dot ring
    const dp = polarToCartesian(CX, CY, R_DOT, angle);
    dots.push(
      <circle
        key={`dot-${i}`}
        cx={dp.x}
        cy={dp.y}
        r="2"
        fill="rgba(255,255,255,0.18)"
      />
    );
  }

  // Arc path description for the outer decorative ring
  // We draw a full circle via SVG <circle> — simpler and equally effective.

  return (
    <svg
      viewBox="0 0 600 600"
      width="600"
      height="600"
      aria-hidden="true"
      className="zodiac-wheel"
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        filter: "drop-shadow(0 0 8px rgba(160,100,255,0.20))",
        zIndex: 0,
      }}
    >
      {/* ClipPath definitions for circular sign images */}
      <defs>
        {ZODIAC_NAMES.map((name, i) => {
          const glyphAngle = i * 30 + 15;
          const gp = polarToCartesian(CX, CY, R_GLYPH, glyphAngle);
          return (
            <clipPath key={`clip-${name}`} id={`clip-${name}`}>
              <circle cx={gp.x} cy={gp.y} r="18" />
            </clipPath>
          );
        })}
      </defs>

      {/* Outer decorative ring */}
      <circle
        cx={CX}
        cy={CY}
        r={R_RING}
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="1"
      />

      {/* Inner hub ring */}
      <circle
        cx={CX}
        cy={CY}
        r={R_INNER}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="0.7"
      />

      {/* Outer boundary ring (at R_SPOKE) */}
      <circle
        cx={CX}
        cy={CY}
        r={R_SPOKE}
        fill="none"
        stroke="rgba(255,255,255,0.07)"
        strokeWidth="0.6"
      />

      {/* Spokes */}
      {spokes}

      {/* Zodiac sign images */}
      {glyphs}

      {/* Dot markers */}
      {dots}
    </svg>
  );
}
