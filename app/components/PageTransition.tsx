"use client";

import type { ReactNode } from "react";

type PageTransitionProps = {
  children: ReactNode;
  className?: string;
};

/* Lightweight CSS-only fade-in transition.
   Uses a class-based animation instead of Framer Motion
   to avoid the y-axis bounce / jitter issues on mobile. */
export default function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <div className={`page-transition-enter ${className ?? ""}`}>
      {children}
    </div>
  );
}
