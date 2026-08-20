"use client";

import { memo, useEffect, useMemo, useState } from "react";
import type { ChartApiResponse, HousePlacement, PlanetPosition } from "@/lib/astro-types";
import { buildBirthProfileApiUrl } from "@/lib/chart-query";
import { useTranslation } from "@/lib/i18n-context";
import styles from "../insights.module.css";

type LahiriPlacidusLagnaChartProps = {
  queryString: string;
};

type HouseRegion = {
  cx: number;
  cy: number;
  path: string;
};

const LAHIRI_PLACIDUS_ENGINE_ID = "lahiri_placidus";

/*
  Same North Indian layout as lagna-chart.tsx: houses run counter-clockwise
  from the top centre rhombus, so the kendras 1/4/7/10 are the four rhombi
  (top, left, bottom, right) and the other eight fill the corner triangles in
  order. cx/cy is each region's centroid.
*/
export const HOUSE_REGIONS: Record<number, HouseRegion> = {
  1: { cx: 300, cy: 150, path: "M 300,0 L 450,150 L 300,300 L 150,150 Z" },
  2: { cx: 150, cy: 50, path: "M 0,0 L 300,0 L 150,150 Z" },
  3: { cx: 50, cy: 150, path: "M 0,0 L 150,150 L 0,300 Z" },
  4: { cx: 150, cy: 300, path: "M 0,300 L 150,150 L 300,300 L 150,450 Z" },
  5: { cx: 50, cy: 450, path: "M 0,300 L 150,450 L 0,600 Z" },
  6: { cx: 150, cy: 550, path: "M 0,600 L 150,450 L 300,600 Z" },
  7: { cx: 300, cy: 450, path: "M 150,450 L 300,300 L 450,450 L 300,600 Z" },
  8: { cx: 450, cy: 550, path: "M 300,600 L 450,450 L 600,600 Z" },
  9: { cx: 550, cy: 450, path: "M 600,300 L 450,450 L 600,600 Z" },
  10: { cx: 450, cy: 300, path: "M 600,300 L 450,150 L 300,300 L 450,450 Z" },
  11: { cx: 550, cy: 150, path: "M 600,0 L 450,150 L 600,300 Z" },
  12: { cx: 450, cy: 50, path: "M 300,0 L 600,0 L 450,150 Z" },
};

const PLANET_GLYPHS: Record<string, string> = {
  Sun: "Su",
  Moon: "Mo",
  Mercury: "Me",
  Venus: "Ve",
  Mars: "Ma",
  Jupiter: "Ju",
  Saturn: "Sa",
  Rahu: "Ra",
  Ketu: "Ke",
};

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

function buildLahiriPlacidusUrl(queryString: string) {
  const params = new URLSearchParams(queryString);
  params.set("engineId", LAHIRI_PLACIDUS_ENGINE_ID);

  return buildBirthProfileApiUrl("/api/chart", window.location.origin, params, {
    include_transits: false,
  });
}

function planetsByHouse(planets: PlanetPosition[]) {
  return planets.reduce<Record<number, PlanetPosition[]>>((groups, planet) => {
    groups[planet.house] = [...(groups[planet.house] ?? []), planet];
    return groups;
  }, {});
}

function getHouseCusp(cusps: number[] | undefined, houseNumber: number) {
  const cusp = cusps?.[houseNumber - 1];
  return typeof cusp === "number" ? cusp : null;
}

function renderPlanetLine(planets: PlanetPosition[]) {
  if (planets.length === 0) return "";
  return planets.map((planet) => PLANET_GLYPHS[planet.name] ?? planet.name.slice(0, 2)).join(" ");
}

function LahiriPlacidusLagnaChart({ queryString }: LahiriPlacidusLagnaChartProps) {
  const { t } = useTranslation();
  const [payload, setPayload] = useState<ChartApiResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadChart() {
      setIsLoading(true);
      setError("");

      try {
        const response = await fetch(buildLahiriPlacidusUrl(queryString), {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Chart API error (${response.status})`);
        }

        const data = (await response.json()) as ChartApiResponse;
        if (!cancelled) {
          setPayload(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("insights.lahiriPlacidusError"));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadChart();

    return () => {
      cancelled = true;
    };
  }, [queryString, t]);

  const housePlanets = useMemo(
    () => planetsByHouse(payload?.chart.planets ?? []),
    [payload?.chart.planets]
  );

  const houses = payload?.chart.houses ?? [];
  const housesByNumber = useMemo(
    () => new Map(houses.map((house) => [house.house_number, house] as const)),
    [houses]
  );

  return (
    <section className={styles.lahiriPlacidusPanel}>
      <div className="rules-header">
        <p className="kicker">{t("insights.lahiriPlacidusKicker")}</p>
        <h2>{t("insights.lahiriPlacidusHeading")}</h2>
      </div>

      <p className="section-intro">
        {t("insights.lahiriPlacidusIntro")}
      </p>

      {isLoading && (
        <div className={styles.lahiriPlacidusState}>
          {t("insights.lahiriPlacidusLoading")}
        </div>
      )}

      {!isLoading && error && (
        <div className={styles.lahiriPlacidusState}>
          {t("insights.lahiriPlacidusError")}
        </div>
      )}

      {!isLoading && payload && (
        <div className={styles.lahiriPlacidusLayout}>
          <svg
            viewBox="0 0 600 600"
            className={styles.lahiriPlacidusSvg}
            role="img"
            aria-label={t("insights.lahiriPlacidusAria", {
              ascendant: payload.chart.ascendant.sign,
            })}
          >
            <title>
              {t("insights.lahiriPlacidusAria", {
                ascendant: payload.chart.ascendant.sign,
              })}
            </title>
            <rect x="0" y="0" width="600" height="600" rx="8" />
            <line x1="0" y1="0" x2="600" y2="600" />
            <line x1="600" y1="0" x2="0" y2="600" />
            <polygon points="300,0 600,300 300,600 0,300" />
            <line x1="0" y1="300" x2="600" y2="300" />
            <line x1="300" y1="0" x2="300" y2="600" />

            {Array.from({ length: 12 }, (_, index) => index + 1).map((houseNumber) => {
              const region = HOUSE_REGIONS[houseNumber];
              const house = housesByNumber.get(houseNumber) as HousePlacement | undefined;
              const planets = housePlanets[houseNumber] ?? [];
              const cusp = getHouseCusp(payload.chart.house_cusps, houseNumber);
              const isAscendant = houseNumber === 1;
              const sign = house?.sign ?? "";

              return (
                <g key={houseNumber} className={isAscendant ? styles.lahiriPlacidusAscHouse : undefined}>
                  <path d={region.path} />
                  <text x={region.cx} y={region.cy - 30} className={styles.lahiriPlacidusHouseNumber}>
                    H{houseNumber}
                  </text>
                  <text x={region.cx} y={region.cy - 12} className={styles.lahiriPlacidusSign}>
                    {SIGN_ABBREVIATIONS[sign] ?? sign}
                  </text>
                  <text x={region.cx} y={region.cy + 9} className={styles.lahiriPlacidusPlanets}>
                    {renderPlanetLine(planets)}
                  </text>
                  {cusp !== null && (
                    <text x={region.cx} y={region.cy + 29} className={styles.lahiriPlacidusCusp}>
                      {cusp.toFixed(1)} deg
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          <div className={styles.lahiriPlacidusMeta}>
            <span>
              <strong>{t("insights.lahiriPlacidusAscendant")}</strong>
              {payload.chart.ascendant.sign} {payload.chart.ascendant.degree_in_sign.toFixed(2)} deg
            </span>
            <span>
              <strong>{t("insights.lahiriPlacidusEngine")}</strong>
              {payload.engine.engine_label}
            </span>
            <span>
              <strong>{t("insights.lahiriPlacidusHouseSystem")}</strong>
              {payload.engine.house_system}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

export default memo(LahiriPlacidusLagnaChart);
