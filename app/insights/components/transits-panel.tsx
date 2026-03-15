"use client";

import { useState } from "react";
import type { TransitData } from "@/lib/astro-types";
import { useTranslation } from "@/lib/i18n-context";
import { getTransitInterpretation } from "./transit-interpretations";

type TransitsPanelProps = {
  transits: TransitData;
};

function getTransitAspectClass(aspectType: string): string {
  const normalized = aspectType.toLowerCase();
  if (normalized === "trine" || normalized === "sextile") {
    return "transit-aspect-item transit-aspect-item--harmonious";
  }
  if (normalized === "square" || normalized === "opposition") {
    return "transit-aspect-item transit-aspect-item--tension";
  }
  if (normalized === "conjunction") {
    return "transit-aspect-item transit-aspect-item--union";
  }
  return "transit-aspect-item";
}

export default function TransitsPanel({ transits }: TransitsPanelProps) {
  const { t } = useTranslation();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const tightestAspects = [...transits.active_aspects]
    .sort((a, b) => a.orb - b.orb)
    .slice(0, 10);

  const handleToggle = (index: number) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
  };

  return (
    <section className="transits-panel">
      <div className="rules-header">
        <p className="kicker">{t("transits.kicker")}</p>
        <h2>{t("transits.heading")}</h2>
        <small className="transits-timestamp">
          {t("transits.computedAt")} {transits.computed_at_utc}
        </small>
      </div>

      <div className="transits-columns">
        <div className="transits-col">
          <h3>{t("transits.positions")}</h3>
          <div className="transits-grid">
            {transits.positions.map((position) => (
              <article key={position.name} className="transit-card">
                <h4>{position.name}</h4>
                <p>{position.sign}</p>
                <small>{position.degree_in_sign.toFixed(2)}&deg;</small>
              </article>
            ))}
          </div>
        </div>

        <div className="transits-col">
          <h3>{t("transits.aspects")}</h3>
          <div className="transit-aspect-list">
            {tightestAspects.map((aspect, index) => {
              const isExpanded = expandedIndex === index;
              const interpretation = getTransitInterpretation(
                aspect.transit_planet,
                aspect.aspect_type,
                aspect.natal_planet
              );

              return (
                <div
                  key={`${aspect.transit_planet}-${aspect.natal_planet}-${index}`}
                  className={`${getTransitAspectClass(aspect.aspect_type)}${isExpanded ? " transit-aspect-item--expanded" : ""}`}
                  onClick={() => handleToggle(index)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleToggle(index);
                    }
                  }}
                >
                  <div className="transit-aspect-header">
                    <span className="transit-aspect-text">
                      <strong>{aspect.transit_planet}</strong>{" "}
                      {aspect.aspect_type}{" "}
                      natal <strong>{aspect.natal_planet}</strong>
                    </span>
                    <span className="transit-aspect-orb">
                      {aspect.orb.toFixed(2)}&deg;
                    </span>
                  </div>
                  {isExpanded && (
                    <p className="transit-interpretation anim-fade-in">
                      {interpretation}
                    </p>
                  )}
                </div>
              );
            })}

            {tightestAspects.length === 0 && (
              <p className="transits-empty">{t("transits.noAspects")}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
