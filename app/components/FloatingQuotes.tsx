"use client";

import { useEffect, useState } from "react";

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
}

function generateQuote(id: number): FloatingQuote {
  const text = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  const direction = Math.random() > 0.5 ? 1 : -1;
  return {
    id,
    text,
    x: Math.random() * 70 + 15,
    y: Math.random() * 70 + 15,
    duration: 20 + Math.random() * 12,
    delay: Math.random() * 4,
    size: 0.82 + Math.random() * 0.3,
    driftX: (20 + Math.random() * 30) * direction,
    driftY: -(20 + Math.random() * 40),
  };
}

export default function FloatingQuotes() {
  const [quotes, setQuotes] = useState<FloatingQuote[]>([]);

  useEffect(() => {
    const initial = Array.from({ length: 5 }, (_, i) => generateQuote(i));
    setQuotes(initial);

    let counter = initial.length;
    const interval = setInterval(() => {
      setQuotes((prev) => {
        const next = prev.slice(1);
        next.push(generateQuote(counter++));
        return next;
      });
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="floating-quotes-container" aria-hidden="true">
      {quotes.map((q) => (
        <div
          key={q.id}
          className="floating-quote"
          style={{
            left: `${q.x}%`,
            top: `${q.y}%`,
            fontSize: `${q.size}rem`,
            ["--drift-x" as string]: `${q.driftX}px`,
            ["--drift-y" as string]: `${q.driftY}px`,
            animationDuration: `${q.duration}s`,
            animationDelay: `${q.delay}s`,
          }}
        >
          {q.text}
        </div>
      ))}
    </div>
  );
}
