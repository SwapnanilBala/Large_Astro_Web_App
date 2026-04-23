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
    <div className={`${styles.premiumToggle} ${disabled ? styles.disabled : ""}`}>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`${styles.toggleButton} ${checked ? styles.checked : ""}`}
        aria-pressed={checked}
      >
        <div className={styles.toggleTrack}>
          <div className={styles.toggleThumb} />
        </div>
      </button>
      <label className={styles.toggleLabel}>{label}</label>
    </div>
  );
}
