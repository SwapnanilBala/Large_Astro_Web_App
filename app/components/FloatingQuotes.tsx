"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "@/lib/i18n-context";

const QUOTE_COUNT = 23;

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

function makeQuote(id: number, quoteTexts: string[]): FloatingQuote {
  const text = quoteTexts[Math.floor(Math.random() * quoteTexts.length)];
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
  const { t } = useTranslation();
  const [quotes, setQuotes] = useState<FloatingQuote[]>([]);
  const [exitingIds, setExitingIds] = useState<Set<number>>(new Set());

  /* ── Load translated quotes ── */
  const quoteTexts = useMemo(() => {
    const texts: string[] = [];
    for (let i = 1; i <= QUOTE_COUNT; i++) {
      const key = `quotes.${i}`;
      const val = t(key);
      if (val !== key) texts.push(val);  // t() returns the key when missing
    }
    return texts.length > 0 ? texts : ["The stars incline, they do not compel"];
  }, [t]);

  /* Stable ref so the interval callback always sees the latest quoteTexts */
  const quoteTextsRef = useRef(quoteTexts);
  quoteTextsRef.current = quoteTexts;

  const generateQuote = useCallback(
    (id: number) => makeQuote(id, quoteTextsRef.current),
    [],
  );

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
  }, [generateQuote]);

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
            <span
              style={{
                display: "inline-block",
                background:
                  q.depth === 1
                    ? "rgba(255, 255, 255, 0.06)"
                    : q.depth === 2
                      ? "rgba(255, 255, 255, 0.04)"
                      : "rgba(255, 255, 255, 0.02)",
                backdropFilter:
                  q.depth === 1
                    ? "blur(10px)"
                    : q.depth === 2
                      ? "blur(8px)"
                      : "blur(6px)",
                WebkitBackdropFilter:
                  q.depth === 1
                    ? "blur(10px)"
                    : q.depth === 2
                      ? "blur(8px)"
                      : "blur(6px)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "20px",
                padding: "0.5rem 1rem",
                boxShadow:
                  "0 2px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
              }}
            >
              {q.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
