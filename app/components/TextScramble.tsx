"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const ASTRO_GLYPHS = "☿♀♁♂♃♄♅♆♇☉☽★✦✧⚹⚳⚴⚵☊☋♈♉♊♋♌♍♎♏♐♑♒♓";

function getRandomGlyph(): string {
  return ASTRO_GLYPHS[Math.floor(Math.random() * ASTRO_GLYPHS.length)];
}

function getPrefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface TextScrambleOptions {
  duration?: number;
  staggerPerChar?: number;
}

export function useTextScramble(
  text: string,
  isActive: boolean,
  options?: TextScrambleOptions
): string {
  const { duration = 1200, staggerPerChar = 40 } = options ?? {};

  const [scrambledText, setScrambledText] = useState(text);
  const hasStarted = useRef(false);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const animate = useCallback(
    (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const chars = text.split("");
      const result: string[] = [];

      let allResolved = true;

      for (let i = 0; i < chars.length; i++) {
        const charResolveTime = staggerPerChar * i;
        const charDuration = duration - charResolveTime;
        const charElapsed = elapsed - charResolveTime;

        if (chars[i] === " ") {
          result.push(" ");
          continue;
        }

        if (charElapsed >= charDuration) {
          // This character has fully resolved
          result.push(chars[i]);
        } else if (charElapsed < 0) {
          // This character hasn't started scrambling yet
          result.push(chars[i]); // Keep original text
          allResolved = false;
        } else {
          // This character is still scrambling
          result.push(getRandomGlyph());
          allResolved = false;
        }
      }

      setScrambledText(result.join(""));

      if (!allResolved) {
        rafRef.current = requestAnimationFrame(animate);
      }
    },
    [text, duration, staggerPerChar]
  );

  useEffect(() => {
    // Respect reduced motion preference
    if (getPrefersReducedMotion()) {
      setScrambledText(text);
      return;
    }

    if (!isActive) {
      setScrambledText(text);
      return;
    }

    // Only scramble if not already started
    if (hasStarted.current) {
      setScrambledText(text);
      return;
    }
    
    hasStarted.current = true;
    
    // Start with actual text, then scramble briefly
    setScrambledText(text);
    
    // Brief delay before scrambling starts
    setTimeout(() => {
      startTimeRef.current = null;
      rafRef.current = requestAnimationFrame(animate);
    }, 300);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [text, isActive, animate]);

  return scrambledText;
}

export default useTextScramble;
