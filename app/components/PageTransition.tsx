"use client";

import { type ReactNode, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useHydrated } from "@/lib/use-hydrated";
import { usePrefersReducedMotion } from "@/lib/use-media-query";
import CosmicTransitionOverlay from "./CosmicTransitionOverlay";

type PageTransitionProps = {
  children: ReactNode;
  className?: string;
};

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
  const hydrated = useHydrated();

  /*
   * The path whose cosmic overlay has run its course. The overlay is on
   * whenever the current path is not that one -- from the render that first
   * sees a new path until the timer below records it, 500ms later -- which is
   * the old "on for 500ms after every navigation, and on first load" without
   * setting state in an effect body. Off until hydration, as it always was.
   */
  const [settledPath, setSettledPath] = useState<string | null>(null);
  useEffect(() => {
    if (prefersReduced) return;
    const timer = setTimeout(() => setSettledPath(pathname), 500);
    return () => clearTimeout(timer);
  }, [pathname, prefersReduced]);
  const cosmicActive = hydrated && !prefersReduced && settledPath !== pathname;

  const variants = prefersReduced ? instantVariants : pageVariants;

  return (
    <>
      {!prefersReduced && <CosmicTransitionOverlay isActive={cosmicActive} seed={pathname} />}

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
