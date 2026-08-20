"use client";

import { memo } from "react";
import type { LuckyElementsInfo } from "@/lib/astro-types";
import { useTranslation } from "@/lib/i18n-context";
import styles from "./lucky-elements-panel.module.css";

/* ── Gemstone → translation key for life-benefit description ── */

const GEMSTONE_BENEFIT_KEY: Record<string, string> = {
  "Ruby":             "insights.gemBenefit_Ruby",
  "Pearl":            "insights.gemBenefit_Pearl",
  "Red Coral":        "insights.gemBenefit_RedCoral",
  "Emerald":          "insights.gemBenefit_Emerald",
  "Yellow Sapphire":  "insights.gemBenefit_YellowSapphire",
  "Diamond":          "insights.gemBenefit_Diamond",
  "Blue Sapphire":    "insights.gemBenefit_BlueSapphire",
  "Hessonite Garnet": "insights.gemBenefit_HessoniteGarnet",
  "Cat's Eye":        "insights.gemBenefit_CatsEye",
};

/* ── Vedic color name → CSS hex for rendering swatches ── */

const CSS_COLOR_MAP: Record<string, string> = {
  "Deep Red": "#B22222",
  "Orange": "#FF8C00",
  "White": "#F0F0F0",
  "Cream": "#FFFDD0",
  "Red": "#DC143C",
  "Scarlet": "#FF2400",
  "Green": "#228B22",
  "Emerald": "#50C878",
  "Yellow": "#FFD700",
  "Golden": "#DAA520",
  "Pink": "#FFB6C1",
  "Blue": "#4169E1",
  "Dark": "#2C2C54",
  "Smoky": "#708090",
  "Ultraviolet": "#7B2FBE",
  "Grey": "#808080",
  "Earthy": "#8B7355",
  "Dull Black": "#1A1A1A",
  "Ash Grey": "#A9A9A9",
  "Murky Brown": "#5A3E2B",
  "Clouded Grey": "#9AA0A6",
  "Rust Red": "#9E3B22",
  "Harsh Neon": "#B7FF00",
  "Dusty Green": "#6F8A5B",
  "Mixed Mud": "#6B5A3A",
  "Sallow Yellow": "#CDBA45",
  "Muddy Gold": "#9A7A24",
  "Washed Pink": "#D8A7B1",
  "Stained White": "#DCD6C9",
  "Flat Black": "#050505",
  "Cold Blue": "#355C7D",
  "Smoky Black": "#242124",
  "Electric Purple": "#8A2BE2",
  "Dust Grey": "#77736A",
  "Pale Brown": "#A1866F",
};

type LuckyElementsPanelProps = {
  luckyElements: LuckyElementsInfo;
};

function ColorSwatch({ color }: { color: string }) {
  const hex = CSS_COLOR_MAP[color] ?? "#888";
  return (
    <span className={styles.colorSwatch}>
      <span className={styles.colorDot} style={{ backgroundColor: hex }} />
      {color}
    </span>
  );
}

function TextChipList({ items }: { items: string[] }) {
  return (
    <div className={styles.cautionChipRow}>
      {items.map((item) => (
        <span key={item} className={styles.cautionChip}>
          {item}
        </span>
      ))}
    </div>
  );
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function nextWeekday(day: string, from: Date): Date {
  const date = new Date(from);
  date.setHours(12, 0, 0, 0);
  const targetDay = WEEKDAY_INDEX[day] ?? date.getDay();
  const offset = (targetDay - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + offset);
  return date;
}

function formatWeekAheadDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function WeekAhead({ luckyElements }: LuckyElementsPanelProps) {
  const primaryDate = nextWeekday(luckyElements.lucky_day, new Date());
  const secondaryDate = nextWeekday(luckyElements.secondary_day, new Date());
  const primaryColor = luckyElements.primary_colors[0] ?? "your primary color";
  const direction = luckyElements.auspicious_directions[0] ?? "your preferred direction";
  const number = luckyElements.lucky_numbers[0] ?? 1;

  const windows = [
    {
      label: "Primary opening",
      date: formatWeekAheadDate(primaryDate),
      title: luckyElements.lucky_day,
      detail: `Use ${primaryColor} for the week’s most important meeting, outreach, or first step.`,
    },
    {
      label: "Support window",
      date: formatWeekAheadDate(secondaryDate),
      title: luckyElements.secondary_day,
      detail: `Use this day for refinement, follow-through, and conversations that benefit from patience.`,
    },
    {
      label: "Daily anchor",
      date: "Any day",
      title: `${direction} focus`,
      detail: `Start one intentional task facing ${direction}; let the number ${number} be a small visual reminder of your priorities.`,
    },
  ];

  return (
    <section className={styles.weekAhead} aria-labelledby="fortune-week-ahead-title">
      <div className={styles.weekAheadHeader}>
        <div>
          <span className={styles.sectionEyebrow}>Practical fortune</span>
          <h3 id="fortune-week-ahead-title">Week Ahead</h3>
        </div>
        <p>Small, chart-aligned moments to make the next seven days feel more intentional.</p>
      </div>
      <div className={styles.weekAheadGrid}>
        {windows.map((window) => (
          <article key={window.label} className={styles.weekAheadCard}>
            <span>{window.label}</span>
            <strong>{window.date}</strong>
            <h4>{window.title}</h4>
            <p>{window.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function GemstoneGuidance({ luckyElements }: LuckyElementsPanelProps) {
  const guidance = luckyElements.gemstone_guidance;
  if (!guidance) return null;
  const recommendations = [
    { label: "Primary recommendation", ...guidance.primary },
    { label: "Secondary recommendation", ...guidance.secondary },
  ];

  return (
    <section className={styles.gemstoneGuidance} aria-labelledby="gemstone-guidance-title">
      <div className={styles.guidanceHeader}>
        <div>
          <span className={styles.sectionEyebrow}>Traditional practice</span>
          <h3 id="gemstone-guidance-title">Gemstone Guidance</h3>
        </div>
        <p>Use these as intention-setting references grounded in the planets that support your chart.</p>
      </div>
      <div className={styles.guidanceGrid}>
        {recommendations.map((gemstone) => (
          <article key={gemstone.label} className={styles.guidanceCard}>
            <span className={styles.sectionEyebrow}>{gemstone.label}</span>
            <h4>{gemstone.gemstone}</h4>
            <p>{gemstone.intention}</p>
            <dl>
              <div>
                <dt>Planet</dt>
                <dd>{gemstone.governing_planet}</dd>
              </div>
              <div>
                <dt>Wear day</dt>
                <dd>{gemstone.recommended_day}</dd>
              </div>
              <div>
                <dt>Pair with</dt>
                <dd>{gemstone.metal}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <p className={styles.gemstoneSafety}>{guidance.safety_note}</p>
    </section>
  );
}

function FortuneDomains({ luckyElements }: LuckyElementsPanelProps) {
  const domains = luckyElements.fortune_domains;
  if (!domains?.length) return null;

  return (
    <section className={styles.fortuneDomains} aria-labelledby="fortune-domains-title">
      <div className={styles.guidanceHeader}>
        <div>
          <span className={styles.sectionEyebrow}>Where fortune grows</span>
          <h3 id="fortune-domains-title">Fortune Domains</h3>
        </div>
        <p>These are the life areas where preparation, perspective, and the right connections can compound.</p>
      </div>
      <div className={styles.domainGrid}>
        {domains.map((domain) => (
          <article key={domain.title} className={styles.domainCard}>
            <span>{domain.basis}</span>
            <h4>{domain.title}</h4>
            <strong>
              {domain.key_planet}
              {domain.planet_house ? ` · house ${domain.planet_house}` : ""}
            </strong>
            <p>{domain.focus}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function LuckyElementsPanel({ luckyElements }: LuckyElementsPanelProps) {
  const { t } = useTranslation();
  const le = luckyElements;

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <p className={styles.kicker}>{t("insights.luckyElementsKicker")}</p>
        <h2 className={styles.heading}>{t("insights.luckyElementsHeading")}</h2>
      </div>
      <p className={styles.intro}>{t("insights.luckyElementsIntro")}</p>

      <WeekAhead luckyElements={le} />

      <div className={styles.cautionBlock}>
        <h3 className={styles.cautionHeading}>Unlucky Colors, Items & Bad Omens</h3>
        <div className={styles.cautionGrid}>
          <section className={styles.cautionSection}>
            <h4 className={styles.cautionTitle}>Colors to avoid</h4>
            <div className={styles.colorRow}>
              {le.unlucky_colors.map((color) => (
                <ColorSwatch key={color} color={color} />
              ))}
            </div>
          </section>
          <section className={styles.cautionSection}>
            <h4 className={styles.cautionTitle}>Items</h4>
            <TextChipList items={le.unlucky_items} />
          </section>
          <section className={styles.cautionSection}>
            <h4 className={styles.cautionTitle}>Bad omens</h4>
            <TextChipList items={le.bad_omens} />
          </section>
        </div>
      </div>

      <div className={styles.sectionGrid}>
        {/* ── Colors ── */}
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>{t("insights.luckyElementsColors")}</h4>
          <p className={styles.colorLabel}>{t("insights.luckyElementsPrimary")}</p>
          <div className={styles.colorRow}>
            {le.primary_colors.map((c) => <ColorSwatch key={c} color={c} />)}
          </div>
          {le.secondary_colors.length > 0 && (
            <>
              <p className={styles.colorLabel}>{t("insights.luckyElementsSecondary")}</p>
              <div className={styles.colorRow}>
                {le.secondary_colors.map((c) => <ColorSwatch key={c} color={c} />)}
              </div>
            </>
          )}
        </div>

        {/* ── Numbers ── */}
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>{t("insights.luckyElementsNumbers")}</h4>
          <div className={styles.numberRow}>
            {le.lucky_numbers.map((n) => (
              <span key={n} className={styles.numberBadge}>{n}</span>
            ))}
          </div>
        </div>

        {/* ── Gemstones ── */}
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>{t("insights.luckyElementsGemstones")}</h4>
          <div className={styles.gemRow}>
            <div className={styles.gemItem}>
              <div className={styles.gemHeader}>
                <span className={styles.gemLabel}>{t("insights.luckyElementsPrimary")}</span>
                <span className={styles.gemValue}>{le.primary_gemstone}</span>
              </div>
              <p className={styles.gemBenefit}>
                {t(GEMSTONE_BENEFIT_KEY[le.primary_gemstone] ?? "insights.gemBenefit_Ruby")}
              </p>
            </div>
            <div className={styles.gemItem}>
              <div className={styles.gemHeader}>
                <span className={styles.gemLabel}>{t("insights.luckyElementsSecondary")}</span>
                <span className={styles.gemValue}>{le.secondary_gemstone}</span>
              </div>
              <p className={styles.gemBenefit}>
                {t(GEMSTONE_BENEFIT_KEY[le.secondary_gemstone] ?? "insights.gemBenefit_Ruby")}
              </p>
            </div>
          </div>
        </div>

        {/* ── Day & Metal ── */}
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>{t("insights.luckyElementsDayMetal")}</h4>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>{t("insights.luckyElementsDay")}</span>
            <span className={styles.detailValue}>{le.lucky_day}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>{t("insights.luckyElementsSecondaryDay")}</span>
            <span className={styles.detailValue}>{le.secondary_day}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>{t("insights.luckyElementsMetal")}</span>
            <span className={styles.detailValue}>{le.primary_metal}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>{t("insights.luckyElementsSecondaryMetal")}</span>
            <span className={styles.detailValue}>{le.secondary_metal}</span>
          </div>
        </div>
      </div>

      {/* ── Directions (full-width) ── */}
      <div className={styles.sectionFull}>
        <h4 className={styles.sectionTitle}>{t("insights.luckyElementsDirections")}</h4>
        <div className={styles.directionRow}>
          {le.auspicious_directions.map((d) => (
            <span key={d} className={styles.directionTag}>↗ {d}</span>
          ))}
        </div>
      </div>

      {/* ── Basis Footer ── */}
      <GemstoneGuidance luckyElements={le} />

      <FortuneDomains luckyElements={le} />

      <div className={styles.basis}>
        <span className={styles.basisLabel}>{t("insights.luckyElementsBasis")}:</span>
        <span className={styles.basisPlanet}>{t("insights.luckyElementsAscLord")}: {le.basis.ascendant_lord}</span>
        <span className={styles.basisPlanet}>{t("insights.luckyElementsMoonLord")}: {le.basis.moon_sign_lord}</span>
        <span className={styles.basisPlanet}>{t("insights.luckyElementsNinthLord")}: {le.basis.ninth_house_lord}</span>
        {le.basis.nakshatra_lord && (
          <span className={styles.basisPlanet}>{t("insights.luckyElementsNakLord")}: {le.basis.nakshatra_lord}</span>
        )}
        {le.basis.yogakaraka_lord && (
          <span className={styles.basisPlanet} data-yogakaraka="true">{t("insights.luckyElementsYogakaraka")}: {le.basis.yogakaraka_lord}</span>
        )}
      </div>
    </section>
  );
}

export default memo(LuckyElementsPanel);
