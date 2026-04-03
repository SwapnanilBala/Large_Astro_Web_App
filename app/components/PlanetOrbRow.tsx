"use client";

import { memo } from "react";
import PlanetOrb from "./PlanetOrb";
import type { PlanetName, PlanetOrbSize } from "./PlanetOrb";
import styles from "./PlanetOrb.module.css";

export type PlanetOrbRowProps = {
  planets: PlanetName[];
  size?: PlanetOrbSize;
  showLabels?: boolean;
  className?: string;
};

function PlanetOrbRow({
  planets,
  size = "md",
  showLabels = false,
  className = "",
}: PlanetOrbRowProps) {
  return (
    <div className={`${styles.row} ${className}`}>
      {planets.map((planet, i) => (
        <div
          key={planet}
          className={styles.rowItem}
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <PlanetOrb planet={planet} size={size} showLabel={showLabels} />
        </div>
      ))}
    </div>
  );
}

export default memo(PlanetOrbRow);
