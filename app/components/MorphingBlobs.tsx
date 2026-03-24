"use client";

import { useEffect, useRef, useState } from "react";

export default function MorphingBlobs() {
  const turbRef1 = useRef<SVGFETurbulenceElement>(null);
  const turbRef2 = useRef<SVGFETurbulenceElement>(null);
  const turbRef3 = useRef<SVGFETurbulenceElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;

    let frameId: number;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = (now - startTime) / 1000;

      // Each blob oscillates at a different speed and phase for organic variety
      const freq1 = 0.006 + 0.002 * Math.sin(elapsed * 0.3);
      const freq2 = 0.005 + 0.002 * Math.sin(elapsed * 0.2 + 1.5);
      const freq3 = 0.007 + 0.002 * Math.sin(elapsed * 0.25 + 3.0);

      if (turbRef1.current) {
        turbRef1.current.setAttribute(
          "baseFrequency",
          `${freq1} ${freq1 * 0.8}`
        );
      }
      if (turbRef2.current) {
        turbRef2.current.setAttribute(
          "baseFrequency",
          `${freq2} ${freq2 * 0.9}`
        );
      }
      if (turbRef3.current) {
        turbRef3.current.setAttribute(
          "baseFrequency",
          `${freq3} ${freq3 * 0.7}`
        );
      }

      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [reducedMotion]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", top: 0, left: 0 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Filter for Blob 1 — Aqua/teal, left side */}
          <filter
            id="morphBlob1"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feTurbulence
              ref={turbRef1}
              type="fractalNoise"
              baseFrequency="0.006 0.005"
              numOctaves={3}
              seed={1}
              result="turbulence"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="turbulence"
              scale={120}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>

          {/* Filter for Blob 2 — Gold/amber, right side */}
          <filter
            id="morphBlob2"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feTurbulence
              ref={turbRef2}
              type="fractalNoise"
              baseFrequency="0.005 0.0045"
              numOctaves={3}
              seed={42}
              result="turbulence"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="turbulence"
              scale={100}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>

          {/* Filter for Blob 3 — Purple/violet, center */}
          <filter
            id="morphBlob3"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feTurbulence
              ref={turbRef3}
              type="fractalNoise"
              baseFrequency="0.007 0.005"
              numOctaves={3}
              seed={99}
              result="turbulence"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="turbulence"
              scale={90}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>

        {/* Blob 1 — Aqua/teal, positioned left */}
        <ellipse
          cx="25%"
          cy="40%"
          rx="320"
          ry="280"
          fill="rgba(108, 225, 212, 0.12)"
          filter="url(#morphBlob1)"
        />

        {/* Blob 2 — Gold/amber, positioned right */}
        <ellipse
          cx="75%"
          cy="35%"
          rx="300"
          ry="260"
          fill="rgba(242, 194, 108, 0.10)"
          filter="url(#morphBlob2)"
        />

        {/* Blob 3 — Purple/violet, positioned center */}
        <ellipse
          cx="50%"
          cy="65%"
          rx="280"
          ry="240"
          fill="rgba(180, 120, 220, 0.08)"
          filter="url(#morphBlob3)"
        />
      </svg>
    </div>
  );
}
