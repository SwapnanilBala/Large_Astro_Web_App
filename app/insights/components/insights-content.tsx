"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useMotionValue, animate as fmAnimate, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import { FiChevronDown, FiCopy, FiRefreshCw, FiGrid } from "react-icons/fi";
import AuthGate from "@/app/insights/components/auth-gate";
import PanelErrorBoundary from "@/app/insights/components/PanelErrorBoundary";
import ChartHistorySaver from "@/app/insights/components/chart-history-saver";
import PlanetarySnapshots from "@/app/insights/components/planetary-snapshots";
import styles from "../insights.module.css";

// Lightweight skeleton for lazy-loaded panels
function PanelSkeleton() {
  const { t } = useTranslation();
  return <div className={styles.card} style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4 }}>{t("insights.loading")}</div>;
}

/* ─── Intersection Observer Lazy Panel ─── */
function LazyPanel({
  children,
  fallback,
  rootMargin = "200px",
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref}>
      {isVisible ? children : (fallback ?? <PanelSkeleton />)}
    </div>
  );
}

const NakshatraDashaPanel = dynamic(() => import("./nakshatra-dasha-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const LagnaChart = dynamic(() => import("./lagna-chart"), { ssr: false, loading: () => <PanelSkeleton /> });
const FutureForecastPanel = dynamic(() => import("./future-forecast-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const NavamsaChart = dynamic(() => import("./navamsa-chart"), { ssr: false, loading: () => <PanelSkeleton /> });
const TransitsPanel = dynamic(() => import("./transits-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const AspectsPanel = dynamic(() => import("./aspects-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const DivisionalChartsPanel = dynamic(() => import("./divisional-charts-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const AshtakavargaPanel = dynamic(() => import("./ashtakavarga-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const PalmReadingPanel = dynamic(() => import("./palm-reading-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const MuhurtaPanel = dynamic(() => import("./muhurta-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const VarshaphalPanel = dynamic(() => import("./varshaphal-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const ShadbalaPanel = dynamic(() => import("./shadbala-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const YogasPanel = dynamic(() => import("./yogas-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const LuckyElementsPanel = dynamic(() => import("./lucky-elements-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
import type { ChartApiResponse, LifeDomainInsight } from "@/lib/astro-types";
import { useTranslation } from "@/lib/i18n-context";
import { useToast } from "@/lib/toast-context";
import ZodiacSignImage from "@/app/components/ZodiacSignImage";

type InsightsContentProps = {
  payload: ChartApiResponse;
  birthDate: string;
  historyQs: string;
};

type RuleCardProps = {
  rule: ChartApiResponse["chart"]["deterministic_rules"][number];
  index: number;
};

/* ─── Animated Section Header ─── */
function SectionHeader({
  kicker,
  heading,
  children,
}: {
  kicker: string;
  heading: string;
  children?: React.ReactNode;
}) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      className={styles.sectionHeader}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 20 }}
    >
      <p className={styles.kicker}>{kicker}</p>
      <h2 className={styles.heading}>{heading}</h2>
      {children}
    </motion.div>
  );
}

/* ─── Collapsible Section Wrapper ─── */
function CollapsibleSection({
  title,
  kicker,
  defaultOpen = true,
  children,
  className = "",
}: {
  title: string;
  kicker: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.section
      className={`${styles.collapsible} ${className}`}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 20 }}
    >
      <button
        type="button"
        className={styles.collapsibleTrigger}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <div>
          <span className={styles.kicker}>{kicker}</span>
          <h2 className={styles.heading}>{title}</h2>
        </div>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3 }}
          className={styles.chevron}
        >
          <FiChevronDown size={20} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 250, damping: 25, opacity: { duration: 0.2 } }}
            style={{ overflow: "hidden" }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

/* ─── Rule Card (Animated) ─── */
function RuleCard({ rule, index }: RuleCardProps) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.article
      className={`${styles.ruleCard} ${rule.priority === "high" ? styles.ruleHigh : rule.priority === "medium" ? styles.ruleMedium : styles.ruleLow}`}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={shouldReduceMotion ? { duration: 0 } : {
        type: "spring",
        stiffness: 200,
        damping: 20,
        delay: index * 0.05,
      }}
    >
      <header className={styles.ruleHeader}>
        <h3>{rule.title}</h3>
        <span className={rule.priority === "high" ? styles.priorityHigh : rule.priority === "medium" ? styles.priorityMedium : styles.priorityLow}>
          {rule.priority}
        </span>
      </header>
      <p className={styles.ruleInsight}>{rule.insight}</p>
      <small className={styles.ruleBasis}>{rule.basis}</small>
      {typeof rule.confidence_score === "number" && (
        <div className={styles.confidenceBar}>
          <div
            className={styles.confidenceFill}
            style={{ width: `${Math.round(rule.confidence_score * 100)}%` }}
          />
          <span className={styles.confidenceLabel}>
            {Math.round(rule.confidence_score * 100)}%
          </span>
        </div>
      )}
      {rule.tension_note && (
        <p className={styles.ruleTension}>{rule.tension_note}</p>
      )}
    </motion.article>
  );
}

/* ─── Locked Feature Preview ─── */
function LockedFeaturePreview({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className={styles.lockedPreview}>
      <div className={styles.lockedIcon}>&#128274;</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

/* ─── Animated Counter for Metric Values ─── */
function AnimatedCounter({
  value,
  decimals = 0,
  suffix = "",
  prefix = "",
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
}) {
  const motionVal = useMotionValue(0);
  const displayRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const controls = fmAnimate(motionVal, value, {
      type: "spring",
      stiffness: 80,
      damping: 20,
      mass: 0.8,
    });
    const unsubscribe = motionVal.on("change", (latest) => {
      if (displayRef.current) {
        displayRef.current.textContent =
          prefix + latest.toFixed(decimals) + suffix;
      }
    });
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [value, decimals, suffix, prefix, motionVal]);

  return (
    <span ref={displayRef}>
      {prefix}
      {(0).toFixed(decimals)}
      {suffix}
    </span>
  );
}

/* ═══════════════════════════════════════════════
   MAIN INSIGHTS DASHBOARD (BENTO GRID LAYOUT)
   ═══════════════════════════════════════════════ */

export default function InsightsContent({
  payload,
  birthDate,
  historyQs,
}: InsightsContentProps) {
  const { t } = useTranslation();
  const { pushToast } = useToast();
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const [isRouting, startRouting] = useTransition();
  const lockedFeatures = new Set(payload.access.locked_features);
  const compatibilityHref = `/insights/compatibility?${historyQs}`;
  const domainInsights = payload.chart.life_domain_insights ?? [];
  const availableEngines = payload.engine.available_engines ?? [];
  const [selectedDomainKey, setSelectedDomainKey] = useState<
    LifeDomainInsight["key"]
  >(domainInsights[0]?.key ?? "love_life");

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

  const tenthHouse = payload.chart.houses.find(
    (house) => house.house_number === 10
  );
  const seventhHouse = payload.chart.houses.find(
    (house) => house.house_number === 7
  );
  const selectedDomainInsight =
    domainInsights.find((domain) => domain.key === selectedDomainKey) ??
    domainInsights[0];

  const copyCurrentChartLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/insights?${historyQs}`
      );
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

  /* ─── Stagger animation for bento cells ─── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const noMotion: any = { hidden: { opacity: 1 }, visible: { opacity: 1 } };

  const bentoContainer = shouldReduceMotion
    ? noMotion
    : {
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: 0.1, delayChildren: 0.1 },
        },
      };

  const bentoItem = shouldReduceMotion
    ? noMotion
    : {
        hidden: { opacity: 0, y: 24, scale: 0.97 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { type: "spring", stiffness: 200, damping: 20 },
        },
      };

  /* Alternating direction: odd from left, even from right */
  const bentoItemFromLeft = shouldReduceMotion
    ? noMotion
    : {
        hidden: { opacity: 0, x: -30, scale: 0.97 },
        visible: {
          opacity: 1,
          x: 0,
          scale: 1,
          transition: { type: "spring", stiffness: 200, damping: 20 },
        },
      };

  const bentoItemFromRight = shouldReduceMotion
    ? noMotion
    : {
        hidden: { opacity: 0, x: 30, scale: 0.97 },
        visible: {
          opacity: 1,
          x: 0,
          scale: 1,
          transition: { type: "spring", stiffness: 200, damping: 20 },
        },
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

      <section className={`dashboard-shell ${styles.dashboard}`}>
        {/* ─── Hero Header ─── */}
        <motion.div
          className={styles.hero}
          initial={shouldReduceMotion ? false : { opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 180, damping: 22 }}
        >
          <p className={styles.kicker}>{t("insights.kicker")}</p>
          <h1 className={styles.title}>
            {payload.client.name}
            {t("insights.headingSuffix")}
          </h1>
          <p className={styles.lead}>{payload.chart.summary}</p>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            marginTop: "1.25rem",
            padding: "0.75rem 1.25rem",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "12px",
            backdropFilter: "blur(8px)",
            width: "fit-content",
          }}>
            <ZodiacSignImage
              sign={payload.chart.ascendant.sign}
              size={52}
              style={{
                border: "2px solid rgba(255,200,80,0.5)",
                boxShadow: "0 0 16px rgba(255,200,80,0.3)",
              }}
            />
            <div>
              <p style={{ margin: 0, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.5)" }}>{t("insights.ascendantSign")}</p>
              <p style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#f5c842" }}>{payload.chart.ascendant.sign}</p>
            </div>
          </div>
        </motion.div>

        {/* ─── Top Metrics Bento Row ─── */}
        <motion.div
          className={styles.gridHero}
          variants={bentoContainer}
          initial="hidden"
          animate="visible"
        >
          {/* Lagna Card */}
          <motion.article
            className={`${styles.cardMetric} ${styles.cardGold}`}
            variants={bentoItem}
          >
            <ZodiacSignImage
              sign={payload.chart.ascendant.sign}
              size={64}
              style={{
                border: "2px solid rgba(255,200,80,0.4)",
                boxShadow: "0 0 20px rgba(255,200,80,0.25)",
                marginBottom: "0.5rem",
              }}
            />
            <h3>{t("insights.lagna")}</h3>
            <p className={styles.metricValue}>
              {payload.chart.ascendant.sign}
            </p>
            <small>
              <AnimatedCounter
                value={payload.chart.ascendant.degree_in_sign}
                decimals={2}
                suffix={`° ${t("insights.degInSign")}`}
              />
            </small>
          </motion.article>

          {/* Engine Card */}
          <motion.article
            className={`${styles.cardMetric} ${styles.cardAqua}`}
            variants={bentoItem}
          >
            <div className={styles.metricIcon}>&#x2699;</div>
            <h3>{t("insights.engine")}</h3>
            <p className={styles.metricValue}>
              {payload.engine.engine_label}
            </p>
            <small>
              {payload.engine.ayanamsha} &bull; {payload.engine.house_system}
              {payload.engine.fallback_mode ? " &bull; Fallback" : ""}
            </small>
            {availableEngines.length > 1 && (
              <label className={styles.engineSwitcher}>
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
          </motion.article>

          {/* Access Card */}
          <motion.article
            className={styles.cardStatus}
            variants={bentoItem}
          >
            <span
              className={payload.access.premium_features_enabled
                  ? styles.accessPillPremium
                  : styles.accessPillLimited}
            >
              {lockedFeatures.size === 0
                ? t("insights.allFeatures")
                : t("insights.limitedResponse")}
            </span>
            <small className={styles.accessTier}>
              Tier: <strong>{payload.access.subscription_tier}</strong>
            </small>
            {lockedFeatures.size > 0 && (
              <small className={styles.accessLocked}>
                Locked: {Array.from(lockedFeatures).join(", ")}
              </small>
            )}
          </motion.article>
        </motion.div>

        {/* ─── Main Bento Grid ─── */}
        <motion.div
          className={styles.gridMain}
          variants={bentoContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {/* Birth Chart — Large card spanning 2 columns */}
          <motion.div
            className={styles.cardChart}
            variants={bentoItemFromLeft}
          >
            <PanelErrorBoundary panelName="Lagna Chart">
              <LagnaChart
                ascendantSign={payload.chart.ascendant.sign}
                houses={payload.chart.houses}
                planets={payload.chart.planets}
                currentDashaLord={payload.chart.dasha?.current_dasha}
              />
            </PanelErrorBoundary>
          </motion.div>

          {/* Planetary Snapshots — Side card */}
          <motion.div
            className={styles.cardPlanets}
            variants={bentoItemFromRight}
          >
            <PanelErrorBoundary panelName="Planetary Snapshots">
              <PlanetarySnapshots planets={payload.chart.planets} />
            </PanelErrorBoundary>
          </motion.div>
        </motion.div>

        {/* ─── Forecasts & Timing (Collapsible) ─── */}
        <CollapsibleSection
          kicker={t("insights.timingKicker")}
          title={t("insights.timingHeading")}
          defaultOpen={true}
          className={styles.cardRules}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className={styles.cardForecast}>
              <LazyPanel>
                <PanelErrorBoundary panelName="Future Forecast">
                  <FutureForecastPanel queryString={historyQs} />
                </PanelErrorBoundary>
              </LazyPanel>
            </div>

            <div className={styles.cardForecast}>
              <LazyPanel>
                <PanelErrorBoundary panelName="Muhurta">
                  <MuhurtaPanel queryString={historyQs} />
                </PanelErrorBoundary>
              </LazyPanel>
            </div>

            <div className={styles.cardForecast}>
              <LazyPanel>
                <PanelErrorBoundary panelName="Varshaphal & Annual Profections">
                  <VarshaphalPanel queryString={historyQs} birthDate={birthDate} />
                </PanelErrorBoundary>
              </LazyPanel>
            </div>
          </div>
        </CollapsibleSection>

        {/* ─── Core Rules Section ─── */}
        <CollapsibleSection
          kicker={t("insights.coreKicker")}
          title={t("insights.coreHeading")}
          className={styles.cardRules}
        >
          <p className={styles.sectionIntro}>
            This section pulls together the backbone of the chart: your lagna
            path, house emphasis, elemental style, nodal direction, and the
            structural signatures most likely to shape major outcomes.
          </p>
          <div className={styles.rulesScroll}>
            {coreRules.map((rule, i) => (
              <RuleCard
                key={`${rule.category}-${rule.title}`}
                rule={rule}
                index={i}
              />
            ))}
          </div>
        </CollapsibleSection>

        {/* ─── Career & Love in Bento Grid ─── */}
        {(careerRules.length > 0 || loveRules.length > 0) && (
          <div className={styles.gridThemes}>
            {careerRules.length > 0 && (
              <CollapsibleSection
                kicker={t("insights.careerKicker")}
                title={t("insights.careerHeading")}
                className={styles.cardCareer}
              >
                <p className={styles.sectionIntro}>
                  {t("insights.careerIntro")}
                </p>
                {tenthHouse && (
                  <div className={styles.themeSummary}>
                    <h4>{t("insights.career10thHouse")}</h4>
                    <p>
                      {t("insights.careerSign", { sign: tenthHouse.sign })}
                    </p>
                    <p>
                      {tenthHouse.planets.length > 0
                        ? t("insights.careerPlanetsIn10th", {
                            planets: tenthHouse.planets.join(", "),
                          })
                        : t("insights.careerNoPlanets")}
                    </p>
                  </div>
                )}
                <div className={styles.rulesScroll}>
                  {careerRules.map((rule, i) => (
                    <RuleCard
                      key={`${rule.category}-${rule.title}`}
                      rule={rule}
                      index={i}
                    />
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {loveRules.length > 0 && (
              <CollapsibleSection
                kicker={t("insights.loveKicker")}
                title={t("insights.loveHeading")}
                className={styles.cardLove}
              >
                <p className={styles.sectionIntro}>
                  {t("insights.loveIntro")}
                </p>
                {seventhHouse && (
                  <div className={styles.themeSummary}>
                    <h4>{t("insights.love7thHouse")}</h4>
                    <p>
                      {t("insights.loveSign", { sign: seventhHouse.sign })}
                    </p>
                    <p>
                      {seventhHouse.planets.length > 0
                        ? t("insights.lovePlanetsIn7th", {
                            planets: seventhHouse.planets.join(", "),
                          })
                        : t("insights.loveNoPlanets")}
                    </p>
                  </div>
                )}
                <div className={styles.rulesScroll}>
                  {loveRules.map((rule, i) => (
                    <RuleCard
                      key={`${rule.category}-${rule.title}`}
                      rule={rule}
                      index={i}
                    />
                  ))}
                </div>
                <div className={styles.ctaStrip}>
                  <Link href={compatibilityHref} className={styles.ctaButton}>
                    {t("insights.compatibilityCtaButton")} &rarr;
                  </Link>
                </div>
              </CollapsibleSection>
            )}
          </div>
        )}

        {/* ─── Advanced Modules Grid (Collapsible) ─── */}
        <CollapsibleSection
          kicker={t("insights.advancedKicker")}
          title={t("insights.advancedHeading")}
          defaultOpen={false}
          className={styles.cardRules}
        >
        <div className={styles.gridAdvanced}>
          {/* Nakshatra & Dasha */}
          <motion.div
            className={`${styles.cardDasha} ${styles.cardFullWidth}`}
            initial={shouldReduceMotion ? false : { opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 20 }}
          >
            <LazyPanel>
              <PanelErrorBoundary panelName="Nakshatra & Dasha">
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
              </PanelErrorBoundary>
            </LazyPanel>
          </motion.div>

          {/* Aspects */}
          <motion.div
            className={styles.cardAspects}
            initial={shouldReduceMotion ? false : { opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
          >
            <LazyPanel>
              <PanelErrorBoundary panelName="Planetary Aspects">
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
              </PanelErrorBoundary>
            </LazyPanel>
          </motion.div>

          {/* Navamsa */}
          <motion.div
            className={styles.cardNavamsa}
            initial={shouldReduceMotion ? false : { opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 20, delay: 0.15 }}
          >
            <LazyPanel>
              <PanelErrorBoundary panelName="Navamsa D9 Chart">
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
              </PanelErrorBoundary>
            </LazyPanel>
          </motion.div>

          {/* Divisional Charts */}
          <motion.div
            className={`${styles.cardNavamsa} ${styles.cardFullWidth}`}
            initial={shouldReduceMotion ? false : { opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 20, delay: 0.18 }}
          >
            <LazyPanel>
              <PanelErrorBoundary panelName="Divisional Charts">
              <AuthGate
                featureLabel="Divisional Charts"
                isLocked={lockedFeatures.has("divisional_charts")}
              >
                {payload.chart.divisional_charts && Object.keys(payload.chart.divisional_charts).length > 0 ? (
                  <DivisionalChartsPanel divisionalCharts={payload.chart.divisional_charts} />
                ) : (
                  <LockedFeaturePreview
                    title="Divisional Varga Charts"
                    description="Unlock D2 through D12 divisional charts to examine wealth, siblings, career, children, and more."
                  />
                )}
              </AuthGate>
              </PanelErrorBoundary>
            </LazyPanel>
          </motion.div>

          {/* Shadbala */}
          {payload.chart.shadbala && payload.chart.shadbala.length > 0 && (
            <motion.div
              className={`${styles.cardFullWidth}`}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 20, delay: 0.12 }}
            >
              <LazyPanel>
                <PanelErrorBoundary panelName="Shadbala Analysis">
                  <AuthGate
                    featureLabel="Shadbala Analysis"
                    isLocked={lockedFeatures.has("planetary_aspects")}
                  >
                    <ShadbalaPanel shadbala={payload.chart.shadbala} />
                  </AuthGate>
                </PanelErrorBoundary>
              </LazyPanel>
            </motion.div>
          )}

          {/* Yogas */}
          {payload.chart.yogas && payload.chart.yogas.length > 0 && (
            <motion.div
              className={`${styles.card} ${styles.cardFullWidth}`}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 20, delay: 0.15 }}
            >
              <LazyPanel>
                <PanelErrorBoundary panelName="Planetary Yogas">
                  <YogasPanel yogas={payload.chart.yogas} />
                </PanelErrorBoundary>
              </LazyPanel>
            </motion.div>
          )}

          {/* Transits */}
          <motion.div
            className={`${styles.cardTransits} ${styles.cardFullWidth}`}
            initial={shouldReduceMotion ? false : { opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
          >
            <LazyPanel>
              <PanelErrorBoundary panelName="Live Transits">
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
              </PanelErrorBoundary>
            </LazyPanel>
          </motion.div>

          {/* Ashtakavarga */}
          <motion.div
            className={`${styles.cardAshtakavarga} ${styles.cardFullWidth}`}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 20, delay: 0.25 }}
          >
            <LazyPanel>
              <PanelErrorBoundary panelName="Ashtakavarga">
              <AuthGate
                featureLabel="Ashtakavarga"
                isLocked={lockedFeatures.has("live_transits")}
              >
                {payload.ashtakavarga ? (
                  <AshtakavargaPanel
                    ashtakavarga={payload.ashtakavarga}
                    transits={payload.transits}
                  />
                ) : (
                  <LockedFeaturePreview
                    title="Ashtakavarga scoring"
                    description="Unlock the classical Vedic transit strength system showing bindu distribution across all 12 signs."
                  />
                )}
              </AuthGate>
              </PanelErrorBoundary>
            </LazyPanel>
          </motion.div>
        </div>
        </CollapsibleSection>

        {/* ── Palm Reading (Collapsible) ── */}
        <CollapsibleSection
          kicker={t("insights.palmKicker")}
          title={t("insights.palmHeading")}
          defaultOpen={false}
          className={styles.cardRules}
        >
          <LazyPanel>
            <PanelErrorBoundary panelName="Palm Reading">
              <AuthGate
                featureLabel="Palm Reading"
                isLocked={lockedFeatures.has("palm_reading")}
                requiredTier="premium"
              >
                <PalmReadingPanel />
              </AuthGate>
            </PanelErrorBoundary>
          </LazyPanel>
        </CollapsibleSection>

        {/* ─── Life Domain Deep Dives ─── */}
        <AuthGate
          featureLabel="Life Domain Deep Dives"
          isLocked={lockedFeatures.has("life_domain_readings")}
          requiredTier="ultimate"
        >
          {selectedDomainInsight ? (
            <motion.section
              className={styles.cardDomains}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 20 }}
            >
              <SectionHeader
                kicker="Ultimate Module"
                heading="Life domain deep dives"
              />
              <p className={styles.sectionIntro}>
                Choose a life area and read a more focused interpretation built
                from the relevant house, its lord, supporting house pattern,
                activation timing, and the chart&apos;s dominant element.
              </p>

              <p className={styles.domainSelectLabel}>Select a focus area</p>
              <div className={styles.domainChips}>
                {domainInsights.map((domain) => (
                  <button
                    key={domain.key}
                    type="button"
                    className={domain.key === selectedDomainKey ? styles.domainChipActive : styles.domainChip}
                    onClick={() => setSelectedDomainKey(domain.key)}
                  >
                    {domain.label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.article
                  key={selectedDomainInsight.key}
                  className={styles.domainCard}
                  initial={shouldReduceMotion ? false : { opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -10 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3 }}
                >
                  <div className={styles.domainHeader}>
                    <div>
                      <p className={styles.kicker}>
                        {selectedDomainInsight.label}
                      </p>
                      <h3>{selectedDomainInsight.headline}</h3>
                    </div>
                    <span className={styles.accessPillPremium}>
                      {Math.round(
                        selectedDomainInsight.confidence_score * 100
                      )}
                      % confidence
                    </span>
                  </div>

                  <p className={styles.domainOverview}>
                    {selectedDomainInsight.overview}
                  </p>

                  <div className={styles.domainGrid}>
                    <section className={styles.domainCol}>
                      <h4>What supports this area</h4>
                      <ul>
                        {selectedDomainInsight.strengths.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                    <section className={styles.domainCol}>
                      <h4>What to watch</h4>
                      <ul>
                        {selectedDomainInsight.watchouts.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  </div>

                  <div className={styles.domainGrid}>
                    <section className={styles.domainCol}>
                      <h4>Timing triggers</h4>
                      <ul>
                        {selectedDomainInsight.timing_triggers.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                    <section className={styles.domainCol}>
                      <h4>Supporting patterns</h4>
                      <ul>
                        {selectedDomainInsight.supporting_patterns.map(
                          (item) => (
                            <li key={item}>{item}</li>
                          )
                        )}
                      </ul>
                    </section>
                  </div>

                  <p className={styles.domainGuidance}>
                    <strong>Guidance:</strong>{" "}
                    {selectedDomainInsight.guidance}
                  </p>
                  <p className={styles.domainLongGame}>
                    <strong>Long game:</strong>{" "}
                    {selectedDomainInsight.long_game}
                  </p>
                </motion.article>
              </AnimatePresence>
            </motion.section>
          ) : (
            <LockedFeaturePreview
              title="Life domain deep dives"
              description="Ultimate unlocks focused readings for love life, career, family, inheritance, influence, and major life cycles."
            />
          )}
        </AuthGate>

        {/* ─── Lucky Elements ─── */}
        {payload.chart.lucky_elements && (
          <LazyPanel>
            <PanelErrorBoundary panelName="Lucky Elements">
              <LuckyElementsPanel luckyElements={payload.chart.lucky_elements} />
            </PanelErrorBoundary>
          </LazyPanel>
        )}

        {/* ─── Footer Actions ─── */}
        <motion.div
          className={styles.actions}
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5, delay: 0.2 }}
        >
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => void copyCurrentChartLink()}
          >
            <FiCopy size={16} />
            Copy chart link
          </button>
          <Link href="/workspace" className={styles.actionBtnGhost}>
            <FiGrid size={16} />
            Open Workspace
          </Link>
          <Link href="/" className={styles.actionBtnRefresh}>
            <FiRefreshCw size={16} />
            {t("insights.recalculate")}
          </Link>
        </motion.div>
      </section>
    </>
  );
}
