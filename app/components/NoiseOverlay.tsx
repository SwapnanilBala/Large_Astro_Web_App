"use client";

import { useEffect, useRef, useState } from "react";

export default function NoiseOverlay() {
  const turbulenceRef = useRef<SVGFETurbulenceElement>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mql.matches);

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  /* Slow seed cycling: swap every 2s for subtle texture drift instead of 100ms strobe */
  useEffect(() => {
    if (prefersReducedMotion) return;

    let seed = 0;
    const interval = setInterval(() => {
      if (turbulenceRef.current) {
        seed = (seed + 1) % 50;
        turbulenceRef.current.setAttribute("seed", String(seed));
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 1,
        willChange: "auto",
      }}
    >
      <svg
        style={{
          position: "absolute",
          width: 0,
          height: 0,
          overflow: "hidden",
        }}
      >
        <defs>
          <filter id="noise-overlay-filter" colorInterpolationFilters="sRGB">
            <feTurbulence
              ref={turbulenceRef}
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves={3}
              stitchTiles="stitch"
              seed={0}
            />
            {/* Fade transitions between seed changes via opacity */}
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.5" />
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          filter: "url(#noise-overlay-filter)",
          opacity: 0.025,
          mixBlendMode: "soft-light",
        }}
      />
    </div>
  );
}
