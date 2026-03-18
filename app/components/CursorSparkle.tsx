"use client";

import { useEffect, useRef, useCallback } from "react";

const SPARKLE_COLORS = ["#f2c26c", "#6ce1d4", "#eef7ff"];
const MAX_PARTICLES = 15;
const THROTTLE_MS = 50;
const PARTICLE_LIFETIME = 800;

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
}

export default function CursorSparkle() {
  const containerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const idCounter = useRef(0);
  const lastSpawn = useRef(0);
  const prefersReducedMotion = useRef(false);
  const isTouchDevice = useRef(false);

  const spawnParticle = useCallback((x: number, y: number) => {
    const container = containerRef.current;
    if (!container || prefersReducedMotion.current || isTouchDevice.current) return;

    const now = Date.now();
    if (now - lastSpawn.current < THROTTLE_MS) return;
    lastSpawn.current = now;

    // Enforce max particle limit
    if (particlesRef.current.length >= MAX_PARTICLES) {
      const oldest = particlesRef.current.shift();
      if (oldest) {
        const el = container.querySelector(`[data-sparkle-id="${oldest.id}"]`);
        el?.remove();
      }
    }

    const id = idCounter.current++;
    const size = 3 + Math.random() * 3; // 3-6px
    const color = SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)];

    const particle: Particle = { id, x, y, size, color };
    particlesRef.current.push(particle);

    const el = document.createElement("span");
    el.className = "sparkle-particle";
    el.dataset.sparkleId = String(id);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.backgroundColor = color;
    el.style.boxShadow = `0 0 ${size * 2}px ${color}`;
    container.appendChild(el);

    // Remove after animation completes
    setTimeout(() => {
      el.remove();
      particlesRef.current = particlesRef.current.filter((p) => p.id !== id);
    }, PARTICLE_LIFETIME);
  }, []);

  useEffect(() => {
    // Check for reduced motion preference
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotion.current = mql.matches;
    const handleMotionChange = (e: MediaQueryListEvent) => {
      prefersReducedMotion.current = e.matches;
    };
    mql.addEventListener("change", handleMotionChange);

    // Check for touch device (coarse pointer = touch/stylus)
    const touchMql = window.matchMedia("(pointer: coarse)");
    isTouchDevice.current = touchMql.matches;
    const handleTouchChange = (e: MediaQueryListEvent) => {
      isTouchDevice.current = e.matches;
    };
    touchMql.addEventListener("change", handleTouchChange);

    const handleMouseMove = (e: MouseEvent) => {
      spawnParticle(e.clientX, e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      mql.removeEventListener("change", handleMotionChange);
      touchMql.removeEventListener("change", handleTouchChange);
    };
  }, [spawnParticle]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 50,
        overflow: "hidden",
      }}
    />
  );
}
