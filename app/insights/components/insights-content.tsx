"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthGate from "@/app/insights/components/auth-gate";
import AspectsPanel from "@/app/insights/components/aspects-panel";
import ChartHistorySaver from "@/app/insights/components/chart-history-saver";
import FutureForecastPanel from "@/app/insights/components/future-forecast-panel";
import LagnaChart from "@/app/insights/components/lagna-chart";
import NakshatraDashaPanel from "@/app/insights/components/nakshatra-dasha-panel";
import NavamsaChart from "@/app/insights/components/navamsa-chart";
import PlanetarySnapshots from "@/app/insights/components/planetary-snapshots";
import TransitsPanel from "@/app/insights/components/transits-panel";
import type { ChartApiResponse, LifeDomainInsight } from "@/lib/astro-types";
import { useTranslation } from "@/lib/i18n-context";
import { useToast } from "@/lib/toast-context";

type InsightsContentProps = {
  payload: ChartApiResponse;
  birthDate: string;
  historyQs: string;
};

type RuleCardProps = {
  rule: ChartApiResponse["chart"]["deterministic_rules"][number];
};

function RuleCard({ rule }: RuleCardProps) {
  return (
    <article className={`rule-card rule-${rule.priority}`}>
      <header>
        <h3>{rule.title}</h3>
        <span>{rule.priority}</span>
      </header>
      <p>{rule.insight}</p>
      <small>{rule.basis}</small>
      {typeof rule.confidence_score === "number" && (
        <p className="rule-meta">Confidence: {Math.round(rule.confidence_score * 100)}%</p>
      )}
      {rule.tension_note && <p className="rule-tension">{rule.tension_note}</p>}
    </article>
  );
}

function LockedFeaturePreview({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="rules-panel premium-preview">
      <div className="rules-header">
        <p className="kicker">Premium Module</p>
        <h2>{title}</h2>
      </div>
      <p className="section-intro">{description}</p>
    </section>
  );
}

export default function InsightsContent({ payload, birthDate, historyQs }: InsightsContentProps) {
  const { t } = useTranslation();
  const { pushToast } = useToast();
  const router = useRouter();
  const [isRouting, startRouting] = useTransition();
  const lockedFeatures = new Set(payload.access.locked_features);
  const compatibilityHref = `/insights/compatibility?${historyQs}`;
  const domainInsights = payload.chart.life_domain_insights ?? [];
  const availableEngines = payload.engine.available_engines ?? [];
  const [selectedDomainKey, setSelectedDomainKey] = useState<LifeDomainInsight["key"]>(
    domainInsights[0]?.key ?? "love_life"
  );

  const coreRules = [...payload.chart.deterministic_rules]
    .filter((rule) => !rule.category || rule.category === "core")
    .sort((left, right) => {
      const priorityRank = { high: 0, medium: 1, low: 2 };
      return priorityRank[left.priority] - priorityRank[right.priority];
    });
  const careerRules = payload.chart.deterministic_rules.filter(
    (rule) => rule.category === "career"
  );
  const loveRules = payload.chart.deterministic_rules.filter(
    (rule) => rule.category === "love"
  );

  const tenthHouse = payload.chart.houses.find((house) => house.house_number === 10);
  const seventhHouse = payload.chart.houses.find((house) => house.house_number === 7);
  const selectedDomainInsight =
    domainInsights.find((domain) => domain.key === selectedDomainKey) ?? domainInsights[0];

  const copyCurrentChartLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/insights?${historyQs}`);
      pushToast("Current chart link copied.", "success");
    } catch {
      pushToast("Could not copy the current chart link.", "error");
    }
  };

  const switchEngine = (engineId: string) => {
    const params = new URLSearchParams(historyQs);
    params.set("engineId", engineId);
    startRouting(() => {
      router.push(`/insights?${params.toString()}`);
    });
  };

  return (
    <>
      <ChartHistorySaver
        name={payload.client.name}
        city={payload.client.city}
        birthDate={birthDate}
        ascendantSign={payload.chart.ascendant.sign}
        queryString={historyQs}
      />
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <section className="dashboard-shell">
        <p className="kicker">{t("insights.kicker")}</p>
        <h1>
          {payload.client.name}
          {t("insights.headingSuffix")}
        </h1>
        <p className="lead">{payload.chart.summary}</p>

        <div className="metrics-grid metrics-grid--hero">
          <article className="metric-card metric-card--hero">
            <h3>
              <span className="metric-icon">&#x2609;</span>
              {t("insights.lagna")}
            </h3>
            <p>{payload.chart.ascendant.sign}</p>
            <small>
              {payload.chart.ascendant.degree_in_sign.toFixed(2)} {t("insights.degInSign")}
            </small>
          </article>
          <article className="metric-card metric-card--hero">
            <h3>
              <span className="metric-icon">&#x2699;</span>
              {t("insights.engine")}
            </h3>
            <p>{payload.engine.engine_label}</p>
            <small>
              {payload.engine.ayanamsha} • {payload.engine.house_system}
              {payload.engine.fallback_mode ? " • Fallback mode active" : ""}
            </small>
            {availableEngines.length > 1 && (
              <label className="engine-switcher">
                Change engine
                <select
                  value={payload.engine.engine_id}
                  onChange={(event) => switchEngine(event.target.value)}
                  disabled={isRouting}
                >
                  {availableEngines.map((engine) => (
                    <option key={engine.engine_id} value={engine.engine_id}>
                      {engine.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </article>
        </div>

        <div className="access-strip">
          <span className={`access-pill ${payload.access.premium_features_enabled ? "access-pill--premium" : "access-pill--limited"}`}>
            {lockedFeatures.size === 0 ? "All features unlocked" : "Limited response"}
          </span>
          <p className="access-copy">
            Tier: <strong>{payload.access.subscription_tier}</strong>
            {lockedFeatures.size > 0
              ? ` • Locked modules: ${Array.from(lockedFeatures).join(", ")}`
              : " • Advanced astrology modules are enabled for this chart."}
          </p>
        </div>

        <LagnaChart
          ascendantSign={payload.chart.ascendant.sign}
          houses={payload.chart.houses}
        />

        <FutureForecastPanel queryString={historyQs} />

        <section className="rules-panel">
          <div className="rules-header">
            <p className="kicker">{t("insights.coreKicker")}</p>
            <h2>{t("insights.coreHeading")}</h2>
          </div>
          <p className="section-intro">
            This section pulls together the backbone of the chart: your lagna path, house emphasis,
            elemental style, nodal direction, and the structural signatures most likely to shape major
            outcomes.
          </p>
          <div className="rules-list">
            {coreRules.map((rule) => (
              <RuleCard key={`${rule.category}-${rule.title}`} rule={rule} />
            ))}
          </div>
        </section>

        {careerRules.length > 0 && (
          <section className="rules-panel career-section">
            <div className="rules-header">
              <p className="kicker">{t("insights.careerKicker")}</p>
              <h2>{t("insights.careerHeading")}</h2>
            </div>
            <p className="section-intro">{t("insights.careerIntro")}</p>

            {tenthHouse && (
              <div className="career-summary-card">
                <h4>{t("insights.career10thHouse")}</h4>
                <p className="career-summary-sign">
                  {t("insights.careerSign", { sign: tenthHouse.sign })}
                </p>
                <p className="career-summary-planets">
                  {tenthHouse.planets.length > 0
                    ? t("insights.careerPlanetsIn10th", { planets: tenthHouse.planets.join(", ") })
                    : t("insights.careerNoPlanets")}
                </p>
              </div>
            )}

            <div className="rules-list">
              {careerRules.map((rule) => (
                <RuleCard key={`${rule.category}-${rule.title}`} rule={rule} />
              ))}
            </div>
          </section>
        )}

        {loveRules.length > 0 && (
          <section className="rules-panel love-section">
            <div className="rules-header">
              <p className="kicker">{t("insights.loveKicker")}</p>
              <h2>{t("insights.loveHeading")}</h2>
            </div>
            <p className="section-intro">{t("insights.loveIntro")}</p>

            {seventhHouse && (
              <div className="love-summary-card">
                <h4>{t("insights.love7thHouse")}</h4>
                <p className="love-summary-sign">
                  {t("insights.loveSign", { sign: seventhHouse.sign })}
                </p>
                <p className="love-summary-planets">
                  {seventhHouse.planets.length > 0
                    ? t("insights.lovePlanetsIn7th", { planets: seventhHouse.planets.join(", ") })
                    : t("insights.loveNoPlanets")}
                </p>
              </div>
            )}

            <div className="rules-list">
              {loveRules.map((rule) => (
                <RuleCard key={`${rule.category}-${rule.title}`} rule={rule} />
              ))}
            </div>

            <div className="compatibility-cta">
              <h3>{t("insights.compatibilityCtaHeading")}</h3>
              <p>{t("insights.compatibilityCtaText")}</p>
              <Link href={compatibilityHref} className="compatibility-cta-button">
                {t("insights.compatibilityCtaButton")} &rarr;
              </Link>
            </div>
          </section>
        )}

        <AuthGate
          featureLabel="Nakshatra & Dasha"
          isLocked={lockedFeatures.has("nakshatra_dasha")}
        >
          {payload.chart.nakshatra && payload.chart.dasha ? (
            <NakshatraDashaPanel
              nakshatra={payload.chart.nakshatra}
              dasha={payload.chart.dasha}
              audit={payload.chart.calculation_audit}
              planets={payload.chart.planets}
            />
          ) : (
            <LockedFeaturePreview
              title="Nakshatra and Dasha timing"
              description="Unlock lunar mansion analysis, current dasha sequencing, and timing-sensitive drill-downs."
            />
          )}
        </AuthGate>

        <AuthGate
          featureLabel="Planetary Aspects"
          isLocked={lockedFeatures.has("planetary_aspects")}
        >
          {payload.chart.aspects && payload.chart.aspects.length > 0 ? (
            <AspectsPanel aspects={payload.chart.aspects} />
          ) : (
            <LockedFeaturePreview
              title="Planetary aspect matrix"
              description="See the strongest harmonious and friction-heavy contacts in the natal chart, ranked by orb."
            />
          )}
        </AuthGate>

        <AuthGate
          featureLabel="Navamsa D9 Chart"
          isLocked={lockedFeatures.has("navamsa_d9")}
        >
          {payload.chart.navamsa && payload.chart.navamsa.length > 0 ? (
            <NavamsaChart navamsa={payload.chart.navamsa} />
          ) : (
            <LockedFeaturePreview
              title="Navamsa D9 refinement"
              description="Open the D9 layer to evaluate maturity patterns, deeper relationship signatures, and inner promise."
            />
          )}
        </AuthGate>

        <AuthGate
          featureLabel="Live Transits"
          isLocked={lockedFeatures.has("live_transits")}
        >
          {payload.transits ? (
            <TransitsPanel transits={payload.transits} />
          ) : (
            <LockedFeaturePreview
              title="Live transits"
              description="Track the current sky against the natal chart to understand active triggers and near-term windows."
            />
          )}
        </AuthGate>

        <AuthGate
          featureLabel="Life Domain Deep Dives"
          isLocked={lockedFeatures.has("life_domain_readings")}
          requiredTier="ultimate"
        >
          {selectedDomainInsight ? (
            <section className="rules-panel domain-reading-panel">
              <div className="rules-header">
                <p className="kicker">Ultimate Module</p>
                <h2>Life domain deep dives</h2>
              </div>
              <p className="section-intro">
                Choose a life area and read a more focused interpretation built from the relevant house,
                its lord, supporting house pattern, activation timing, and the chart&apos;s dominant element.
              </p>

              <label className="domain-reading-select input-glow-gold">
                Select a focus area
                <select
                  value={selectedDomainInsight.key}
                  onChange={(event) =>
                    setSelectedDomainKey(event.target.value as LifeDomainInsight["key"])
                  }
                >
                  {domainInsights.map((domain) => (
                    <option key={domain.key} value={domain.key}>
                      {domain.label}
                    </option>
                  ))}
                </select>
              </label>

              <article className="domain-reading-card">
                <div className="domain-reading-header">
                  <div>
                    <p className="kicker">{selectedDomainInsight.label}</p>
                    <h3>{selectedDomainInsight.headline}</h3>
                  </div>
                  <span className="access-pill access-pill--premium">
                    {Math.round(selectedDomainInsight.confidence_score * 100)}% confidence
                  </span>
                </div>

                <p className="domain-reading-overview">{selectedDomainInsight.overview}</p>

                <div className="domain-reading-grid">
                  <section className="domain-reading-column">
                    <h4>What supports this area</h4>
                    <ul className="domain-reading-list">
                      {selectedDomainInsight.strengths.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>

                  <section className="domain-reading-column">
                    <h4>What to watch</h4>
                    <ul className="domain-reading-list">
                      {selectedDomainInsight.watchouts.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                </div>

                <div className="domain-reading-grid domain-reading-grid--detail">
                  <section className="domain-reading-column">
                    <h4>Timing triggers</h4>
                    <ul className="domain-reading-list">
                      {selectedDomainInsight.timing_triggers.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>

                  <section className="domain-reading-column">
                    <h4>Supporting patterns</h4>
                    <ul className="domain-reading-list">
                      {selectedDomainInsight.supporting_patterns.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                </div>

                <p className="domain-reading-guidance">
                  <strong>Guidance:</strong> {selectedDomainInsight.guidance}
                </p>

                <p className="domain-reading-long-game">
                  <strong>Long game:</strong> {selectedDomainInsight.long_game}
                </p>
              </article>
            </section>
          ) : (
            <LockedFeaturePreview
              title="Life domain deep dives"
              description="Ultimate unlocks focused readings for love life, career, family, inheritance, influence, and major life cycles."
            />
          )}
        </AuthGate>

        <PlanetarySnapshots planets={payload.chart.planets} />

        <div className="insights-actions">
          <button type="button" onClick={() => void copyCurrentChartLink()}>
            Copy current chart
          </button>
          <Link href="/workspace" className="ghost-link">
            Open Workspace
          </Link>
          <Link href="/" className="recalculate-btn">
            <span className="recalculate-icon">&#x21BB;</span>
            {t("insights.recalculate")}
          </Link>
        </div>
      </section>
    </>
  );
}
