"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { HousePlacement, PlanetPosition } from "@/lib/astro-types";
import ConstellationChart from "./constellation-chart";
import chartStyles from "../insights.module.css";

type LagnaChartProps = {
  ascendantSign: string;
  houses: HousePlacement[];
  planets?: PlanetPosition[];
  currentDashaLord?: string;
};

const PLANET_GLYPHS: Record<string, string> = {
  Sun: "☉",
  Moon: "☽",
  Mercury: "☿",
  Venus: "♀",
  Mars: "♂",
  Jupiter: "♃",
  Saturn: "♄",
  Uranus: "♅",
  Neptune: "♆",
  Pluto: "♇",
  Rahu: "☊",
  Ketu: "☋",
  Ascendant: "Asc",
};

const PLANET_COLORS: Record<string, string> = {
  Sun: "#f5c842",
  Moon: "#c0c0c0",
  Mars: "#ff6b5b",
  Mercury: "#6ce1a0",
  Jupiter: "#ffd966",
  Venus: "#f0a0c8",
  Saturn: "#7eaadf",
  Uranus: "#a0d8ef",
  Neptune: "#8888dd",
  Pluto: "#b07090",
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

/*
  North Indian Diamond Chart Layout
  ─────────────────────────────────
  The square is cut by both diagonals and by the diamond joining the midpoints
  of the four sides, which yields exactly 12 regions: four rhombi at top,
  left, bottom and right centre, and eight corner triangles.

  House 1 (Ascendant) is the top centre rhombus and the houses run
  counter-clockwise, so the four kendras — 1, 4, 7, 10 — land on the four
  rhombi (top, left, bottom, right) and the remaining eight houses fill the
  corner triangles in order. The earlier table numbered the rhombi 1, 3, 5, 7
  and swept the corner triangles up afterwards, which put every house except
  the first in the wrong region.

  cx/cy is the centroid of each region, used to anchor its labels.
  Coordinates are in the 600x600 viewBox.
*/
export const HOUSE_REGIONS: Record<
  number,
  { cx: number; cy: number; path: string }
> = {
  // Top centre rhombus = House 1 (Ascendant)
  1: {
    cx: 300,
    cy: 150,
    path: "M 300,0 L 450,150 L 300,300 L 150,150 Z",
  },
  // Top-left triangle = House 2
  2: {
    cx: 150,
    cy: 50,
    path: "M 0,0 L 300,0 L 150,150 Z",
  },
  // Left-top triangle = House 3
  3: {
    cx: 50,
    cy: 150,
    path: "M 0,0 L 150,150 L 0,300 Z",
  },
  // Left centre rhombus = House 4
  4: {
    cx: 150,
    cy: 300,
    path: "M 0,300 L 150,150 L 300,300 L 150,450 Z",
  },
  // Left-bottom triangle = House 5
  5: {
    cx: 50,
    cy: 450,
    path: "M 0,300 L 150,450 L 0,600 Z",
  },
  // Bottom-left triangle = House 6
  6: {
    cx: 150,
    cy: 550,
    path: "M 0,600 L 150,450 L 300,600 Z",
  },
  // Bottom centre rhombus = House 7
  7: {
    cx: 300,
    cy: 450,
    path: "M 150,450 L 300,300 L 450,450 L 300,600 Z",
  },
  // Bottom-right triangle = House 8
  8: {
    cx: 450,
    cy: 550,
    path: "M 300,600 L 450,450 L 600,600 Z",
  },
  // Right-bottom triangle = House 9
  9: {
    cx: 550,
    cy: 450,
    path: "M 600,300 L 450,450 L 600,600 Z",
  },
  // Right centre rhombus = House 10
  10: {
    cx: 450,
    cy: 300,
    path: "M 600,300 L 450,150 L 300,300 L 450,450 Z",
  },
  // Right-top triangle = House 11
  11: {
    cx: 550,
    cy: 150,
    path: "M 600,0 L 450,150 L 600,300 Z",
  },
  // Top-right triangle = House 12
  12: {
    cx: 450,
    cy: 50,
    path: "M 300,0 L 600,0 L 450,150 Z",
  },
};

type TooltipData = {
  planet: string;
  sign: string;
  degree: number;
  house: number;
  x: number;
  y: number;
};

function getPlanetGlyph(name: string): string {
  return PLANET_GLYPHS[name] ?? name.slice(0, 3);
}

type ChartView = "diamond" | "constellation";

const STORAGE_KEY = "lagna-chart-view";

export default function LagnaChart({
  ascendantSign,
  houses,
  planets,
  currentDashaLord,
}: LagnaChartProps) {
  const [chartView, setChartView] = useState<ChartView>("diamond");
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [hoveredHouse, setHoveredHouse] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Load saved preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "diamond" || saved === "constellation") {
        setChartView(saved);
      }
    } catch {}
  }, []);

  const switchView = (view: ChartView) => {
    setChartView(view);
    try {
      localStorage.setItem(STORAGE_KEY, view);
    } catch {}
  };

  const findPlanetData = (planetName: string): PlanetPosition | undefined => {
    return planets?.find((p) => p.name === planetName);
  };

  const handlePlanetHover = (
    planetName: string,
    houseNumber: number,
    event: React.MouseEvent<SVGTextElement>
  ) => {
    const data = findPlanetData(planetName);
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const clientX = event.clientX - rect.left;
    const clientY = event.clientY - rect.top;
    const scaleX = 600 / rect.width;
    const scaleY = 600 / rect.height;

    setTooltip({
      planet: planetName,
      sign: data?.sign ?? "",
      degree: data?.degree_in_sign ?? 0,
      house: data?.house ?? houseNumber,
      x: clientX * scaleX,
      y: clientY * scaleY,
    });
  };

  const handlePlanetLeave = () => {
    setTooltip(null);
  };

  // Animation variants
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const noMotion: any = { hidden: { opacity: 1 }, visible: { opacity: 1 } };

  const containerVariants = shouldReduceMotion
    ? noMotion
    : {
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: 0.04, delayChildren: 0.2 },
        },
      };

  const houseVariants = shouldReduceMotion
    ? noMotion
    : {
        hidden: { opacity: 0, scale: 0.92 },
        visible: {
          opacity: 1,
          scale: 1,
          transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] },
        },
      };

  const planetVariants = shouldReduceMotion
    ? noMotion
    : {
        hidden: { opacity: 0, y: 8 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.4, ease: "easeOut" },
        },
      };

  const centerVariants = shouldReduceMotion
    ? noMotion
    : {
        hidden: { opacity: 0, scale: 0.6 },
        visible: {
          opacity: 1,
          scale: 1,
          transition: { duration: 0.8, ease: [0.23, 1, 0.32, 1], delay: 0.5 },
        },
      };

  return (
    <div className="constellation-chart-toggle-wrap">
      {/* View toggle */}
      <div className="constellation-chart-toggle">
        <button
          data-active={chartView === "diamond"}
          onClick={() => switchView("diamond")}
          title="North Indian Diamond chart"
        >
          ◇ Diamond
        </button>
        <button
          data-active={chartView === "constellation"}
          onClick={() => switchView("constellation")}
          title="Constellation Map view"
        >
          ✦ Constellation
        </button>
      </div>

      <AnimatePresence mode="wait">
        {chartView === "constellation" ? (
          <motion.div
            key="constellation"
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3 }}
          >
            <ConstellationChart
              ascendantSign={ascendantSign}
              houses={houses}
              planets={planets}
            />
          </motion.div>
        ) : (
    <motion.div
      key="diamond"
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3 }}
    >
    <section className={`lagna-panel ${chartStyles.chartCard}`}>
      <motion.svg
        ref={svgRef}
        viewBox="0 0 600 600"
        className="lagna-svg lagna-svg--interactive"
        role="img"
        aria-label={`Birth chart showing planetary positions in 12 houses for ascendant ${ascendantSign}`}
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <title>Rasi birth chart with {ascendantSign} ascendant showing planetary house placements</title>
        <defs>
          <style>{`
            @keyframes dashaLordPulse {
              0%, 100% { text-shadow: 0 0 4px currentColor; opacity: 1; }
              50% { text-shadow: 0 0 12px currentColor, 0 0 24px currentColor; opacity: 0.85; }
            }
            .dasha-lord-glyph {
              animation: dashaLordPulse 2s ease-in-out infinite;
            }
          `}</style>
          {/* Glow filter for ascendant house */}
          <filter id="ascGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Glow filter for hovered planet */}
          <filter
            id="planetGlow"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="3"
              result="blur"
            />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Gradient for outer border */}
          <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(242, 194, 108, 0.5)" />
            <stop offset="50%" stopColor="rgba(108, 225, 212, 0.4)" />
            <stop offset="100%" stopColor="rgba(242, 194, 108, 0.5)" />
          </linearGradient>

          {/* Radial gradient for center */}
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(242, 194, 108, 0.15)" />
            <stop offset="100%" stopColor="rgba(4, 20, 32, 0)" />
          </radialGradient>

          {/* House highlight gradient */}
          <linearGradient
            id="houseHighlight"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="rgba(108, 225, 212, 0.12)" />
            <stop offset="100%" stopColor="rgba(242, 194, 108, 0.08)" />
          </linearGradient>
        </defs>

        {/* Background fill */}
        <rect
          x="0"
          y="0"
          width="600"
          height="600"
          fill="rgba(2, 10, 18, 0.9)"
          rx="8"
          aria-hidden="true"
        />

        {/* Outer border with gradient */}
        <rect
          x="1"
          y="1"
          width="598"
          height="598"
          fill="none"
          stroke="url(#borderGrad)"
          strokeWidth="2"
          rx="8"
          aria-hidden="true"
        />

        {/* Structural lines - outer box diagonals */}
        <g aria-hidden="true">
          <motion.line
            x1="0"
            y1="0"
            x2="600"
            y2="600"
            stroke="rgba(242, 194, 108, 0.18)"
            strokeWidth="1"
            variants={houseVariants}
          />
          <motion.line
            x1="600"
            y1="0"
            x2="0"
            y2="600"
            stroke="rgba(242, 194, 108, 0.18)"
            strokeWidth="1"
            variants={houseVariants}
          />

          {/* Inner diamond */}
          <motion.polygon
            points="300,0 600,300 300,600 0,300"
            fill="none"
            stroke="rgba(108, 225, 212, 0.25)"
            strokeWidth="1.5"
            variants={houseVariants}
          />

          {/* Horizontal and vertical midlines */}
          <motion.line
            x1="0"
            y1="300"
            x2="600"
            y2="300"
            stroke="rgba(242, 194, 108, 0.12)"
            strokeWidth="0.5"
            variants={houseVariants}
          />
          <motion.line
            x1="300"
            y1="0"
            x2="300"
            y2="600"
            stroke="rgba(242, 194, 108, 0.12)"
            strokeWidth="0.5"
            variants={houseVariants}
          />
        </g>

        {/* House regions with hover detection */}
        {houses.map((house) => {
          const region = HOUSE_REGIONS[house.house_number];
          if (!region) return null;

          const isAscendant = house.house_number === 1;
          const isHovered = hoveredHouse === house.house_number;

          return (
            <motion.g key={`house-region-${house.house_number}`} variants={houseVariants}>
              {/* Invisible hit area for hover */}
              <path
                d={region.path}
                fill={
                  isAscendant
                    ? "rgba(242, 194, 108, 0.06)"
                    : isHovered
                    ? "rgba(108, 225, 212, 0.04)"
                    : "transparent"
                }
                stroke="none"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredHouse(house.house_number)}
                onMouseLeave={() => setHoveredHouse(null)}
              />

              {/* Ascendant highlight border */}
              {isAscendant && (
                <path
                  d={region.path}
                  fill="none"
                  stroke="rgba(242, 194, 108, 0.35)"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  filter="url(#ascGlow)"
                />
              )}

              {/* House number label */}
              <text
                x={region.cx}
                y={region.cy - (house.planets.length > 0 ? 20 : 5)}
                fill={
                  isAscendant
                    ? "rgba(242, 194, 108, 0.9)"
                    : "rgba(108, 225, 212, 0.5)"
                }
                fontSize="10"
                textAnchor="middle"
                dominantBaseline="central"
                style={{
                  fontFamily: "var(--font-body), sans-serif",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  pointerEvents: "none",
                }}
              >
                {house.house_number}
              </text>

              {/* Sign label */}
              <text
                x={region.cx}
                y={region.cy - (house.planets.length > 0 ? 8 : 7) + (house.planets.length > 0 ? 0 : 12)}
                fill={
                  isAscendant
                    ? "rgba(242, 194, 108, 0.7)"
                    : "rgba(185, 208, 225, 0.55)"
                }
                fontSize="11"
                textAnchor="middle"
                dominantBaseline="central"
                style={{
                  fontFamily: "var(--font-display), serif",
                  pointerEvents: "none",
                }}
              >
                {SIGN_SYMBOLS[house.sign] ?? ""} {house.sign}
              </text>

              {/* Planet symbols with individual hover */}
              {house.planets.length > 0 && (
                <g>
                  {house.planets.map((planetName, pi) => {
                    const totalPlanets = house.planets.length;
                    const spacing = Math.min(32, 100 / totalPlanets);
                    const startX =
                      region.cx - ((totalPlanets - 1) * spacing) / 2;
                    const px = startX + pi * spacing;
                    const py = region.cy + 14;
                    const color = PLANET_COLORS[planetName] ?? "#f2c26c";
                    const isTooltipPlanet = tooltip?.planet === planetName;
                    const planetData = findPlanetData(planetName);
                    const planetAriaLabel = planetData
                      ? `${planetName} in ${planetData.sign} at ${planetData.degree_in_sign.toFixed(1)} degrees in house ${house.house_number}`
                      : `${planetName} in house ${house.house_number}`;

                    const isDashaLord =
                      currentDashaLord != null &&
                      planetName === currentDashaLord;

                    return (
                      <motion.text
                        key={`${house.house_number}-${planetName}`}
                        x={px}
                        y={py}
                        fill={color}
                        textAnchor="middle"
                        dominantBaseline="central"
                        aria-label={planetAriaLabel}
                        role="img"
                        className={isDashaLord ? "dasha-lord-glyph" : undefined}
                        style={{
                          cursor: "pointer",
                          fontSize: isTooltipPlanet ? "22px" : "20px",
                          transition: "font-size 0.2s ease",
                          filter: isTooltipPlanet
                            ? "url(#planetGlow)"
                            : "none",
                        }}
                        variants={planetVariants}
                        onMouseEnter={(e) =>
                          handlePlanetHover(
                            planetName,
                            house.house_number,
                            e as unknown as React.MouseEvent<SVGTextElement>
                          )
                        }
                        onMouseLeave={handlePlanetLeave}
                      >
                        {getPlanetGlyph(planetName)}
                      </motion.text>
                    );
                  })}
                </g>
              )}
            </motion.g>
          );
        })}

        {/* Center decoration */}
        <motion.g variants={centerVariants} aria-hidden="true">
          <circle cx="300" cy="300" r="60" fill="url(#centerGlow)" />
          <circle
            cx="300"
            cy="300"
            r="58"
            fill="none"
            stroke="rgba(242, 194, 108, 0.15)"
            strokeWidth="0.5"
          />

          <text
            x="300"
            y="275"
            fill="rgba(242, 194, 108, 0.85)"
            fontSize="9"
            textAnchor="middle"
            dominantBaseline="central"
            style={{
              textTransform: "uppercase",
              letterSpacing: "3px",
              fontWeight: 600,
              fontFamily: "var(--font-body), sans-serif",
            }}
          >
            Rasi Chart
          </text>

          <line
            x1="268"
            y1="286"
            x2="332"
            y2="286"
            stroke="rgba(242, 194, 108, 0.2)"
            strokeWidth="0.5"
          />

          <text
            x="300"
            y="303"
            fill="#eef7ff"
            fontSize="18"
            fontWeight="bold"
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            {SIGN_SYMBOLS[ascendantSign] ?? ""} {ascendantSign}
          </text>

          <text
            x="300"
            y="325"
            fill="#b9d0e1"
            fontSize="9"
            textAnchor="middle"
            dominantBaseline="central"
            style={{
              textTransform: "uppercase",
              letterSpacing: "3px",
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
              <rect
                x={Math.min(tooltip.x - 70, 460)}
                y={Math.max(tooltip.y - 70, 5)}
                width="140"
                height="60"
                rx="8"
                fill="rgba(4, 20, 32, 0.95)"
                stroke="rgba(108, 225, 212, 0.35)"
                strokeWidth="1"
              />
              <text
                x={Math.min(tooltip.x, 530)}
                y={Math.max(tooltip.y - 50, 25)}
                fill={PLANET_COLORS[tooltip.planet] ?? "#f2c26c"}
                fontSize="14"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="central"
                style={{ fontFamily: "var(--font-display), serif" }}
              >
                {getPlanetGlyph(tooltip.planet)} {tooltip.planet}
              </text>
              <text
                x={Math.min(tooltip.x, 530)}
                y={Math.max(tooltip.y - 32, 43)}
                fill="#b9d0e1"
                fontSize="11"
                textAnchor="middle"
                dominantBaseline="central"
                style={{ fontFamily: "var(--font-body), sans-serif" }}
              >
                {tooltip.sign} {tooltip.degree.toFixed(2)}&deg;
              </text>
              <text
                x={Math.min(tooltip.x, 530)}
                y={Math.max(tooltip.y - 18, 57)}
                fill="rgba(108, 225, 212, 0.8)"
                fontSize="10"
                textAnchor="middle"
                dominantBaseline="central"
                style={{ fontFamily: "var(--font-body), sans-serif" }}
              >
                House {tooltip.house}
              </text>
            </motion.g>
          )}
        </AnimatePresence>
      </motion.svg>
    </section>
    </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
