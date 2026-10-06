"use client";

import { memo } from "react";
import type { LuckyElementsInfo } from "@/lib/astro-types";
import { LOCALE_TAGS, useTranslation } from "@/lib/i18n-context";
import { planetName } from "@/lib/chart-labels";
import { domainFocusText, gemstoneIntention, luckyTerm, weekdayIndex, weekdayName } from "./lucky-terms";
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
  const { t } = useTranslation();
  const hex = CSS_COLOR_MAP[color] ?? "#888";
  return (
    <span className={styles.colorSwatch}>
      <span className={styles.colorDot} style={{ backgroundColor: hex }} />
      {luckyTerm("colors", color, t)}
    </span>
  );
}

function TextChipList({ items, kind }: { items: string[]; kind: "items" | "omens" }) {
  const { t } = useTranslation();
  return (
    <div className={styles.cautionChipRow}>
      {items.map((item) => (
        <span key={item} className={styles.cautionChip}>
          {luckyTerm(kind, item, t)}
        </span>
      ))}
    </div>
  );
}

const SENTENCE_CASE_LANGUAGES: ReadonlySet<string> = new Set(["es", "fr", "it"]);

function nextWeekday(day: string, from: Date): Date {
  const date = new Date(from);
  date.setHours(12, 0, 0, 0);
  const targetDay = weekdayIndex(day) ?? date.getDay();
  const offset = (targetDay - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + offset);
  return date;
}

/* In the interface language, now that the rows around it come from the
   catalog. LOCALE_TAGS keeps it a function of app state, not of the runtime. */
function formatWeekAheadDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/* The engine names days in English ("Wednesday"); weekdayName (lucky-terms)
   asks Intl for the reader's name, so no catalog entry is needed. */

function WeekAhead({ luckyElements }: LuckyElementsPanelProps) {
  const { t, language } = useTranslation();
  const locale = LOCALE_TAGS[language];
  const primaryDate = nextWeekday(luckyElements.lucky_day, new Date());
  const secondaryDate = nextWeekday(luckyElements.secondary_day, new Date());
  /* Both land inside sentences, where French, Spanish and Italian write a
     colour or a compass point in lower case. English keeps the capitals it
     always printed, and German capitalises them as nouns. */
  const inSentence = (word: string) => (SENTENCE_CASE_LANGUAGES.has(language) ? word.toLowerCase() : word);
  const primaryColor = luckyElements.primary_colors[0]
    ? inSentence(luckyTerm("colors", luckyElements.primary_colors[0], t))
    : t("insights.fortunePanel.fallbackColor");
  const direction = luckyElements.auspicious_directions[0]
    ? inSentence(luckyTerm("directions", luckyElements.auspicious_directions[0], t))
    : t("insights.fortunePanel.fallbackDirection");
  const number = luckyElements.lucky_numbers[0] ?? 1;

  const windows = [
    {
      label: t("insights.fortunePanel.primaryOpening"),
      date: formatWeekAheadDate(primaryDate, locale),
      title: weekdayName(luckyElements.lucky_day, locale),
      detail: t("insights.fortunePanel.primaryDetail", { color: primaryColor }),
    },
    {
      label: t("insights.fortunePanel.supportWindow"),
      date: formatWeekAheadDate(secondaryDate, locale),
      title: weekdayName(luckyElements.secondary_day, locale),
      detail: t("insights.fortunePanel.supportDetail"),
    },
    {
      label: t("insights.fortunePanel.dailyAnchor"),
      date: t("insights.fortunePanel.anyDay"),
      title: t("insights.fortunePanel.directionFocus", { direction }),
      detail: t("insights.fortunePanel.anchorDetail", { direction, number: String(number) }),
    },
  ];

  return (
    <section className={styles.weekAhead} aria-labelledby="fortune-week-ahead-title">
      <div className={styles.weekAheadHeader}>
        <div>
          <span className={styles.sectionEyebrow}>{t("insights.fortunePanel.weekEyebrow")}</span>
          <h3 id="fortune-week-ahead-title">{t("insights.fortunePanel.weekTitle")}</h3>
        </div>
        <p>{t("insights.fortunePanel.weekLead")}</p>
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
  const { t, language } = useTranslation();
  const locale = LOCALE_TAGS[language];
  const guidance = luckyElements.gemstone_guidance;
  if (!guidance) return null;
  const recommendations = [
    { label: t("insights.fortunePanel.primaryRecommendation"), ...guidance.primary },
    { label: t("insights.fortunePanel.secondaryRecommendation"), ...guidance.secondary },
  ];

  return (
    <section className={styles.gemstoneGuidance} aria-labelledby="gemstone-guidance-title">
      <div className={styles.guidanceHeader}>
        <div>
          <span className={styles.sectionEyebrow}>{t("insights.fortunePanel.gemEyebrow")}</span>
          <h3 id="gemstone-guidance-title">{t("insights.fortunePanel.gemTitle")}</h3>
        </div>
        <p>{t("insights.fortunePanel.gemLead")}</p>
      </div>
      <div className={styles.guidanceGrid}>
        {recommendations.map((gemstone) => (
          <article key={gemstone.label} className={styles.guidanceCard}>
            <span className={styles.sectionEyebrow}>{gemstone.label}</span>
            <h4>{luckyTerm("gems", gemstone.gemstone, t)}</h4>
            <p>{gemstoneIntention(gemstone.governing_planet, gemstone.intention, t)}</p>
            <dl>
              <div>
                <dt>{t("insights.fortunePanel.planet")}</dt>
                <dd>{planetName(gemstone.governing_planet, t)}</dd>
              </div>
              <div>
                <dt>{t("insights.fortunePanel.wearDay")}</dt>
                <dd>{weekdayName(gemstone.recommended_day, locale)}</dd>
              </div>
              <div>
                <dt>{t("insights.fortunePanel.pairWith")}</dt>
                <dd>{luckyTerm("metals", gemstone.metal, t)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <p className={styles.gemstoneSafety}>
        {t("insights.lucky.safetyNote") === "insights.lucky.safetyNote"
          ? guidance.safety_note
          : t("insights.lucky.safetyNote")}
      </p>
    </section>
  );
}

function FortuneDomains({ luckyElements }: LuckyElementsPanelProps) {
  const { t } = useTranslation();
  const domains = luckyElements.fortune_domains;
  if (!domains?.length) return null;

  return (
    <section className={styles.fortuneDomains} aria-labelledby="fortune-domains-title">
      <div className={styles.guidanceHeader}>
        <div>
          <span className={styles.sectionEyebrow}>{t("insights.fortunePanel.domainsEyebrow")}</span>
          <h3 id="fortune-domains-title">{t("insights.fortunePanel.domainsTitle")}</h3>
        </div>
        <p>{t("insights.fortunePanel.domainsLead")}</p>
      </div>
      <div className={styles.domainGrid}>
        {domains.map((domain) => (
          <article key={domain.title} className={styles.domainCard}>
            <span>{luckyTerm("domainBasis", domain.basis, t)}</span>
            <h4>{luckyTerm("domainTitles", domain.title, t)}</h4>
            <strong>
              {planetName(domain.key_planet, t)}
              {domain.planet_house
                ? ` · ${t("insights.fortunePanel.house", { house: String(domain.planet_house) })}`
                : ""}
            </strong>
            <p>{domainFocusText(domain.title, domain.focus, t)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function LuckyElementsPanel({ luckyElements }: LuckyElementsPanelProps) {
  const { t, language } = useTranslation();
  const locale = LOCALE_TAGS[language];
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
        <h3 className={styles.cautionHeading}>{t("insights.fortunePanel.cautionTitle")}</h3>
        <div className={styles.cautionGrid}>
          <section className={styles.cautionSection}>
            <h4 className={styles.cautionTitle}>{t("insights.fortunePanel.colorsToAvoid")}</h4>
            <div className={styles.colorRow}>
              {le.unlucky_colors.map((color) => (
                <ColorSwatch key={color} color={color} />
              ))}
            </div>
          </section>
          <section className={styles.cautionSection}>
            <h4 className={styles.cautionTitle}>{t("insights.fortunePanel.items")}</h4>
            <TextChipList items={le.unlucky_items} kind="items" />
          </section>
          <section className={styles.cautionSection}>
            <h4 className={styles.cautionTitle}>{t("insights.fortunePanel.badOmens")}</h4>
            <TextChipList items={le.bad_omens} kind="omens" />
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
                <span className={styles.gemValue}>{luckyTerm("gems", le.primary_gemstone, t)}</span>
              </div>
              <p className={styles.gemBenefit}>
                {t(GEMSTONE_BENEFIT_KEY[le.primary_gemstone] ?? "insights.gemBenefit_Ruby")}
              </p>
            </div>
            <div className={styles.gemItem}>
              <div className={styles.gemHeader}>
                <span className={styles.gemLabel}>{t("insights.luckyElementsSecondary")}</span>
                <span className={styles.gemValue}>{luckyTerm("gems", le.secondary_gemstone, t)}</span>
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
            <span className={styles.detailValue}>{weekdayName(le.lucky_day, locale)}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>{t("insights.luckyElementsSecondaryDay")}</span>
            <span className={styles.detailValue}>{weekdayName(le.secondary_day, locale)}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>{t("insights.luckyElementsMetal")}</span>
            <span className={styles.detailValue}>{luckyTerm("metals", le.primary_metal, t)}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>{t("insights.luckyElementsSecondaryMetal")}</span>
            <span className={styles.detailValue}>{luckyTerm("metals", le.secondary_metal, t)}</span>
          </div>
        </div>
      </div>

      {/* ── Directions (full-width) ── */}
      <div className={styles.sectionFull}>
        <h4 className={styles.sectionTitle}>{t("insights.luckyElementsDirections")}</h4>
        <div className={styles.directionRow}>
          {le.auspicious_directions.map((d) => (
            <span key={d} className={styles.directionTag}>↗ {luckyTerm("directions", d, t)}</span>
          ))}
        </div>
      </div>

      {/* ── Basis Footer ── */}
      <GemstoneGuidance luckyElements={le} />

      <FortuneDomains luckyElements={le} />

      <div className={styles.basis}>
        <span className={styles.basisLabel}>{t("insights.luckyElementsBasis")}:</span>
        <span className={styles.basisPlanet}>{t("insights.luckyElementsAscLord")}: {planetName(le.basis.ascendant_lord, t)}</span>
        <span className={styles.basisPlanet}>{t("insights.luckyElementsMoonLord")}: {planetName(le.basis.moon_sign_lord, t)}</span>
        <span className={styles.basisPlanet}>{t("insights.luckyElementsNinthLord")}: {planetName(le.basis.ninth_house_lord, t)}</span>
        {le.basis.nakshatra_lord && (
          <span className={styles.basisPlanet}>{t("insights.luckyElementsNakLord")}: {planetName(le.basis.nakshatra_lord, t)}</span>
        )}
        {le.basis.yogakaraka_lord && (
          <span className={styles.basisPlanet} data-yogakaraka="true">{t("insights.luckyElementsYogakaraka")}: {planetName(le.basis.yogakaraka_lord, t)}</span>
        )}
      </div>
    </section>
  );
}

export default memo(LuckyElementsPanel);
