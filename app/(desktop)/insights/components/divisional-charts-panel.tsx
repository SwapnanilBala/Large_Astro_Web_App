"use client";

import { useState, memo } from "react";
import type { DivisionalChartInfo } from "@/lib/astro-types";
import { useRouteMessages } from "@/lib/i18n-context";
import divisionalMessages from "@/messages/en.divisional.json";

// --------------------------------------------------------------------------
// Props
// --------------------------------------------------------------------------

type DivisionalChartsPanelProps = {
  divisionalCharts: Record<number, DivisionalChartInfo>;
};

// --------------------------------------------------------------------------
// Chart metadata — what each division reveals
// --------------------------------------------------------------------------

/* The prose that went with each icon now lives under
   divisional.panel.themes.d<division> in messages/en.divisional.json. This map
   stays the record of which divisions have a theme at all: a division absent
   from it falls back to the engine's own description, rather than putting an
   unresolved translation key on screen. */
const DIVISION_META: Record<number, { icon: string }> = {
  1:  { icon: "\u25C9" },
  2:  { icon: "\u2600" },
  3:  { icon: "\u2694" },
  4:  { icon: "\u2302" },
  5:  { icon: "\u265B" },
  6:  { icon: "\u271A" },
  7:  { icon: "\u2764" },
  8:  { icon: "\u21AF" },
  9:  { icon: "\u2638" },
  10: { icon: "\u2692" },
  11: { icon: "\u2197" },
  12: { icon: "\u2B50" },
  16: { icon: "\u2708" },
  20: { icon: "\u2721" },
  24: { icon: "\u2710" },
  27: { icon: "\u2726" },
  30: { icon: "\u26A0" },
  40: { icon: "\u2728" },
  45: { icon: "\u2605" },
  60: { icon: "\u267E" },
};

// Planet Unicode glyphs (same as navamsa-chart.tsx)
const PLANET_GLYPHS: Record<string, string> = {
  Ascendant: "\u2191",
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
  const tr = useRouteMessages(divisionalMessages);
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
        <p className="kicker">{tr("divisional.panel.kicker")}</p>
        <h2>{tr("divisional.panel.heading")}</h2>
      </div>

      <p className="section-intro">{tr("divisional.panel.intro")}</p>

      {/* ── Division selector tabs ── */}
      <div
        className="divisional-tabs"
        role="tablist"
        aria-label={tr("divisional.panel.selectorLabel")}
      >
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
          {meta
            ? tr(`divisional.panel.themes.d${selectedDivision}`)
            : chart.description}
        </p>
      </div>

      {/* ── Planet positions table ── */}
      <div
        className="divisional-table"
        role="table"
        aria-label={tr("divisional.panel.tableLabel", { label: chart.label })}
      >
        <div className="divisional-row divisional-row--header" role="row">
          <span role="columnheader">{tr("divisional.panel.planet")}</span>
          <span role="columnheader">{tr("divisional.panel.rashiSign")}</span>
          <span role="columnheader" aria-hidden="true"></span>
          <span role="columnheader">
            {tr("divisional.panel.vargaSign", { label: chart.label })}
          </span>
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
                  <small className="divisional-same-label">
                    {tr("divisional.panel.same")}
                  </small>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Hint ── */}
      <p className="divisional-hint">{tr("divisional.panel.hint")}</p>
    </section>
  );
}

export default memo(DivisionalChartsPanel);
