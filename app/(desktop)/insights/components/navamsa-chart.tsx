"use client";

import { useState, memo } from "react";
import type { NavamsaPositionInfo } from "@/lib/astro-types";
import { useTranslation } from "@/lib/i18n-context";
import { getNavamsaInterpretation } from "./navamsa-interpretations";

type NavamsaChartProps = {
  navamsa: NavamsaPositionInfo[];
};

// ── Dignity color map ────────────────────────────────────────────────────────
const DIGNITY_COLORS: Record<string, { color: string; label: string; glow: string }> = {
  exalted:      { color: "#ffd700", label: "Exalted",      glow: "rgba(255, 215, 0, 0.4)" },
  own:          { color: "#4ade80", label: "Own Sign",      glow: "rgba(74, 222, 128, 0.3)" },
  moolatrikona: { color: "#86efac", label: "Moolatrikona",  glow: "rgba(134, 239, 172, 0.3)" },
  friend:       { color: "#93c5fd", label: "Friend Sign",   glow: "rgba(147, 197, 253, 0.25)" },
  neutral:      { color: "#d1d5db", label: "Neutral",       glow: "rgba(209, 213, 219, 0.15)" },
  enemy:        { color: "#fb923c", label: "Enemy Sign",    glow: "rgba(251, 146, 60, 0.25)" },
  debilitated:  { color: "#f87171", label: "Debilitated",   glow: "rgba(248, 113, 113, 0.4)" },
};

// Legend entries — only show dignities that need explanation (skip neutral by
// default; include it so users know the key is complete).
const DIGNITY_LEGEND_ORDER = [
  "exalted",
  "own",
  "moolatrikona",
  "friend",
  "neutral",
  "enemy",
  "debilitated",
] as const;

// ── Planet Unicode glyphs ────────────────────────────────────────────────────
const PLANET_GLYPHS: Record<string, string> = {
  Sun:     "☉",
  Moon:    "☽",
  Mercury: "☿",
  Venus:   "♀",
  Mars:    "♂",
  Jupiter: "♃",
  Saturn:  "♄",
  Rahu:    "☊",
  Ketu:    "☋",
};

function NavamsaChart({ navamsa }: NavamsaChartProps) {
  const { t } = useTranslation();
  const [expandedPlanet, setExpandedPlanet] = useState<string | null>(null);

  const handleToggle = (name: string) => {
    setExpandedPlanet((prev) => (prev === name ? null : name));
  };

  return (
    <section className="navamsa-panel">
      <div className="rules-header">
        <p className="kicker">{t("navamsa.kicker")}</p>
        <h2>{t("navamsa.heading")}</h2>
      </div>

      <p className="section-intro">{t("navamsa.introText")}</p>

      {(() => {
        const vargottamaCount = navamsa.filter(
          (p) => p.rashi_sign === p.navamsa_sign
        ).length;
        const vargottamaPlanets = navamsa
          .filter((p) => p.rashi_sign === p.navamsa_sign)
          .map((p) => p.name);

        return (
          <div className="navamsa-summary-card">
            <h4>{t("navamsa.summaryLabel")}</h4>
            <p className="navamsa-summary-vargottama">
              {vargottamaCount > 0
                ? `${t("navamsa.vargottamaCount", { count: String(vargottamaCount) })}: ${vargottamaPlanets.join(", ")}`
                : t("navamsa.vargottamaCountZero")}
            </p>
            {vargottamaCount > 0 && (
              <p className="navamsa-summary-explanation">
                {t("navamsa.vargottamaExplanation")}
              </p>
            )}
            <p className="navamsa-click-hint">{t("navamsa.clickHint")}</p>
          </div>
        );
      })()}

      <div className="navamsa-table" role="table" aria-label="Navamsa planetary positions">
        <div className="navamsa-row navamsa-row--header" role="row">
          <span role="columnheader">{t("navamsa.planet")}</span>
          <span role="columnheader">{t("navamsa.rashiSign")}</span>
          <span role="columnheader" aria-hidden="true"></span>
          <span role="columnheader">{t("navamsa.navamsaSign")}</span>
        </div>

        {navamsa.map((position) => {
          const isVargottama = position.rashi_sign === position.navamsa_sign;
          const isExpanded = expandedPlanet === position.name;
          const interpretation = getNavamsaInterpretation(
            position.name,
            position.navamsa_sign,
            isVargottama
          );

          const dignityKey = position.dignity ?? "neutral";
          const dignityInfo = DIGNITY_COLORS[dignityKey] ?? DIGNITY_COLORS.neutral;
          const glyph = PLANET_GLYPHS[position.name] ?? position.name;

          // Tooltip text shown on hover of the planet cell
          const tooltipText = `${position.name} · ${dignityInfo.label} · ${position.navamsa_sign}`;

          const planetStyle: React.CSSProperties = {
            color: dignityInfo.color,
            textShadow: `0 0 8px ${dignityInfo.glow}, 0 0 16px ${dignityInfo.glow}`,
          };

          return (
            <div key={position.name} role="row">
              <div
                className={`navamsa-row${isVargottama ? " navamsa-vargottama" : ""}${isExpanded ? " navamsa-row--expanded" : ""}`}
                onClick={() => handleToggle(position.name)}
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleToggle(position.name);
                  }
                }}
              >
                {/* Planet cell — dignity-coloured glyph + name, with CSS tooltip */}
                <span
                  className="navamsa-planet navamsa-planet-cell"
                  role="cell"
                  data-tooltip={tooltipText}
                >
                  <span
                    className="navamsa-planet-glyph"
                    aria-hidden="true"
                    style={planetStyle}
                  >
                    {glyph}
                  </span>
                  <span
                    className="navamsa-planet-name"
                    style={planetStyle}
                  >
                    {position.name}
                  </span>
                </span>

                <span className="navamsa-sign" role="cell">{position.rashi_sign}</span>
                <span className="navamsa-arrow" role="cell" aria-hidden="true">&rarr;</span>
                <span className="navamsa-sign" role="cell">
                  {position.navamsa_sign}
                  {isVargottama && (
                    <small className="navamsa-vargottama-label">Vargottama</small>
                  )}
                </span>
              </div>

              {isExpanded && (
                <div className="navamsa-insight anim-fade-in">
                  <div className="navamsa-insight-block">
                    <span className="navamsa-insight-label">
                      {t("navamsa.inNavamsa", { planet: position.name, sign: position.navamsa_sign })}
                    </span>
                    <p className="navamsa-insight-text">
                      {interpretation.planetMeaning}
                    </p>
                  </div>
                  <div className="navamsa-insight-block">
                    <span className="navamsa-insight-label">
                      Navamsa {position.navamsa_sign}
                    </span>
                    <p className="navamsa-insight-text">
                      {interpretation.signMeaning}
                    </p>
                  </div>
                  {interpretation.vargottamaNote && (
                    <div className="navamsa-insight-block navamsa-insight-block--vargottama">
                      <span className="navamsa-insight-label">
                        &#10022; {t("navamsa.vargottamaStatus")}
                      </span>
                      <p className="navamsa-insight-text">
                        {interpretation.vargottamaNote}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Dignity Legend ── */}
      <div className="navamsa-dignity-legend" aria-label="Dignity colour legend">
        {DIGNITY_LEGEND_ORDER.map((key) => {
          const d = DIGNITY_COLORS[key];
          return (
            <span key={key} className="navamsa-dignity-legend-item">
              <span
                className="navamsa-dignity-dot"
                style={{ color: d.color, textShadow: `0 0 6px ${d.glow}` }}
                aria-hidden="true"
              >
                ●
              </span>
              {d.label}
            </span>
          );
        })}
      </div>
    </section>
  );
}

export default memo(NavamsaChart);
