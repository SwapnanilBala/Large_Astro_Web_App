"use client";

import { useState, useEffect, type ReactNode } from "react";

/* ─────────────────────────────────────────────────────────
   ZodiacWheel — slow-rotating decorative SVG background
   600×600 viewport, 12 equal segments, outer image ring.
   Colour: ultra-subtle semi-transparent white/violet.

   Interactive features:
   - Hover-to-highlight with tooltip
   - activeSigns prop for permanent glow on specific signs
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

/** Build an SVG arc-wedge path for a 30-degree segment */
function segmentPath(index: number): string {
  const startAngle = index * 30;
  const endAngle = startAngle + 30;
  const innerStart = polarToCartesian(CX, CY, R_INNER, startAngle);
  const innerEnd = polarToCartesian(CX, CY, R_INNER, endAngle);
  const outerStart = polarToCartesian(CX, CY, R_SPOKE, startAngle);
  const outerEnd = polarToCartesian(CX, CY, R_SPOKE, endAngle);
  return [
    `M ${innerStart.x} ${innerStart.y}`,
    `L ${outerStart.x} ${outerStart.y}`,
    `A ${R_SPOKE} ${R_SPOKE} 0 0 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${R_INNER} ${R_INNER} 0 0 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

interface ZodiacWheelProps {
  /** Sign names (e.g. "Aries") to permanently highlight with a pulsing glow */
  activeSigns?: string[];
}

export default function ZodiacWheel({ activeSigns = [] }: ZodiacWheelProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [visibleSegments, setVisibleSegments] = useState<Set<number>>(new Set());
  const [ringsVisible, setRingsVisible] = useState(false);
  const [entranceComplete, setEntranceComplete] = useState(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setRingsVisible(true);
      setVisibleSegments(new Set(Array.from({ length: 12 }, (_, i) => i)));
      setEntranceComplete(true);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];

    // Show rings first (300ms to let the page settle)
    timers.push(setTimeout(() => setRingsVisible(true), 300));

    // Then stagger segments in from center
    for (let i = 0; i < 12; i++) {
      timers.push(
        setTimeout(() => {
          setVisibleSegments((prev) => new Set(prev).add(i));
        }, 500 + i * 60)
      );
    }

    // Mark entrance complete after last segment finishes its transition
    // Last segment appears at 500 + 11*60 = 1160ms, plus 400ms transition
    timers.push(setTimeout(() => setEntranceComplete(true), 1160 + 400));

    return () => timers.forEach(clearTimeout);
  }, []);

  const activeSet = new Set(activeSigns.map((s) => s.toLowerCase()));

  const spokes: ReactNode[] = [];
  const segments: ReactNode[] = [];
  const dots: ReactNode[] = [];

  for (let i = 0; i < 12; i++) {
    const angle = i * 30;
    const isHovered = hoveredIndex === i;
    const isActive = activeSet.has(ZODIAC_NAMES[i].toLowerCase());
    const someHovered = hoveredIndex !== null;
    const isDimmed = someHovered && !isHovered;

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
        style={{
          opacity: visibleSegments.has(i) ? 1 : 0,
          transform: visibleSegments.has(i) ? 'scale(1)' : 'scale(0.3)',
          transformOrigin: '300px 300px',
          transition: 'opacity 400ms ease-out, transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      />
    );

    // Sign image at midpoint of each segment (angle + 15deg)
    const glyphAngle = angle + 15;
    const gp = polarToCartesian(CX, CY, R_GLYPH, glyphAngle);

    // Determine image opacity and filter per state
    let imgOpacity = 0.55;
    let imgFilter = "saturate(0.7) brightness(0.9)";
    if (isHovered) {
      imgOpacity = 1.0;
      imgFilter = "saturate(1.0) brightness(1.1)";
    } else if (isDimmed) {
      imgOpacity = 0.35;
      imgFilter = "saturate(0.5) brightness(0.7)";
    } else if (isActive) {
      imgOpacity = 0.85;
      imgFilter = "saturate(0.9) brightness(1.0)";
    }

    // Glow filter reference for active signs
    const glowFilter = isActive ? "url(#active-glow)" : undefined;

    segments.push(
      <g
        key={`segment-${i}`}
        className="zodiac-segment"
        style={{
          opacity: visibleSegments.has(i) ? 1 : 0,
          transform: visibleSegments.has(i) ? 'scale(1)' : 'scale(0.3)',
          transformOrigin: '300px 300px',
          transition: 'opacity 400ms ease-out, transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Invisible hit-area for hover detection */}
        <path
          d={segmentPath(i)}
          fill="transparent"
          style={{ cursor: "pointer" }}
          onMouseEnter={() => setHoveredIndex(i)}
          onMouseLeave={() => setHoveredIndex(null)}
        />

        {/* Circular border ring behind the image */}
        <circle
          cx={gp.x}
          cy={gp.y}
          r="19"
          fill="none"
          stroke={
            isHovered
              ? "rgba(255,255,255,0.50)"
              : isActive
              ? "rgba(242,194,108,0.50)"
              : "rgba(200,180,255,0.20)"
          }
          strokeWidth={isHovered ? "1.5" : "1"}
          style={{ transition: "stroke 300ms ease, stroke-width 300ms ease" }}
          filter={glowFilter}
          pointerEvents="none"
        />

        {/* Active-sign pulsing glow ring (gold accent) */}
        {isActive && (
          <circle
            cx={gp.x}
            cy={gp.y}
            r="22"
            fill="none"
            stroke="rgba(242, 194, 108, 0.45)"
            strokeWidth="2"
            className="zodiac-active-pulse zodiac-active-glow"
            pointerEvents="none"
          />
        )}

        {/* The actual sign image, clipped to a circle */}
        <image
          href={ZODIAC_IMAGES[i]}
          x={gp.x - 18}
          y={gp.y - 18}
          width="36"
          height="36"
          clipPath={`url(#clip-${ZODIAC_NAMES[i]})`}
          opacity={imgOpacity}
          style={{
            filter: imgFilter,
            transition: "opacity 300ms ease, filter 300ms ease",
          }}
          pointerEvents="none"
        />
      </g>
    );

    // Dot markers at every 30deg on the outer dot ring
    const dp = polarToCartesian(CX, CY, R_DOT, angle);
    dots.push(
      <circle
        key={`dot-${i}`}
        cx={dp.x}
        cy={dp.y}
        r="2"
        fill="rgba(255,255,255,0.18)"
        style={{
          opacity: visibleSegments.has(i) ? 1 : 0,
          transform: visibleSegments.has(i) ? 'scale(1)' : 'scale(0.3)',
          transformOrigin: `${dp.x}px ${dp.y}px`,
          transition: 'opacity 400ms ease-out, transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      />
    );
  }

  // Tooltip for hovered segment
  let tooltip: ReactNode = null;
  if (hoveredIndex !== null) {
    const tAngle = hoveredIndex * 30 + 15;
    const tp = polarToCartesian(CX, CY, R_GLYPH - 45, tAngle);
    tooltip = (
      <g pointerEvents="none">
        {/* Background pill */}
        <rect
          x={tp.x - 40}
          y={tp.y - 12}
          width="80"
          height="24"
          rx="12"
          fill="rgba(10,10,30,0.85)"
          stroke="rgba(200,180,255,0.40)"
          strokeWidth="0.8"
        />
        <text
          x={tp.x}
          y={tp.y + 4}
          textAnchor="middle"
          fill="rgba(255,255,255,0.92)"
          fontSize="11"
          fontFamily="inherit"
          fontWeight="500"
        >
          {ZODIAC_NAMES[hoveredIndex]}
        </text>
      </g>
    );
  }

  return (
    <>
      {/* Injected styles for interactive features */}
      <style>{`
        @keyframes zodiacActivePulse {
          0%, 100% { stroke-opacity: 0.35; r: 22; }
          50%      { stroke-opacity: 0.70; r: 25; }
        }
        .zodiac-active-pulse {
          animation: zodiacActivePulse 2s ease-in-out infinite;
        }
      `}</style>

      {/* Outer ring glow behind the wheel */}
      <div className="zodiac-wheel-glow" />

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
          /* pointerEvents enabled so hover detection works */
          pointerEvents: "auto",
          filter: "drop-shadow(0 0 8px rgba(160,100,255,0.20))",
          zIndex: 0,
        }}
      >
        {/* ClipPath & filter definitions */}
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

          {/* SVG glow filter for active signs (gold accent #f2c26c) */}
          <filter id="active-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feFlood floodColor="rgba(242,194,108,0.6)" result="goldOuter" />
            <feComposite in="goldOuter" in2="blur" operator="in" result="goldOuterGlow" />
            <feFlood floodColor="rgba(242,194,108,0.35)" result="goldInner" />
            <feComposite in="goldInner" in2="blur" operator="in" result="goldInnerGlow" />
            <feMerge>
              <feMergeNode in="goldOuterGlow" />
              <feMergeNode in="goldInnerGlow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
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
          style={{
            opacity: ringsVisible ? 1 : 0,
            transition: 'opacity 400ms ease-out',
          }}
        />

        {/* Inner hub ring */}
        <circle
          cx={CX}
          cy={CY}
          r={R_INNER}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="0.7"
          style={{
            opacity: ringsVisible ? 1 : 0,
            transition: 'opacity 400ms ease-out',
          }}
        />

        {/* Outer boundary ring (at R_SPOKE) */}
        <circle
          cx={CX}
          cy={CY}
          r={R_SPOKE}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="0.6"
          style={{
            opacity: ringsVisible ? 1 : 0,
            transition: 'opacity 400ms ease-out',
          }}
        />

        {/* Spokes */}
        {spokes}

        {/* Zodiac segments (hit areas + images) */}
        {segments}

        {/* Dot markers */}
        {dots}

        {/* Tooltip (rendered last so it's on top) */}
        {tooltip}
      </svg>
    </>
  );
}
