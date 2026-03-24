"use client";

import { useState, memo } from "react";
import type { ShadbalaResult } from "@/lib/astro-types";

type ShadbalaPanelProps = {
  shadbala: ShadbalaResult[];
};

const PLANET_SYMBOLS: Record<string, string> = {
  Sun: "\u2609",
  Moon: "\u263D",
  Mars: "\u2642",
  Mercury: "\u263F",
  Jupiter: "\u2643",
  Venus: "\u2640",
  Saturn: "\u2644",
};

const COMPONENT_LABELS: { key: keyof ShadbalaResult; label: string; description: string }[] = [
  { key: "sthanaBala", label: "Sthana Bala", description: "Positional strength from sign, house, decanate, and divisional chart placement" },
  { key: "digBala", label: "Dig Bala", description: "Directional strength based on angular house alignment" },
  { key: "kalaBala", label: "Kala Bala", description: "Temporal strength from day/night and lunar phase" },
  { key: "cheshtaBala", label: "Cheshta Bala", description: "Motional strength from planetary movement" },
  { key: "naisargikaBala", label: "Naisargika Bala", description: "Inherent natural strength (fixed value)" },
  { key: "drikBala", label: "Drik Bala", description: "Aspectual strength from benefic and malefic aspects" },
];

function getStrengthColor(ratio: number): string {
  if (ratio >= 1.0) return "var(--accent-aqua, #6ce1d4)";
  if (ratio >= 0.7) return "var(--accent-gold, #f2c26c)";
  return "var(--accent-coral, #ff8f7e)";
}

function getStrengthLabel(ratio: number): string {
  if (ratio >= 1.2) return "Very Strong";
  if (ratio >= 1.0) return "Strong";
  if (ratio >= 0.7) return "Moderate";
  return "Weak";
}

function ShadbalaPanel({ shadbala }: ShadbalaPanelProps) {
  const [expandedPlanet, setExpandedPlanet] = useState<string | null>(null);

  if (!shadbala || shadbala.length === 0) return null;

  const strongest = shadbala[0];
  const weakest = shadbala[shadbala.length - 1];
  const maxVirupas = Math.max(...shadbala.map((s) => s.totalVirupas));

  return (
    <section className="shadbala-panel">
      <div className="rules-header">
        <p className="kicker">Planetary Strength</p>
        <h2>Shadbala Analysis</h2>
      </div>

      <p className="shadbala-intro">
        Shadbala measures six-fold planetary strength. A strength ratio above
        1.0 indicates the planet meets its required minimum; below 0.7 signals
        an area that may need conscious reinforcement.
      </p>

      {/* Summary strip */}
      <div className="shadbala-summary">
        <div className="shadbala-summary-item shadbala-summary-strong">
          <span className="shadbala-summary-label">Strongest</span>
          <span className="shadbala-summary-planet">
            {PLANET_SYMBOLS[strongest.planet] ?? ""} {strongest.planet}
          </span>
          <span className="shadbala-summary-value">
            {strongest.totalVirupas} virupas ({strongest.strengthRatio}x)
          </span>
        </div>
        <div className="shadbala-summary-item shadbala-summary-weak">
          <span className="shadbala-summary-label">Weakest</span>
          <span className="shadbala-summary-planet">
            {PLANET_SYMBOLS[weakest.planet] ?? ""} {weakest.planet}
          </span>
          <span className="shadbala-summary-value">
            {weakest.totalVirupas} virupas ({weakest.strengthRatio}x)
          </span>
        </div>
      </div>

      {/* Bar chart */}
      <div className="shadbala-chart" role="list" aria-label="Shadbala strength chart">
        {shadbala.map((result) => {
          const barWidth = maxVirupas > 0 ? (result.totalVirupas / maxVirupas) * 100 : 0;
          const color = getStrengthColor(result.strengthRatio);
          const isExpanded = expandedPlanet === result.planet;

          return (
            <div key={result.planet} className="shadbala-row" role="listitem">
              <button
                type="button"
                className="shadbala-row-header"
                onClick={() =>
                  setExpandedPlanet(isExpanded ? null : result.planet)
                }
                aria-expanded={isExpanded}
              >
                <span className="shadbala-planet-name">
                  <span className="shadbala-planet-symbol">
                    {PLANET_SYMBOLS[result.planet] ?? ""}
                  </span>
                  {result.planet}
                </span>
                <div className="shadbala-bar-container">
                  <div
                    className="shadbala-bar-fill"
                    style={{
                      width: `${barWidth}%`,
                      background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                    }}
                  />
                  <div
                    className="shadbala-bar-threshold"
                    style={{
                      left: `${maxVirupas > 0 ? (result.requiredMinimum / maxVirupas) * 100 : 0}%`,
                    }}
                    title={`Required minimum: ${result.requiredMinimum}`}
                  />
                </div>
                <span className="shadbala-total" style={{ color }}>
                  {result.totalVirupas}
                </span>
                <span
                  className={`shadbala-ratio-badge ${
                    result.strengthRatio >= 1
                      ? "shadbala-ratio-strong"
                      : result.strengthRatio >= 0.7
                        ? "shadbala-ratio-moderate"
                        : "shadbala-ratio-weak"
                  }`}
                >
                  {result.strengthRatio}x
                </span>
                <span className={`shadbala-chevron ${isExpanded ? "shadbala-chevron-open" : ""}`}>
                  &#9662;
                </span>
              </button>

              {isExpanded && (
                <div className="shadbala-breakdown">
                  <div className="shadbala-breakdown-grid">
                    {COMPONENT_LABELS.map(({ key, label, description }) => {
                      const val = result[key] as number;
                      const maxComp = key === "sthanaBala" ? 195 : 60;
                      const compWidth = Math.min(100, (val / maxComp) * 100);
                      return (
                        <div key={key} className="shadbala-comp-row">
                          <div className="shadbala-comp-label">
                            <span className="shadbala-comp-name">{label}</span>
                            <span className="shadbala-comp-desc">{description}</span>
                          </div>
                          <div className="shadbala-comp-bar-container">
                            <div
                              className="shadbala-comp-bar-fill"
                              style={{
                                width: `${compWidth}%`,
                                background: color,
                              }}
                            />
                          </div>
                          <span className="shadbala-comp-value">
                            {val.toFixed(1)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="shadbala-breakdown-footer">
                    <span>Total: <strong>{result.totalVirupas}</strong> virupas ({result.totalRupas} rupas)</span>
                    <span>Required: <strong>{result.requiredMinimum}</strong></span>
                    <span className={`shadbala-strength-label ${
                      result.strengthRatio >= 1
                        ? "shadbala-label-strong"
                        : result.strengthRatio >= 0.7
                          ? "shadbala-label-moderate"
                          : "shadbala-label-weak"
                    }`}>
                      {getStrengthLabel(result.strengthRatio)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default memo(ShadbalaPanel);
