"use client";

/* ─────────────────────────────────────────────────────────
   AuthAmbient — ambient background layer for the login page.
   Layers:
     A) CSS-only drifting nebula + starfield (radial-gradients)
     B) Slowly rotating Vedic zodiac wheel silhouette (inline SVG)
   Sits at z-index 0 behind the login glass card.
   ───────────────────────────────────────────────────────── */

import { useMemo } from "react";
import styles from "./AuthAmbient.module.css";

const CX = 300;
const CY = 300;
const R_OUTER = 290;
const R_RING = 268;
const R_SPOKE = 250;
const R_INNER = 60;
const R_TICK_OUTER = 290;
const R_TICK_INNER = 278;

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export default function AuthAmbient() {
  // Pre-compute spokes & ticks so React doesn't rebuild on every render
  const { spokes, ticks } = useMemo(() => {
    const spokeEls: React.ReactNode[] = [];
    const tickEls: React.ReactNode[] = [];
    for (let i = 0; i < 12; i++) {
      const angle = i * 30;
      const inner = polar(CX, CY, R_INNER, angle);
      const outer = polar(CX, CY, R_SPOKE, angle);
      spokeEls.push(
        <line
          key={`s${i}`}
          x1={inner.x}
          y1={inner.y}
          x2={outer.x}
          y2={outer.y}
          stroke="currentColor"
          strokeWidth="1"
        />,
      );
      // Minor tick marks every 10deg for a subtle astrological "graduation"
      for (let j = 0; j < 3; j++) {
        const tAngle = angle + j * 10;
        const tIn = polar(CX, CY, R_TICK_INNER, tAngle);
        const tOut = polar(CX, CY, R_TICK_OUTER, tAngle);
        tickEls.push(
          <line
            key={`t${i}-${j}`}
            x1={tIn.x}
            y1={tIn.y}
            x2={tOut.x}
            y2={tOut.y}
            stroke="currentColor"
            strokeWidth={j === 0 ? 1.2 : 0.6}
          />,
        );
      }
    }
    return { spokes: spokeEls, ticks: tickEls };
  }, []);

  return (
    <div className={styles.root} aria-hidden="true">
      {/* Layer A — nebula + starfield */}
      <div className={styles.nebula} />
      <div className={styles.starfield} />

      {/* Layer B — slowly rotating zodiac wheel silhouette */}
      <div className={styles.wheelWrap}>
        <svg
          className={styles.wheel}
          viewBox="0 0 600 600"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Outer boundary */}
          <circle cx={CX} cy={CY} r={R_OUTER} stroke="currentColor" strokeWidth="1" />
          {/* Decorative ring */}
          <circle cx={CX} cy={CY} r={R_RING} stroke="currentColor" strokeWidth="0.7" />
          {/* Spoke boundary */}
          <circle cx={CX} cy={CY} r={R_SPOKE} stroke="currentColor" strokeWidth="0.7" />
          {/* Inner hub */}
          <circle cx={CX} cy={CY} r={R_INNER} stroke="currentColor" strokeWidth="0.8" />
          {/* Innermost dot */}
          <circle cx={CX} cy={CY} r="3" fill="currentColor" />

          {/* 12 house spokes */}
          <g>{spokes}</g>

          {/* Graduation tick marks around the rim */}
          <g>{ticks}</g>
        </svg>
      </div>
    </div>
  );
}
