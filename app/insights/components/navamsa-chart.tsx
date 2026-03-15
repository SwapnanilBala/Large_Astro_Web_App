"use client";

import { useState } from "react";
import type { NavamsaPositionInfo } from "@/lib/astro-types";
import { useTranslation } from "@/lib/i18n-context";
import { getNavamsaInterpretation } from "./navamsa-interpretations";

type NavamsaChartProps = {
  navamsa: NavamsaPositionInfo[];
};

export default function NavamsaChart({ navamsa }: NavamsaChartProps) {
  const { t } = useTranslation();
  const [expandedPlanet, setExpandedPlanet] = useState<string | null>(null);

  const handleToggle = (name: string) => {
    setExpandedPlanet((prev) => (prev === name ? null : name));
  };

  return (
    <section className="navamsa-panel">
      <div className="rules-header">
        <p className="kicker">{t("navamsa.kicker")}</p>
        <h2>{t("navamsa.heading")}</h2>
      </div>

      <p className="section-intro">{t("navamsa.introText")}</p>

      {(() => {
        const vargottamaCount = navamsa.filter(
          (p) => p.rashi_sign === p.navamsa_sign
        ).length;
        const vargottamaPlanets = navamsa
          .filter((p) => p.rashi_sign === p.navamsa_sign)
          .map((p) => p.name);

        return (
          <div className="navamsa-summary-card">
            <h4>{t("navamsa.summaryLabel")}</h4>
            <p className="navamsa-summary-vargottama">
              {vargottamaCount > 0
                ? `${t("navamsa.vargottamaCount", { count: String(vargottamaCount) })}: ${vargottamaPlanets.join(", ")}`
                : t("navamsa.vargottamaCountZero")}
            </p>
            {vargottamaCount > 0 && (
              <p className="navamsa-summary-explanation">
                {t("navamsa.vargottamaExplanation")}
              </p>
            )}
            <p className="navamsa-click-hint">{t("navamsa.clickHint")}</p>
          </div>
        );
      })()}

      <div className="navamsa-table">
        <div className="navamsa-row navamsa-row--header">
          <span>{t("navamsa.planet")}</span>
          <span>{t("navamsa.rashiSign")}</span>
          <span></span>
          <span>{t("navamsa.navamsaSign")}</span>
        </div>

        {navamsa.map((position) => {
          const isVargottama = position.rashi_sign === position.navamsa_sign;
          const isExpanded = expandedPlanet === position.name;
          const interpretation = getNavamsaInterpretation(
            position.name,
            position.navamsa_sign,
            isVargottama
          );

          return (
            <div key={position.name}>
              <div
                className={`navamsa-row${isVargottama ? " navamsa-vargottama" : ""}${isExpanded ? " navamsa-row--expanded" : ""}`}
                onClick={() => handleToggle(position.name)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleToggle(position.name);
                  }
                }}
              >
                <span className="navamsa-planet">{position.name}</span>
                <span className="navamsa-sign">{position.rashi_sign}</span>
                <span className="navamsa-arrow">&rarr;</span>
                <span className="navamsa-sign">
                  {position.navamsa_sign}
                  {isVargottama && (
                    <small className="navamsa-vargottama-label">Vargottama</small>
                  )}
                </span>
              </div>

              {isExpanded && (
                <div className="navamsa-insight anim-fade-in">
                  <div className="navamsa-insight-block">
                    <span className="navamsa-insight-label">
                      {t("navamsa.inNavamsa", { planet: position.name, sign: position.navamsa_sign })}
                    </span>
                    <p className="navamsa-insight-text">
                      {interpretation.planetMeaning}
                    </p>
                  </div>
                  <div className="navamsa-insight-block">
                    <span className="navamsa-insight-label">
                      Navamsa {position.navamsa_sign}
                    </span>
                    <p className="navamsa-insight-text">
                      {interpretation.signMeaning}
                    </p>
                  </div>
                  {interpretation.vargottamaNote && (
                    <div className="navamsa-insight-block navamsa-insight-block--vargottama">
                      <span className="navamsa-insight-label">
                        &#10022; {t("navamsa.vargottamaStatus")}
                      </span>
                      <p className="navamsa-insight-text">
                        {interpretation.vargottamaNote}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
