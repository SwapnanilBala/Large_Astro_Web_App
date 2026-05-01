"use client";

import { memo } from "react";
import type { CSSProperties, ReactNode } from "react";
import PlanetOrb from "./PlanetOrb";
import type { PlanetName, PlanetOrbSize } from "./PlanetOrb";
import styles from "./PlanetOrb.module.css";

export type PlanetOrbMetadata = {
  planet: PlanetName;
  sign?: string;
  house?: number | string;
  dignity?: string;
  strength?: number;
  shadbalaStrength?: number;
  strengthPercent?: number;
  isCurrentDashaLord?: boolean;
  tooltip?: ReactNode;
};

export type PlanetOrbRowProps = {
  planets: PlanetName[];
  size?: PlanetOrbSize;
  showLabels?: boolean;
  activePlanet?: PlanetName;
  currentDashaLord?: PlanetName;
  planetMetadata?: PlanetOrbMetadata[];
  planetStrengths?: Partial<Record<PlanetName, number>>;
  planetTooltips?: Partial<Record<PlanetName, ReactNode>>;
  getPlanetTooltip?: (planet: PlanetName, index: number) => ReactNode;
  showRail?: boolean;
  arc?: boolean;
  className?: string;
};

function PlanetOrbRow({
  planets,
  size = "md",
  showLabels = false,
  activePlanet,
  currentDashaLord,
  planetMetadata,
  planetStrengths,
  planetTooltips,
  getPlanetTooltip,
  showRail = true,
  arc = true,
  className = "",
}: PlanetOrbRowProps) {
  const count = Math.max(planets.length - 1, 1);
  const metadataByPlanet = new Map(
    planetMetadata?.map((metadata) => [metadata.planet, metadata]),
  );

  return (
    <div
      className={`${styles.row} ${showRail ? styles.withRail : ""} ${
        arc ? styles.arc : ""
      } ${className}`}
    >
      {planets.map((planet, i) => {
        const metadata = metadataByPlanet.get(planet);
        const metadataStrength =
          metadata?.shadbalaStrength ??
          metadata?.strength ??
          (typeof metadata?.strengthPercent === "number"
            ? metadata.strengthPercent / 100
            : undefined);

        return (
          <div
            key={`${planet}-${i}`}
            className={styles.rowItem}
            style={
              {
                "--orb-arc-y": arc
                  ? `${Math.round(Math.sin((i / count) * Math.PI) * -14)}px`
                  : "0px",
                animationDelay: `${i * 85}ms`,
              } as CSSProperties
            }
          >
            <PlanetOrb
              planet={planet}
              size={size}
              showLabel={showLabels}
              active={
                planet === activePlanet ||
                planet === currentDashaLord ||
                Boolean(metadata?.isCurrentDashaLord)
              }
              strength={planetStrengths?.[planet] ?? metadataStrength}
              tooltip={
                getPlanetTooltip?.(planet, i) ??
                planetTooltips?.[planet] ??
                metadata?.tooltip
              }
            />
          </div>
        );
      })}
    </div>
  );
}

export default memo(PlanetOrbRow);
