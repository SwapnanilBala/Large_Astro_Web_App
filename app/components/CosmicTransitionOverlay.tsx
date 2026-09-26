"use client";

import { useEffect, useCallback, useMemo } from "react";
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

/**
 * A small seeded generator (FNV-1a over the seed, then mulberry32), so a
 * particle field is a pure function of its seed.
 *
 * The field used to come from Math.random() in an effect that then set state
 * to render it. Seeding it from the page path instead lets it be computed
 * during render -- the same on the server and in hydration, so it can render
 * from the start -- while every page still gets a pattern of its own.
 */
function seededRandom(seed: string): () => number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
  }
  let state = hash >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateParticles(seed: string): Particle[] {
  const random = seededRandom(seed);
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const angle = (Math.PI * 2 * i) / PARTICLE_COUNT;
    const scatterDist = 60 + random() * 120;
    const colors = [GOLD, AQUA, WHITE];
    return {
      id: i,
      x: 50 + (random() - 0.5) * 80,
      y: 50 + (random() - 0.5) * 80,
      size: 1.5 + random() * 2.5,
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
export default function CosmicTransitionOverlay({
  isActive,
  seed,
}: {
  isActive: boolean;
  /** What the particle field is drawn from; a new seed gives a new pattern. */
  seed: string;
}) {
  /* Kept rendered after the overlay switches off, as the state-held field
     was, so a scatter still running when `isActive` drops is not cut off.
     The particles start invisible and only the animation shows them. */
  const particles = useMemo(() => generateParticles(seed), [seed]);
  const controls = useAnimationControls();

  const runAnimation = useCallback(async () => {
    // Scatter outward
    await controls.start("scatter");
    // Reconverge
    await controls.start("converge");
  }, [controls]);

  useEffect(() => {
    if (isActive) {
      void runAnimation();
    }
  }, [isActive, particles, runAnimation]);

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
      {particles.map((p) => (
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
