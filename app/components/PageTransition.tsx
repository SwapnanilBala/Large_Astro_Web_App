"use client";

import { type ReactNode, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import CosmicTransitionOverlay from "./CosmicTransitionOverlay";

type PageTransitionProps = {
  children: ReactNode;
  className?: string;
};

/* ── Detect prefers-reduced-motion ── */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}

/* ── Animation variants ── */
const DURATION = 0.4; // 400ms
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

const pageVariants = {
  initial: {
    opacity: 0,
    scale: 0.98,
    y: 10,
  },
  enter: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: DURATION,
      ease: EASE_OUT,
      when: "beforeChildren",
      staggerChildren: 0.05, // 50ms stagger
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: -8,
    transition: {
      duration: DURATION * 0.6,
      ease: "easeIn",
    },
  },
};

/* Stagger variant for direct children */
const childVariants = {
  initial: {
    opacity: 0,
    y: 12,
  },
  enter: {
    opacity: 1,
    y: 0,
    transition: {
      duration: DURATION * 0.75,
      ease: EASE_OUT,
    },
  },
};

/* Instant variants for reduced motion */
const instantVariants = {
  initial: { opacity: 1 },
  enter: { opacity: 1 },
  exit: { opacity: 1 },
};

/**
 * Page transition wrapper using Framer Motion.
 *
 * - Smooth opacity + scale + y-translate entrance (400ms easeOut)
 * - Cosmic star particles scatter/reconverge during transition
 * - Staggered children reveal with 50ms delay
 * - Respects prefers-reduced-motion
 * - Backward compatible: same props as the previous CSS-only version
 */
export default function PageTransition({ children, className }: PageTransitionProps) {
  const pathname = usePathname();
  const prefersReduced = usePrefersReducedMotion();
  const [cosmicActive, setCosmicActive] = useState(false);

  // Fire cosmic overlay on pathname change
  useEffect(() => {
    if (prefersReduced) return;
    // Trigger cosmic particles on every render (which happens on navigation)
    setCosmicActive(true);
    const timer = setTimeout(() => setCosmicActive(false), 500);
    return () => clearTimeout(timer);
  }, [pathname, prefersReduced]);

  const variants = prefersReduced ? instantVariants : pageVariants;

  return (
    <>
      {!prefersReduced && <CosmicTransitionOverlay isActive={cosmicActive} />}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`page-transition-${pathname}`}
          className={`page-transition-enter ${className ?? ""}`}
          variants={variants}
          initial="initial"
          animate="enter"
          exit="exit"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

/**
 * Optional wrapper for child elements that should animate in
 * with the staggered reveal. Wrap direct children of PageTransition
 * with this for the sequential entrance effect.
 *
 * Usage:
 *   <PageTransition>
 *     <StaggerItem><Header /></StaggerItem>
 *     <StaggerItem><Content /></StaggerItem>
 *     <StaggerItem><Footer /></StaggerItem>
 *   </PageTransition>
 */
export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={childVariants}>
      {children}
    </motion.div>
  );
}
