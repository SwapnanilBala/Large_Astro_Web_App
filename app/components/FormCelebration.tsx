"use client";

import { useEffect, useRef } from "react";

interface FormCelebrationProps {
  isComplete: boolean;
}

const ZODIAC_SYMBOLS = [
  "\u2648", "\u2649", "\u264A", "\u264B", "\u264C", "\u264D",
  "\u264E", "\u264F", "\u2650", "\u2651", "\u2652", "\u2653",
];
const GOLD = "#f2c26c";
const AQUA = "#6ce1d4";
const PARTICLE_COUNT = 24;
const ANIMATION_DURATION_MS = 1500;

const KEYFRAMES_ID = "form-celebration-keyframes";

const KEYFRAMES_CSS = `
@keyframes fc-shockwave {
  0% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 0.8;
    border-width: 4px;
  }
  70% {
    opacity: 0.3;
    border-width: 2px;
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0;
    border-width: 0.5px;
  }
}

@keyframes fc-particle {
  0% {
    transform: translate(-50%, -50%) rotate(0deg) scale(1);
    opacity: 1;
  }
  60% {
    opacity: 0.9;
    transform: translate(-50%, -50%) rotate(var(--fc-rot)) scale(1.1);
  }
  100% {
    transform: translate(-50%, -50%) rotate(var(--fc-rot-end)) scale(0.3);
    opacity: 0;
  }
}
`;

function injectKeyframes() {
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement("style");
  style.id = KEYFRAMES_ID;
  style.textContent = KEYFRAMES_CSS;
  document.head.appendChild(style);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function FormCelebration({ isComplete }: FormCelebrationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasFiredRef = useRef(false);
  const prevCompleteRef = useRef(false);

  useEffect(() => {
    const wasComplete = prevCompleteRef.current;
    prevCompleteRef.current = isComplete;

    if (!isComplete || wasComplete || hasFiredRef.current) return;
    if (prefersReducedMotion()) return;
    if (!containerRef.current) return;

    hasFiredRef.current = true;
    const container = containerRef.current;

    injectKeyframes();

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const elements: HTMLElement[] = [];

    // --- Shockwave ring ---
    const ring = document.createElement("div");
    Object.assign(ring.style, {
      position: "absolute",
      left: `${cx}px`,
      top: `${cy}px`,
      width: `${Math.max(window.innerWidth, window.innerHeight) * 1.2}px`,
      height: `${Math.max(window.innerWidth, window.innerHeight) * 1.2}px`,
      borderRadius: "50%",
      border: `4px solid ${GOLD}`,
      boxShadow: `0 0 30px ${GOLD}55, inset 0 0 30px ${GOLD}33`,
      pointerEvents: "none",
      animation: `fc-shockwave ${ANIMATION_DURATION_MS}ms ease-out forwards`,
    });
    container.appendChild(ring);
    elements.push(ring);

    // --- Zodiac particles ---
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const baseAngle = (i / PARTICLE_COUNT) * 360;
      const angleVariance = (Math.random() - 0.5) * 30;
      const angle = baseAngle + angleVariance;
      const rad = (angle * Math.PI) / 180;
      const distance = 200 + Math.random() * 250;

      const endX = cx + Math.cos(rad) * distance;
      const endY = cy + Math.sin(rad) * distance;

      const rotation = (Math.random() - 0.5) * 360;
      const rotationEnd = rotation + (Math.random() - 0.5) * 180;
      const color = i % 2 === 0 ? GOLD : AQUA;
      const symbol = ZODIAC_SYMBOLS[i % ZODIAC_SYMBOLS.length];
      const delay = Math.random() * 100;

      const particle = document.createElement("div");
      particle.textContent = symbol;
      particle.style.setProperty("--fc-rot", `${rotation}deg`);
      particle.style.setProperty("--fc-rot-end", `${rotationEnd}deg`);
      Object.assign(particle.style, {
        position: "absolute",
        left: `${cx}px`,
        top: `${cy}px`,
        fontSize: `${18 + Math.random() * 10}px`,
        color,
        textShadow: `0 0 8px ${color}88`,
        pointerEvents: "none",
        willChange: "transform, opacity",
        animation: `fc-particle ${ANIMATION_DURATION_MS - delay}ms ease-out ${delay}ms forwards`,
      });

      // Animate position with a CSS transition by setting initial then target
      // We use a separate approach: set the position via keyframes offset
      // Instead, animate using a wrapper to handle radial movement
      const wrapper = document.createElement("div");
      Object.assign(wrapper.style, {
        position: "absolute",
        left: `${cx}px`,
        top: `${cy}px`,
        transition: `left ${ANIMATION_DURATION_MS - delay}ms ease-out ${delay}ms, top ${ANIMATION_DURATION_MS - delay}ms ease-out ${delay}ms`,
        pointerEvents: "none",
      });
      // particle is positioned at 0,0 inside wrapper
      particle.style.left = "0px";
      particle.style.top = "0px";
      wrapper.appendChild(particle);
      container.appendChild(wrapper);
      elements.push(wrapper);

      // Trigger the radial fly-out on next frame
      requestAnimationFrame(() => {
        wrapper.style.left = `${endX}px`;
        wrapper.style.top = `${endY}px`;
      });
    }

    // --- Cleanup ---
    const timer = setTimeout(() => {
      elements.forEach((el) => {
        if (el.parentNode === container) {
          container.removeChild(el);
        }
      });
    }, ANIMATION_DURATION_MS + 200);

    return () => {
      clearTimeout(timer);
      elements.forEach((el) => {
        if (el.parentNode === container) {
          container.removeChild(el);
        }
      });
    };
  }, [isComplete]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 100,
        overflow: "hidden",
      }}
    />
  );
}
