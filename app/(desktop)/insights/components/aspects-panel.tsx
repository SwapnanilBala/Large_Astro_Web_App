"use client";

import { memo } from "react";
import type { AspectInfo } from "@/lib/astro-types";
import { useTranslation } from "@/lib/i18n-context";
import { ASPECT_SYMBOLS, getAspectBriefInterpretation } from "./aspect-interpretations";
import PlanetOrb from "@/app/components/PlanetOrb";
import type { PlanetName } from "@/app/components/PlanetOrb";

const VALID_PLANETS = new Set<string>(["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"]);

type AspectsPanelProps = {
  aspects: AspectInfo[];
};

function getAspectBadgeClass(aspectType: string, vedic: boolean): string {
  if (vedic) return "aspect-badge aspect-badge--vedic";

  const normalized = aspectType.toLowerCase();
  if (normalized === "trine" || normalized === "sextile") {
    return "aspect-badge aspect-badge--harmonious";
  }
  if (normalized === "square" || normalized === "opposition") {
    return "aspect-badge aspect-badge--tension";
  }
  if (normalized === "conjunction") {
    return "aspect-badge aspect-badge--union";
  }
  return "aspect-badge";
}

function AspectsPanel({ aspects }: AspectsPanelProps) {
  const { t } = useTranslation();

  return (
    <section className="aspects-panel">
      <div className="rules-header">
        <p className="kicker">{t("aspects.kicker")}</p>
        <h2>{t("aspects.heading")}</h2>
      </div>

      <div className="aspect-grid" role="list" aria-label="Planetary aspects">
        {aspects.map((aspect, index) => (
          <article
            key={`${aspect.planet1}-${aspect.planet2}-${aspect.aspect_type}-${index}`}
            className={`aspect-card aspect-card--${aspect.aspect_type.toLowerCase()}`}
            role="listitem"
          >
            {/* Each planet is one group that cannot break. The names used to be
                bare text nodes in this flex row, which made them flex items in
                their own right and let them shrink character by character --
                three columns wide, "Mercury" rendered as "Mer cur y". The line
                may still wrap, but now only between the two planets. */}
            <h3 className="aspect-card-title">
              <span className="aspect-planet">
                {VALID_PLANETS.has(aspect.planet1) && (
                  <PlanetOrb planet={aspect.planet1 as PlanetName} size="sm" />
                )}
                {aspect.planet1}
              </span>
              <span className="aspect-symbol">
                {ASPECT_SYMBOLS[aspect.aspect_type.toLowerCase()] ?? "\u2194"}
              </span>
              <span className="aspect-planet">
                {VALID_PLANETS.has(aspect.planet2) && (
                  <PlanetOrb planet={aspect.planet2 as PlanetName} size="sm" />
                )}
                {aspect.planet2}
              </span>
            </h3>
            <div className="aspect-card-body">
              <span className={getAspectBadgeClass(aspect.aspect_type, aspect.vedic)}>
                {aspect.vedic ? t("aspects.vedicDrishti") : aspect.aspect_type}
              </span>
              <span className="aspect-orb">{aspect.orb.toFixed(2)}&deg;</span>
              <span className="aspect-angle">{aspect.exact_angle.toFixed(1)}&deg;</span>
              <span
                className={`aspect-badge ${
                  aspect.applying
                    ? "aspect-badge--harmonious"
                    : "aspect-badge--tension"
                }`}
              >
                {aspect.applying ? t("aspects.applying") : t("aspects.separating")}
              </span>
            </div>
            <p className="aspect-brief">
              {getAspectBriefInterpretation(aspect.planet1, aspect.planet2, aspect.aspect_type)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default memo(AspectsPanel);
