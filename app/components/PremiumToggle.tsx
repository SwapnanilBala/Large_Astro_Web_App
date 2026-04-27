"use client";

import React from "react";
import styles from "./PremiumToggle.module.css";

interface PremiumToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export default function PremiumToggle({
  label,
  checked,
  onChange,
  disabled = false,
}: PremiumToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`${styles.premiumToggle} ${checked ? styles.checked : ""} ${disabled ? styles.disabled : ""}`}
      aria-pressed={checked}
    >
      <span className={styles.toggleGlyph} aria-hidden="true" />
      <span className={styles.toggleLabel}>{label}</span>
    </button>
  );
}
