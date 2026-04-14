"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import { FiChevronDown, FiArrowLeft } from "react-icons/fi";
import AuthGate from "@/app/insights/components/auth-gate";
import PanelErrorBoundary from "@/app/insights/components/PanelErrorBoundary";
import ParallaxContainer from "@/app/components/ParallaxContainer";
import ParallaxLayer from "@/app/components/ParallaxLayer";
import CosmicOrbs from "@/app/components/CosmicOrbs";
import styles from "../insights.module.css";
import advStyles from "./advanced.module.css";
import type { ChartApiResponse } from "@/lib/astro-types";
import { useTranslation } from "@/lib/i18n-context";

/* ─── Lightweight skeleton for lazy-loaded panels ─── */
function PanelSkeleton() {
  const { t } = useTranslation();
  return (
    <div
      className={styles.card}
      style={{
        minHeight: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: 0.4,
      }}
    >
      {t("insights.loading")}
    </div>
  );
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

/* ─── Dynamic Imports ─── */
const NakshatraDashaPanel = dynamic(() => import("../components/nakshatra-dasha-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const NavamsaChart = dynamic(() => import("../components/navamsa-chart"), { ssr: false, loading: () => <PanelSkeleton /> });
const TransitsPanel = dynamic(() => import("../components/transits-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const AspectsPanel = dynamic(() => import("../components/aspects-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const DivisionalChartsPanel = dynamic(() => import("../components/divisional-charts-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const AshtakavargaPanel = dynamic(() => import("../components/ashtakavarga-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const PalmReadingPanel = dynamic(() => import("../components/palm-reading-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const ShadbalaPanel = dynamic(() => import("../components/shadbala-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const YogasPanel = dynamic(() => import("../components/yogas-panel"), { ssr: false, loading: () => <PanelSkeleton /> });

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

/* ═══════════════════════════════════════════════
   ADVANCED CONTENT — Main Component
   ═══════════════════════════════════════════════ */

type AdvancedContentProps = {
  payload: ChartApiResponse;
  historyQs: string;
};

export default function AdvancedContent({
  payload,
  historyQs,
}: AdvancedContentProps) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const lockedFeatures = new Set(payload.access.locked_features);

  return (
    <ParallaxContainer>
      <CosmicOrbs />
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <ParallaxLayer depth={0.05}>
        <section className={`dashboard-shell ${advStyles.advancedShell}`}>
          {/* ─── Back to Insights Link ─── */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 22 }}
          >
            <Link href={`/insights?${historyQs}`} className={advStyles.backLink}>
              <FiArrowLeft size={16} />
              Back to Insights
            </Link>
          </motion.div>

          {/* ─── Hero Header ─── */}
          <motion.div
            className={advStyles.hero}
            initial={shouldReduceMotion ? false : { opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 180, damping: 22 }}
          >
            <p className={advStyles.heroKicker}>Deep Dive Tools</p>
            <h1 className={advStyles.heroTitle}>
              Advanced &amp; Palm Analysis
            </h1>
            <p className={advStyles.heroLead}>
              Nakshatra cycles, Dasha timing, Navamsa refinements, divisional charts,
              planetary yogas, transit overlays, Ashtakavarga scores, Shadbala strength,
              and AI-powered palm reading — all in one dedicated space.
            </p>
          </motion.div>

          {/* ─── Advanced Modules Grid (Collapsible) ─── */}
          <CollapsibleSection
            kicker={t("insights.advancedKicker")}
            title={t("insights.advancedHeading")}
            defaultOpen={true}
            className={styles.cardRules}
          >
            <div className={styles.gridAdvanced}>
              {/* Nakshatra & Dasha */}
              <motion.div
                className={`${styles.cardDasha} ${styles.cardFullWidth} ${styles.cardDashaActive}`}
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
                className={`${styles.cardAspects} ${styles.cardDepthMid}`}
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
                className={`${styles.cardNavamsa} ${styles.chartStarfield}`}
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
                className={`${styles.cardTransits} ${styles.cardFullWidth} ${styles.cardDepthMid}`}
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
                className={`${styles.cardAshtakavarga} ${styles.cardFullWidth} ${styles.cardDepthBack}`}
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
            defaultOpen={true}
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

          {/* ─── Back to Insights (bottom) ─── */}
          <motion.div
            style={{ display: "flex", justifyContent: "center", padding: "1rem 0 2rem" }}
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5, delay: 0.2 }}
          >
            <Link href={`/insights?${historyQs}`} className={advStyles.backLink}>
              <FiArrowLeft size={16} />
              Back to Insights
            </Link>
          </motion.div>
        </section>
      </ParallaxLayer>
    </ParallaxContainer>
  );
}
