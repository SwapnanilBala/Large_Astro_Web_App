"use client";

import { memo, useId } from "react";
import type { CSSProperties, ReactNode } from "react";
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
  active?: boolean;
  strength?: number;
  tooltip?: ReactNode;
  ariaLabel?: string;
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
  active = false,
  strength,
  tooltip,
  ariaLabel,
  className = "",
}: PlanetOrbProps) {
  const tooltipId = useId();
  const planetClass = PLANET_CLASS_MAP[planet] ?? styles.sun;
  const sizeClass = SIZE_CLASS_MAP[size];
  const normalizedStrength =
    typeof strength === "number" ? Math.min(1, Math.max(0, strength)) : null;
  const strengthPercent =
    normalizedStrength === null ? null : Math.round(normalizedStrength * 100);
  const hasTooltip = tooltip !== undefined && tooltip !== null;

  const strengthStyle =
    normalizedStrength === null
      ? undefined
      : ({
          "--planet-strength-scale": (0.88 + normalizedStrength * 0.24).toFixed(3),
          "--planet-strength-brightness": (
            0.88 +
            normalizedStrength * 0.26
          ).toFixed(3),
          "--planet-strength-opacity": (0.72 + normalizedStrength * 0.28).toFixed(
            3,
          ),
        } as CSSProperties);

  const generatedAriaLabel =
    ariaLabel ??
    [
      `${planet} orb`,
      active ? "active dasha planet" : null,
      strengthPercent !== null ? `${strengthPercent}% strength` : null,
    ]
      .filter(Boolean)
      .join(", ");

  const orbEl = (
    <span
      className={`${styles.orb} ${planetClass} ${sizeClass} ${
        active ? styles.active : ""
      } ${className}`}
      role="img"
      aria-label={generatedAriaLabel}
      aria-describedby={hasTooltip ? tooltipId : undefined}
      tabIndex={hasTooltip ? 0 : undefined}
      style={strengthStyle}
    >
      <span className={styles.surface} aria-hidden="true" />
    </span>
  );

  if (!showLabel && !hasTooltip) return orbEl;

  return (
    <span className={styles.wrapper}>
      {orbEl}
      {showLabel ? <span className={styles.label}>{planet}</span> : null}
      {hasTooltip ? (
        <span id={tooltipId} role="tooltip" className={styles.tooltip}>
          {tooltip}
        </span>
      ) : null}
    </span>
  );
}

export default memo(PlanetOrb);
