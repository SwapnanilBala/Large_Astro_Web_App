"use client";

import { useEffect, useState, useMemo } from "react";

const QUOTES = [
  "The stars incline, they do not compel",
  "As above, so below",
  "The cosmos is within us",
  "We are made of starstuff",
  "The soul of the newly born baby is marked for life by the pattern of the stars",
  "A wise man shall overrule his stars",
  "The starry vault of heaven is in truth the open book of cosmic projection",
  "Follow the light of your natal star",
  "The planets speak in whispers to those who listen",
  "Every soul is destined by the stars that witnessed its birth",
  "In the dance of the planets, find the rhythm of your fate",
  "The ascendant reveals what the soul already knows",
  "Saturn teaches through patience what Jupiter grants through grace",
  "The Moon remembers what the mind forgets",
  "Through the houses of heaven, the self discovers its path",
  "Beneath every chart lies a universe waiting to speak",
  "The Nakshatras weave destiny thread by thread",
  "Where planets converge, purpose is revealed",
  "Your Lagna is the doorway to self-knowledge",
  "The Navamsha whispers what the Rashi shouts",
  "Time is the canvas; the planets are the paint",
  "In Jyotish, nothing is random \u2014 all is rhythm",
  "The Dasha unfolds what karma has written",
];

type DepthLayer = 1 | 2 | 3;

interface DepthConfig {
  sizeMultiplier: number;
  baseOpacity: number;
  blur: number;
  /** Lower speed multiplier = slower drift (foreground), higher = faster (background) */
  speedMultiplier: number;
}

const DEPTH_CONFIGS: Record<DepthLayer, DepthConfig> = {
  1: { sizeMultiplier: 1.1, baseOpacity: 0.35, blur: 0, speedMultiplier: 0.7 },
  2: { sizeMultiplier: 1.0, baseOpacity: 0.2, blur: 1, speedMultiplier: 1.0 },
  3: { sizeMultiplier: 0.85, baseOpacity: 0.12, blur: 2, speedMultiplier: 1.4 },
};

interface FloatingQuote {
  id: number;
  text: string;
  x: number;
  y: number;
  duration: number;
  delay: number;
  size: number;
  driftX: number;
  driftY: number;
  depth: DepthLayer;
}

/**
 * Calculate extra blur for quotes near viewport edges.
 * Returns additional blur in px (0 if not near edge).
 */
function getEdgeBlur(x: number, y: number): number {
  const edgeThreshold = 15; // percentage from edge
  let maxProximity = 0;

  // Distance from each edge as a fraction of the threshold (1 = at edge, 0 = at threshold boundary)
  const proximities = [
    x < edgeThreshold ? 1 - x / edgeThreshold : 0,           // left
    x > 100 - edgeThreshold ? 1 - (100 - x) / edgeThreshold : 0, // right
    y < edgeThreshold ? 1 - y / edgeThreshold : 0,           // top
    y > 100 - edgeThreshold ? 1 - (100 - y) / edgeThreshold : 0, // bottom
  ];

  maxProximity = Math.max(...proximities);
  // Up to 3px additional blur at the very edge
  return maxProximity * 3;
}

function generateQuote(id: number): FloatingQuote {
  const text = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  const direction = Math.random() > 0.5 ? 1 : -1;
  const depth = ([1, 2, 3] as DepthLayer[])[Math.floor(Math.random() * 3)];
  const config = DEPTH_CONFIGS[depth];

  const baseDuration = 20 + Math.random() * 12;

  return {
    id,
    text,
    x: Math.random() * 70 + 15,
    y: Math.random() * 70 + 15,
    duration: baseDuration / config.speedMultiplier,
    delay: Math.random() * 4,
    size: (0.82 + Math.random() * 0.3) * config.sizeMultiplier,
    driftX: (20 + Math.random() * 30) * direction,
    driftY: -(20 + Math.random() * 40),
    depth,
  };
}

export default function FloatingQuotes() {
  const [quotes, setQuotes] = useState<FloatingQuote[]>([]);
  const [exitingIds, setExitingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const initial = Array.from({ length: 5 }, (_, i) => generateQuote(i));
    setQuotes(initial);

    let counter = initial.length;
    const interval = setInterval(() => {
      setQuotes((prev) => {
        // Mark the oldest quote for exit
        const oldestId = prev[0]?.id;
        if (oldestId !== undefined) {
          setExitingIds((ids) => new Set(ids).add(oldestId));
        }

        // After the fade-out duration, actually remove it
        setTimeout(() => {
          setExitingIds((ids) => {
            const next = new Set(ids);
            next.delete(oldestId);
            return next;
          });
        }, 1000);

        const next = prev.slice(1);
        next.push(generateQuote(counter++));
        return next;
      });
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="floating-quotes-container" aria-hidden="true">
      {quotes.map((q) => {
        const config = DEPTH_CONFIGS[q.depth];
        const edgeBlur = getEdgeBlur(q.x, q.y);
        const totalBlur = config.blur + edgeBlur;
        const isExiting = exitingIds.has(q.id);

        return (
          <div
            key={q.id}
            className={`floating-quote floating-quote--depth-${q.depth}${isExiting ? " floating-quote--exiting" : ""}`}
            style={{
              left: `${q.x}%`,
              top: `${q.y}%`,
              fontSize: `${q.size}rem`,
              ["--drift-x" as string]: `${q.driftX}px`,
              ["--drift-y" as string]: `${q.driftY}px`,
              ["--depth-opacity" as string]: config.baseOpacity,
              animationDuration: `${q.duration}s`,
              animationDelay: `${q.delay}s`,
              filter: totalBlur > 0 ? `blur(${totalBlur}px)` : "none",
            }}
          >
            {q.text}
          </div>
        );
      })}
    </div>
  );
}
