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
