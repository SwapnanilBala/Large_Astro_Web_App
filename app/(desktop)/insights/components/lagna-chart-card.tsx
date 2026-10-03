"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import PanelErrorBoundary from "@/app/(desktop)/insights/components/PanelErrorBoundary";
import type { ChartApiResponse } from "@/lib/astro-types";
import { useTranslation } from "@/lib/i18n-context";
import { formatDegreeMinutes } from "@/lib/north-indian-chart";
import { GRAHA_ORDER, PLANET_COLORS } from "@/lib/planet-colors";
import { useChartStyle, type ChartStyle } from "@/lib/use-chart-style";
import styles from "./lagna-chart-card.module.css";

/*
 * The birth chart card on the results page: the chart in the reader's chosen
 * style, the planet positions beside it, and the three signals read off it.
 *
 * Both drawings are lazy chunks with no server render (the wheel animates and
 * measures itself; the diamond only matters once someone has asked for it), so
 * each loads into a square placeholder that holds the card's height still.
 */
const ConstellationChart = dynamic(() => import("./constellation-chart"), {
  ssr: false,
  loading: () => <div className={styles.chartPlaceholder} aria-hidden="true" />,
});
const NorthIndianChart = dynamic(() => import("./north-indian-chart"), {
  ssr: false,
  loading: () => <div className={styles.chartPlaceholder} aria-hidden="true" />,
});

const STYLE_OPTIONS: { style: ChartStyle; labelKey: string }[] = [
  { style: "constellation", labelKey: "lagnaChart.constellation" },
  { style: "north-indian", labelKey: "lagnaChart.northIndian" },
];

const SIGN_ELEMENTS: Record<string, string> = {
  Aries: "Fire", Leo: "Fire", Sagittarius: "Fire",
  Taurus: "Earth", Virgo: "Earth", Capricorn: "Earth",
  Gemini: "Air", Libra: "Air", Aquarius: "Air",
  Cancer: "Water", Scorpio: "Water", Pisces: "Water",
};

function readGlance(payload: ChartApiResponse) {
  const strongest = [...(payload.chart.shadbala ?? [])].sort(
    (left, right) => right.strengthRatio - left.strengthRatio,
  )[0];
  const elementCounts = payload.chart.planets
    .filter((planet) => GRAHA_ORDER.slice(0, 7).includes(planet.name as (typeof GRAHA_ORDER)[number]))
    .reduce<Record<string, number>>((counts, planet) => {
      const element = SIGN_ELEMENTS[planet.sign] ?? "Fire";
      counts[element] = (counts[element] ?? 0) + 1;
      return counts;
    }, {});
  const dominantElement =
    Object.entries(elementCounts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "Mixed";
  const activeHouse = [...payload.chart.houses]
    .filter((house) => house.planets.length > 0)
    .sort((left, right) => right.planets.length - left.planets.length)[0];
  return { strongest, dominantElement, activeHouse };
}

export default function LagnaChartCard({ payload }: { payload: ChartApiResponse }) {
  const { t } = useTranslation();
  const [style, setStyle] = useChartStyle();
  /* The house under the pointer or keyboard focus, shared by the diamond and
     the positions list so each highlights the other. */
  const [activeHouse, setActiveHouse] = useState<number | null>(null);

  const { ascendant, planets, houses } = payload.chart;
  const glance = readGlance(payload);

  const planetName = (name: string) =>
    name === "Rahu" || name === "Ketu"
      ? t(`lagnaChart.${name.toLowerCase()}`)
      : t(`planetNames.${name.toLowerCase()}`);
  const signName = (sign: string) => t(`zodiacSigns.${sign.toLowerCase()}`);

  const rows: { key: string; name: string; color?: string; sign: string; house: number; degree: number; retrograde: boolean }[] = [
    {
      key: "Ascendant",
      name: t("lagnaChart.ascendant"),
      sign: ascendant.sign,
      house: 1,
      degree: ascendant.degree_in_sign,
      retrograde: false,
    },
    ...[...planets]
      .sort(
        (a, b) =>
          GRAHA_ORDER.indexOf(a.name as (typeof GRAHA_ORDER)[number]) -
          GRAHA_ORDER.indexOf(b.name as (typeof GRAHA_ORDER)[number]),
      )
      .map((planet) => ({
        key: planet.name,
        name: planetName(planet.name),
        color: PLANET_COLORS[planet.name],
        sign: planet.sign,
        house: planet.house,
        degree: planet.degree_in_sign,
        /* The nodes are always retrograde; marking them says nothing. */
        retrograde: planet.is_retrograde === true && planet.name !== "Rahu" && planet.name !== "Ketu",
      })),
  ];

  return (
    <div className={styles.card}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <p className={styles.kicker}>{t("lagnaChart.kicker")}</p>
          <h2 className={styles.title}>{ascendant.sign} rising</h2>
        </div>
        <div className={styles.switch} role="group" aria-label={t("lagnaChart.styleGroup")}>
          {STYLE_OPTIONS.map((option) => (
            <button
              key={option.style}
              type="button"
              className={styles.switchOption}
              aria-pressed={style === option.style}
              onClick={() => setStyle(option.style)}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.chart}>
          <PanelErrorBoundary panelName="Lagna Chart">
            {style === "north-indian" ? (
              <NorthIndianChart
                ascendantSign={ascendant.sign}
                ascendantDegree={ascendant.degree_in_sign}
                planets={planets}
                activeHouse={activeHouse}
                onActiveHouseChange={setActiveHouse}
              />
            ) : (
              <ConstellationChart ascendantSign={ascendant.sign} houses={houses} planets={planets} />
            )}
          </PanelErrorBoundary>
        </div>

        <div className={styles.table}>
          <table className={styles.positions}>
            <caption className={styles.srOnly}>{t("lagnaChart.positionsCaption")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("navamsa.planet")}</th>
                <th scope="col">{t("lagnaChart.sign")}</th>
                <th scope="col" className={styles.numeric}>{t("insights.house")}</th>
                <th scope="col" className={styles.numeric}>{t("dasha.degree")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.key}
                  data-active={activeHouse === row.house ? "true" : undefined}
                  onMouseEnter={() => setActiveHouse(row.house)}
                  onMouseLeave={() => setActiveHouse(null)}
                >
                  <th scope="row">
                    <span
                      className={styles.dot}
                      style={row.color ? { background: row.color } : undefined}
                      data-ascendant={row.color ? undefined : "true"}
                      aria-hidden="true"
                    />
                    {row.name}
                    {row.retrograde && (
                      <abbr className={styles.retro} title={t("lagnaChart.retrograde")}>
                        {t("lagnaChart.retrogradeShort")}
                      </abbr>
                    )}
                  </th>
                  <td>{signName(row.sign)}</td>
                  <td className={styles.numeric}>{row.house}</td>
                  <td className={styles.numeric}>{formatDegreeMinutes(row.degree)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* The three signals the old "Chart at a glance" panel carried, moved
            into the card with the chart they describe. Wording unchanged. */}
        <div className={styles.glanceBlock}>
          <dl className={styles.glance} aria-label="Chart at a glance">
            <div>
              <dt>Strongest support</dt>
              <dd>{glance.strongest?.planet ?? "Balanced"}</dd>
            </div>
            <div>
              <dt>Dominant tone</dt>
              <dd>{glance.dominantElement}</dd>
            </div>
            <div>
              <dt>Most active area</dt>
              <dd>
                {glance.activeHouse
                  ? `House ${glance.activeHouse.house_number} · ${glance.activeHouse.sign}`
                  : "Evenly distributed"}
              </dd>
            </div>
          </dl>
          {glance.activeHouse && (
            <p className={styles.glanceNote}>
              {glance.activeHouse.planets.join(", ")} concentrate in this part of the chart.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
