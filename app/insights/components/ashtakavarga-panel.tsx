"use client";

import { useState } from "react";
import type { AshtakavargaData, TransitData } from "@/lib/astro-types";

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const SIGN_GLYPHS: Record<string, string> = {
  Aries: "\u2648", Taurus: "\u2649", Gemini: "\u264A", Cancer: "\u264B",
  Leo: "\u264C", Virgo: "\u264D", Libra: "\u264E", Scorpio: "\u264F",
  Sagittarius: "\u2650", Capricorn: "\u2651", Aquarius: "\u2652", Pisces: "\u2653",
};

const BAV_PLANETS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];

type Props = {
  ashtakavarga: AshtakavargaData;
  transits?: TransitData | null;
};

function binduClass(value: number, isSAV: boolean): string {
  if (isSAV) {
    if (value >= 28) return "ashtakavarga-cell ashtakavarga-cell--strong";
    if (value <= 25) return "ashtakavarga-cell ashtakavarga-cell--weak";
    return "ashtakavarga-cell ashtakavarga-cell--neutral";
  }
  // BAV: max per planet is 8
  if (value >= 5) return "ashtakavarga-cell ashtakavarga-cell--strong";
  if (value <= 2) return "ashtakavarga-cell ashtakavarga-cell--weak";
  return "ashtakavarga-cell ashtakavarga-cell--neutral";
}

function getTransitSign(transits: TransitData | null | undefined, planet: string): string | null {
  if (!transits) return null;
  const pos = transits.positions.find((p) => p.name === planet);
  return pos?.sign ?? null;
}

export default function AshtakavargaPanel({ ashtakavarga, transits }: Props) {
  const [selectedPlanet, setSelectedPlanet] = useState<string | null>(null);

  const showingBAV = selectedPlanet !== null;
  const bavData = selectedPlanet ? ashtakavarga.bhinnashtakavarga[selectedPlanet] : null;

  return (
    <section className="ashtakavarga-panel">
      <div className="rules-header">
        <p className="kicker">Vedic Transit Strength</p>
        <h2>Ashtakavarga</h2>
        <small className="ashtakavarga-total">
          Total bindus: {ashtakavarga.totalBindus}
        </small>
      </div>

      {/* Planet selector tabs */}
      <div className="ashtakavarga-tabs">
        <button
          type="button"
          className={`ashtakavarga-tab${selectedPlanet === null ? " ashtakavarga-tab--active" : ""}`}
          onClick={() => setSelectedPlanet(null)}
        >
          SAV Total
        </button>
        {BAV_PLANETS.map((planet) => (
          <button
            key={planet}
            type="button"
            className={`ashtakavarga-tab${selectedPlanet === planet ? " ashtakavarga-tab--active" : ""}`}
            onClick={() => setSelectedPlanet(planet)}
          >
            {planet}
          </button>
        ))}
      </div>

      {/* Grid display */}
      <div className="ashtakavarga-grid">
        {SIGNS.map((sign, i) => {
          const value = showingBAV && bavData ? bavData[i] : ashtakavarga.sarvashtakavarga[i];
          const cellClass = binduClass(value, !showingBAV);
          const transitSign = showingBAV ? getTransitSign(transits, selectedPlanet!) : null;
          const isTransiting = transitSign === sign;

          return (
            <div
              key={sign}
              className={`${cellClass}${isTransiting ? " ashtakavarga-cell--transit" : ""}`}
            >
              <span className="ashtakavarga-glyph">{SIGN_GLYPHS[sign]}</span>
              <span className="ashtakavarga-sign-name">{sign}</span>
              <span className="ashtakavarga-bindu">{value}</span>
              {isTransiting && (
                <span className="ashtakavarga-transit-badge">
                  {selectedPlanet} transiting
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Strength summary */}
      <div className="ashtakavarga-summary">
        {ashtakavarga.strongSigns.length > 0 && (
          <div className="ashtakavarga-summary-group">
            <h4>Strong signs (SAV &ge; 28)</h4>
            <div className="ashtakavarga-sign-chips">
              {ashtakavarga.strongSigns.map((sign) => (
                <span key={sign} className="ashtakavarga-chip ashtakavarga-chip--strong">
                  {SIGN_GLYPHS[sign]} {sign}
                </span>
              ))}
            </div>
          </div>
        )}
        {ashtakavarga.weakSigns.length > 0 && (
          <div className="ashtakavarga-summary-group">
            <h4>Weak signs (SAV &le; 25)</h4>
            <div className="ashtakavarga-sign-chips">
              {ashtakavarga.weakSigns.map((sign) => (
                <span key={sign} className="ashtakavarga-chip ashtakavarga-chip--weak">
                  {SIGN_GLYPHS[sign]} {sign}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
