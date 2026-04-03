"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./CompatibilityScoreRing.module.css";

interface CompatibilityScoreRingProps {
  score: number;
  size?: number;
}

function getScoreColor(score: number): string {
  if (score <= 30) return "#F07068";
  if (score <= 50) return "#C96B2A";
  if (score <= 75) return "#C89B3C";
  return "#1A7B6E";
}

const SPARKLE_COUNT = 10;

export default function CompatibilityScoreRing({
  score,
  size = 120,
}: CompatibilityScoreRingProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const [progress, setProgress] = useState(0);
  const [sparklesActive, setSparklesActive] = useState(false);
  const hasAnimated = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const strokeWidth = Math.max(6, size * 0.07);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const color = getScoreColor(clampedScore);

  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    if (prefersReducedMotion) {
      setDisplayScore(Math.round(clampedScore));
      setProgress(clampedScore / 100);
      return;
    }

    const duration = 1500;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);

      setDisplayScore(Math.round(eased * clampedScore));
      setProgress(eased * (clampedScore / 100));

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        setSparklesActive(true);
        setTimeout(() => setSparklesActive(false), 900);
      }
    };

    // Small delay so the component is visible before animating
    const timeout = setTimeout(() => requestAnimationFrame(animate), 100);
    return () => clearTimeout(timeout);
  }, [clampedScore, prefersReducedMotion]);

  const dashOffset = circumference * (1 - progress);

  // Generate sparkle positions distributed around the ring endpoint
  const sparkles = useMemo(() => {
    const angle = (progress * 360 - 90) * (Math.PI / 180);
    const cx = size / 2 + radius * Math.cos(angle);
    const cy = size / 2 + radius * Math.sin(angle);
    return Array.from({ length: SPARKLE_COUNT }, (_, i) => {
      const spreadAngle = (Math.PI * 2 * i) / SPARKLE_COUNT;
      const dist = 12 + Math.random() * 18;
      return {
        left: cx,
        top: cy,
        tx: `${Math.cos(spreadAngle) * dist}px`,
        ty: `${Math.sin(spreadAngle) * dist}px`,
        delay: `${i * 40}ms`,
      };
    });
  }, [progress, radius, size]);

  return (
    <div
      ref={containerRef}
      className={styles.container}
      style={{ width: size, height: size }}
    >
      <svg
        className={styles.ring}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          className={styles.trackCircle}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className={styles.progressCircle}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>

      <div className={styles.scoreLabel}>
        <span className={styles.scoreValue} style={{ fontSize: size * 0.26 }}>
          {displayScore}
        </span>
        <span className={styles.scoreCaption} style={{ fontSize: size * 0.09 }}>
          score
        </span>
      </div>

      <div className={styles.sparkleContainer}>
        {sparklesActive &&
          sparkles.map((s, i) => (
            <span
              key={i}
              className={`${styles.sparkle} ${sparklesActive ? styles.active : ""}`}
              style={{
                left: s.left,
                top: s.top,
                "--tx": s.tx,
                "--ty": s.ty,
                animationDelay: s.delay,
              } as React.CSSProperties}
            />
          ))}
      </div>
    </div>
  );
}
