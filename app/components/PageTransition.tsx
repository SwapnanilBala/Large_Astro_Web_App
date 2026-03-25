"use client";

import type { ReactNode } from "react";

type PageTransitionProps = {
  children: ReactNode;
  className?: string;
};

/* Simple wrapper — no Framer Motion animation on mount.
   This eliminates the y-axis bounce that caused jitter on mobile. */
export default function PageTransition({ children, className }: PageTransitionProps) {
  return <div className={className}>{children}</div>;
}
