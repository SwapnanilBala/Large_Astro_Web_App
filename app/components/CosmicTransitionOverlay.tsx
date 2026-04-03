"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion, useAnimationControls } from "framer-motion";

const PARTICLE_COUNT = 28;
const GOLD = "rgba(200, 155, 60, 0.7)";
const AQUA = "rgba(26, 123, 110, 0.6)";
const WHITE = "rgba(255, 255, 255, 0.5)";

type Particle = {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  scatterX: number;
  scatterY: number;
  delay: number;
};

function generateParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const angle = (Math.PI * 2 * i) / PARTICLE_COUNT;
    const scatterDist = 60 + Math.random() * 120;
    const colors = [GOLD, AQUA, WHITE];
    return {
      id: i,
      x: 50 + (Math.random() - 0.5) * 80,
      y: 50 + (Math.random() - 0.5) * 80,
      size: 1.5 + Math.random() * 2.5,
      color: colors[i % 3],
      scatterX: Math.cos(angle) * scatterDist,
      scatterY: Math.sin(angle) * scatterDist,
      delay: (i * 0.012),
    };
  });
}

/**
 * A cosmic star/particle overlay that briefly scatters and reconverges
 * during page transitions. Renders as a fixed overlay with pointer-events: none.
 */
export default function CosmicTransitionOverlay({ isActive }: { isActive: boolean }) {
  const particlesRef = useRef<Particle[]>(generateParticles());
  const controls = useAnimationControls();

  const runAnimation = useCallback(async () => {
    // Scatter outward
    await controls.start("scatter");
    // Reconverge
    await controls.start("converge");
  }, [controls]);

  useEffect(() => {
    if (isActive) {
      particlesRef.current = generateParticles();
      runAnimation();
    }
  }, [isActive, runAnimation]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
        overflow: "hidden",
      }}
    >
      {particlesRef.current.map((p) => (
        <motion.span
          key={p.id}
          initial={{
            x: `${p.x}vw`,
            y: `${p.y}vh`,
            opacity: 0,
            scale: 0,
          }}
          animate={controls}
          variants={{
            scatter: {
              x: `calc(${p.x}vw + ${p.scatterX}px)`,
              y: `calc(${p.y}vh + ${p.scatterY}px)`,
              opacity: [0, 0.9, 0.7],
              scale: [0, 1.4, 1],
              transition: {
                duration: 0.25,
                delay: p.delay,
                ease: "easeOut",
              },
            },
            converge: {
              x: `${p.x}vw`,
              y: `${p.y}vh`,
              opacity: [0.7, 0.3, 0],
              scale: [1, 0.6, 0],
              transition: {
                duration: 0.2,
                delay: p.delay * 0.5,
                ease: "easeIn",
              },
            },
          }}
          style={{
            position: "absolute",
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: p.color,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
          }}
        />
      ))}
    </div>
  );
}
