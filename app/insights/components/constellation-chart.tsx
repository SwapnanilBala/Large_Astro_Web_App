"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { HousePlacement, PlanetPosition } from "@/lib/astro-types";

type ConstellationChartProps = {
  ascendantSign: string;
  houses: HousePlacement[];
  planets?: PlanetPosition[];
};

const PLANET_SYMBOLS: Record<string, string> = {
  Sun: "\u2609",
  Moon: "\u263D",
  Mars: "\u2642",
  Mercury: "\u263F",
  Jupiter: "\u2643",
  Venus: "\u2640",
  Saturn: "\u2644",
  Rahu: "\u260A",
  Ketu: "\u260B",
};

const PLANET_COLORS: Record<string, string> = {
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

const SIGN_SYMBOLS: Record<string, string> = {
  Aries: "\u2648",
  Taurus: "\u2649",
  Gemini: "\u264A",
  Cancer: "\u264B",
  Leo: "\u264C",
  Virgo: "\u264D",
  Libra: "\u264E",
  Scorpio: "\u264F",
  Sagittarius: "\u2650",
  Capricorn: "\u2651",
  Aquarius: "\u2652",
  Pisces: "\u2653",
};

const SIGN_ORDER = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const ELEMENT_MAP: Record<string, "fire" | "earth" | "air" | "water"> = {
  Aries: "fire", Leo: "fire", Sagittarius: "fire",
  Taurus: "earth", Virgo: "earth", Capricorn: "earth",
  Gemini: "air", Libra: "air", Aquarius: "air",
  Cancer: "water", Scorpio: "water", Pisces: "water",
};

const ELEMENT_COLORS: Record<string, string> = {
  fire: "rgba(255,100,80,0.06)",
  earth: "rgba(100,200,120,0.06)",
  air: "rgba(100,180,255,0.06)",
  water: "rgba(160,100,220,0.06)",
};

// Seeded random number generator for consistent star positions per chart
function seededRandom(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return function () {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    return (hash % 10000) / 10000;
  };
}

// Aspect detection
type AspectType = "conjunction" | "trine" | "square" | "opposition" | "sextile";

const ASPECT_CONFIG: { type: AspectType; angle: number; orb: number; color: string }[] = [
  { type: "conjunction", angle: 0, orb: 10, color: "#f2c26c" },
  { type: "trine", angle: 120, orb: 8, color: "#6ce1d4" },
  { type: "square", angle: 90, orb: 8, color: "#ff6b5b" },
  { type: "opposition", angle: 180, orb: 10, color: "#c490e4" },
  { type: "sextile", angle: 60, orb: 6, color: "#6ce1a0" },
];

function detectAspect(lon1: number, lon2: number): { type: AspectType; color: string } | null {
  let diff = Math.abs(lon1 - lon2);
  if (diff > 180) diff = 360 - diff;
  for (const cfg of ASPECT_CONFIG) {
    if (Math.abs(diff - cfg.angle) <= cfg.orb) {
      return { type: cfg.type, color: cfg.color };
    }
  }
  return null;
}

// Convert longitude to position on the wheel
// 0 deg Aries at top (12 o'clock), going clockwise
function lonToAngle(longitude: number): number {
  // longitude 0 = 0 deg Aries, map to -90 deg (top), clockwise
  return longitude - 90;
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = degToRad(angleDeg);
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

// Create an SVG arc path
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

// Create a wedge (pie slice) path for sign arcs
function describeWedge(cx: number, cy: number, rInner: number, rOuter: number, startAngle: number, endAngle: number): string {
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

type TooltipData = {
  planet: string;
  sign: string;
  degree: number;
  house: number;
  longitude: number;
  isRetrograde: boolean;
  x: number;
  y: number;
};

const CX = 300;
const CY = 300;
const ZODIAC_R = 260;
const PLANET_R = 195;
const HOUSE_NUM_R = 140;
const INNER_R = 230;

export default function ConstellationChart({
  ascendantSign,
  houses,
  planets,
}: ConstellationChartProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [hoveredPlanet, setHoveredPlanet] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Generate stars with seeded random
  const stars = useMemo(() => {
    const rng = seededRandom(ascendantSign);
    const count = 50;
    const result: { x: number; y: number; r: number; dur: number; delay: number }[] = [];
    for (let i = 0; i < count; i++) {
      result.push({
        x: rng() * 600,
        y: rng() * 600,
        r: 0.5 + rng() * 1.5,
        dur: 2 + rng() * 3,
        delay: rng() * 5,
      });
    }
    return result;
  }, [ascendantSign]);

  // Get sign index for a given sign name
  const signIndex = useCallback((sign: string) => SIGN_ORDER.indexOf(sign), []);

  // Planet positions on the wheel
  const planetPositions = useMemo(() => {
    if (!planets || planets.length === 0) return [];

    // Group planets by proximity to offset overlapping ones
    const positions = planets.map((p) => {
      const angle = lonToAngle(p.longitude);
      const pos = polarToCartesian(CX, CY, PLANET_R, angle);
      return {
        ...p,
        angle,
        cx: pos.x,
        cy: pos.y,
      };
    });

    // Spread out planets that are too close together
    const MIN_DIST = 28;
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[i].cx - positions[j].cx;
        const dy = positions[i].cy - positions[j].cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MIN_DIST) {
          // Offset radially
          const midAngle = (positions[i].angle + positions[j].angle) / 2;
          positions[i] = {
            ...positions[i],
            ...polarToCartesian(CX, CY, PLANET_R - 16, positions[i].angle),
          };
          positions[j] = {
            ...positions[j],
            ...polarToCartesian(CX, CY, PLANET_R + 16, positions[j].angle),
          };
        }
      }
    }

    return positions;
  }, [planets]);

  // Conjunction lines (planets in same house)
  const conjunctionLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const houseGroups: Record<number, typeof planetPositions> = {};
    for (const p of planetPositions) {
      if (!houseGroups[p.house]) houseGroups[p.house] = [];
      houseGroups[p.house].push(p);
    }
    for (const group of Object.values(houseGroups)) {
      if (group.length > 1) {
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            lines.push({
              x1: group[i].cx,
              y1: group[i].cy,
              x2: group[j].cx,
              y2: group[j].cy,
            });
          }
        }
      }
    }
    return lines;
  }, [planetPositions]);

  // Aspect lines for hovered planet
  const aspectLines = useMemo(() => {
    if (!hoveredPlanet || !planets) return [];
    const hovered = planetPositions.find((p) => p.name === hoveredPlanet);
    if (!hovered) return [];

    return planetPositions
      .filter((p) => p.name !== hoveredPlanet)
      .map((p) => {
        const aspect = detectAspect(hovered.longitude, p.longitude);
        if (!aspect) return null;
        return {
          x1: hovered.cx,
          y1: hovered.cy,
          x2: p.cx,
          y2: p.cy,
          color: aspect.color,
          type: aspect.type,
        };
      })
      .filter(Boolean) as { x1: number; y1: number; x2: number; y2: number; color: string; type: AspectType }[];
  }, [hoveredPlanet, planets, planetPositions]);

  const handlePlanetHover = (planetName: string, event: React.MouseEvent<SVGGElement>) => {
    const p = planets?.find((pl) => pl.name === planetName);
    if (!p || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = 600 / rect.width;
    const scaleY = 600 / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    setHoveredPlanet(planetName);
    setTooltip({
      planet: planetName,
      sign: p.sign,
      degree: p.degree_in_sign,
      house: p.house,
      longitude: p.longitude,
      isRetrograde: (p as Record<string, unknown>).is_retrograde === true,
      x,
      y,
    });
  };

  const handlePlanetLeave = () => {
    setHoveredPlanet(null);
    setTooltip(null);
  };

  // House cusps: house 1 starts at sign index of ascendant
  const ascSignIdx = signIndex(ascendantSign);

  return (
    <section className="constellation-panel">
      <motion.svg
        ref={svgRef}
        viewBox="0 0 600 600"
        className="constellation-svg"
        role="img"
        aria-label={`Constellation chart showing planetary positions for ascendant ${ascendantSign}`}
        initial="hidden"
        animate="visible"
      >
        <title>Constellation map with {ascendantSign} ascendant</title>
        <defs>
          {/* Sky background gradient */}
          <radialGradient id="cSkyGrad" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#0a1628" />
            <stop offset="100%" stopColor="#020810" />
          </radialGradient>

          {/* Center glow */}
          <radialGradient id="cCenterGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(242, 194, 108, 0.12)" />
            <stop offset="100%" stopColor="rgba(242, 194, 108, 0)" />
          </radialGradient>

          {/* Planet glow filters - one per planet color */}
          {Object.entries(PLANET_COLORS).map(([name, color]) => (
            <filter key={name} id={`cGlow-${name}`} x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
              <feFlood floodColor={color} floodOpacity="0.6" result="color" />
              <feComposite in="color" in2="blur" operator="in" result="colorBlur" />
              <feMerge>
                <feMergeNode in="colorBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ))}

          {/* Ascendant arc glow */}
          <filter id="cAscGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feFlood floodColor="#f2c26c" floodOpacity="0.3" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background */}
        <rect x="0" y="0" width="600" height="600" fill="url(#cSkyGrad)" rx="12" />

        {/* Twinkling stars */}
        <g className="constellation-stars" aria-hidden="true">
          {stars.map((star, i) => (
            <circle
              key={i}
              cx={star.x}
              cy={star.y}
              r={star.r}
              fill="white"
              className="constellation-star"
              style={{
                animationDuration: `${star.dur}s`,
                animationDelay: `${star.delay}s`,
              }}
            />
          ))}
        </g>

        {/* Zodiac ring: 12 sign arcs */}
        <motion.g
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 1, delay: 0.5 }}
        >
          {SIGN_ORDER.map((sign, i) => {
            const startAngle = i * 30 - 90;
            const endAngle = startAngle + 30;
            const element = ELEMENT_MAP[sign];
            const isAsc = sign === ascendantSign;
            const midAngle = startAngle + 15;
            const labelPos = polarToCartesian(CX, CY, ZODIAC_R + 8, midAngle);

            return (
              <g key={sign}>
                {/* Colored wedge */}
                <path
                  d={describeWedge(CX, CY, INNER_R, ZODIAC_R, startAngle, endAngle)}
                  fill={ELEMENT_COLORS[element]}
                  stroke="none"
                />
                {/* Arc border */}
                <path
                  d={describeArc(CX, CY, ZODIAC_R, startAngle, endAngle)}
                  fill="none"
                  stroke={isAsc ? "rgba(242,194,108,0.35)" : "rgba(255,255,255,0.08)"}
                  strokeWidth={isAsc ? 1.5 : 0.5}
                  strokeDasharray={isAsc ? "none" : "2 4"}
                  filter={isAsc ? "url(#cAscGlow)" : "none"}
                />
                {/* Radial boundary line */}
                {(() => {
                  const inner = polarToCartesian(CX, CY, HOUSE_NUM_R - 20, startAngle);
                  const outer = polarToCartesian(CX, CY, ZODIAC_R, startAngle);
                  return (
                    <line
                      x1={inner.x} y1={inner.y}
                      x2={outer.x} y2={outer.y}
                      stroke="rgba(255,255,255,0.05)"
                      strokeWidth="0.5"
                      strokeDasharray="2 4"
                    />
                  );
                })()}
                {/* Sign symbol label */}
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  fill={isAsc ? "rgba(242,194,108,0.9)" : "rgba(255,255,255,0.35)"}
                  fontSize="14"
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ fontFamily: "var(--font-heading), serif" }}
                >
                  {SIGN_SYMBOLS[sign]}
                </text>
              </g>
            );
          })}
        </motion.g>

        {/* House boundary lines and numbers */}
        <motion.g
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.8, delay: 0.8 }}
        >
          {houses.map((house) => {
            // House i starts at sign index = (ascSignIdx + i - 1) % 12
            const houseSignIdx = (ascSignIdx + house.house_number - 1) % 12;
            const houseStartAngle = houseSignIdx * 30 - 90;
            const houseMidAngle = houseStartAngle + 15;
            const numPos = polarToCartesian(CX, CY, HOUSE_NUM_R, houseMidAngle);

            return (
              <g key={`house-${house.house_number}`}>
                {/* House cusp radial line */}
                <line
                  x1={CX + (HOUSE_NUM_R - 20) * Math.cos(degToRad(houseStartAngle))}
                  y1={CY + (HOUSE_NUM_R - 20) * Math.sin(degToRad(houseStartAngle))}
                  x2={CX + INNER_R * Math.cos(degToRad(houseStartAngle))}
                  y2={CY + INNER_R * Math.sin(degToRad(houseStartAngle))}
                  stroke="rgba(242,194,108,0.1)"
                  strokeWidth="0.5"
                  strokeDasharray="3 6"
                />
                {/* House number */}
                <text
                  x={numPos.x}
                  y={numPos.y}
                  fill="rgba(242,194,108,0.2)"
                  fontSize="10"
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{
                    fontFamily: "var(--font-body), sans-serif",
                    letterSpacing: "0.5px",
                  }}
                >
                  {house.house_number}
                </text>
              </g>
            );
          })}
        </motion.g>

        {/* Conjunction lines (same-house planets) */}
        <motion.g
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.6, delay: 1.8 }}
        >
          {conjunctionLines.map((line, i) => (
            <line
              key={`conj-${i}`}
              x1={line.x1} y1={line.y1}
              x2={line.x2} y2={line.y2}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="0.5"
              strokeDasharray="2 4"
            />
          ))}
        </motion.g>

        {/* Aspect lines on hover */}
        <AnimatePresence>
          {aspectLines.map((line, i) => (
            <motion.line
              key={`aspect-${line.type}-${i}`}
              x1={line.x1} y1={line.y1}
              x2={line.x2} y2={line.y2}
              stroke={line.color}
              strokeWidth="1"
              strokeDasharray="4 3"
              initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.6 }}
              exit={{ opacity: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.4 }}
            />
          ))}
        </AnimatePresence>

        {/* Planet positions */}
        {planetPositions.map((p, i) => {
          const color = PLANET_COLORS[p.name] ?? "#f2c26c";
          const symbol = PLANET_SYMBOLS[p.name] ?? p.name.slice(0, 2);
          const isHovered = hoveredPlanet === p.name;

          return (
            <motion.g
              key={p.name}
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.4, delay: 1.2 + i * 0.05 }}
              onMouseEnter={(e: React.MouseEvent) => handlePlanetHover(p.name, e as unknown as React.MouseEvent<SVGGElement>)}
              onMouseLeave={handlePlanetLeave}
              style={{ cursor: "pointer" }}
            >
              {/* Glow circle */}
              <circle
                cx={p.cx}
                cy={p.cy}
                r={isHovered ? 10 : 7}
                fill={color}
                opacity={isHovered ? 0.25 : 0.12}
                filter={`url(#cGlow-${p.name})`}
                className="constellation-planet-glow"
              />
              {/* Planet dot */}
              <circle
                cx={p.cx}
                cy={p.cy}
                r={isHovered ? 5 : 4}
                fill={color}
                className="constellation-planet-dot"
                style={{
                  animationDelay: `${i * 0.3}s`,
                }}
              />
              {/* Planet symbol */}
              <text
                x={p.cx}
                y={p.cy - 12}
                fill={color}
                fontSize={isHovered ? "13" : "11"}
                textAnchor="middle"
                dominantBaseline="central"
                style={{
                  fontFamily: "var(--font-heading), serif",
                  transition: "font-size 0.2s ease",
                  pointerEvents: "none",
                }}
              >
                {symbol}
              </text>
            </motion.g>
          );
        })}

        {/* Center area */}
        <motion.g
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.8, delay: 0.3, ease: [0.23, 1, 0.32, 1] }}
        >
          <circle cx={CX} cy={CY} r="55" fill="url(#cCenterGlow)" />
          <circle
            cx={CX} cy={CY} r="53"
            fill="none"
            stroke="rgba(242,194,108,0.1)"
            strokeWidth="0.5"
          />
          <text
            x={CX} y={CY - 14}
            fill="rgba(242,194,108,0.7)"
            fontSize="8"
            textAnchor="middle"
            dominantBaseline="central"
            style={{
              textTransform: "uppercase",
              letterSpacing: "2.5px",
              fontFamily: "var(--font-body), sans-serif",
            }}
          >
            Rasi
          </text>
          <text
            x={CX} y={CY + 6}
            fill="#eef7ff"
            fontSize="15"
            fontWeight="bold"
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontFamily: "var(--font-heading), serif" }}
          >
            {SIGN_SYMBOLS[ascendantSign] ?? ""} {ascendantSign}
          </text>
          <text
            x={CX} y={CY + 24}
            fill="rgba(185,208,225,0.5)"
            fontSize="7"
            textAnchor="middle"
            dominantBaseline="central"
            style={{
              textTransform: "uppercase",
              letterSpacing: "2px",
              fontFamily: "var(--font-body), sans-serif",
            }}
          >
            Lagna
          </text>
        </motion.g>

        {/* Tooltip */}
        <AnimatePresence>
          {tooltip && (
            <motion.g
              initial={shouldReduceMotion ? false : { opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.15 }}
            >
              {(() => {
                const tx = Math.min(Math.max(tooltip.x - 80, 5), 440);
                const ty = Math.max(tooltip.y - 85, 5);
                const planetColor = PLANET_COLORS[tooltip.planet] ?? "#f2c26c";
                return (
                  <>
                    <rect
                      x={tx} y={ty}
                      width="160" height="72"
                      rx="8"
                      fill="rgba(4, 16, 28, 0.95)"
                      stroke="rgba(108, 225, 212, 0.3)"
                      strokeWidth="1"
                    />
                    <text
                      x={tx + 80} y={ty + 16}
                      fill={planetColor}
                      fontSize="13"
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="central"
                      style={{ fontFamily: "var(--font-heading), serif" }}
                    >
                      {PLANET_SYMBOLS[tooltip.planet] ?? ""} {tooltip.planet}
                      {tooltip.isRetrograde ? " (R)" : ""}
                    </text>
                    <text
                      x={tx + 80} y={ty + 34}
                      fill="#b9d0e1"
                      fontSize="11"
                      textAnchor="middle"
                      dominantBaseline="central"
                      style={{ fontFamily: "var(--font-body), sans-serif" }}
                    >
                      {SIGN_SYMBOLS[tooltip.sign] ?? ""} {tooltip.sign} {tooltip.degree.toFixed(2)}&deg;
                    </text>
                    <text
                      x={tx + 80} y={ty + 50}
                      fill="rgba(108,225,212,0.8)"
                      fontSize="10"
                      textAnchor="middle"
                      dominantBaseline="central"
                      style={{ fontFamily: "var(--font-body), sans-serif" }}
                    >
                      House {tooltip.house} &middot; {tooltip.longitude.toFixed(1)}&deg; long.
                    </text>
                  </>
                );
              })()}
            </motion.g>
          )}
        </AnimatePresence>
      </motion.svg>
    </section>
  );
}
