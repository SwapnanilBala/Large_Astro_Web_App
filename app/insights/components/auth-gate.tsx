"use client";

import type { ReactNode } from "react";

type AuthGateProps = {
  children: ReactNode;
  featureLabel?: string;
  isLocked?: boolean;
  requiredTier?: "premium" | "ultimate";
};

export default function AuthGate({ children }: AuthGateProps) {
  return <>{children}</>;
}
