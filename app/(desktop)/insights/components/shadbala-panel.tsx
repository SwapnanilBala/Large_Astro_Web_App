"use client";

import { useState, memo } from "react";
import type {
  AshtakavargaData,
  PlanetPosition,
  ShadbalaResult,
} from "@/lib/astro-types";
import { useRouteMessages, useTranslation } from "@/lib/i18n-context";
import strengthMessages from "@/messages/en.strength.json";

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

/* The six components in reading order. Both the name and the one-line gloss
   are copy, so they live under strength.shadbala.components keyed by this
   same field name; only the field order is decided here. */
const COMPONENT_KEYS: (keyof ShadbalaResult)[] = [
  "sthanaBala",
  "digBala",
  "kalaBala",
  "cheshtaBala",
  "naisargikaBala",
  "drikBala",
];

function getStrengthColor(ratio: number): string {
  if (ratio >= 1.0) return "var(--accent-aqua, #6ce1d4)";
  if (ratio >= 0.7) return "var(--accent-gold, #f2c26c)";
  return "var(--accent-coral, #ff8f7e)";
}

function strengthLabelKey(ratio: number): string {
  if (ratio >= 1.2) return "veryStrong";
  if (ratio >= 1.0) return "strong";
  if (ratio >= 0.7) return "moderate";
  return "weak";
}

/* Planet and sign names come from the baseline namespaces the layout already
   loads, not from this route's catalog. Shadbala covers the seven grahas
   only, so `planetNames` always answers. */
function planetLabel(t: (key: string) => string, planet: string): string {
  return t(`planetNames.${planet.toLowerCase()}`);
}

function signLabel(t: (key: string) => string, sign: string): string {
  return t(`zodiacSigns.${sign.toLowerCase()}`);
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
  const { t } = useTranslation();
  const tr = useRouteMessages(strengthMessages);
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
      ? tr("strength.shadbala.strongestSignsLabel")
      : tr("strength.shadbala.strongestSignLabel");
  const weakestSignLabel =
    signExtremes && signExtremes.weakestSigns.length > 1
      ? tr("strength.shadbala.weakestSignsLabel")
      : tr("strength.shadbala.weakestSignLabel");

  return (
    <section className="shadbala-panel">
      <div className="rules-header">
        <p className="kicker">{tr("strength.shadbala.kicker")}</p>
        <h2>{tr("strength.shadbala.heading")}</h2>
      </div>

      <p className="shadbala-intro">{tr("strength.shadbala.intro")}</p>

      {/* Summary strip */}
      <div className="shadbala-summary">
        <div className="shadbala-summary-item shadbala-summary-strong">
          <span className="shadbala-summary-label">
            {tr("strength.shadbala.highestRatioLabel")}
          </span>
          <span className="shadbala-summary-planet">
            {PLANET_SYMBOLS[strongest.planet] ?? ""} {planetLabel(t, strongest.planet)}
          </span>
          <span className="shadbala-summary-value">
            {tr("strength.shadbala.summaryValue", {
              virupas: String(strongest.totalVirupas),
              ratio: String(strongest.strengthRatio),
            })}
          </span>
        </div>
        <div className="shadbala-summary-item shadbala-summary-weak">
          <span className="shadbala-summary-label">
            {tr("strength.shadbala.lowestRatioLabel")}
          </span>
          <span className="shadbala-summary-planet">
            {PLANET_SYMBOLS[weakest.planet] ?? ""} {planetLabel(t, weakest.planet)}
          </span>
          <span className="shadbala-summary-value">
            {tr("strength.shadbala.summaryValue", {
              virupas: String(weakest.totalVirupas),
              ratio: String(weakest.strengthRatio),
            })}
          </span>
        </div>
      </div>

      {/* Bar chart */}
      <div
        className="shadbala-chart"
        role="list"
        aria-label={tr("strength.shadbala.chartAriaLabel")}
      >
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
                  {planetLabel(t, result.planet)}
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
                    title={tr("strength.shadbala.requiredMinimumTitle", {
                      value: String(result.requiredMinimum),
                    })}
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
                  {tr("strength.shadbala.ratioBadge", {
                    ratio: String(result.strengthRatio),
                  })}
                </span>
                <span className={`shadbala-chevron ${isExpanded ? "shadbala-chevron-open" : ""}`}>
                  &#9662;
                </span>
              </button>

              {isExpanded && (
                <div className="shadbala-breakdown">
                  <div className="shadbala-breakdown-grid">
                    {COMPONENT_KEYS.map((key) => {
                      const val = result[key] as number;
                      const maxComp = key === "sthanaBala" ? 195 : 60;
                      const compWidth = Math.min(100, (val / maxComp) * 100);
                      return (
                        <div key={key} className="shadbala-comp-row">
                          <div className="shadbala-comp-label">
                            <span className="shadbala-comp-name">
                              {tr(`strength.shadbala.components.${key}.label`)}
                            </span>
                            <span className="shadbala-comp-desc">
                              {tr(`strength.shadbala.components.${key}.description`)}
                            </span>
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
                    <span>
                      {tr("strength.shadbala.totalLabel")}{" "}
                      <strong>{result.totalVirupas}</strong>{" "}
                      {tr("strength.shadbala.totalSuffix", {
                        rupas: String(result.totalRupas),
                      })}
                    </span>
                    <span>
                      {tr("strength.shadbala.requiredLabel")}{" "}
                      <strong>{result.requiredMinimum}</strong>
                    </span>
                    <span className={`shadbala-strength-label ${
                      result.strengthRatio >= 1
                        ? "shadbala-label-strong"
                        : result.strengthRatio >= 0.7
                          ? "shadbala-label-moderate"
                          : "shadbala-label-weak"
                    }`}>
                      {tr(
                        `strength.shadbala.strengthLabels.${strengthLabelKey(result.strengthRatio)}`
                      )}
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
            <p className="shadbala-sign-context-kicker">
              {tr("strength.shadbala.signContextKicker")}
            </p>
            <h3 id="shadbala-sign-context-heading">
              {tr("strength.shadbala.signContextHeading")}
            </h3>
          </div>
          <span className="shadbala-sign-context-source">
            {tr("strength.shadbala.signContextSource")}
          </span>
        </div>

        <p className="shadbala-sign-context-intro">
          {tr("strength.shadbala.signContextIntro")}
        </p>

        {signExtremes ? (
          <>
            <div
              className="shadbala-sign-summary"
              aria-label={tr("strength.shadbala.signSummaryAriaLabel")}
            >
              <article className="shadbala-sign-card shadbala-sign-card--strong">
                <p>{strongestSignLabel}</p>
                <div className="shadbala-sign-chip-list">
                  {signExtremes.strongestSigns.map((sign) => (
                    <span key={sign} className="shadbala-sign-chip">
                      <span aria-hidden="true">{SIGN_GLYPHS[sign]}</span>{" "}
                      {signLabel(t, sign)}
                    </span>
                  ))}
                </div>
                <strong>
                  {tr("strength.shadbala.savBindus", {
                    bindus: formatBindus(signExtremes.strongestScore),
                  })}
                </strong>
              </article>

              <article className="shadbala-sign-card shadbala-sign-card--weak">
                <p>{weakestSignLabel}</p>
                <div className="shadbala-sign-chip-list">
                  {signExtremes.weakestSigns.map((sign) => (
                    <span key={sign} className="shadbala-sign-chip">
                      <span aria-hidden="true">{SIGN_GLYPHS[sign]}</span>{" "}
                      {signLabel(t, sign)}
                    </span>
                  ))}
                </div>
                <strong>
                  {tr("strength.shadbala.savBindus", {
                    bindus: formatBindus(signExtremes.weakestScore),
                  })}
                </strong>
              </article>
            </div>

            <div className="shadbala-sign-planet-context">
              <p className="shadbala-sign-planet-context-label">
                {tr("strength.shadbala.relatesLabel")}
              </p>
              {/* The full stop after the placement clause is the one piece of
                  punctuation here that no catalog string can carry: the clause
                  before it is optional, so the stop cannot live at the end of
                  either the ratio sentence or the placement clause without
                  doubling up or going missing. It stays a literal, which means
                  Devanagari and Bengali get a Latin "." at this one spot
                  rather than a danda. Splitting the two variants into four
                  whole sentences would fix it and is the right move the next
                  time this copy is edited. */}
              <div className="shadbala-sign-planet-context-grid">
                <p>
                  <strong>{planetLabel(t, strongest.planet)}</strong>{" "}
                  {tr("strength.shadbala.highestRatioSentence", {
                    ratio: String(strongest.strengthRatio),
                  })}
                  {strongestPlacement
                    ? ` ${tr("strength.shadbala.placedIn", {
                        sign: signLabel(t, strongestPlacement.sign),
                      })}`
                    : ""}
                  {"."}{" "}
                  {strongestPlacement && signExtremes.strongestSigns.includes(strongestPlacement.sign)
                    ? tr("strength.shadbala.strongestSignMatch")
                    : tr("strength.shadbala.strongestSignNoMatch")}
                </p>
                <p>
                  <strong>{planetLabel(t, weakest.planet)}</strong>{" "}
                  {tr("strength.shadbala.lowestRatioSentence", {
                    ratio: String(weakest.strengthRatio),
                  })}
                  {weakestPlacement
                    ? ` ${tr("strength.shadbala.placedIn", {
                        sign: signLabel(t, weakestPlacement.sign),
                      })}`
                    : ""}
                  {"."}{" "}
                  {weakestPlacement && signExtremes.weakestSigns.includes(weakestPlacement.sign)
                    ? tr("strength.shadbala.weakestSignMatch")
                    : tr("strength.shadbala.weakestSignNoMatch")}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="shadbala-sign-unavailable" role="status">
            <strong>{tr("strength.shadbala.unavailableTitle")}</strong>
            <span>{tr("strength.shadbala.unavailableBody")}</span>
          </div>
        )}
      </section>
    </section>
  );
}

export default memo(ShadbalaPanel);
