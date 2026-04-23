"use client";

import { useEffect, useRef, useCallback } from "react";
import styles from "./CosmicTrailCursor.module.css";

const TRAIL_COLORS = ["#f2c26c", "#6ce1d4", "#C89B3C", "#E8E8E8"];
const MAX_TRAIL_PARTICLES = 25;
const FADE_DELAY = 100;

interface TrailParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  birthTime: number;
  vx: number;
  vy: number;
}

export default function CosmicTrailCursor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<TrailParticle[]>([]);
  const idCounter = useRef(0);
  const mousePos = useRef({ x: 0, y: 0 });
  const lastSpawnTime = useRef(0);
  const rafRef = useRef<number | null>(null);
  const prefersReducedMotion = useRef(false);
  const isTouchDevice = useRef(false);

  const spawnTrailParticle = useCallback((x: number, y: number) => {
    const now = Date.now();
    if (now - lastSpawnTime.current < 20) return; // Throttle
    lastSpawnTime.current = now;

    const container = containerRef.current;
    if (!container) return;

    // Remove oldest if at limit
    if (particlesRef.current.length >= MAX_TRAIL_PARTICLES) {
      particlesRef.current.shift();
    }

    const id = idCounter.current++;
    const color = TRAIL_COLORS[Math.floor(Math.random() * TRAIL_COLORS.length)];
    const size = 2 + Math.random() * 4;
    
    // Add slight velocity for drift
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.3 + Math.random() * 0.5;
    
    const particle: TrailParticle = {
      id,
      x,
      y,
      size,
      color,
      birthTime: now,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    };

    particlesRef.current.push(particle);

    // Create DOM element
    const el = document.createElement("span");
    el.className = styles.trailParticle;
    el.dataset.particleId = String(id);
    el.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      box-shadow: 0 0 ${size * 2}px ${color}80;
      transform: translate(-50%, -50%);
    `;
    
    container.appendChild(el);
  }, []);

  const updateParticles = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const now = Date.now();
    const particles = particlesRef.current;
    
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      const age = now - particle.birthTime;
      
      // Apply drift
      particle.x += particle.vx;
      particle.y += particle.vy;
      
      // Fade based on age
      const lifeRatio = age / (FADE_DELAY + particle.size * 80);
      const opacity = Math.max(0, 1 - lifeRatio);
      
      const el = container.querySelector(`[data-particle-id="${particle.id}"]`) as HTMLElement;
      if (el) {
        el.style.left = `${particle.x}px`;
        el.style.top = `${particle.y}px`;
        el.style.opacity = String(opacity);
        
        // Scale down as it fades
        const scale = 0.5 + opacity * 0.5;
        el.style.transform = `translate(-50%, -50%) scale(${scale})`;
      }
      
      // Remove dead particles
      if (opacity <= 0) {
        el?.remove();
        particles.splice(i, 1);
      }
    }
    
    rafRef.current = requestAnimationFrame(updateParticles);
  }, []);

  useEffect(() => {
    // Check preferences
    const motionMql = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotion.current = motionMql.matches;
    
    const touchMql = window.matchMedia("(pointer: coarse)");
    isTouchDevice.current = touchMql.matches;

    if (prefersReducedMotion.current || isTouchDevice.current) {
      return;
    }

    // Delay startup to reduce initial page shake
    const startDelay = setTimeout(() => {
      const handleMouseMove = (e: MouseEvent) => {
        mousePos.current = { x: e.clientX, y: e.clientY };
        spawnTrailParticle(e.clientX, e.clientY);
      };

      window.addEventListener("mousemove", handleMouseMove, { passive: true });
      rafRef.current = requestAnimationFrame(updateParticles);
      
      // Store cleanup function for delayed start
      const cleanup = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
        }
        // Cleanup DOM
        const container = containerRef.current;
        if (container) {
          container.innerHTML = "";
        }
      };
      
      // Store cleanup for useEffect return
      (startDelay as any).cleanup = cleanup;
    }, 800); // 800ms delay

    return () => {
      clearTimeout(startDelay);
      // If cleanup function was stored, call it
      if ((startDelay as any).cleanup) {
        (startDelay as any).cleanup();
      }
    };
  }, [spawnTrailParticle, updateParticles]);

  return (
    <div
      ref={containerRef}
      className={styles.trailContainer}
      aria-hidden="true"
    />
  );
}
