"use client";

import { useState, memo } from "react";
import type { PlanetPosition } from "@/lib/astro-types";
import { useTranslation } from "@/lib/i18n-context";

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

const PLANET_GLYPHS: Record<string, string> = {
  Sun: "☉",
  Moon: "☽",
  Mercury: "☿",
  Venus: "♀",
  Mars: "♂",
  Jupiter: "♃",
  Saturn: "♄",
  Rahu: "☊",
  Ketu: "☋",
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

type PlanetarySnapshotsProps = {
  planets: PlanetPosition[];
};

function PlanetarySnapshots({ planets }: PlanetarySnapshotsProps) {
  const { t } = useTranslation();
  const [expandedPlanet, setExpandedPlanet] = useState<string | null>(null);

  function handleCardClick(name: string) {
    setExpandedPlanet((prev) => (prev === name ? null : name));
  }

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
        {planets.map((planet) => {
          const color      = PLANET_COLORS[planet.name] ?? "#f2c26c";
          const glyph      = PLANET_GLYPHS[planet.name] ?? "★";
          const dignity    = getDignityLabel(planet);
          const isExpanded = expandedPlanet === planet.name;

          return (
            <article
              key={planet.name}
              className={`planet-card planet-card--compact${isExpanded ? " planet-card--expanded" : ""}`}
              style={{
                borderLeftWidth: "3px",
                borderLeftStyle: "solid",
                borderLeftColor: color,
              }}
              onClick={() => handleCardClick(planet.name)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleCardClick(planet.name);
                }
              }}
              role="button"
              tabIndex={0}
              aria-expanded={isExpanded}
            >
              {/* ── Compact row (always visible) ── */}
              <div className="planet-card__header">
                <span
                  className="planet-card__glyph"
                  style={{ color }}
                  aria-hidden="true"
                >
                  {glyph}
                </span>

                <div className="planet-card__title-group">
                  <h3 style={{ color }}>{planet.name}</h3>
                  <span className="planet-card__sign">{planet.sign}</span>
                </div>

                <span
                  className={`planet-card__chevron${isExpanded ? " planet-card__chevron--open" : ""}`}
                  aria-hidden="true"
                >
                  ▾
                </span>
              </div>

              {/* ── Expanded detail (revealed on hover/click) ── */}
              <div className="planet-card__detail">
                <div className="planet-card__detail-row">
                  <span className="planet-card__detail-label">
                    {t("insights.house")}
                  </span>
                  <span className="planet-card__detail-value">
                    {planet.house}
                  </span>
                </div>

                <div className="planet-card__detail-row">
                  <span className="planet-card__detail-label">Degree</span>
                  <span className="planet-card__detail-value">
                    {planet.degree_in_sign.toFixed(2)}°
                  </span>
                </div>

                {dignity && (
                  <div className="planet-card__detail-row">
                    <span className="planet-card__detail-label">Dignity</span>
                    <span
                      className="planet-card__dignity"
                      style={{
                        color:
                          dignity === "Exalted" || dignity === "Domicile"
                            ? color
                            : "var(--accent-coral, #ff6b5b)",
                      }}
                    >
                      {dignity}
                    </span>
                  </div>
                )}

                <div className="planet-card__detail-row">
                  <span className="planet-card__detail-label">Longitude</span>
                  <span className="planet-card__detail-value">
                    {planet.longitude.toFixed(2)}°
                  </span>
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
