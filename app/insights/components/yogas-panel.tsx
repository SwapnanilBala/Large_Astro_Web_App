"use client";

import { useState, memo } from "react";
import type { YogaDetectionResult } from "@/lib/astro-types";

// --------------------------------------------------------------------------
// Planet glyph mapping
// --------------------------------------------------------------------------

const PLANET_GLYPHS: Record<string, string> = {
  Sun: "\u2609",
  Moon: "\u263D",
  Mercury: "\u263F",
  Venus: "\u2640",
  Mars: "\u2642",
  Jupiter: "\u2643",
  Saturn: "\u2644",
  Rahu: "\u260A",
  Ketu: "\u260B",
};

// --------------------------------------------------------------------------
// Category metadata
// --------------------------------------------------------------------------

type CategoryKey = YogaDetectionResult["category"] | "all";

const CATEGORY_META: Record<CategoryKey, { label: string; emoji: string }> = {
  all: { label: "All Yogas", emoji: "\u2728" },
  mahapurusha: { label: "Mahapurusha", emoji: "\uD83D\uDC51" },
  wealth: { label: "Wealth & Raja", emoji: "\uD83D\uDCB0" },
  benefic: { label: "Benefic", emoji: "\u2B50" },
  challenging: { label: "Challenging", emoji: "\u26A0\uFE0F" },
  viparita: { label: "Viparita Raja", emoji: "\uD83D\uDD04" },
  nabhasa: { label: "Nabhasa", emoji: "\uD83C\uDF10" },
};

const CATEGORY_KEYS: CategoryKey[] = [
  "all",
  "mahapurusha",
  "wealth",
  "benefic",
  "challenging",
  "viparita",
  "nabhasa",
];

// --------------------------------------------------------------------------
// Strength indicator
// --------------------------------------------------------------------------

function StrengthIndicator({ strength }: { strength: "strong" | "moderate" | "weak" }) {
  const dots = strength === "strong" ? 3 : strength === "moderate" ? 2 : 1;
  return (
    <span className="yoga-strength" aria-label={`Strength: ${strength}`}>
      {Array.from({ length: 3 }, (_, i) => (
        <span
          key={i}
          className={`yoga-strength-dot ${i < dots ? `yoga-strength-dot--active yoga-strength-dot--${strength}` : ""}`}
        />
      ))}
      <span className="yoga-strength-label">{strength}</span>
    </span>
  );
}

function fallbackActivationTiming(yoga: YogaDetectionResult): string {
  if (yoga.activation_timing) return yoga.activation_timing;
  if (yoga.strength === "strong") return "Most active during involved planet dashas and major transits to the yoga houses.";
  if (yoga.strength === "moderate") return "Most noticeable when the involved planets are emphasized by dasha or transit.";
  return "Usually situational, becoming visible during short transit triggers or focused life choices.";
}

function fallbackTraits(yoga: YogaDetectionResult): string[] {
  if (yoga.key_traits?.length) return yoga.key_traits;
  const categoryTraits: Record<YogaDetectionResult["category"], string[]> = {
    mahapurusha: ["command", "life direction", "visible strength"],
    wealth: ["resources", "status", "opportunity"],
    benefic: ["support", "growth", "ease"],
    challenging: ["discipline", "repair", "self-awareness"],
    viparita: ["resilience", "reversal", "recovery"],
    nabhasa: ["patterning", "temperament", "life structure"],
  };
  return categoryTraits[yoga.category];
}

// --------------------------------------------------------------------------
// Yoga card
// --------------------------------------------------------------------------

function YogaCard({ yoga, rank }: { yoga: YogaDetectionResult; rank: number }) {
  const isBenefic = ["mahapurusha", "wealth", "benefic", "viparita"].includes(yoga.category);
  const isChallenging = yoga.category === "challenging";
  const isPriority = rank <= 10;
  const activationTiming = fallbackActivationTiming(yoga);
  const traits = fallbackTraits(yoga);

  const borderClass = isBenefic
    ? "yoga-card--benefic"
    : isChallenging
      ? "yoga-card--challenging"
      : "";

  return (
    <article className={`yoga-card ${borderClass} ${isPriority ? "yoga-card--priority" : ""}`}>
      <header className="yoga-card-header">
        <div className="yoga-card-titles">
          <div className="yoga-card-rank-row">
            {isPriority && (
              <span className="yoga-priority-badge">Top {rank}</span>
            )}
            <h3 className="yoga-card-name">{yoga.name}</h3>
          </div>
          <span className="yoga-card-sanskrit">{yoga.sanskrit}</span>
        </div>
        <div className="yoga-card-metrics">
          <StrengthIndicator strength={yoga.strength} />
          <span className="yoga-occurrence">
            {yoga.occurrence_chance}% chance
          </span>
        </div>
      </header>

      <div className="yoga-card-planets">
        {yoga.involved_planets.map((planet) => (
          <span key={planet} className="yoga-planet-chip">
            <span className="yoga-planet-glyph">{PLANET_GLYPHS[planet] ?? ""}</span>
            {planet}
          </span>
        ))}
      </div>

      <p className="yoga-card-description">{yoga.description}</p>
      <p className="yoga-card-effects">{yoga.effects}</p>

      {isPriority && (
        <div className="yoga-card-deep-read">
          <p className="yoga-card-detail">
            {yoga.detailed_description ??
              `${yoga.name} is one of the strongest detected combinations in this chart, so its effects deserve more weight than the lighter matches below.`}
          </p>
          <div className="yoga-card-activation">
            <span>Activation timing</span>
            <p>{activationTiming}</p>
          </div>
          <div className="yoga-card-traits" aria-label={`${yoga.name} traits`}>
            {traits.map((trait) => (
              <span key={trait}>{trait}</span>
            ))}
          </div>
        </div>
      )}

      {yoga.cancellation && (
        <p className="yoga-card-cancellation">{yoga.cancellation}</p>
      )}
    </article>
  );
}

// --------------------------------------------------------------------------
// Main panel
// --------------------------------------------------------------------------

type YogasPanelProps = {
  yogas: YogaDetectionResult[];
};

function YogasPanel({ yogas }: YogasPanelProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("all");
  const rankedYogas = [...yogas].sort((a, b) => {
    if (b.occurrence_chance !== a.occurrence_chance) {
      return b.occurrence_chance - a.occurrence_chance;
    }
    const strengthOrder: Record<YogaDetectionResult["strength"], number> = {
      strong: 0,
      moderate: 1,
      weak: 2,
    };
    return strengthOrder[a.strength] - strengthOrder[b.strength];
  });
  const rankByYogaId = new Map(
    rankedYogas.map((yoga, index) => [yoga.yoga_id, index + 1])
  );

  const filtered =
    activeCategory === "all"
      ? rankedYogas
      : rankedYogas.filter((y) => y.category === activeCategory);

  // Count per category
  const counts: Record<CategoryKey, number> = {
    all: yogas.length,
    mahapurusha: 0,
    wealth: 0,
    benefic: 0,
    challenging: 0,
    viparita: 0,
    nabhasa: 0,
  };
  for (const y of yogas) {
    counts[y.category] = (counts[y.category] || 0) + 1;
  }

  return (
    <section className="yogas-panel">
      <div className="rules-header">
        <p className="kicker">Classical Combinations</p>
        <h2>Planetary Yogas</h2>
      </div>

      <p className="yogas-intro">
        Yogas are classical planetary combinations that shape life patterns.
        Each yoga below was detected in this natal chart based on planet positions,
        sign rulership, and house placement.
      </p>

      {/* Category filter tabs */}
      <div className="yogas-tabs" role="tablist" aria-label="Yoga category filter">
        {CATEGORY_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeCategory === key}
            className={`yogas-tab ${activeCategory === key ? "yogas-tab--active" : ""}`}
            onClick={() => setActiveCategory(key)}
          >
            {CATEGORY_META[key].label}
            {counts[key] > 0 && (
              <span className="yogas-tab-count">{counts[key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Yoga cards */}
      {filtered.length > 0 ? (
        <div className="yogas-grid" role="list" aria-label="Detected yogas">
          {filtered.map((yoga) => (
            <YogaCard
              key={yoga.yoga_id}
              yoga={yoga}
              rank={rankByYogaId.get(yoga.yoga_id) ?? filtered.length}
            />
          ))}
        </div>
      ) : (
        <div className="yogas-empty">
          <p>No yogas found in this category for this chart.</p>
        </div>
      )}
    </section>
  );
}

export default memo(YogasPanel);
