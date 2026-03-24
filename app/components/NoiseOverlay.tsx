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

  useEffect(() => {
    if (prefersReducedMotion) return;

    let seed = 0;
    const interval = setInterval(() => {
      if (turbulenceRef.current) {
        seed = (seed + 1) % 100;
        turbulenceRef.current.setAttribute("seed", String(seed));
      }
    }, 100);

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
          <filter id="noise-overlay-filter">
            <feTurbulence
              ref={turbulenceRef}
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves={3}
              stitchTiles="stitch"
              seed={0}
            />
          </filter>
        </defs>
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          filter: "url(#noise-overlay-filter)",
          opacity: 0.035,
          mixBlendMode: "overlay",
        }}
      />
    </div>
  );
}
