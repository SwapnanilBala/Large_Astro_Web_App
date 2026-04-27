"use client";

import React from "react";
import styles from "./PremiumButton.module.css";

interface PremiumButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export default function PremiumButton({
  children,
  onClick,
  type = "button",
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  loadingLabel = "Processing...",
  icon,
  fullWidth = false,
}: PremiumButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${styles.premiumButton} ${styles[variant]} ${styles[size]} ${fullWidth ? styles.fullWidth : ""} ${loading ? styles.loading : ""}`}
    >
      <div className={styles.buttonContent}>
        {icon && <span className={styles.buttonIcon}>{icon}</span>}
        {loading ? (
          <span className={styles.loadingText}>{loadingLabel}</span>
        ) : (
          <span className={styles.buttonText}>{children}</span>
        )}
      </div>
      <div className={styles.buttonGlow} />
      <div className={styles.buttonShine} />
    </button>
  );
}
