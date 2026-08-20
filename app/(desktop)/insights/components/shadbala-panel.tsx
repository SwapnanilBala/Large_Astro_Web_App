"use client";

import { useState, memo } from "react";
import type {
  AshtakavargaData,
  PlanetPosition,
  ShadbalaResult,
} from "@/lib/astro-types";

type ShadbalaPanelProps = {
  shadbala: ShadbalaResult[];
  planets?: PlanetPosition[];
  ashtakavarga?: AshtakavargaData | null;
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

const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;

const SIGN_GLYPHS: Record<string, string> = {
  Aries: "\u2648", Taurus: "\u2649", Gemini: "\u264A", Cancer: "\u264B",
  Leo: "\u264C", Virgo: "\u264D", Libra: "\u264E", Scorpio: "\u264F",
  Sagittarius: "\u2650", Capricorn: "\u2651", Aquarius: "\u2652", Pisces: "\u2653",
};

export type SarvashtakavargaSignExtremes = {
  strongestSigns: string[];
  weakestSigns: string[];
  strongestScore: number;
  weakestScore: number;
};

/**
 * Shadbala assesses planetary strength, while Sarvashtakavarga (SAV) scores
 * sign fields. Keep the two measurements separate rather than deriving a
 * "strong sign" from a planet's Shadbala score.
 */
export function getSarvashtakavargaSignExtremes(
  ashtakavarga?: AshtakavargaData | null,
): SarvashtakavargaSignExtremes | null {
  const sav = ashtakavarga?.sarvashtakavarga;
  if (
    !Array.isArray(sav) ||
    sav.length !== ZODIAC_SIGNS.length ||
    sav.some((score) => !Number.isFinite(score))
  ) {
    return null;
  }

  const strongestScore = Math.max(...sav);
  const weakestScore = Math.min(...sav);

  return {
    strongestSigns: ZODIAC_SIGNS.filter(
      (_sign, index) => sav[index] === strongestScore,
    ),
    weakestSigns: ZODIAC_SIGNS.filter(
      (_sign, index) => sav[index] === weakestScore,
    ),
    strongestScore,
    weakestScore,
  };
}

export type ShadbalaRatioExtremes = {
  strongest: ShadbalaResult;
  weakest: ShadbalaResult;
};

/**
 * Each graha has a different required minimum, so the summary uses the
 * normalized Shadbala ratio rather than raw virupas alone.
 */
export function getShadbalaRatioExtremes(
  shadbala: ShadbalaResult[],
): ShadbalaRatioExtremes | null {
  if (shadbala.length === 0) return null;

  const ranked = [...shadbala].sort(
    (left, right) =>
      right.strengthRatio - left.strengthRatio ||
      right.totalVirupas - left.totalVirupas,
  );

  return {
    strongest: ranked[0],
    weakest: ranked[ranked.length - 1],
  };
}

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

function formatBindus(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function getPlanetPlacement(
  planetName: string,
  planets?: PlanetPosition[],
): PlanetPosition | undefined {
  return planets?.find((planet) => planet.name === planetName);
}

function ShadbalaPanel({ shadbala, planets, ashtakavarga }: ShadbalaPanelProps) {
  const [expandedPlanet, setExpandedPlanet] = useState<string | null>(null);

  if (!shadbala || shadbala.length === 0) return null;

  const ratioExtremes = getShadbalaRatioExtremes(shadbala);
  if (!ratioExtremes) return null;
  const { strongest, weakest } = ratioExtremes;
  const maxVirupas = Math.max(...shadbala.map((s) => s.totalVirupas));
  const signExtremes = getSarvashtakavargaSignExtremes(ashtakavarga);
  const strongestPlacement = getPlanetPlacement(strongest.planet, planets);
  const weakestPlacement = getPlanetPlacement(weakest.planet, planets);
  const strongestSignLabel =
    signExtremes && signExtremes.strongestSigns.length > 1
      ? "Joint strongest signs by SAV"
      : "Strongest sign by SAV";
  const weakestSignLabel =
    signExtremes && signExtremes.weakestSigns.length > 1
      ? "Joint weakest signs by SAV"
      : "Weakest sign by SAV";

  return (
    <section className="shadbala-panel">
      <div className="rules-header">
        <p className="kicker">Planetary Strength</p>
        <h2>Shadbala Analysis</h2>
      </div>

      <p className="shadbala-intro">
        Shadbala measures six-fold planetary strength. A strength ratio above
        1.0 indicates the planet meets its required minimum; below 0.7 signals
        an area that may need conscious reinforcement. The summary normalizes
        each planet against its own required minimum before ranking it.
      </p>

      {/* Summary strip */}
      <div className="shadbala-summary">
        <div className="shadbala-summary-item shadbala-summary-strong">
          <span className="shadbala-summary-label">Highest ratio</span>
          <span className="shadbala-summary-planet">
            {PLANET_SYMBOLS[strongest.planet] ?? ""} {strongest.planet}
          </span>
          <span className="shadbala-summary-value">
            {strongest.totalVirupas} virupas ({strongest.strengthRatio}x)
          </span>
        </div>
        <div className="shadbala-summary-item shadbala-summary-weak">
          <span className="shadbala-summary-label">Lowest ratio</span>
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

      <section className="shadbala-sign-context" aria-labelledby="shadbala-sign-context-heading">
        <div className="shadbala-sign-context-header">
          <div>
            <p className="shadbala-sign-context-kicker">Sign-level context</p>
            <h3 id="shadbala-sign-context-heading">Strongest and weakest sign</h3>
          </div>
          <span className="shadbala-sign-context-source">Source: Sarvashtakavarga (SAV)</span>
        </div>

        <p className="shadbala-sign-context-intro">
          Shadbala ranks planets, not signs. The sign labels below come from
          Sarvashtakavarga totals: more bindus indicate relatively more
          support when that sign&apos;s field is activated, while fewer indicate a
          need for more care. They are not a verdict on a zodiac sign or a
          standalone prediction.
        </p>

        {signExtremes ? (
          <>
            <div className="shadbala-sign-summary" aria-label="Sarvashtakavarga sign strength summary">
              <article className="shadbala-sign-card shadbala-sign-card--strong">
                <p>{strongestSignLabel}</p>
                <div className="shadbala-sign-chip-list">
                  {signExtremes.strongestSigns.map((sign) => (
                    <span key={sign} className="shadbala-sign-chip">
                      <span aria-hidden="true">{SIGN_GLYPHS[sign]}</span> {sign}
                    </span>
                  ))}
                </div>
                <strong>{formatBindus(signExtremes.strongestScore)} SAV bindus</strong>
              </article>

              <article className="shadbala-sign-card shadbala-sign-card--weak">
                <p>{weakestSignLabel}</p>
                <div className="shadbala-sign-chip-list">
                  {signExtremes.weakestSigns.map((sign) => (
                    <span key={sign} className="shadbala-sign-chip">
                      <span aria-hidden="true">{SIGN_GLYPHS[sign]}</span> {sign}
                    </span>
                  ))}
                </div>
                <strong>{formatBindus(signExtremes.weakestScore)} SAV bindus</strong>
              </article>
            </div>

            <div className="shadbala-sign-planet-context">
              <p className="shadbala-sign-planet-context-label">How this relates to Shadbala</p>
              <div className="shadbala-sign-planet-context-grid">
                <p>
                  <strong>{strongest.planet}</strong> has the highest Shadbala ratio
                  ({strongest.strengthRatio}x)
                  {strongestPlacement ? ` and is placed in ${strongestPlacement.sign}` : ""}.
                  {strongestPlacement && signExtremes.strongestSigns.includes(strongestPlacement.sign)
                    ? " Its natal placement also falls in a highest-SAV sign. Treat both as separate contextual indicators, not a combined score."
                    : " This measures planetary capacity separately from the SAV sign score; the two should not be averaged."}
                </p>
                <p>
                  <strong>{weakest.planet}</strong> has the lowest Shadbala ratio
                  ({weakest.strengthRatio}x)
                  {weakestPlacement ? ` and is placed in ${weakestPlacement.sign}` : ""}.
                  {weakestPlacement && signExtremes.weakestSigns.includes(weakestPlacement.sign)
                    ? " Its natal placement also falls in a lowest-SAV sign. Treat both as separate contextual indicators, not a combined score."
                    : " A lower SAV sign is a different signal from a lower Shadbala planet, so read both in their own context."}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="shadbala-sign-unavailable" role="status">
            <strong>Sign-level context is unavailable for this reading.</strong>
            <span>
              Shadbala still identifies the strongest and weakest planets above,
              but it cannot by itself identify a strongest or weakest sign. SAV
              data was not included, so no sign-level conclusion is being inferred.
            </span>
          </div>
        )}
      </section>
    </section>
  );
}

export default memo(ShadbalaPanel);
