"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import { FiChevronDown, FiArrowLeft } from "react-icons/fi";
import PanelErrorBoundary from "@/app/(desktop)/insights/components/PanelErrorBoundary";
import ParallaxContainer from "@/app/components/ParallaxContainer";
import ParallaxLayer from "@/app/components/ParallaxLayer";
import CosmicOrbs from "@/app/components/CosmicOrbs";
import styles from "../insights.module.css";
import advStyles from "./advanced.module.css";
import type { ChartApiResponse } from "@/lib/astro-types";
import { parseBirthSex } from "@/lib/birth-sex";
import { useRouteMessages, useTranslation } from "@/lib/i18n-context";
import advancedMessages from "@/messages/en.advanced.json";
import { readerFromBirthSex, type PalmReader } from "@/lib/palm-readings/reader";
import { LOCKED_PREVIEWS, type AdvancedFocusView } from "./advanced-views";
import {
  StoryOpening,
  StoryProgress,
  StorySection,
  useAdvancedStory,
} from "./advanced-story";

/* ─── JyotishContext extraction (for palm-reading Jyotish correlation) ─── */
type JyotishContext = {
  ascendant?: { sign: string; degree: number; nakshatra: string };
  moonSign?: string;
  moonNakshatra?: string;
  sunSign?: string;
  currentMahadasha?: { lord: string; remaining_years: number };
  currentAntardasha?: { lord: string; remaining_months: number };
  keyPlacements?: Array<{
    planet: string;
    sign: string;
    house: number;
    nakshatra: string;
  }>;
};

const NAKSHATRA_NAMES_FOR_PALM: string[] = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni",
  "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha",
  "Jyeshtha", "Moola", "Purva Ashadha", "Uttara Ashadha", "Shravana",
  "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
];
const NAKSHATRA_SPAN_FOR_PALM = 13.333333333;
function nakshatraNameFromLongitude(longitude: number): string {
  if (typeof longitude !== "number" || !isFinite(longitude)) return "";
  const norm = ((longitude % 360) + 360) % 360;
  const idx = Math.floor(norm / NAKSHATRA_SPAN_FOR_PALM);
  return NAKSHATRA_NAMES_FOR_PALM[idx] ?? "";
}

const PALM_KEY_PLANETS = new Set([
  "Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu",
]);

function buildJyotishContext(payload: ChartApiResponse): JyotishContext | undefined {
  try {
    const chart = payload.chart;
    if (!chart) return undefined;

    const ctx: JyotishContext = {};

    // Ascendant
    if (chart.ascendant && typeof chart.ascendant.longitude === "number") {
      ctx.ascendant = {
        sign: chart.ascendant.sign,
        degree: chart.ascendant.degree_in_sign,
        nakshatra: nakshatraNameFromLongitude(chart.ascendant.longitude),
      };
    }

    // Moon / Sun signs and Moon nakshatra
    const planets = chart.planets ?? [];
    const moon = planets.find((p) => p.name === "Moon");
    const sun = planets.find((p) => p.name === "Sun");
    if (moon) {
      ctx.moonSign = moon.sign;
      ctx.moonNakshatra =
        chart.nakshatra?.name ?? nakshatraNameFromLongitude(moon.longitude);
    }
    if (sun) ctx.sunSign = sun.sign;

    // Dasha → mahadasha & antardasha (compute remaining time from end dates)
    const dasha = chart.dasha;
    if (dasha) {
      const now = Date.now();
      if (dasha.current_dasha && dasha.current_dasha_end) {
        const endMs = new Date(dasha.current_dasha_end).getTime();
        const remainingYears = isFinite(endMs)
          ? Math.max(0, (endMs - now) / (365.25 * 24 * 3600 * 1000))
          : 0;
        ctx.currentMahadasha = {
          lord: dasha.current_dasha,
          remaining_years: Math.round(remainingYears * 100) / 100,
        };
      }
      if (dasha.current_antardasha && dasha.current_antardasha_end) {
        const endMs = new Date(dasha.current_antardasha_end).getTime();
        const remainingMonths = isFinite(endMs)
          ? Math.max(0, (endMs - now) / (30.4375 * 24 * 3600 * 1000))
          : 0;
        ctx.currentAntardasha = {
          lord: dasha.current_antardasha,
          remaining_months: Math.round(remainingMonths * 10) / 10,
        };
      }
    }

    // Key placements for the 9 main planets
    const keyPlacements: NonNullable<JyotishContext["keyPlacements"]> = [];
    for (const p of planets) {
      if (!PALM_KEY_PLANETS.has(p.name)) continue;
      keyPlacements.push({
        planet: p.name,
        sign: p.sign,
        house: p.house,
        nakshatra: nakshatraNameFromLongitude(p.longitude),
      });
    }
    if (keyPlacements.length > 0) ctx.keyPlacements = keyPlacements;

    return ctx;
  } catch {
    return undefined;
  }
}

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

type Translate = (key: string, params?: Record<string, string>) => string;

/* ─── Locked Feature Preview ─── */
/* What stands in for a module whose data this chart does not have. */
function LockedFeaturePreview({ module }: { module: (typeof LOCKED_PREVIEWS)[number] }) {
  const tr = useRouteMessages(advancedMessages);
  return (
    <div className={styles.lockedPreview}>
      <div className={styles.lockedIcon}>&#128274;</div>
      <h3>{tr(`advanced.locked.${module}.title`)}</h3>
      <p>{tr(`advanced.locked.${module}.description`)}</p>
    </div>
  );
}

/* ─── Collapsible Section Wrapper ─── */
function CollapsibleSection({
  id,
  title,
  kicker,
  defaultOpen = true,
  children,
  className = "",
}: {
  id?: string;
  title: string;
  kicker: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const shouldReduceMotion = useReducedMotion();
  /* A new default (a different view) resets the section to it. Adjusted during
     render rather than in an effect, which painted the old state first. */
  const [appliedDefault, setAppliedDefault] = useState(defaultOpen);
  if (appliedDefault !== defaultOpen) {
    setAppliedDefault(defaultOpen);
    setIsOpen(defaultOpen);
  }

  return (
    <motion.section
      id={id}
      className={`${styles.collapsible} ${id ? styles.anchorTarget : ""} ${className}`}
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

type FocusWorkspaceCopy = {
  breadcrumb: string;
  status: string;
  description: string;
};

/* Each focused view's breadcrumb, status line and standfirst, by key:
   advanced.focus.<view>.*, in the route catalog. */
function focusWorkspaceCopy(view: AdvancedFocusView, tr: Translate): FocusWorkspaceCopy {
  return {
    breadcrumb: tr(`advanced.focus.${view}.breadcrumb`),
    status: tr(`advanced.focus.${view}.status`),
    description: tr(`advanced.focus.${view}.description`),
  };
}

function LiveTransitsModule({
  payload,
  rootMargin,
}: {
  payload: ChartApiResponse;
  rootMargin?: string;
}) {
  return (
    <LazyPanel rootMargin={rootMargin}>
      <PanelErrorBoundary panelName="Live Transits">
          {payload.transits ? (
            <TransitsPanel transits={payload.transits} />
          ) : (
            <LockedFeaturePreview module="transits" />
          )}
      </PanelErrorBoundary>
    </LazyPanel>
  );
}

function PalmReadingModule({
  jyotishContext,
  palmReader,
  rootMargin,
}: {
  jyotishContext: JyotishContext | undefined;
  palmReader: PalmReader;
  rootMargin?: string;
}) {
  return (
    <LazyPanel rootMargin={rootMargin}>
      <PanelErrorBoundary panelName="Palm Reading">
          <PalmReadingPanel jyotishContext={jyotishContext} initialReader={palmReader} />
      </PanelErrorBoundary>
    </LazyPanel>
  );
}

function FocusWorkspace({
  focusView,
  payload,
  jyotishContext,
  palmReader,
}: {
  focusView: AdvancedFocusView;
  payload: ChartApiResponse;
  jyotishContext: JyotishContext | undefined;
  palmReader: PalmReader;
}) {
  const tr = useRouteMessages(advancedMessages);
  const copy = focusWorkspaceCopy(focusView, tr);

  return (
    <section
      id={`${focusView}-workspace`}
      className={advStyles.focusWorkspace}
      aria-label={tr("advanced.header.workspaceAria", { name: copy.breadcrumb })}
    >
      <div className={advStyles.focusWorkspaceHeader}>
        <span className={advStyles.focusStatus}>{copy.status}</span>
        <p>{copy.description}</p>
      </div>
      <div className={advStyles.focusWorkspacePanel}>
        {focusView === "transits" ? (
          <LiveTransitsModule
            payload={payload}
            rootMargin="900px"
          />
        ) : (
          <PalmReadingModule
            jyotishContext={jyotishContext}
            palmReader={palmReader}
            rootMargin="900px"
          />
        )}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   ADVANCED CONTENT — Main Component
   ═══════════════════════════════════════════════ */

type AdvancedContentProps = {
  payload: ChartApiResponse;
  historyQs: string;
  focusView: AdvancedFocusView | null;
};

export default function AdvancedContent({
  payload,
  historyQs,
  focusView,
}: AdvancedContentProps) {
  const { t } = useTranslation();
  const tr = useRouteMessages(advancedMessages);
  const shouldReduceMotion = useReducedMotion();
  /* One request writes every passage on this page; see the route for why it
     cannot be one per module. */
  const storyState = useAdvancedStory(historyQs);
  const jyotishContext = buildJyotishContext(payload);
  /* The chart's sex at birth, when given, is where the palm panel's "whose
     hand?" choice starts; the reader can still change it there. */
  const palmReader = readerFromBirthSex(parseBirthSex(new URLSearchParams(historyQs).get("birthSex")));
  const insightsHref = historyQs ? `/insights?${historyQs}` : "/insights";
  const returnToReadingHref = focusView
    ? `${insightsHref}#continue-reading`
    : insightsHref;
  const focusCopy = focusView ? focusWorkspaceCopy(focusView, tr) : null;

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
            {focusCopy ? (
              <nav className={advStyles.breadcrumb} aria-label={tr("advanced.header.breadcrumbAria")}>
                <Link href={returnToReadingHref} className={advStyles.breadcrumbBack}>
                  <FiArrowLeft size={16} />
                  {tr("advanced.header.yourReading")}
                </Link>
                <span aria-hidden="true">/</span>
                <span>{tr("advanced.header.advanced")}</span>
                <span aria-hidden="true">/</span>
                <span aria-current="page">{focusCopy.breadcrumb}</span>
              </nav>
            ) : (
              <Link href={returnToReadingHref} className={advStyles.backLink}>
                <FiArrowLeft size={16} />
                {tr("advanced.header.backToInsights")}
              </Link>
            )}
          </motion.div>

          {/* ─── Hero Header ─── */}
          <motion.div
            className={advStyles.hero}
            initial={shouldReduceMotion ? false : { opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 180, damping: 22 }}
          >
            <p className={advStyles.heroKicker}>
              {focusCopy ? tr("advanced.header.focusKicker") : tr("advanced.header.kicker")}
            </p>
            <h1 className={advStyles.heroTitle}>
              {focusCopy ? focusCopy.breadcrumb : tr("advanced.header.title")}
            </h1>
            <p className={advStyles.heroLead}>
              {focusCopy ? focusCopy.description : tr("advanced.header.lead")}
            </p>
          </motion.div>

          {focusView && (
            <FocusWorkspace
              focusView={focusView}
              payload={payload}
              jyotishContext={jyotishContext}
              palmReader={palmReader}
            />
          )}

          {/* ─── Advanced Modules Grid (Collapsible) ─── */}
          <CollapsibleSection
            kicker={focusView ? tr("advanced.header.moreKicker") : t("insights.advancedKicker")}
            title={focusView ? tr("advanced.header.moreTitle") : t("insights.advancedHeading")}
            defaultOpen={!focusView}
            className={styles.cardRules}
          >
            {/* The whole section, said plainly, before any of the tables. */}
            <StoryOpening state={storyState} />
            <StoryProgress state={storyState} />
            <div className={styles.gridAdvanced}>
              {/* Nakshatra & Dasha */}
              <motion.div
                className={`${styles.cardDasha} ${styles.cardFullWidth} ${styles.cardDashaActive}`}
                initial={shouldReduceMotion ? false : { opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 20 }}
              >
                <StorySection moduleKey="timing" state={storyState} detail="timing">
                  <LazyPanel>
                    <PanelErrorBoundary panelName="Nakshatra & Dasha">
                        {payload.chart.nakshatra && payload.chart.dasha ? (
                          <NakshatraDashaPanel
                            nakshatra={payload.chart.nakshatra}
                            dasha={payload.chart.dasha}
                            audit={payload.chart.calculation_audit}
                            planets={payload.chart.planets}
                            ascendantSign={payload.chart.ascendant.sign}
                            historyQs={historyQs}
                          />
                        ) : (
                          <LockedFeaturePreview module="dasha" />
                        )}
                    </PanelErrorBoundary>
                  </LazyPanel>
                </StorySection>
              </motion.div>

              {/* Aspects */}
              <motion.div
                className={`${styles.cardAspects} ${styles.cardDepthMid}`}
                initial={shouldReduceMotion ? false : { opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
              >
                <StorySection moduleKey="aspects" state={storyState} detail="aspects">
                  <LazyPanel>
                    <PanelErrorBoundary panelName="Planetary Aspects">
                        {payload.chart.aspects && payload.chart.aspects.length > 0 ? (
                          <AspectsPanel aspects={payload.chart.aspects} />
                        ) : (
                          <LockedFeaturePreview module="aspects" />
                        )}
                    </PanelErrorBoundary>
                  </LazyPanel>
                </StorySection>
              </motion.div>

              {/* Navamsa */}
              <motion.div
                className={`${styles.cardNavamsa} ${styles.chartStarfield}`}
                initial={shouldReduceMotion ? false : { opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 20, delay: 0.15 }}
              >
                <StorySection moduleKey="navamsa" state={storyState} detail="navamsa">
                  <LazyPanel>
                    <PanelErrorBoundary panelName="Navamsa D9 Chart">
                        {payload.chart.navamsa && payload.chart.navamsa.length > 0 ? (
                          <NavamsaChart navamsa={payload.chart.navamsa} />
                        ) : (
                          <LockedFeaturePreview module="navamsa" />
                        )}
                    </PanelErrorBoundary>
                  </LazyPanel>
                </StorySection>
              </motion.div>

              {/* Divisional Charts */}
              <motion.div
                className={`${styles.cardNavamsa} ${styles.cardFullWidth}`}
                initial={shouldReduceMotion ? false : { opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 20, delay: 0.18 }}
              >
                <StorySection moduleKey="divisional" state={storyState} detail="divisional">
                  <LazyPanel>
                    <PanelErrorBoundary panelName="Divisional Charts">
                        {payload.chart.divisional_charts && Object.keys(payload.chart.divisional_charts).length > 0 ? (
                          <DivisionalChartsPanel divisionalCharts={payload.chart.divisional_charts} />
                        ) : (
                          <LockedFeaturePreview module="divisional" />
                        )}
                    </PanelErrorBoundary>
                  </LazyPanel>
                </StorySection>
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
                  <StorySection moduleKey="strength" state={storyState} detail="strength">
                    <LazyPanel>
                      <PanelErrorBoundary panelName="Shadbala Analysis">
                          <ShadbalaPanel
                            shadbala={payload.chart.shadbala}
                            planets={payload.chart.planets}
                            ashtakavarga={payload.ashtakavarga}
                          />
                      </PanelErrorBoundary>
                    </LazyPanel>
                  </StorySection>
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
                  <StorySection state={storyState} detail="yogas">
                    <LazyPanel>
                      <PanelErrorBoundary panelName="Planetary Yogas">
                        <YogasPanel yogas={payload.chart.yogas} />
                      </PanelErrorBoundary>
                    </LazyPanel>
                  </StorySection>
                </motion.div>
              )}

              {/* Transits */}
              <motion.div
                id="live-transits"
                hidden={focusView === "transits"}
                className={`${styles.cardTransits} ${styles.cardFullWidth} ${styles.cardDepthMid} ${styles.anchorTarget} ${focusView === "transits" ? advStyles.hiddenForFocusedView : ""}`}
                initial={shouldReduceMotion ? false : { opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
              >
                <StorySection moduleKey="transits" state={storyState} detail="transits">
                  <LazyPanel>
                    <PanelErrorBoundary panelName="Live Transits">
                        {payload.transits ? (
                          <TransitsPanel transits={payload.transits} />
                        ) : (
                          <LockedFeaturePreview module="transits" />
                        )}
                    </PanelErrorBoundary>
                  </LazyPanel>
                </StorySection>
              </motion.div>

              {/* Ashtakavarga */}
              <motion.div
                className={`${styles.cardAshtakavarga} ${styles.cardFullWidth} ${styles.cardDepthBack}`}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 20, delay: 0.25 }}
              >
                <StorySection moduleKey="ashtakavarga" state={storyState} detail="ashtakavarga">
                  <LazyPanel>
                    <PanelErrorBoundary panelName="Ashtakavarga">
                        {payload.ashtakavarga ? (
                          <AshtakavargaPanel
                            ashtakavarga={payload.ashtakavarga}
                            transits={payload.transits}
                          />
                        ) : (
                          <LockedFeaturePreview module="ashtakavarga" />
                        )}
                    </PanelErrorBoundary>
                  </LazyPanel>
                </StorySection>
              </motion.div>
            </div>
          </CollapsibleSection>

          {/* ── Palm Reading (Collapsible) ── */}
          <CollapsibleSection
            id="palm-reading"
            kicker={t("insights.palmKicker")}
            title={t("insights.palmHeading")}
            defaultOpen={!focusView}
            className={`${styles.cardRules} ${focusView === "palm" ? advStyles.hiddenForFocusedView : ""}`}
          >
            <LazyPanel>
              <PanelErrorBoundary panelName="Palm Reading">
                  <PalmReadingPanel jyotishContext={jyotishContext} initialReader={palmReader} />
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
            <Link href={returnToReadingHref} className={advStyles.backLink}>
              <FiArrowLeft size={16} />
              {focusView ? t("insights.backToReading") : tr("advanced.header.backToInsights")}
            </Link>
          </motion.div>
        </section>
      </ParallaxLayer>
    </ParallaxContainer>
  );
}
