"use client";

import React from "react";
import styles from "./GlassCard.module.css";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "elevated" | "subtle";
  glow?: "gold" | "purple" | "teal" | "none";
  onClick?: () => void;
}

export default function GlassCard({
  children,
  className = "",
  variant = "default",
  glow = "none",
  onClick,
}: GlassCardProps) {
  return (
    <div
      className={`${styles.glassCard} ${styles[variant]} ${glow !== "none" ? styles[glow] : ""} ${onClick ? styles.clickable : ""} ${className}`}
      onClick={onClick}
    >
      <div className={styles.cardInner}>{children}</div>
      <div className={styles.cardBorder} />
      {glow !== "none" && <div className={styles.cardGlow} />}
    </div>
  );
}
