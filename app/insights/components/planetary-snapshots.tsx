"use client";

import type { PlanetPosition } from "@/lib/astro-types";
import { useTranslation } from "@/lib/i18n-context";

type PlanetarySnapshotsProps = {
  planets: PlanetPosition[];
};

export default function PlanetarySnapshots({ planets }: PlanetarySnapshotsProps) {
  const { t } = useTranslation();

  return (
    <section className="planet-panel planet-panel--compact">
      <div className="rules-header">
        <p className="kicker">{t("insights.planetKicker")}</p>
        <h2>{t("insights.planetHeading")}</h2>
      </div>

      <p className="section-intro planet-panel-intro">
        A compact placement summary for quick scanning. The deeper chart logic is carried in the main
        analysis above.
      </p>

      <div className="planet-grid planet-grid--compact">
        {planets.map((planet) => (
          <article key={planet.name} className="planet-card planet-card--compact">
            <h3>{planet.name}</h3>
            <p>{planet.sign}</p>
            <small>
              {planet.degree_in_sign.toFixed(2)}° | {t("insights.house")} {planet.house}
            </small>
          </article>
        ))}
      </div>
    </section>
  );
}
