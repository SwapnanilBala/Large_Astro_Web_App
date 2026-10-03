"use client";

import type { PlanetPosition } from "@/lib/astro-types";
import { useTranslation } from "@/lib/i18n-context";
import {
  HOUSES,
  HOUSE_POLYGONS,
  LABEL_BOXES,
  LABEL_FONT,
  NORTH_INDIAN_SIZE,
  SIGN_NUMBER_POINTS,
  formatWholeDegree,
  layoutHouseLabels,
  signForHouse,
  signNumber,
  type ChartLabel,
} from "@/lib/north-indian-chart";
import { GRAHA_ORDER } from "@/lib/planet-colors";
import styles from "./north-indian-chart.module.css";

type NorthIndianChartProps = {
  ascendantSign: string;
  ascendantDegree: number;
  planets: PlanetPosition[];
  /** The house the positions list or the pointer is on, shared with the card. */
  activeHouse: number | null;
  onActiveHouseChange: (house: number | null) => void;
};

const S = NORTH_INDIAN_SIZE;

/*
 * The North Indian (diamond) chart: houses fixed, ascendant at the top, signs
 * rotating, each house carrying its sign number. All geometry comes from
 * lib/north-indian-chart.ts, which is tested; this file only draws it.
 *
 * Each house is a focusable element with its own label, so a screen reader or
 * a keyboard user gets the chart house by house ("House 7, Capricorn: Saturn
 * 1° retrograde, Rahu 17°") rather than the single image description the
 * constellation wheel offers.
 */
export default function NorthIndianChart({
  ascendantSign,
  ascendantDegree,
  planets,
  activeHouse,
  onActiveHouseChange,
}: NorthIndianChartProps) {
  const { t } = useTranslation();

  const planetName = (name: string) =>
    name === "Rahu" || name === "Ketu"
      ? t(`lagnaChart.${name.toLowerCase()}`)
      : t(`planetNames.${name.toLowerCase()}`);
  const signName = (sign: string) => t(`zodiacSigns.${sign.toLowerCase()}`);

  const ordered = [...planets].sort(
    (a, b) =>
      GRAHA_ORDER.indexOf(a.name as (typeof GRAHA_ORDER)[number]) -
      GRAHA_ORDER.indexOf(b.name as (typeof GRAHA_ORDER)[number]),
  );

  const houses = HOUSES.map((house) => {
    const sign = signForHouse(ascendantSign, house);
    const inHouse = ordered.filter((planet) => planet.house === house);
    /* Rahu and Ketu always move backwards, so marking them retrograde says
       nothing; only the true planets get the R. */
    const isRetrograde = (planet: PlanetPosition) =>
      planet.is_retrograde === true && planet.name !== "Rahu" && planet.name !== "Ketu";

    const labels: ChartLabel[] = inHouse.map((planet) => ({
      abbrev: t(`lagnaChart.abbrev.${planet.name.toLowerCase()}`),
      degree: formatWholeDegree(planet.degree_in_sign),
      retrograde: isRetrograde(planet),
    }));
    if (house === 1) {
      labels.unshift({
        abbrev: t("lagnaChart.abbrev.ascendant"),
        degree: formatWholeDegree(ascendantDegree),
        retrograde: false,
      });
    }

    const spoken = [
      ...(house === 1 ? [`${t("lagnaChart.ascendant")} ${formatWholeDegree(ascendantDegree)}`] : []),
      ...inHouse.map(
        (planet) =>
          `${planetName(planet.name)} ${formatWholeDegree(planet.degree_in_sign)}` +
          (isRetrograde(planet) ? ` ${t("lagnaChart.retrograde")}` : ""),
      ),
    ];
    const ariaLabel = spoken.length > 0
      ? t("lagnaChart.houseAria", { house: String(house), sign: signName(sign), planets: spoken.join(", ") })
      : t("lagnaChart.houseEmptyAria", { house: String(house), sign: signName(sign) });

    return { house, sign, layout: layoutHouseLabels(labels, LABEL_BOXES[house]), ariaLabel };
  });

  return (
    <svg
      viewBox={`0 0 ${S} ${S}`}
      className={styles.chart}
      role="group"
      aria-label={t("lagnaChart.northIndianTitle", { ascendant: signName(ascendantSign) })}
      aria-describedby="north-indian-chart-desc"
    >
      <desc id="north-indian-chart-desc">{t("lagnaChart.northIndianDesc")}</desc>

      {houses.map(({ house, sign, layout, ariaLabel }) => {
        const [nx, ny] = SIGN_NUMBER_POINTS[house];
        return (
          <g
            key={house}
            className={styles.house}
            data-house={house}
            data-active={activeHouse === house ? "true" : undefined}
            data-ascendant={house === 1 ? "true" : undefined}
            role="img"
            aria-label={ariaLabel}
            tabIndex={0}
            onMouseEnter={() => onActiveHouseChange(house)}
            onMouseLeave={() => onActiveHouseChange(null)}
            onFocus={() => onActiveHouseChange(house)}
            onBlur={() => onActiveHouseChange(null)}
          >
            <polygon
              className={styles.region}
              points={HOUSE_POLYGONS[house].map(([x, y]) => `${x},${y}`).join(" ")}
            />
            <text className={styles.signNumber} x={nx} y={ny} textAnchor="middle" dominantBaseline="central">
              {signNumber(sign)}
            </text>
            {layout.labels.map((label, index) => (
              <text
                key={index}
                className={house === 1 && index === 0 ? `${styles.label} ${styles.ascendantLabel}` : styles.label}
                x={label.x}
                y={label.y}
                textAnchor="middle"
                dominantBaseline="central"
              >
                <tspan className={styles.abbrev} fontSize={LABEL_FONT.abbrev * layout.scale}>
                  {label.abbrev}
                </tspan>
                {label.showDegree && (
                  <tspan className={styles.degree} dx={3 * layout.scale} fontSize={LABEL_FONT.degree * layout.scale}>
                    {label.degree}
                  </tspan>
                )}
                {label.retrograde && (
                  <tspan
                    className={styles.retro}
                    dx={1.5 * layout.scale}
                    dy={-4 * layout.scale}
                    fontSize={LABEL_FONT.retro * layout.scale}
                  >
                    {t("lagnaChart.retrogradeShort")}
                  </tspan>
                )}
              </text>
            ))}
          </g>
        );
      })}

      {/* The construction lines, drawn once over the regions so a shared edge
          is stroked once rather than twice. The focus ring is wider than these
          lines, so it still shows where it runs along one. */}
      <g className={styles.lines} aria-hidden="true">
        <rect x={0.75} y={0.75} width={S - 1.5} height={S - 1.5} />
        <line x1={0} y1={0} x2={S} y2={S} />
        <line x1={S} y1={0} x2={0} y2={S} />
        <polygon points={`${S / 2},0 ${S},${S / 2} ${S / 2},${S} 0,${S / 2}`} />
      </g>
    </svg>
  );
}
