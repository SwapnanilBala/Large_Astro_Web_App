"use client";

import { useState, memo } from "react";
import type { CSSProperties } from "react";
import type { PlanetPosition } from "@/lib/astro-types";
import { useTranslation } from "@/lib/i18n-context";
import PlanetOrb from "@/app/components/PlanetOrb";
import type { PlanetName } from "@/app/components/PlanetOrb";
import styles from "./planetary-snapshots.module.css";

const PLANET_COLORS: Record<string, string> = {
  Sun: "#f5a623",
  Moon: "#a8d8ea",
  Mercury: "#2ecc71",
  Venus: "#e91e8c",
  Mars: "#e74c3c",
  Jupiter: "#f1c40f",
  Saturn: "#95a5a6",
  Rahu: "#8e44ad",
  Ketu: "#e67e22",
};

/** Derive a simple dignity label from degree and sign — purely cosmetic. */
function getDignityLabel(planet: PlanetPosition): string | null {
  const dignities: Record<string, { domicile: string[]; exaltation: string; detriment: string[]; fall: string }> = {
    Sun:     { domicile: ["Leo"],         exaltation: "Aries",     detriment: ["Aquarius"],             fall: "Libra"       },
    Moon:    { domicile: ["Cancer"],      exaltation: "Taurus",    detriment: ["Capricorn"],            fall: "Scorpio"     },
    Mercury: { domicile: ["Gemini","Virgo"], exaltation: "Virgo",  detriment: ["Sagittarius","Pisces"], fall: "Pisces"      },
    Venus:   { domicile: ["Taurus","Libra"], exaltation: "Pisces", detriment: ["Aries","Scorpio"],      fall: "Virgo"       },
    Mars:    { domicile: ["Aries","Scorpio"], exaltation: "Capricorn", detriment: ["Taurus","Libra"],   fall: "Cancer"      },
    Jupiter: { domicile: ["Sagittarius","Pisces"], exaltation: "Cancer", detriment: ["Gemini","Virgo"], fall: "Capricorn"   },
    Saturn:  { domicile: ["Capricorn","Aquarius"], exaltation: "Libra",  detriment: ["Cancer","Leo"],   fall: "Aries"       },
  };
  const d = dignities[planet.name];
  if (!d) return null;
  if (d.domicile.includes(planet.sign)) return "Domicile";
  if (d.exaltation === planet.sign)     return "Exalted";
  if (d.detriment.includes(planet.sign)) return "Detriment";
  if (d.fall === planet.sign)           return "Fall";
  return null;
}

const SUPPORTIVE_DIGNITIES = new Set(["Domicile", "Exalted"]);

type PlanetarySnapshotsProps = {
  planets: PlanetPosition[];
};

/**
 * The compact placement grid.
 *
 * Every fact a reader scans for -- sign, degree, house, dignity, motion --
 * is on the resting face of the card. The drawer holds only the precise
 * numbers, so collapsing a card never hides the answer to "where is Mars".
 */
function PlanetarySnapshots({ planets }: PlanetarySnapshotsProps) {
  const { t } = useTranslation();
  const [expandedPlanet, setExpandedPlanet] = useState<string | null>(null);

  function handleToggle(name: string) {
    setExpandedPlanet((prev) => (prev === name ? null : name));
  }

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <p className={styles.kicker}>{t("insights.planetKicker")}</p>
        <h2 className={styles.heading}>{t("insights.planetHeading")}</h2>
        <p className={styles.intro}>
          Sign, degree, house, and dignity for every graha. Open a card for the exact
          longitude and motion.
        </p>
      </div>

      <div className={styles.grid}>
        {planets.map((planet) => {
          const color = PLANET_COLORS[planet.name] ?? "#f2c26c";
          const dignity = getDignityLabel(planet);
          const isExpanded = expandedPlanet === planet.name;
          const detailId = `planet-detail-${planet.name}`;

          return (
            <article
              key={planet.name}
              className={`${styles.card}${isExpanded ? ` ${styles.cardOpen}` : ""}`}
              style={{ "--planet-accent": color } as CSSProperties}
            >
              <button
                type="button"
                className={styles.toggle}
                onClick={() => handleToggle(planet.name)}
                aria-expanded={isExpanded}
                aria-controls={detailId}
              >
                <span className={styles.identity}>
                  <PlanetOrb planet={planet.name as PlanetName} size="sm" />
                  <span className={styles.name}>{planet.name}</span>
                  {/* Status markers ride the identity row rather than the chip
                      row below: three chips wrap on a narrow column, and one
                      wrapped card stretches its whole grid row. */}
                  {planet.is_retrograde && (
                    <span
                      className={styles.marker}
                      role="img"
                      aria-label="Retrograde"
                      title="Retrograde"
                    >
                      ℞
                    </span>
                  )}
                  {planet.is_combust && (
                    <span
                      className={`${styles.marker} ${styles.markerCombust}`}
                      role="img"
                      aria-label="Combust"
                      title="Combust"
                    >
                      ☌
                    </span>
                  )}
                  <span
                    className={`${styles.chevron}${isExpanded ? ` ${styles.chevronOpen}` : ""}`}
                    aria-hidden="true"
                  >
                    ▾
                  </span>
                </span>

                <span className={styles.placement}>
                  <span className={styles.sign}>{planet.sign}</span>
                  <span className={styles.degree}>
                    {planet.degree_in_sign.toFixed(2)}°
                  </span>
                </span>

                <span className={styles.chips}>
                  <span className={`${styles.chip} ${styles.chipHouse}`}>
                    {t("insights.house")} {planet.house}
                  </span>
                  {dignity && (
                    <span
                      className={`${styles.chip} ${
                        SUPPORTIVE_DIGNITIES.has(dignity)
                          ? styles.chipStrong
                          : styles.chipWeak
                      }`}
                    >
                      {dignity}
                    </span>
                  )}
                </span>
              </button>

              <div
                id={detailId}
                className={`${styles.drawer}${isExpanded ? ` ${styles.drawerOpen}` : ""}`}
              >
                <div className={styles.drawerInner}>
                  <dl className={styles.detailList}>
                    <div className={styles.detailRow}>
                      <dt className={styles.detailLabel}>Longitude</dt>
                      <dd className={styles.detailValue}>
                        {planet.longitude.toFixed(2)}°
                      </dd>
                    </div>
                    <div className={styles.detailRow}>
                      <dt className={styles.detailLabel}>Motion</dt>
                      <dd className={styles.detailValue}>
                        {planet.is_retrograde ? "Retrograde" : "Direct"}
                        {typeof planet.speed === "number"
                          ? ` · ${planet.speed.toFixed(3)}°/day`
                          : ""}
                      </dd>
                    </div>
                    <div className={styles.detailRow}>
                      <dt className={styles.detailLabel}>Dignity</dt>
                      <dd className={styles.detailValue}>{dignity ?? "Neutral"}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default memo(PlanetarySnapshots);
