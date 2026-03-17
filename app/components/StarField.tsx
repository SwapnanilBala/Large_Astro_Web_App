"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  /** Current rendered position (includes gravitational pull) */
  rx: number;
  ry: number;
  radius: number;
  opacity: number;
  twinkleSpeed: number;
  twinklePhase: number;
  color: string;
  /** 0-1: how much this star participates in parallax (depth layer) */
  depth: number;
  /** Random phase offset for constellation line pulsing */
  pulsePhase: number;
}

const STAR_COLORS = [
  "255, 255, 255",
  "242, 194, 108",
  "108, 225, 212",
  "200, 220, 255",
  "255, 230, 200",
];

/** Distance threshold for constellation connections between stars */
const CONSTELLATION_DIST = 150;
/** Distance threshold for cursor interaction */
const CURSOR_DIST = 200;
/** How strongly stars are pulled toward the cursor (0-1) */
const CURSOR_PULL_STRENGTH = 0.15;
/** Base opacity for ambient constellation lines */
const LINE_OPACITY_MIN = 0.03;
const LINE_OPACITY_MAX = 0.08;
/** Opacity for cursor-proximity constellation lines */
const CURSOR_LINE_OPACITY = 0.18;
/** Pulse cycle duration in ms (3-5s range, varies per star) */
const PULSE_PERIOD_BASE = 3500;
const PULSE_PERIOD_VARIANCE = 1500;

export default function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const animRef = useRef<number>(0);
  /** Current parallax offset, smoothly interpolated */
  const offsetRef = useRef({ x: 0, y: 0 });
  /** Target parallax offset from the latest mouse event */
  const targetRef = useRef({ x: 0, y: 0 });
  /** Mouse position in canvas coordinates (null when cursor off-screen) */
  const mouseRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Pre-computed neighbor pairs (indices into starsRef.current)
    let neighborPairs: [number, number][] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    };

    const initStars = () => {
      const count = Math.floor((canvas.width * canvas.height) / 6000);
      const capped = Math.min(count, 220);
      starsRef.current = Array.from({ length: capped }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        rx: 0,
        ry: 0,
        radius: Math.random() * 1.6 + 0.3,
        opacity: Math.random() * 0.5 + 0.15,
        twinkleSpeed: 0.003 + Math.random() * 0.008,
        twinklePhase: Math.random() * Math.PI * 2,
        color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
        depth: Math.random(),
        pulsePhase: Math.random() * Math.PI * 2,
      }));

      // Pre-compute neighbor pairs to avoid O(n^2) every frame
      buildNeighborPairs();
    };

    const buildNeighborPairs = () => {
      const stars = starsRef.current;
      const pairs: [number, number][] = [];
      const distSq = CONSTELLATION_DIST * CONSTELLATION_DIST;

      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const dx = stars[i].x - stars[j].x;
          const dy = stars[i].y - stars[j].y;
          if (dx * dx + dy * dy < distSq) {
            pairs.push([i, j]);
          }
        }
      }
      neighborPairs = pairs;
    };

    // -- Mouse parallax + tracking ---------------------------------
    const MAX_SHIFT = 20;

    const handleMouseMove = (e: MouseEvent) => {
      targetRef.current = {
        x: (e.clientX / window.innerWidth - 0.5) * MAX_SHIFT,
        y: (e.clientY / window.innerHeight - 0.5) * MAX_SHIFT,
      };
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseLeave = () => {
      mouseRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    // -- Render loop -----------------------------------------------
    const render = (time: number) => {
      // Smooth-lerp the offset towards target (ease factor 0.06)
      offsetRef.current.x += (targetRef.current.x - offsetRef.current.x) * 0.06;
      offsetRef.current.y += (targetRef.current.y - offsetRef.current.y) * 0.06;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const stars = starsRef.current;
      const mouse = mouseRef.current;
      const cursorDistSq = CURSOR_DIST * CURSOR_DIST;

      // --- Phase 1: compute rendered positions (parallax + cursor pull) ---
      for (const star of stars) {
        // Parallax: deeper stars move more
        const dx = offsetRef.current.x * star.depth;
        const dy = offsetRef.current.y * star.depth;
        let sx = star.x + dx;
        let sy = star.y + dy;

        // Cursor gravitational pull
        if (mouse) {
          const cdx = mouse.x - sx;
          const cdy = mouse.y - sy;
          const cdSq = cdx * cdx + cdy * cdy;
          if (cdSq < cursorDistSq && cdSq > 1) {
            // Strength falls off linearly with distance
            const proximity = 1 - Math.sqrt(cdSq) / CURSOR_DIST;
            const pull = proximity * CURSOR_PULL_STRENGTH;
            sx += cdx * pull;
            sy += cdy * pull;
          }
        }

        star.rx = sx;
        star.ry = sy;
      }

      // --- Phase 2: draw constellation lines (ambient) ---
      ctx.lineWidth = 0.8;
      for (const [i, j] of neighborPairs) {
        const a = stars[i];
        const b = stars[j];

        // Distance between rendered positions
        const rdx = a.rx - b.rx;
        const rdy = a.ry - b.ry;
        const rDistSq = rdx * rdx + rdy * rdy;
        const maxDistSq = CONSTELLATION_DIST * CONSTELLATION_DIST;
        if (rDistSq > maxDistSq) continue; // may have drifted apart from pull

        const dist = Math.sqrt(rDistSq);
        const distFade = 1 - dist / CONSTELLATION_DIST;

        // Pulsing: average the two stars' pulse phases for a shared rhythm
        const pulseA = (PULSE_PERIOD_BASE + a.pulsePhase * PULSE_PERIOD_VARIANCE);
        const pulseB = (PULSE_PERIOD_BASE + b.pulsePhase * PULSE_PERIOD_VARIANCE);
        const avgPeriod = (pulseA + pulseB) * 0.5;
        const avgPhase = (a.pulsePhase + b.pulsePhase) * 0.5;
        const pulse = Math.sin((time / avgPeriod) * Math.PI * 2 + avgPhase) * 0.5 + 0.5;

        let opacity = LINE_OPACITY_MIN + (LINE_OPACITY_MAX - LINE_OPACITY_MIN) * pulse;
        opacity *= distFade;

        // Brighten lines near cursor
        if (mouse) {
          const midX = (a.rx + b.rx) * 0.5;
          const midY = (a.ry + b.ry) * 0.5;
          const mcdx = mouse.x - midX;
          const mcdy = mouse.y - midY;
          const mcDistSq = mcdx * mcdx + mcdy * mcdy;
          if (mcDistSq < cursorDistSq) {
            const cursorProx = 1 - Math.sqrt(mcDistSq) / CURSOR_DIST;
            opacity = Math.max(opacity, CURSOR_LINE_OPACITY * cursorProx * distFade);
          }
        }

        ctx.beginPath();
        ctx.moveTo(a.rx, a.ry);
        ctx.lineTo(b.rx, b.ry);
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.stroke();
      }

      // --- Phase 3: draw cursor-to-star connection lines ---
      if (mouse) {
        ctx.lineWidth = 0.6;
        for (const star of stars) {
          const cdx = mouse.x - star.rx;
          const cdy = mouse.y - star.ry;
          const cdSq = cdx * cdx + cdy * cdy;
          if (cdSq < cursorDistSq && cdSq > 1) {
            const dist = Math.sqrt(cdSq);
            const proximity = 1 - dist / CURSOR_DIST;
            const opacity = CURSOR_LINE_OPACITY * proximity * proximity; // quadratic falloff
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(star.rx, star.ry);
            ctx.strokeStyle = `rgba(200, 220, 255, ${opacity})`;
            ctx.stroke();
          }
        }
      }

      // --- Phase 4: draw stars (on top of lines) ---
      for (const star of stars) {
        const flicker =
          Math.sin(time * star.twinkleSpeed + star.twinklePhase) * 0.3 + 0.7;
        const alpha = star.opacity * flicker;

        ctx.beginPath();
        ctx.arc(star.rx, star.ry, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${star.color}, ${alpha})`;
        ctx.fill();

        if (star.radius > 1.1) {
          ctx.beginPath();
          ctx.arc(star.rx, star.ry, star.radius * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${star.color}, ${alpha * 0.12})`;
          ctx.fill();
        }
      }

      animRef.current = requestAnimationFrame(render);
    };

    resize();
    animRef.current = requestAnimationFrame(render);

    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="star-field-canvas"
      aria-hidden="true"
    />
  );
}
