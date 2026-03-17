"use client";

import { useState, useCallback, type ReactNode } from "react";

/* ─────────────────────────────────────────────────────────
   ZodiacWheel — slow-rotating decorative SVG background
   600×600 viewport, 12 equal segments, outer image ring.
   Colour: ultra-subtle semi-transparent white/violet.

   Interactive features:
   - Hover-to-highlight individual zodiac segments
   - Optional `activeSigns` prop for externally-highlighted signs
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

/** Build an SVG arc-wedge path from center covering a 30-degree segment. */
function wedgePath(index: number): string {
  const startAngle = index * 30;
  const endAngle = startAngle + 30;
  const innerStart = polarToCartesian(CX, CY, R_INNER, startAngle);
  const innerEnd   = polarToCartesian(CX, CY, R_INNER, endAngle);
  const outerStart = polarToCartesian(CX, CY, R_SPOKE, startAngle);
  const outerEnd   = polarToCartesian(CX, CY, R_SPOKE, endAngle);

  // Move to outer-start, arc to outer-end, line to inner-end, arc back to inner-start, close
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${R_SPOKE} ${R_SPOKE} 0 0 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${R_INNER} ${R_INNER} 0 0 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

interface ZodiacWheelProps {
  /** Signs to mark as "active" — they get a pulsing gold/aqua glow. */
  activeSigns?: string[];
}

export default function ZodiacWheel({ activeSigns = [] }: ZodiacWheelProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleMouseEnter = useCallback((i: number) => setHoveredIndex(i), []);
  const handleMouseLeave = useCallback(() => setHoveredIndex(null), []);

  const activeSet = new Set(activeSigns.map((s) => s.toLowerCase()));

  const spokes: ReactNode[] = [];
  const glyphs: ReactNode[] = [];
  const dots:   ReactNode[] = [];
  const hitAreas: ReactNode[] = [];
  const tooltips: ReactNode[] = [];

  for (let i = 0; i < 12; i++) {
    const angle = i * 30; // each sign = 30°
    const isHovered = hoveredIndex === i;
    const isActive  = activeSet.has(ZODIAC_NAMES[i].toLowerCase());
    const anyHovered = hoveredIndex !== null;

    // Determine opacity & filter for this segment
    let segmentOpacity: number;
    let segmentFilter: string;

    if (isHovered) {
      segmentOpacity = 1.0;
      segmentFilter = "saturate(1.0) brightness(1.1)";
    } else if (isActive && !anyHovered) {
      segmentOpacity = 0.85;
      segmentFilter = "saturate(1.2) brightness(1.05)";
    } else if (anyHovered) {
      // Another segment is hovered — dim this one
      segmentOpacity = isActive ? 0.5 : 0.35;
      segmentFilter = "saturate(0.5) brightness(0.8)";
    } else {
      // Default idle state (matches original look)
      segmentOpacity = 0.55;
      segmentFilter = "saturate(0.7) brightness(0.9)";
    }

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
      <g
        key={`sign-${i}`}
        className="zodiac-segment"
        style={{ opacity: segmentOpacity }}
        filter={isActive ? "url(#activeGlow)" : undefined}
      >
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
          style={{ filter: segmentFilter }}
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

    // Invisible hit-area wedge for hover detection
    hitAreas.push(
      <path
        key={`hit-${i}`}
        d={wedgePath(i)}
        fill="transparent"
        className="zodiac-segment-hitarea"
        onMouseEnter={() => handleMouseEnter(i)}
        onMouseLeave={handleMouseLeave}
      />
    );

    // Tooltip (visible only when hovered)
    const tooltipPos = polarToCartesian(CX, CY, R_GLYPH - 42, glyphAngle);
    tooltips.push(
      <g
        key={`tooltip-${i}`}
        className="zodiac-tooltip"
        style={{ opacity: isHovered ? 1 : 0 }}
      >
        <rect
          x={tooltipPos.x - 38}
          y={tooltipPos.y - 12}
          width="76"
          height="22"
          rx="6"
          fill="rgba(15, 10, 30, 0.85)"
          stroke="rgba(200,180,255,0.35)"
          strokeWidth="0.8"
        />
        <text
          x={tooltipPos.x}
          y={tooltipPos.y + 3}
          textAnchor="middle"
          fill="rgba(220,200,255,0.95)"
          fontSize="11"
          fontFamily="inherit"
          fontWeight="500"
        >
          {ZODIAC_NAMES[i]}
        </text>
      </g>
    );
  }

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
        pointerEvents: "auto",
        filter: "drop-shadow(0 0 8px rgba(160,100,255,0.20))",
        zIndex: 0,
      }}
    >
      {/* ClipPath definitions for circular sign images + active glow filter */}
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

        {/* SVG filter for active-sign pulsing gold/aqua glow */}
        <filter id="activeGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow
            dx="0"
            dy="0"
            stdDeviation="4"
            floodColor="#ffd700"
            floodOpacity="0.7"
          >
            <animate
              attributeName="flood-color"
              values="#ffd700;#00e5ff;#ffd700"
              dur="2s"
              repeatCount="indefinite"
            />
          </feDropShadow>
        </filter>
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

      {/* Invisible hit-area wedges (on top for pointer events) */}
      {hitAreas}

      {/* Tooltips (rendered last so they appear above everything) */}
      {tooltips}
    </svg>
  );
}
