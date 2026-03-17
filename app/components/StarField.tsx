"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  twinkleSpeed: number;
  twinklePhase: number;
  color: string;
  /** 0–1: how much this star participates in parallax (depth layer) */
  depth: number;
}

const STAR_COLORS = [
  "255, 255, 255",
  "242, 194, 108",
  "108, 225, 212",
  "200, 220, 255",
  "255, 230, 200",
];

export default function StarField() {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const starsRef    = useRef<Star[]>([]);
  const animRef     = useRef<number>(0);
  /** Current parallax offset, smoothly interpolated */
  const offsetRef   = useRef({ x: 0, y: 0 });
  /** Target parallax offset from the latest mouse event */
  const targetRef   = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    };

    const initStars = () => {
      const count  = Math.floor((canvas.width * canvas.height) / 6000);
      const capped = Math.min(count, 220);
      starsRef.current = Array.from({ length: capped }, () => ({
        x:            Math.random() * canvas.width,
        y:            Math.random() * canvas.height,
        radius:       Math.random() * 1.6 + 0.3,
        opacity:      Math.random() * 0.5 + 0.15,
        twinkleSpeed: 0.003 + Math.random() * 0.008,
        twinklePhase: Math.random() * Math.PI * 2,
        color:        STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
        depth:        Math.random(), // 0 = barely moves, 1 = full parallax
      }));
    };

    // ── Mouse parallax ───────────────────────────────────────
    const MAX_SHIFT = 20; // px at full depth

    const handleMouseMove = (e: MouseEvent) => {
      targetRef.current = {
        x: (e.clientX / window.innerWidth  - 0.5) * MAX_SHIFT,
        y: (e.clientY / window.innerHeight - 0.5) * MAX_SHIFT,
      };
    };

    window.addEventListener("mousemove", handleMouseMove);

    // ── Render loop ──────────────────────────────────────────
    const render = (time: number) => {
      // Smooth-lerp the offset towards target (ease factor 0.06)
      offsetRef.current.x += (targetRef.current.x - offsetRef.current.x) * 0.06;
      offsetRef.current.y += (targetRef.current.y - offsetRef.current.y) * 0.06;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const star of starsRef.current) {
        const flicker =
          Math.sin(time * star.twinkleSpeed + star.twinklePhase) * 0.3 + 0.7;
        const alpha = star.opacity * flicker;

        // Parallax: deeper stars move more
        const dx = offsetRef.current.x * star.depth;
        const dy = offsetRef.current.y * star.depth;
        const sx = star.x + dx;
        const sy = star.y + dy;

        ctx.beginPath();
        ctx.arc(sx, sy, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${star.color}, ${alpha})`;
        ctx.fill();

        if (star.radius > 1.1) {
          ctx.beginPath();
          ctx.arc(sx, sy, star.radius * 2.5, 0, Math.PI * 2);
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
