"use client";

import { useMemo } from "react";
import styles from "./PlanetaryAffinity.module.css";

interface PlanetaryAffinityProps {
  fieldType: "name" | "birthDate" | "birthTime" | "country" | "state" | "city";
  isActive?: boolean;
}

const PLANET_CONFIG = {
  name: {
    planet: "☿",
    label: "Mercury",
    subtitle: "Messenger",
    orbitDuration: 8,
    color: "#C89B3C",
    size: 14,
  },
  birthDate: {
    planet: "☉",
    label: "Sun",
    subtitle: "Essence",
    orbitDuration: 12,
    color: "#F2C26C",
    size: 18,
  },
  birthTime: {
    planet: "☽",
    label: "Moon",
    subtitle: "Rhythm",
    orbitDuration: 10,
    color: "#E8E8E8",
    size: 16,
  },
  country: {
    planet: "♃",
    label: "Jupiter",
    subtitle: "Expansion",
    orbitDuration: 15,
    color: "#D4A574",
    size: 16,
  },
  state: {
    planet: "♄",
    label: "Saturn",
    subtitle: "Structure",
    orbitDuration: 18,
    color: "#9B8B7A",
    size: 14,
  },
  city: {
    planet: "♀",
    label: "Venus",
    subtitle: "Harmony",
    orbitDuration: 11,
    color: "#E8B4B4",
    size: 14,
  },
};

export default function PlanetaryAffinity({ fieldType, isActive = false }: PlanetaryAffinityProps) {
  const config = useMemo(() => PLANET_CONFIG[fieldType], [fieldType]);

  return (
    <div 
      className={`${styles.affinityContainer} ${isActive ? styles.active : ""}`}
      data-planet={config.label}
    >
      <div 
        className={styles.orbitRing}
        style={{ 
          animationDuration: `${config.orbitDuration}s`,
          opacity: isActive ? 0.6 : 0.3,
        }}
      >
        <div 
          className={styles.planet}
          style={{ 
            color: config.color,
            fontSize: config.size,
            textShadow: `0 0 ${config.size}px ${config.color}80`,
          }}
        >
          {config.planet}
        </div>
      </div>
      
      <div className={`${styles.planetInfo} ${isActive ? styles.infoVisible : ""}`}>
        <span className={styles.planetLabel}>{config.label}</span>
        <span className={styles.planetSubtitle}>{config.subtitle}</span>
      </div>

      {/* Static glow pulse when active */}
      {isActive && (
        <div 
          className={styles.glowPulse}
          style={{ background: `radial-gradient(circle, ${config.color}20 0%, transparent 70%)` }}
        />
      )}
    </div>
  );
}
