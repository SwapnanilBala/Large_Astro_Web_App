"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useAnimation, AnimatePresence } from "framer-motion";
import styles from "./OnboardingCinematic.module.css";

/* ─────────────────────────────────────────────────────────
   OnboardingCinematic — Premium intro animation
   Plays once per device on the home page.
   4.5-5s total:  stars fade in → spiral → coalesce into brand
   Click or Escape to skip at any time.
   ───────────────────────────────────────────────────────── */

const STORAGE_KEY = "lagna_onboarding_seen";
const STAR_COUNT_DESKTOP = 50;
const STAR_COUNT_MOBILE = 30;
const TOTAL_DURATION = 5000; // ms

interface Star {
  id: number;
  /** Initial scattered position (vw / vh fractions 0-1) */
  x: number;
  y: number;
  /** Size in px */
  size: number;
  /** Delay before this star appears (0-1s range) */
  fadeDelay: number;
  /** Color */
  color: string;
  /** Spiral angle offset (radians) */
  angle: number;
  /** Distance from center at start of spiral */
  radius: number;
}

function generateStars(count: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    const isGold = i % 4 === 0;
    stars.push({
      id: i,
      x: Math.random(),
      y: Math.random(),
      size: 2 + Math.random() * 2,
      fadeDelay: Math.random() * 0.8,
      color: isGold
        ? "rgba(200, 155, 60, 0.9)"
        : `rgba(255, 255, 255, ${0.5 + Math.random() * 0.5})`,
      angle: (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3,
      radius: 30 + Math.random() * 35, // % of viewport half-size
    });
  }
  return stars;
}

export default function OnboardingCinematic() {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<
    "stars-in" | "spiral" | "brand" | "tagline" | "fade-out" | "done"
  >("stars-in");
  const overlayRef = useRef<HTMLDivElement>(null);
  const timerIds = useRef<ReturnType<typeof setTimeout>[]>([]);

  const isMobile =
    typeof window !== "undefined" && window.innerWidth < 768;
  const stars = useMemo(
    () =>
      generateStars(isMobile ? STAR_COUNT_MOBILE : STAR_COUNT_DESKTOP),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /* ── Check reduced motion & localStorage ── */
  useEffect(() => {
    // Respect prefers-reduced-motion
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      return; // private browsing — skip
    }
    setVisible(true);
  }, []);

  /* ── Phase sequencer ── */
  useEffect(() => {
    if (!visible) return;

    const schedule = (fn: () => void, ms: number) => {
      const id = setTimeout(fn, ms);
      timerIds.current.push(id);
      return id;
    };

    // 0-1s:   stars fade in (already happening via CSS/framer)
    // 1s:     start spiral convergence
    schedule(() => setPhase("spiral"), 1000);
    // 2.5s:   show brand name
    schedule(() => setPhase("brand"), 2500);
    // 3.5s:   show tagline
    schedule(() => setPhase("tagline"), 3500);
    // 4.5s:   begin fade-out
    schedule(() => setPhase("fade-out"), 4500);
    // 5s:     remove overlay completely
    schedule(() => {
      setPhase("done");
      setVisible(false);
      markSeen();
    }, TOTAL_DURATION);

    return () => timerIds.current.forEach(clearTimeout);
  }, [visible]);

  const markSeen = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* noop */
    }
  };

  const skip = useCallback(() => {
    timerIds.current.forEach(clearTimeout);
    timerIds.current = [];
    setPhase("done");
    setVisible(false);
    markSeen();
  }, []);

  /* ── Keyboard escape ── */
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible, skip]);

  if (!visible && phase === "done") return null;
  if (!visible) return null;

  /* ── Compute star transforms per phase ── */
  const getStarStyle = (star: Star) => {
    const base = {
      width: star.size,
      height: star.size,
      background: star.color,
      boxShadow: `0 0 ${star.size * 3}px ${star.color}`,
    };

    if (phase === "stars-in") {
      return {
        ...base,
        left: `${star.x * 100}%`,
        top: `${star.y * 100}%`,
      };
    }

    if (phase === "spiral") {
      // Move toward center in a spiral pattern
      const spiralX = 50 + Math.cos(star.angle) * star.radius * 0.4;
      const spiralY = 50 + Math.sin(star.angle) * star.radius * 0.4;
      return {
        ...base,
        left: `${spiralX}%`,
        top: `${spiralY}%`,
      };
    }

    // brand / tagline / fade-out — stars collapse to center
    return {
      ...base,
      left: "50%",
      top: "50%",
      opacity: 0,
    };
  };

  const spiralActive = phase === "spiral";
  const brandVisible =
    phase === "brand" || phase === "tagline" || phase === "fade-out";
  const taglineVisible = phase === "tagline" || phase === "fade-out";
  const fadingOut = phase === "fade-out";

  return (
    <div
      ref={overlayRef}
      className={`${styles.overlay} ${fadingOut ? styles.fadeOut : ""}`}
      onClick={skip}
      role="presentation"
      aria-label="Onboarding intro animation. Click or press Escape to skip."
    >
      {/* ── Star field ── */}
      <div className={styles.starField}>
        {stars.map((star) => (
          <motion.div
            key={star.id}
            className={styles.star}
            initial={{
              left: `${star.x * 100}%`,
              top: `${star.y * 100}%`,
              opacity: 0,
              scale: 0.5,
              width: star.size,
              height: star.size,
            }}
            animate={{
              left:
                phase === "stars-in"
                  ? `${star.x * 100}%`
                  : phase === "spiral"
                  ? `${50 + Math.cos(star.angle) * star.radius * 0.4}%`
                  : "50%",
              top:
                phase === "stars-in"
                  ? `${star.y * 100}%`
                  : phase === "spiral"
                  ? `${50 + Math.sin(star.angle) * star.radius * 0.4}%`
                  : "50%",
              opacity:
                phase === "stars-in"
                  ? 1
                  : phase === "spiral"
                  ? 0.8
                  : 0,
              scale:
                phase === "stars-in"
                  ? 1
                  : phase === "spiral"
                  ? 1.3
                  : 0,
            }}
            transition={{
              duration:
                phase === "stars-in"
                  ? 0.6
                  : phase === "spiral"
                  ? 1.4
                  : 0.8,
              delay: phase === "stars-in" ? star.fadeDelay : 0,
              ease: "easeInOut",
            }}
            style={{
              background: star.color,
              boxShadow: `0 0 ${star.size * 3}px ${star.color}`,
            }}
          />
        ))}
      </div>

      {/* ── Brand Container ── */}
      <div className={styles.brandContainer}>
        <AnimatePresence>
          {brandVisible && (
            <motion.h1
              className={styles.brandName}
              initial={{ opacity: 0, scale: 0.7, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              Lagna Atelier
            </motion.h1>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {taglineVisible && (
            <motion.p
              className={styles.tagline}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 0.85, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              Your Cosmic Blueprint, Decoded
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Skip hint */}
      <span className={styles.skipHint}>Click or press Esc to skip</span>
    </div>
  );
}
