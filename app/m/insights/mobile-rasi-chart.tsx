"use client";

import { useState } from "react";
import type { PlanetPosition } from "@/lib/astro-types";
import { SIGN_ORDER } from "@/lib/constellation-geometry";
import styles from "./mobile-rasi-chart.module.css";

/*
 * The rasi chart, drawn the way it is drawn in India: the South Indian square.
 *
 * It replaces a Western-style wheel. The wheel read as imported on a Vedic
 * reading and was the most stock image on the page; the square is the chart a
 * Vedic reader already knows, and it carries the same information. Signs sit
 * in fixed places -- Pisces top left, then clockwise -- and the houses are
 * counted from the rising sign, which is marked.
 *
 * Planets are written the way astrologers write them by hand, two letters
 * each. Tapping one puts its placement in a line under the chart, as the wheel
 * did; there is no hover on a phone to hang a tooltip on.
 */

type Translate = (key: string, params?: Record<string, string>) => string;

type Props = {
  ascendantSign: string;
  planets?: PlanetPosition[];
  tr: Translate;
  formatDegree: (value: number) => string;
};

/* Grid row and column (1-based) of each sign in the South Indian layout, in
   SIGN_ORDER order: Aries across the top, down the right, back along the
   bottom and up the left to Pisces in the corner it starts from. */
const CELL: Record<(typeof SIGN_ORDER)[number], [number, number]> = {
  Aries: [1, 2],
  Taurus: [1, 3],
  Gemini: [1, 4],
  Cancer: [2, 4],
  Leo: [3, 4],
  Virgo: [4, 4],
  Libra: [4, 3],
  Scorpio: [4, 2],
  Sagittarius: [4, 1],
  Capricorn: [3, 1],
  Aquarius: [2, 1],
  Pisces: [1, 1],
};

const ABBREVIATION: Record<string, string> = {
  Sun: "Su",
  Moon: "Mo",
  Mars: "Ma",
  Mercury: "Me",
  Jupiter: "Ju",
  Venus: "Ve",
  Saturn: "Sa",
  Rahu: "Ra",
  Ketu: "Ke",
};

/** A planet as astrologers write it by hand: Su, Mo, Ma and so on. */
export const abbreviate = (name: string) => ABBREVIATION[name] ?? name.slice(0, 2);

export default function MobileRasiChart({ ascendantSign, planets = [], tr, formatDegree }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const ascIndex = SIGN_ORDER.indexOf(ascendantSign as (typeof SIGN_ORDER)[number]);
  const active = planets.find((planet) => planet.name === selected) ?? null;

  const placement = (planet: PlanetPosition) =>
    tr("mobileInsights.chartPlacement", {
      planet: planet.name,
      sign: planet.sign,
      degree: formatDegree(planet.degree_in_sign),
      house: String(planet.house),
    });

  return (
    <figure className={styles.wrap}>
      <div
        className={styles.grid}
        /* group, not img: the planets inside are buttons. */
        role="group"
        aria-label={tr("mobileInsights.chartAria", { sign: ascendantSign })}
      >
        {SIGN_ORDER.map((sign, index) => {
          const [row, column] = CELL[sign];
          const house = ascIndex < 0 ? null : ((index - ascIndex + 12) % 12) + 1;
          const isLagna = house === 1;
          const here = planets.filter((planet) => planet.sign === sign);
          return (
            <div
              key={sign}
              className={`${styles.cell} ${isLagna ? styles.lagnaCell : ""}`}
              style={{ gridRow: row, gridColumn: column }}
            >
              <span className={styles.cellHead} aria-hidden="true">
                <span>{house ?? ""}</span>
                <span>{sign.slice(0, 3)}</span>
              </span>
              {isLagna && <span className={styles.lagnaMark}>{tr("mobileInsights.factLagna")}</span>}
              <span className={styles.planets}>
                {here.map((planet) => {
                  const isOn = selected === planet.name;
                  return (
                    <button
                      key={planet.name}
                      type="button"
                      className={`${styles.planet} ${isOn ? styles.planetOn : ""}`}
                      aria-pressed={isOn}
                      aria-label={placement(planet)}
                      onClick={() => setSelected(isOn ? null : planet.name)}
                    >
                      {abbreviate(planet.name)}
                      {planet.is_retrograde && <sup className={styles.retro}>R</sup>}
                    </button>
                  );
                })}
              </span>
            </div>
          );
        })}
        <div className={styles.centre} aria-hidden="true">
          <span className={styles.centreTitle}>{tr("mobileInsights.chartCentre")}</span>
          <span className={styles.centreMeta}>
            {tr("mobileInsights.ascendantLead", { sign: ascendantSign })}
          </span>
        </div>
      </div>

      <figcaption className={styles.caption} aria-live="polite">
        {active ? placement(active) : tr("mobileInsights.chartHint")}
      </figcaption>
    </figure>
  );
}
