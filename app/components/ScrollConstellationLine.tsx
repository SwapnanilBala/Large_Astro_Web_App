"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const CONSTELLATION_POINTS = [
  { x: 20, y: 10 },
  { x: 12, y: 20 },
  { x: 28, y: 30 },
  { x: 15, y: 39 },
  { x: 25, y: 48 },
  { x: 10, y: 57 },
  { x: 30, y: 66 },
  { x: 18, y: 75 },
  { x: 26, y: 84 },
  { x: 14, y: 92 },
];

function buildPathD(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  const segments = points.map((p, i) =>
    i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
  );
  return segments.join(" ");
}

export default function ScrollConstellationLine() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, []);

  const updateScroll = useCallback(() => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight =
      document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const progress = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0;
    setScrollProgress(progress);
    rafRef.current = null;
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const onScroll = () => {
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(updateScroll);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    updateScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [prefersReducedMotion, updateScroll]);

  if (prefersReducedMotion) return null;

  const dashOffset = pathLength > 0 ? pathLength * (1 - scrollProgress) : 0;

  return (
    <svg
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        right: 20,
        width: 40,
        height: "100vh",
        pointerEvents: "none",
        zIndex: 50,
      }}
      viewBox="0 0 40 100"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="constellation-glow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="constellation-glow-active">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0.1
                    0 1 0 0 0.05
                    0 0 1 0 0
                    0 0 0 1.5 0"
            result="coloredBlur"
          />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="star-glow-gradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(242, 194, 108, 0.8)" />
          <stop offset="100%" stopColor="rgba(242, 194, 108, 0)" />
        </radialGradient>
      </defs>

      {/* Background trace (faint) so you can see the full constellation shape */}
      <path
        d={buildPathD(CONSTELLATION_POINTS)}
        fill="none"
        stroke="rgba(242, 194, 108, 0.08)"
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Animated reveal path */}
      <path
        ref={pathRef}
        d={buildPathD(CONSTELLATION_POINTS)}
        fill="none"
        stroke="rgba(242, 194, 108, 0.3)"
        strokeWidth="0.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={pathLength}
        strokeDashoffset={dashOffset}
        style={{ transition: "stroke-dashoffset 0.15s linear" }}
      />

      {/* Star dots */}
      {CONSTELLATION_POINTS.map((point, i) => {
        const pointThreshold = i / (CONSTELLATION_POINTS.length - 1);
        const isActive = scrollProgress >= pointThreshold;
        const distancePastThreshold = scrollProgress - pointThreshold;
        const glowOpacity = isActive
          ? Math.min(distancePastThreshold * 8, 1)
          : 0;

        return (
          <g key={i}>
            {/* Radial glow behind active dots */}
            {isActive && (
              <circle
                cx={point.x}
                cy={point.y}
                r="3"
                fill="url(#star-glow-gradient)"
                opacity={glowOpacity * 0.7}
              />
            )}
            {/* The dot itself */}
            <circle
              cx={point.x}
              cy={point.y}
              r={isActive ? 1.2 : 0.8}
              fill={
                isActive
                  ? "rgba(242, 194, 108, 0.9)"
                  : "rgba(242, 194, 108, 0.2)"
              }
              filter={
                isActive
                  ? "url(#constellation-glow-active)"
                  : "url(#constellation-glow)"
              }
              style={{
                transition: "fill 0.4s ease, r 0.4s ease",
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}
