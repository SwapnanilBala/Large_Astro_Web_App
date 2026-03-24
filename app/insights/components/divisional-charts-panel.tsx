"use client";

import { useState, memo } from "react";
import type { DivisionalChartInfo } from "@/lib/astro-types";

// --------------------------------------------------------------------------
// Props
// --------------------------------------------------------------------------

type DivisionalChartsPanelProps = {
  divisionalCharts: Record<number, DivisionalChartInfo>;
};

// --------------------------------------------------------------------------
// Chart metadata — what each division reveals
// --------------------------------------------------------------------------

const DIVISION_META: Record<number, { icon: string; theme: string }> = {
  2:  { icon: "\u2600", theme: "Wealth and financial capacity" },
  3:  { icon: "\u2694", theme: "Siblings, courage, and initiative" },
  4:  { icon: "\u2302", theme: "Property, fortune, and fixed assets" },
  7:  { icon: "\u2764", theme: "Children and progeny" },
  9:  { icon: "\u2638", theme: "Marriage, dharma, and inner nature" },
  10: { icon: "\u2692", theme: "Career, profession, and public life" },
  12: { icon: "\u2B50", theme: "Parents and ancestral lineage" },
  16: { icon: "\u2708", theme: "Vehicles, comforts, and happiness" },
  20: { icon: "\u2721", theme: "Spiritual progress and worship" },
  24: { icon: "\u2710", theme: "Education, learning, and knowledge" },
  27: { icon: "\u2726", theme: "Strengths and weaknesses" },
  30: { icon: "\u26A0", theme: "Misfortune, disease, and challenges" },
  40: { icon: "\u2728", theme: "Auspicious and inauspicious effects" },
  45: { icon: "\u2605", theme: "General indications and character" },
  60: { icon: "\u267E", theme: "Past life karma and general matters" },
};

// Planet Unicode glyphs (same as navamsa-chart.tsx)
const PLANET_GLYPHS: Record<string, string> = {
  Sun:     "\u2609",
  Moon:    "\u263D",
  Mercury: "\u263F",
  Venus:   "\u2640",
  Mars:    "\u2642",
  Jupiter: "\u2643",
  Saturn:  "\u2644",
  Rahu:    "\u260A",
  Ketu:    "\u260B",
};

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

function DivisionalChartsPanel({
  divisionalCharts,
}: DivisionalChartsPanelProps) {
  const divisionKeys = Object.keys(divisionalCharts)
    .map(Number)
    .sort((a, b) => a - b);

  const [selectedDivision, setSelectedDivision] = useState<number>(
    divisionKeys[0] ?? 2
  );

  const chart = divisionalCharts[selectedDivision];
  if (!chart) return null;

  const meta = DIVISION_META[selectedDivision];

  return (
    <section className="divisional-panel">
      <div className="rules-header">
        <p className="kicker">Varga Charts</p>
        <h2>Divisional Charts</h2>
      </div>

      <p className="section-intro">
        Divisional charts (Vargas) magnify specific life themes by subdividing
        each sign into smaller portions. Select a chart below to see where each
        planet lands in that division.
      </p>

      {/* ── Division selector tabs ── */}
      <div className="divisional-tabs" role="tablist" aria-label="Divisional chart selector">
        {divisionKeys.map((div) => {
          const info = divisionalCharts[div];
          const isActive = div === selectedDivision;
          return (
            <button
              key={div}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`divisional-tab${isActive ? " divisional-tab--active" : ""}`}
              onClick={() => setSelectedDivision(div)}
            >
              <span className="divisional-tab-label">{info.label}</span>
              <span className="divisional-tab-name">
                {DIVISION_META[div]?.icon ?? ""}{" "}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Theme description ── */}
      <div className="divisional-theme-card">
        <span className="divisional-theme-badge">{chart.label}</span>
        <p className="divisional-theme-text">
          {meta?.theme ?? chart.description}
        </p>
      </div>

      {/* ── Planet positions table ── */}
      <div className="divisional-table" role="table" aria-label={`${chart.label} planetary positions`}>
        <div className="divisional-row divisional-row--header" role="row">
          <span role="columnheader">Planet</span>
          <span role="columnheader">Rashi Sign</span>
          <span role="columnheader" aria-hidden="true"></span>
          <span role="columnheader">{chart.label} Sign</span>
        </div>

        {chart.positions.map((pos) => {
          const isSameSign = pos.rashi_sign === pos.divisional_sign;
          const glyph = PLANET_GLYPHS[pos.name] ?? pos.name;

          return (
            <div
              key={pos.name}
              className={`divisional-row${isSameSign ? " divisional-same-sign" : ""}`}
              role="row"
            >
              <span className="divisional-planet" role="cell">
                <span className="divisional-planet-glyph" aria-hidden="true">
                  {glyph}
                </span>
                <span className="divisional-planet-name">{pos.name}</span>
              </span>
              <span className="divisional-sign" role="cell">{pos.rashi_sign}</span>
              <span className="divisional-arrow" role="cell" aria-hidden="true">&rarr;</span>
              <span className="divisional-sign" role="cell">
                {pos.divisional_sign}
                {isSameSign && (
                  <small className="divisional-same-label">Same</small>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Hint ── */}
      <p className="divisional-hint">
        Planets in the same sign as their rashi position are highlighted.
        This repetition strengthens that planet&apos;s expression in the
        corresponding life area.
      </p>
    </section>
  );
}

export default memo(DivisionalChartsPanel);
