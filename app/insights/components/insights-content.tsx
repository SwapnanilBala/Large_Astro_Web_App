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
import ParallaxContainer from "@/app/components/ParallaxContainer";
import ParallaxLayer from "@/app/components/ParallaxLayer";
import CosmicOrbs from "@/app/components/CosmicOrbs";
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

const LagnaChart = dynamic(() => import("./lagna-chart"), { ssr: false, loading: () => <PanelSkeleton /> });
const FutureForecastPanel = dynamic(() => import("./future-forecast-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const MuhurtaPanel = dynamic(() => import("./muhurta-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const VarshaphalPanel = dynamic(() => import("./varshaphal-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const LuckyElementsPanel = dynamic(() => import("./lucky-elements-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const YogaLifetimeSummary = dynamic(() => import("./yoga-lifetime-summary"), { ssr: false, loading: () => <PanelSkeleton /> });
import type { ChartApiResponse, LifeDomainInsight } from "@/lib/astro-types";
import { useTranslation } from "@/lib/i18n-context";
import { useToast } from "@/lib/toast-context";
import ZodiacSignImage from "@/app/components/ZodiacSignImage";
import PlanetOrbRow from "@/app/components/PlanetOrbRow";
import type { PlanetName } from "@/app/components/PlanetOrb";

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

/* ─── Constellation Section Divider ─── */
function ConstellationDivider() {
  return (
    <div className={styles.constellationDivider} aria-hidden="true">
      <svg viewBox="0 0 400 48" fill="none">
        <circle className={styles.constellationDot} cx="40" cy="24" r="2" />
        <circle className={styles.constellationDot} cx="120" cy="16" r="1.5" />
        <circle className={styles.constellationDot} cx="200" cy="28" r="2.5" />
        <circle className={styles.constellationDot} cx="280" cy="18" r="1.5" />
        <circle className={styles.constellationDot} cx="360" cy="26" r="2" />
        <line className={styles.constellationLine} x1="42" y1="24" x2="118" y2="16" />
        <line className={styles.constellationLine} x1="122" y1="16" x2="198" y2="28" />
        <line className={styles.constellationLine} x1="202" y1="28" x2="278" y2="18" />
        <line className={styles.constellationLine} x1="282" y1="18" x2="358" y2="26" />
      </svg>
    </div>
  );
}

/* ─── Domain Icon Map ─── */
const DOMAIN_ICONS: Record<string, string> = {
  love_life: "\u2661",
  career: "\u2726",
  health: "\u2695",
  family: "\u2302",
  finance: "\u2666",
  education: "\u2710",
  spirituality: "\u2638",
  influence: "\u2605",
  inheritance: "\u229B",
  cycles: "\u21BB",
};

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
      stiffness: 60,
      damping: 15,
      mass: 0.6,
      bounce: 0.3,
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
    <ParallaxContainer>
      <ChartHistorySaver
        name={payload.client.name}
        city={payload.client.city}
        birthDate={birthDate}
        ascendantSign={payload.chart.ascendant.sign}
        queryString={historyQs}
      />
      {/* Floating cosmic orbs with parallax */}
      <CosmicOrbs />
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <ParallaxLayer depth={0.05}>
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

          {/* Planet orbs row – key planets from this chart, centered */}
          {payload.chart.planets && payload.chart.planets.length > 0 && (
            <div style={{ marginTop: "1.25rem", display: "flex", justifyContent: "center" }}>
              <PlanetOrbRow
                planets={payload.chart.planets.map((p) => p.name as PlanetName)}
                size="md"
                showLabels
              />
            </div>
          )}
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
            className={`${styles.cardMetric} ${styles.cardGold} ${styles.cardDepthFront}`}
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
            className={`${styles.cardMetric} ${styles.cardAqua} ${styles.cardDepthFront}`}
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

          {/* Ascendant Sign Card (moved from hero) */}
          <motion.article
            className={`${styles.cardMetric} ${styles.cardGold} ${styles.cardDepthFront}`}
            variants={bentoItem}
          >
            <ZodiacSignImage
              sign={payload.chart.ascendant.sign}
              size={52}
              style={{
                border: "2px solid rgba(255,200,80,0.5)",
                boxShadow: "0 0 16px rgba(255,200,80,0.3)",
                marginBottom: "0.35rem",
              }}
            />
            <h3>{t("insights.ascendantSign")}</h3>
            <p className={styles.metricValue}>
              {payload.chart.ascendant.sign}
            </p>
          </motion.article>
        </motion.div>

        <ConstellationDivider />

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
            className={`${styles.cardChart} ${styles.chartStarfield} ${styles.cardDepthFront}`}
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
            className={`${styles.cardPlanets} ${styles.cardDepthFront}`}
            variants={bentoItemFromRight}
          >
            <PanelErrorBoundary panelName="Planetary Snapshots">
              <PlanetarySnapshots planets={payload.chart.planets} />
            </PanelErrorBoundary>
          </motion.div>
        </motion.div>

        <ConstellationDivider />

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

        <ConstellationDivider />

        {/* ─── Yoga Lifetime Summary ─── */}
        {payload.chart.yogas && payload.chart.yogas.length > 0 && (
          <motion.section
            className={styles.cardRules}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 20 }}
          >
            <LazyPanel>
              <PanelErrorBoundary panelName="Yoga Lifetime Summary">
                <YogaLifetimeSummary yogas={payload.chart.yogas} />
              </PanelErrorBoundary>
            </LazyPanel>
          </motion.section>
        )}

        <ConstellationDivider />

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

        <ConstellationDivider />

        {/* ─── Advanced & Palm Analysis CTA ─── */}
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 20 }}
        >
          <Link
            href={`/insights/advanced?${historyQs}`}
            className={styles.advancedCta}
          >
            <span className={styles.advancedCtaTitle}>
              Advanced &amp; Palm Analysis &rarr;
            </span>
            <span className={styles.advancedCtaDesc}>
              Explore Nakshatra cycles, Dasha timing, Navamsa refinements, divisional charts, planetary yogas, transit overlays, Ashtakavarga scores, Shadbala strength, and AI-powered palm reading — all in one dedicated space.
            </span>
          </Link>
        </motion.div>

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
                    {DOMAIN_ICONS[domain.key] && (
                      <span className={styles.domainChipIcon}>{DOMAIN_ICONS[domain.key]}</span>
                    )}
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
      </ParallaxLayer>
    </ParallaxContainer>
  );
}
