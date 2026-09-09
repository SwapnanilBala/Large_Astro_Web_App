"use client";

import { useState, memo } from "react";
import type { YogaDetectionResult } from "@/lib/astro-types";
import { useRouteMessages, useTranslation } from "@/lib/i18n-context";
import strengthMessages from "@/messages/en.strength.json";

type Translator = (key: string, params?: Record<string, string>) => string;

/*
 * The seven grahas live in the baseline `planetNames` namespace, which every
 * page under this layout already loads; Rahu and Ketu are not in it, so the
 * two nodes carry their own keys here. A name that is in neither — the API can
 * name a lagna or a special point among `involved_planets` — renders as sent
 * rather than as a raw key.
 */
function planetLabel(t: Translator, tr: Translator, planet: string): string {
  const baseKey = `planetNames.${planet.toLowerCase()}`;
  const base = t(baseKey);
  if (base !== baseKey) return base;

  const extraKey = `strength.planets.${planet.toLowerCase()}`;
  const extra = tr(extraKey);
  return extra === extraKey ? planet : extra;
}

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

/* The labels moved to strength.yogas.categories. The emoji that used to sit
   beside each one in this table was never rendered, so it went with them. */
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
  const tr = useRouteMessages(strengthMessages);
  const dots = strength === "strong" ? 3 : strength === "moderate" ? 2 : 1;
  const label = tr(`strength.yogas.strengthLabels.${strength}`);
  return (
    <span
      className="yoga-strength"
      aria-label={tr("strength.yogas.strengthAria", { strength: label })}
    >
      {Array.from({ length: 3 }, (_, i) => (
        <span
          key={i}
          className={`yoga-strength-dot ${i < dots ? `yoga-strength-dot--active yoga-strength-dot--${strength}` : ""}`}
        />
      ))}
      <span className="yoga-strength-label">{label}</span>
    </span>
  );
}

function fallbackActivationTiming(yoga: YogaDetectionResult, tr: Translator): string {
  if (yoga.activation_timing) return yoga.activation_timing;
  if (yoga.strength === "strong") return tr("strength.yogas.activationStrong");
  if (yoga.strength === "moderate") return tr("strength.yogas.activationModerate");
  return tr("strength.yogas.activationWeak");
}

function fallbackTraits(yoga: YogaDetectionResult, tr: Translator): string[] {
  if (yoga.key_traits?.length) return yoga.key_traits;
  /* Three per category, numbered rather than an array: the flattener the
     translator runs on would turn a JSON array into `.0`/`.1`/`.2` keys. */
  return [1, 2, 3].map((slot) =>
    tr(`strength.yogas.traits.${yoga.category}.${slot}`)
  );
}

// --------------------------------------------------------------------------
// Yoga card
// --------------------------------------------------------------------------

function YogaCard({ yoga, rank }: { yoga: YogaDetectionResult; rank: number }) {
  const { t } = useTranslation();
  const tr = useRouteMessages(strengthMessages);
  const isBenefic = ["mahapurusha", "wealth", "benefic", "viparita"].includes(yoga.category);
  const isChallenging = yoga.category === "challenging";
  const isPriority = rank <= 10;
  const activationTiming = fallbackActivationTiming(yoga, tr);
  const traits = fallbackTraits(yoga, tr);

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
              <span className="yoga-priority-badge">
                {tr("strength.yogas.topBadge", { rank: String(rank) })}
              </span>
            )}
            <h3 className="yoga-card-name">{yoga.name}</h3>
          </div>
          <span className="yoga-card-sanskrit">{yoga.sanskrit}</span>
        </div>
        <div className="yoga-card-metrics">
          <StrengthIndicator strength={yoga.strength} />
          <span className="yoga-occurrence">
            {tr("strength.yogas.occurrenceChance", {
              chance: String(yoga.occurrence_chance),
            })}
          </span>
        </div>
      </header>

      <div className="yoga-card-planets">
        {yoga.involved_planets.map((planet) => (
          <span key={planet} className="yoga-planet-chip">
            <span className="yoga-planet-glyph">{PLANET_GLYPHS[planet] ?? ""}</span>
            {planetLabel(t, tr, planet)}
          </span>
        ))}
      </div>

      <p className="yoga-card-description">{yoga.description}</p>
      <p className="yoga-card-effects">{yoga.effects}</p>

      {isPriority && (
        <div className="yoga-card-deep-read">
          <p className="yoga-card-detail">
            {yoga.detailed_description ??
              tr("strength.yogas.detailFallback", { name: yoga.name })}
          </p>
          <div className="yoga-card-activation">
            <span>{tr("strength.yogas.activationTimingLabel")}</span>
            <p>{activationTiming}</p>
          </div>
          <div
            className="yoga-card-traits"
            aria-label={tr("strength.yogas.traitsAriaLabel", { name: yoga.name })}
          >
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
  const tr = useRouteMessages(strengthMessages);
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
        <p className="kicker">{tr("strength.yogas.kicker")}</p>
        <h2>{tr("strength.yogas.heading")}</h2>
      </div>

      <p className="yogas-intro">{tr("strength.yogas.intro")}</p>

      {/* Category filter tabs */}
      <div
        className="yogas-tabs"
        role="tablist"
        aria-label={tr("strength.yogas.filterAriaLabel")}
      >
        {CATEGORY_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeCategory === key}
            className={`yogas-tab ${activeCategory === key ? "yogas-tab--active" : ""}`}
            onClick={() => setActiveCategory(key)}
          >
            {tr(`strength.yogas.categories.${key}`)}
            {counts[key] > 0 && (
              <span className="yogas-tab-count">{counts[key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Yoga cards */}
      {filtered.length > 0 ? (
        <div
          className="yogas-grid"
          role="list"
          aria-label={tr("strength.yogas.listAriaLabel")}
        >
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
          <p>{tr("strength.yogas.empty")}</p>
        </div>
      )}
    </section>
  );
}

export default memo(YogasPanel);
