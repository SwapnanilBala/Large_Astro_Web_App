"use client";

import { useEffect, useState, useRef, useCallback } from "react";

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

const DEPTH_CONFIG: Record<DepthLayer, { sizeMultiplier: number; opacity: number; blur: number; speedMultiplier: number }> = {
  1: { sizeMultiplier: 1.1, opacity: 0.35, blur: 0, speedMultiplier: 0.7 },
  2: { sizeMultiplier: 1.0, opacity: 0.2, blur: 1, speedMultiplier: 1.0 },
  3: { sizeMultiplier: 0.85, opacity: 0.12, blur: 2, speedMultiplier: 1.4 },
};

function generateQuote(id: number): FloatingQuote {
  const text = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  const direction = Math.random() > 0.5 ? 1 : -1;
  const depth = ([1, 2, 3] as DepthLayer[])[Math.floor(Math.random() * 3)];
  const config = DEPTH_CONFIG[depth];
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

function computeEdgeBlur(xPercent: number, yPercent: number): number {
  const edgeThreshold = 15;
  let maxBlur = 0;

  // Distance from each edge as a percentage
  const distLeft = xPercent;
  const distRight = 100 - xPercent;
  const distTop = yPercent;
  const distBottom = 100 - yPercent;

  const minDist = Math.min(distLeft, distRight, distTop, distBottom);

  if (minDist < edgeThreshold) {
    // Scale from 0 to 3px as we approach the edge
    maxBlur = ((edgeThreshold - minDist) / edgeThreshold) * 3;
  }

  return maxBlur;
}

export default function FloatingQuotes() {
  const [quotes, setQuotes] = useState<FloatingQuote[]>([]);
  const [exitingQuotes, setExitingQuotes] = useState<FloatingQuote[]>([]);
  const counterRef = useRef(0);

  const rotateQuote = useCallback(() => {
    setQuotes((prev) => {
      if (prev.length === 0) return prev;
      const exiting = prev[0];
      // Move the first quote to the exiting list
      setExitingQuotes((ex) => [...ex, exiting]);
      // Remove exiting quote after 1s animation
      setTimeout(() => {
        setExitingQuotes((ex) => ex.filter((q) => q.id !== exiting.id));
      }, 1000);

      const next = prev.slice(1);
      next.push(generateQuote(counterRef.current++));
      return next;
    });
  }, []);

  useEffect(() => {
    const initial = Array.from({ length: 5 }, (_, i) => generateQuote(i));
    counterRef.current = initial.length;
    setQuotes(initial);

    const interval = setInterval(rotateQuote, 8000);
    return () => clearInterval(interval);
  }, [rotateQuote]);

  const renderQuote = (q: FloatingQuote, isExiting: boolean) => {
    const config = DEPTH_CONFIG[q.depth];
    const edgeBlur = computeEdgeBlur(q.x, q.y);
    const totalBlur = config.blur + edgeBlur;

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
          ["--depth-opacity" as string]: `${config.opacity}`,
          animationDuration: isExiting ? "1s" : `${q.duration}s`,
          animationDelay: isExiting ? "0s" : `${q.delay}s`,
          filter: totalBlur > 0 ? `blur(${totalBlur.toFixed(1)}px)` : "none",
        }}
      >
        {q.text}
      </div>
    );
  };

  return (
    <div className="floating-quotes-container" aria-hidden="true">
      {quotes.map((q) => renderQuote(q, false))}
      {exitingQuotes.map((q) => renderQuote(q, true))}
    </div>
  );
}
