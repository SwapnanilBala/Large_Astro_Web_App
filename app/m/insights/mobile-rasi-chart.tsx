"use client";

import { useState } from "react";
import type { PlanetPosition } from "@/lib/astro-types";
import { SIGN_ORDER } from "@/lib/constellation-geometry";
import { planetAbbreviation, planetName, retrogradeMark, signAbbreviation, signName } from "@/lib/chart-labels";
import styles from "./mobile-rasi-chart.module.css";

/*
 * The rasi chart, drawn the way it is drawn in India: the South Indian square.
 *
 * It replaces a Western-style wheel. The wheel read as imported on a Vedic
 * reading and was the most stock image on the page; the square is the chart a
 * Vedic reader already knows, and it carries the same information. Signs sit
 * in fixed places -- Pisces top left, then clockwise -- and the houses are
 * counted from the rising sign, which is marked. Each cell names its sign in
 * the reader's language: three letters in the Latin alphabet (Pis, Gém), the
 * whole name in Devanagari or Bengali (मीन), which is short enough to fit.
 *
 * Planets are written the way astrologers write them by hand, a letter or two
 * each in the reader's language (Su, Mo; सू, चं), with the abbreviations the
 * desktop's North Indian chart uses. Tapping one puts its placement in a line
 * under the chart, as the wheel did; there is no hover on a phone to hang a
 * tooltip on.
 */

type Translate = (key: string, params?: Record<string, string>) => string;

type Props = {
  ascendantSign: string;
  planets?: PlanetPosition[];
  /** chart.house_system: the system `planet.house` was counted in. */
  houseSystem?: string;
  tr: Translate;
  formatDegree: (value: number) => string;
};

/**
 * The house a sign is, counted from the lagna's sign: the number this chart
 * writes in that sign's cell. Null when either sign is not one of the twelve.
 */
export function signHouse(sign: string, ascendantSign: string): number | null {
  const index = SIGN_ORDER.indexOf(sign as (typeof SIGN_ORDER)[number]);
  const ascIndex = SIGN_ORDER.indexOf(ascendantSign as (typeof SIGN_ORDER)[number]);
  return index < 0 || ascIndex < 0 ? null : ((index - ascIndex + 12) % 12) + 1;
}

/**
 * The name of the house system `planet.house` was counted in, or null under
 * Whole Sign. There the bhava is the sign house, which the chart already
 * shows; under any other system the two can differ, so the page gives both.
 * Every key is spelled out because the mobile coverage test reads only
 * plain-string arguments.
 */
export function bhavaSystemName(houseSystem: string | undefined, tr: Translate): string | null {
  switch (houseSystem) {
    case "equal":
      return tr("mobileInsights.systemEqual");
    case "placidus":
      return tr("mobileInsights.systemPlacidus");
    case "koch":
      return tr("mobileInsights.systemKoch");
    case "campanus":
      return tr("mobileInsights.systemCampanus");
    case "regiomontanus":
      return tr("mobileInsights.systemRegiomontanus");
    case "porphyry":
      return tr("mobileInsights.systemPorphyry");
    default:
      return null;
  }
}

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

export default function MobileRasiChart({ ascendantSign, planets = [], houseSystem, tr, formatDegree }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const active = planets.find((planet) => planet.name === selected) ?? null;
  const system = bhavaSystemName(houseSystem, tr);

  /* The house the cell says comes first, since the line sits right under it.
     Under any system but Whole Sign the bhava follows, named, because that is
     the house the readings count from. */
  const placement = (planet: PlanetPosition) => {
    const params = {
      planet: planetName(planet.name, tr),
      sign: signName(planet.sign, tr),
      degree: formatDegree(planet.degree_in_sign),
      house: String(signHouse(planet.sign, ascendantSign) ?? planet.house),
    };
    return system
      ? tr("mobileInsights.chartPlacementBhava", { ...params, bhava: String(planet.house), system })
      : tr("mobileInsights.chartPlacement", params);
  };

  return (
    <figure className={styles.wrap}>
      <div
        className={styles.grid}
        /* group, not img: the planets inside are buttons. */
        role="group"
        aria-label={tr("mobileInsights.chartAria", { sign: signName(ascendantSign, tr) })}
      >
        {SIGN_ORDER.map((sign) => {
          const [row, column] = CELL[sign];
          const house = signHouse(sign, ascendantSign);
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
                <span>{signAbbreviation(sign, tr)}</span>
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
                      {planetAbbreviation(planet.name, tr)}
                      {planet.is_retrograde && <sup className={styles.retro}>{retrogradeMark(tr)}</sup>}
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
            {tr("mobileInsights.ascendantLead", { sign: signName(ascendantSign, tr) })}
          </span>
        </div>
      </div>

      <figcaption className={styles.caption} aria-live="polite">
        {active ? placement(active) : tr("mobileInsights.chartHint")}
      </figcaption>
    </figure>
  );
}
