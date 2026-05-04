"use client";

import { memo, useMemo } from "react";
import type { HousePlacement, PlanetPosition } from "@/lib/astro-types";
import { useTranslation } from "@/lib/i18n-context";
import styles from "../insights.module.css";

type NorthIndianChartSummaryProps = {
  ascendantSign: string;
  houses: HousePlacement[];
  planets: PlanetPosition[];
};

type HouseSummary = HousePlacement & {
  planetNames: string[];
};

const HOUSE_GROUPS = [
  { key: "kendra", houses: [1, 4, 7, 10], labelKey: "insights.northIndianGroupKendra" },
  { key: "trikona", houses: [1, 5, 9], labelKey: "insights.northIndianGroupTrikona" },
  { key: "upachaya", houses: [3, 6, 10, 11], labelKey: "insights.northIndianGroupUpachaya" },
  { key: "dusthana", houses: [6, 8, 12], labelKey: "insights.northIndianGroupDusthana" },
];

const SIGN_ABBREVIATIONS: Record<string, string> = {
  Aries: "Ari",
  Taurus: "Tau",
  Gemini: "Gem",
  Cancer: "Can",
  Leo: "Leo",
  Virgo: "Vir",
  Libra: "Lib",
  Scorpio: "Sco",
  Sagittarius: "Sag",
  Capricorn: "Cap",
  Aquarius: "Aqu",
  Pisces: "Pis",
};

function buildHouseSummaries(houses: HousePlacement[], planets: PlanetPosition[]) {
  const planetsByHouse = new Map<number, string[]>();

  for (const planet of planets) {
    if (!planetsByHouse.has(planet.house)) {
      planetsByHouse.set(planet.house, []);
    }
    planetsByHouse.get(planet.house)?.push(planet.name);
  }

  return [...houses]
    .sort((left, right) => left.house_number - right.house_number)
    .map<HouseSummary>((house) => {
      const merged = new Set([
        ...house.planets,
        ...(planetsByHouse.get(house.house_number) ?? []),
      ]);

      return {
        ...house,
        planetNames: [...merged],
      };
    });
}

function formatHouseList(houses: number[]) {
  return houses.map((house) => `H${house}`).join(" / ");
}

function NorthIndianChartSummary({
  ascendantSign,
  houses,
  planets,
}: NorthIndianChartSummaryProps) {
  const { t } = useTranslation();
  const houseSummaries = useMemo(
    () => buildHouseSummaries(houses, planets),
    [houses, planets]
  );

  const populatedHouses = houseSummaries.filter(
    (house) => house.planetNames.length > 0
  );

  return (
    <section className={styles.northIndianPanel}>
      <div className="rules-header">
        <p className="kicker">{t("insights.northIndianKicker")}</p>
        <h2>{t("insights.northIndianHeading")}</h2>
      </div>

      <p className="section-intro">
        {t("insights.northIndianIntro", { ascendant: ascendantSign })}
      </p>

      <div className={styles.northIndianFormula} aria-label={t("insights.northIndianFormulaLabel")}>
        <span>
          <strong>{t("insights.northIndianAnchor")}</strong>
          {ascendantSign}
        </span>
        <span>
          <strong>{t("insights.northIndianHouseMode")}</strong>
          {t("insights.northIndianWholeSign")}
        </span>
        <span>
          <strong>{t("insights.northIndianPlanetMode")}</strong>
          {t("insights.northIndianSidereal")}
        </span>
      </div>

      <div className={styles.northIndianHouseGrid} aria-label={t("insights.northIndianHouseGridLabel")}>
        {houseSummaries.map((house) => (
          <article
            key={house.house_number}
            className={`${styles.northIndianHouse} ${
              house.house_number === 1 ? styles.northIndianHouseAsc : ""
            }`}
          >
            <span className={styles.northIndianHouseNumber}>
              {t("insights.northIndianHouse", { house: String(house.house_number) })}
            </span>
            <strong>{SIGN_ABBREVIATIONS[house.sign] ?? house.sign}</strong>
            <small>{house.sign}</small>
            <p>
              {house.planetNames.length > 0
                ? house.planetNames.join(", ")
                : t("insights.northIndianEmpty")}
            </p>
          </article>
        ))}
      </div>

      <div className={styles.northIndianGroups}>
        <h3>{t("insights.northIndianGroupsHeading")}</h3>
        {HOUSE_GROUPS.map((group) => {
          const planetsInGroup = populatedHouses
            .filter((house) => group.houses.includes(house.house_number))
            .flatMap((house) =>
              house.planetNames.map((planet) => `${planet} H${house.house_number}`)
            );

          return (
            <div key={group.key} className={styles.northIndianGroupRow}>
              <span>
                {t(group.labelKey)} <small>{formatHouseList(group.houses)}</small>
              </span>
              <strong>
                {planetsInGroup.length > 0
                  ? planetsInGroup.join(", ")
                  : t("insights.northIndianNoGroupPlanets")}
              </strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default memo(NorthIndianChartSummary);
