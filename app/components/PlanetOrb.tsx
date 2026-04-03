"use client";

import { memo } from "react";
import styles from "./PlanetOrb.module.css";

export type PlanetName =
  | "Sun"
  | "Moon"
  | "Mars"
  | "Mercury"
  | "Jupiter"
  | "Venus"
  | "Saturn"
  | "Rahu"
  | "Ketu";

export type PlanetOrbSize = "sm" | "md" | "lg" | "xl";

export type PlanetOrbProps = {
  planet: PlanetName;
  size?: PlanetOrbSize;
  showLabel?: boolean;
  className?: string;
};

const PLANET_CLASS_MAP: Record<PlanetName, string> = {
  Sun: styles.sun,
  Moon: styles.moon,
  Mars: styles.mars,
  Mercury: styles.mercury,
  Jupiter: styles.jupiter,
  Venus: styles.venus,
  Saturn: styles.saturn,
  Rahu: styles.rahu,
  Ketu: styles.ketu,
};

const SIZE_CLASS_MAP: Record<PlanetOrbSize, string> = {
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
  xl: styles.xl,
};

function PlanetOrb({
  planet,
  size = "md",
  showLabel = false,
  className = "",
}: PlanetOrbProps) {
  const planetClass = PLANET_CLASS_MAP[planet] ?? styles.sun;
  const sizeClass = SIZE_CLASS_MAP[size];

  const orbEl = (
    <div
      className={`${styles.orb} ${planetClass} ${sizeClass} ${className}`}
      role="img"
      aria-label={`${planet} orb`}
    />
  );

  if (!showLabel) return orbEl;

  return (
    <span className={styles.wrapper}>
      {orbEl}
      <span className={styles.label}>{planet}</span>
    </span>
  );
}

export default memo(PlanetOrb);
