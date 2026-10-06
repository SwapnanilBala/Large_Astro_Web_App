"use client";

import { useState, useTransition, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import { FiChevronDown, FiCopy, FiRefreshCw } from "react-icons/fi";
import PanelErrorBoundary from "@/app/(desktop)/insights/components/PanelErrorBoundary";
import ChartHistorySaver from "@/app/(desktop)/insights/components/chart-history-saver";
import ChartSyncPrompt from "@/app/components/ChartSyncPrompt";
import PlanetarySnapshots from "@/app/(desktop)/insights/components/planetary-snapshots";
import PersonalStory from "@/app/(desktop)/insights/components/personal-story";
/* Static, not dynamic(): it is a pure function of the chart with no clock and
   no browser API, so it server-renders — and it sits near the top of the page,
   where a lazy gate is exactly what made Major Life Shifts feel slow. */
import HouseSupportPanel from "@/app/(desktop)/insights/components/house-support-panel";
import styles from "../insights.module.css";
import { useHydrated } from "@/lib/use-hydrated";
import SectionGateway from "./section-gateway";
import TimingGatewayPreview from "./timing-gateway-preview";
import AtlasGatewayPreview from "./atlas-gateway-preview";
import ReadingEvidencePreview from "./reading-evidence-preview";
import { BookOpen, Clock3, Layers3 } from "lucide-react";
import ZodiacSignImage from "@/app/components/ZodiacSignImage";
import TodaysSkyBand from "./todays-sky-band";
import {
  Flourish,
  FoliageSprig,
  LeafSprig,
  ScriptRule,
  Sparkle,
  SunGlyph,
} from "./decor/insights-decor";
import decor from "./decor/insights-decor.module.css";
import WeeklyEnergyPanel from "./weekly-energy-panel";
import LagnaChartCard from "./lagna-chart-card";
import { FiArrowUpRight } from "react-icons/fi";

// Lightweight skeleton for lazy-loaded panels
function PanelSkeleton({ minHeight = 200 }: { minHeight?: number | string }) {
  const { t } = useTranslation();
  return <div className={styles.card} style={{ minHeight, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4 }}>{t("insights.loading")}</div>;
}

/* â”€â”€â”€ Intersection Observer Lazy Panel â”€â”€â”€ */
function LazyPanel({
  children,
  fallback,
  rootMargin = "200px",
  minHeight = 200,
  mountWhenIdle = false,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
  /* A number is pixels; a string is any CSS length, for a reservation that has
     to follow the viewport. */
  minHeight?: number | string;
  /* Also mount once the browser is idle after load, not only on arrival. See
     the effect below for when that is the right trade. */
  mountWhenIdle?: boolean;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /*
   * Mounting on arrival is a layout shift whenever the real panel is a very
   * different height from the placeholder, because it happens in view. Lucky
   * Elements is the case that measured: a 200px placeholder became a 2,060px
   * panel, so jumping to it from the section tabs moved everything beneath
   * it by nearly 1,900px (CLS 0.647). Mounted at idle it grows while it is
   * still thousands of pixels below the fold, where a shift is invisible and
   * uncounted.
   *
   * Only for panels that cost nothing to mount. A panel whose mount fires a
   * paid request -- the dasha panel's current-period reading -- must stay
   * on-arrival, or every visitor would pay for a section most never reach.
   */
  useEffect(() => {
    if (!mountWhenIdle) return;
    const show = () => setIsVisible(true);
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const handle = window.requestIdleCallback(show, { timeout: 2500 });
      return () => window.cancelIdleCallback(handle);
    }
    const timer = setTimeout(show, 1200);
    return () => clearTimeout(timer);
  }, [mountWhenIdle]);

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
    <div ref={ref} className={styles.lazyPanel} style={{ minHeight }}>
      {isVisible ? children : (fallback ?? <PanelSkeleton minHeight={minHeight} />)}
    </div>
  );
}

/* The birth chart card owns both drawings -- the constellation wheel and the
 * North Indian diamond, rebuilt in 2026-10 on tested geometry after the first
 * diamond was dropped in 342a086 -- and lazy-loads whichever is chosen. */
const NakshatraDashaPanel = dynamic(() => import("./nakshatra-dasha-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const LuckyElementsPanel = dynamic(() => import("./lucky-elements-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
/*
 * Named rather than inlined so the chunk can be warmed ahead of the scroll —
 * see the idle prefetch in InsightsContent. The panel is 12.7KB of JS minified
 * (React, the shifts engine, nothing else), which is not worth a cold network
 * round trip at the moment someone arrives at the section.
 */
const loadMajorShiftsPanel = () => import("./major-shifts-panel");
const MajorShiftsPanel = dynamic(loadMajorShiftsPanel, { ssr: false, loading: () => <PanelSkeleton /> });
import type {
  ChartApiResponse,
  LifeDomainInsight,
  LifeDomainInsightsResponse,
  TopLifeDomainSummary,
} from "@/lib/astro-types";
import { LOCALE_TAGS, useTranslation } from "@/lib/i18n-context";
import { planetName, signName } from "@/lib/chart-labels";
import Emphasise from "@/app/components/Emphasise";
import { localScopedKey } from "@/lib/local-scope";
import { TRADITION_ORDER } from "@/lib/engines/engine-registry";
import { luckyTerm, weekdayName } from "./lucky-terms";
import {
  DOMAIN_ICONS,
  activityBadge,
  domainName,
  domainNameInSentence,
} from "@/app/(desktop)/insights/components/life-domain-copy";
import { useToast } from "@/lib/toast-context";
import { useDomainBriefs } from "@/lib/use-domain-briefs";

type InsightsContentProps = {
  payload: ChartApiResponse;
  birthDate: string;
  historyQs: string;
  /** The server's pick of the strongest life area, for Top Takeaways. */
  topLifeDomain?: TopLifeDomainSummary | null;
};

/* â”€â”€â”€ Animated Section Header â”€â”€â”€ */

/* â”€â”€â”€ Collapsible Section Wrapper â”€â”€â”€ */
/*
 * A section that is only a doorway to another page.
 *
 * The three gateways were each wrapped in a CollapsibleSection, which meant
 * every one of them announced itself twice -- "Timing & electional / Forecasts
 * & Muhurta" in the accordion header, then "Forecast, electional windows, and
 * the year ahead" on the card immediately below it -- and carried a collapse
 * chevron over a single link. There is nothing to collapse: the point of a
 * gateway is that its button is visible without a click.
 *
 * This keeps the id, the anchor offset and the reveal so the section nav and
 * deep links behave exactly as before, and drops the rest.
 */
function GatewaySection({
  id,
  className = "",
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.section
      id={id}
      className={`${styles.gatewaySection} ${styles.anchorTarget} ${className}`}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 20 }}
    >
      {children}
    </motion.section>
  );
}

/* How a section should open once the browser is there to ask: open when the
   URL's hash points at it, else as the reader last left it, else null for
   "keep the default". */
function readRestoredOpen(
  id: string | undefined,
  openForHash: string | undefined,
  persistKey: string | undefined,
): boolean | null {
  const hashId = window.location.hash.replace("#", "");
  if ((Boolean(id) && hashId === id) || (Boolean(openForHash) && hashId === openForHash)) {
    return true;
  }
  if (!persistKey) return null;

  try {
    const storedState = window.localStorage.getItem(persistKey);
    if (storedState === "open") return true;
    if (storedState === "closed") return false;
  } catch {
    // Ignore storage failures so results still render in private contexts.
  }
  return null;
}

function CollapsibleSection({
  id,
  title,
  kicker,
  defaultOpen = true,
  children,
  className = "",
  persistKey,
  openForHash,
  summary,
}: {
  id?: string;
  title: string;
  kicker: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  persistKey?: string;
  openForHash?: string;
  /**
   * What the section contains, shown in the bar itself.
   *
   * Closed, these rows were a heading on the far left and a chevron ~1200px
   * away on the right with nothing in between -- so a collapsed section told
   * you its topic and nothing about whether it was worth opening. Facts belong
   * in the bar; they are the reason to open it.
   */
  summary?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hydrated = useHydrated();
  /* A deep link, or the reader's stored choice, applied once hydration is
     over and again for each new key (the stored keys are per chart) --
     during render, where an effect used to do it a commit late. */
  const restoreKey = `${id ?? ""}|${openForHash ?? ""}|${persistKey ?? ""}`;
  const [restoredFor, setRestoredFor] = useState<string | null>(null);
  if (hydrated && restoredFor !== restoreKey) {
    setRestoredFor(restoreKey);
    const restored = readRestoredOpen(id, openForHash, persistKey);
    if (restored !== null) setIsOpen(restored);
  }
  const hasRestored = restoredFor === restoreKey;
  const shouldReduceMotion = useReducedMotion();
  const contentIdBase =
    (id ?? persistKey ?? title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "section";
  const contentId = `${contentIdBase}-content`;

  useEffect(() => {
    if (!id && !openForHash) return;

    const openDeepLinkedSection = () => {
      const hashId = window.location.hash.replace("#", "");
      if (hashId === id || hashId === openForHash) {
        setIsOpen(true);
      }
    };

    window.addEventListener("hashchange", openDeepLinkedSection);
    return () => {
      window.removeEventListener("hashchange", openDeepLinkedSection);
    };
  }, [id, openForHash]);

  useEffect(() => {
    const hashId = window.location.hash.replace("#", "");
    if (!isOpen || (hashId !== id && hashId !== openForHash)) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(hashId)?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [id, isOpen, openForHash]);

  useEffect(() => {
    if (!persistKey || !hasRestored) return;

    try {
      window.localStorage.setItem(persistKey, isOpen ? "open" : "closed");
    } catch {
      // State persistence is a convenience, not a rendering requirement.
    }
  }, [hasRestored, isOpen, persistKey]);

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
        aria-controls={contentId}
      >
        <div className={styles.collapsibleLabel}>
          <span className={styles.kicker}>{kicker}</span>
          <h2 className={styles.heading}>{title}</h2>
        </div>
        {summary && !isOpen && (
          <div className={styles.collapsibleSummary}>{summary}</div>
        )}
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
            id={contentId}
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

/*
 * The five section anchors.
 *
 * This array's ORDER is not load-bearing -- getAvailableAnchorIds sorts what
 * it finds into document order, and the bar renders from that. It used to be:
 * resolveActiveAnchor walks the anchors in order and keeps the last one whose
 * top has passed the scan line, which silently reports the wrong section the
 * moment array order and document order disagree. Moving a band was therefore
 * a two-file change with a failure mode nobody would notice. Now it is not.
 *
 * What IS load-bearing: every id here has to exist in the DOM, or its pill
 * just disappears. Two of them sit on elements that are easy to lose track of
 * -- `timing` rides a card *inside* the gateway grid rather than a top-level
 * child, and `ultimate` is on the life-domain module.
 */
const SECTION_ANCHORS = [
  { id: "overview", labelKey: "insights.page.nav.overview" },
  { id: "chart-map", labelKey: "insights.page.nav.chart" },
  { id: "ultimate", labelKey: "insights.page.nav.lifeAreas" },
  { id: "timing", labelKey: "insights.page.nav.timing" },
  { id: "continue-reading", labelKey: "insights.page.nav.more" },
];

const SECTION_ANCHOR_LABELS: Record<string, string> = Object.fromEntries(
  SECTION_ANCHORS.map((anchor) => [anchor.id, anchor.labelKey])
);

function SectionAnchorNav() {
  const { t } = useTranslation();
  const [activeAnchorId, setActiveAnchorId] = useState(SECTION_ANCHORS[0].id);
  const [availableAnchorIds, setAvailableAnchorIds] = useState(
    SECTION_ANCHORS.map((anchor) => anchor.id)
  );

  useEffect(() => {
    const getAvailableAnchorIds = () => {
      // Resolve each id once and carry the node, rather than sorting ids and
      // calling getElementById again inside the comparator -- that would be
      // O(n log n) lookups per scroll frame instead of n.
      const present: Array<{ id: string; node: HTMLElement }> = [];
      for (const anchor of SECTION_ANCHORS) {
        const node = document.getElementById(anchor.id);
        if (node) present.push({ id: anchor.id, node });
      }

      // Document order, so this stays correct however the bands are arranged.
      present.sort((a, b) =>
        a.node.compareDocumentPosition(b.node) &
        Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1
      );

      return present.map((entry) => entry.id);
    };

    const resolveActiveAnchor = () => {
      const anchorIds = getAvailableAnchorIds();
      if (anchorIds.length === 0) return;

      // Bail out when the set of anchors has not actually changed. This runs
      // once per animation frame for as long as the page is scrolling, and a
      // fresh array is never Object.is-equal to the previous one, so passing it
      // straight through re-rendered the bar on every frame -- 360 times a
      // second on a high-refresh display -- to produce identical output.
      setAvailableAnchorIds((previous) =>
        previous.length === anchorIds.length &&
        previous.every((id, index) => id === anchorIds[index])
          ? previous
          : anchorIds
      );

      const hashId = window.location.hash.replace("#", "");
      if (anchorIds.includes(hashId)) {
        setActiveAnchorId(hashId);
        return;
      }

      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 8
      ) {
        setActiveAnchorId(anchorIds[anchorIds.length - 1]);
        return;
      }

      const markerY = Math.min(window.innerHeight * 0.32, 220);
      let currentId = anchorIds[0];

      for (const anchorId of anchorIds) {
        const section = document.getElementById(anchorId);
        if (!section) continue;

        const rect = section.getBoundingClientRect();
        if (rect.top <= markerY && rect.bottom > markerY) {
          currentId = anchorId;
          break;
        }

        if (rect.top <= markerY) {
          currentId = anchorId;
        }
      }

      setActiveAnchorId(currentId);
    };

    let animationFrame: number | null = null;
    const queueActiveResolve = () => {
      if (animationFrame !== null) return;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        resolveActiveAnchor();
      });
    };

    const handleHashChange = () => {
      const hashId = window.location.hash.replace("#", "");
      if (getAvailableAnchorIds().includes(hashId)) {
        setActiveAnchorId(hashId);
      }
    };

    resolveActiveAnchor();
    window.addEventListener("scroll", queueActiveResolve, { passive: true });
    window.addEventListener("resize", queueActiveResolve);
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      window.removeEventListener("scroll", queueActiveResolve);
      window.removeEventListener("resize", queueActiveResolve);
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  return (
    <nav className={styles.anchorNav} aria-label={t("insights.page.nav.aria")}>
      {/* Rendered from availableAnchorIds, which is in document order, so the
          pills read left to right in the order the reader will meet the
          sections -- and cannot disagree with the scan line that highlights
          them. */}
      {availableAnchorIds.map((id) => {
        const labelKey = SECTION_ANCHOR_LABELS[id];
        if (!labelKey) return null;
        const label = t(labelKey);
        const isActive = id === activeAnchorId;
        return (
          <a
            key={id}
            href={`#${id}`}
            className={`${styles.anchorLink} ${isActive ? styles.anchorLinkActive : ""}`}
            aria-current={isActive ? "location" : undefined}
            onClick={() => setActiveAnchorId(id)}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
}

/* â”€â”€â”€ Rule Card (Animated) â”€â”€â”€ */
/* Top Takeaways */
type TopTakeaway = {
  label: string;
  title: string;
  body: string;
  meta?: string;
  tone: "gold" | "teal" | "coral";
};

/*
 * A summary card should not assert a day.
 *
 * This printed `current_dasha_end` straight from the engine -- "Runs through
 * 2029-01-05" -- while the dasha panel further down the same page renders the
 * same boundary as "Jan 4, 2029", because the engine's end is exclusive and
 * the panel shows it inclusively. Two different dates for one boundary on one
 * page. Month and year is the honest precision for a takeaway, and it sidesteps
 * the off-by-one entirely; the panel remains the place for day precision.
 */
/*
 * In the reader's locale, now that both callers are catalog sentences --
 * "Runs through {date}" in buildTopTakeaways, and the dasha section's "to
 * {date}". `locale` is LOCALE_TAGS[language], never undefined, for the
 * hydration reason LOCALE_TAGS describes.
 */
function formatMonthYear(iso: string, locale: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(locale, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

type Translate = (key: string, params?: Record<string, string>) => string;

function buildTopTakeaways(
  payload: ChartApiResponse,
  serverTopDomain: TopLifeDomainSummary | null,
  t: Translate,
  locale: string,
): TopTakeaway[] {
  const priorityRank = { high: 0, medium: 1, low: 2 };
  const sortedRules = [...payload.chart.deterministic_rules].sort(
    (left, right) =>
      priorityRank[left.priority] - priorityRank[right.priority]
  );
  const primaryRule = sortedRules[0];
  const dasha = payload.chart.dasha;
  const loadedTopDomain = [...(payload.chart.life_domain_insights ?? [])].sort(
    (left, right) => right.confidence_score - left.confidence_score
  )[0];
  /* The loaded domains when they are here, the server's pick of the same
     record until then (getTopLifeDomainSummary): the two agree, so the card
     is the same before and after the domains arrive and nothing below it
     moves. */
  const topDomain = loadedTopDomain
    ? {
        label: loadedTopDomain.label,
        headline: loadedTopDomain.display.headline,
        guidance: loadedTopDomain.display.guidance,
      }
    : serverTopDomain;
  const strongestPlanet = [...(payload.chart.shadbala ?? [])].sort(
    (left, right) => right.strengthRatio - left.strengthRatio
  )[0];
  const takeaways: TopTakeaway[] = [];

  if (primaryRule) {
    takeaways.push({
      label:
        primaryRule.priority === "high"
          ? t("insights.page.takeaways.highestSignal")
          : t("insights.page.takeaways.chartSignal"),
      title: primaryRule.display.headline,
      body: primaryRule.display.body,
      tone: "gold",
    });
  }

  if (dasha) {
    takeaways.push({
      label: t("insights.page.takeaways.currentTiming"),
      title: t("insights.page.takeaways.dashaActive", { planet: planetName(dasha.current_dasha, t) }),
      body: dasha.current_antardasha
        ? t("insights.page.takeaways.antardashaBody", {
            planet: planetName(dasha.current_antardasha, t),
          })
        : t("insights.page.takeaways.dashaBody"),
      meta: dasha.current_dasha_end
        ? t("insights.page.takeaways.runsThrough", {
            date: formatMonthYear(dasha.current_dasha_end, locale) ?? dasha.current_dasha_end,
          })
        : undefined,
      tone: "teal",
    });
  }

  if (topDomain) {
    takeaways.push({
      label: topDomain.label,
      title: topDomain.headline,
      body: topDomain.guidance,
      /* No meta: this used to repeat topDomain.label, which is already the
         card's label, so the same words appeared twice on one card. */
      tone: "coral",
    });
  }

  if (strongestPlanet && takeaways.length < 3) {
    takeaways.push({
      label: t("insights.page.takeaways.strongestPlanet"),
      title: t("insights.page.takeaways.strongestTitle", { planet: planetName(strongestPlanet.planet, t) }),
      body: t("insights.page.takeaways.strongestBody"),
      meta: undefined,
      tone: "coral",
    });
  }

  if (takeaways.length < 3) {
    takeaways.push({
      label: t("insights.page.takeaways.orientation"),
      title: t("insights.page.takeaways.orientationTitle", { sign: signName(payload.chart.ascendant.sign, t) }),
      body: payload.chart.summary,
      meta: undefined,
      tone: "gold",
    });
  }

  return takeaways.slice(0, 3);
}

function getTakeawayToneClass(tone: TopTakeaway["tone"]) {
  if (tone === "teal") return styles.takeawayTeal;
  if (tone === "coral") return styles.takeawayCoral;
  return styles.takeawayGold;
}

function TopTakeawaysModule({
  payload,
  serverTopDomain,
}: {
  payload: ChartApiResponse;
  serverTopDomain: TopLifeDomainSummary | null;
}) {
  const shouldReduceMotion = useReducedMotion();
  const { t, language } = useTranslation();
  const takeaways = buildTopTakeaways(payload, serverTopDomain, t, LOCALE_TAGS[language]);

  return (
    <motion.section
      className={styles.takeaways}
      aria-labelledby="top-takeaways-heading"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 190, damping: 22 }}
    >
      <div className={styles.takeawaysHeader}>
        <p className={styles.kicker}>{t("insights.page.takeaways.kicker")}</p>
        <h2 id="top-takeaways-heading" className={styles.takeawaysTitle}>
          {t("insights.page.takeaways.heading")}
        </h2>
      </div>
      <div className={styles.takeawaysGrid}>
        {takeaways.map((takeaway, index) => (
          <article
            key={`${takeaway.label}-${takeaway.title}`}
            className={`${styles.takeawayCard} ${getTakeawayToneClass(takeaway.tone)}`}
          >
            <div className={styles.takeawayTop}>
              <span className={styles.takeawayNumber}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className={styles.takeawayLabel}>{takeaway.label}</p>
            </div>
            <h3>{takeaway.title}</h3>
            <p className={styles.takeawayBody}>{takeaway.body}</p>
            {takeaway.meta && (
              <small className={styles.takeawayMeta}>{takeaway.meta}</small>
            )}
          </article>
        ))}
      </div>
    </motion.section>
  );
}

function LifeDomainLoadingState({ queued }: { queued: boolean }) {
  const { t } = useTranslation();
  return (
    <section
      className={styles.domainLoading}
      aria-live="polite"
      aria-busy={!queued}
    >
      <div className={styles.domainLoadingHeader}>
        <p className={styles.kicker}>{t("insights.page.domains.kicker")}</p>
        <h2>
          {queued
            ? t("insights.page.domains.queuedHeading")
            : t("insights.page.domains.loadingHeading")}
        </h2>
        <p>
          {queued
            ? t("insights.page.domains.queuedLead")
            : t("insights.page.domains.loadingLead")}
        </p>
      </div>

      <div className={styles.domainLoadingSteps} aria-hidden="true">
        <span>{t("insights.page.domains.stepHouses")}</span>
        <span>{t("insights.page.domains.stepStrength")}</span>
        <span>{t("insights.page.domains.stepTiming")}</span>
      </div>

      <div className={styles.domainLoadingSkeleton} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}

function LifeDomainErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section className={styles.domainLoadError} role="alert">
      <p className={styles.kicker}>{t("insights.page.domains.kicker")}</p>
      <h2>{t("insights.page.domains.errorHeading")}</h2>
      <p>{message}</p>
      <button type="button" className={styles.domainRetryButton} onClick={onRetry}>
        <FiRefreshCw size={16} />
        {t("errorBoundary.tryAgain")}
      </button>
    </section>
  );
}

type DomainLoadState = "idle" | "loading" | "ready" | "error";

/* One empty set for every "no life areas" answer. The selection follows the
   set's identity, so a fresh [] each render would reset it on every render. */
const NO_DOMAIN_INSIGHTS: LifeDomainInsight[] = [];

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   MAIN INSIGHTS DASHBOARD (BENTO GRID LAYOUT)
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

export default function InsightsContent({
  payload,
  birthDate,
  historyQs,
  topLifeDomain = null,
}: InsightsContentProps) {
  const { t, language } = useTranslation();
  const locale = LOCALE_TAGS[language];
  const { pushToast } = useToast();
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const [isRouting, startRouting] = useTransition();
  const lockedFeatures = new Set(payload.access.locked_features);
  const isLifeDomainLocked = lockedFeatures.has("life_domain_readings");
  const advancedInsightsHref = historyQs
    ? `/insights/advanced?${historyQs}`
    : "/insights/advanced";
  const compatibilityHref = historyQs
    ? `/insights/compatibility?${historyQs}`
    : "/insights/compatibility";
  /* Always carries a query string: the page rebuilds the chart from it, so a
     bare /insights/life-areas would land on "details are incomplete". */
  const lifeAreasHref = `/insights/life-areas?${historyQs}`;
  const houseSupportHref = `/insights/house-support?${historyQs}`;
  const lifeShiftsHref = `/insights/life-shifts?${historyQs}`;
  const transitParams = new URLSearchParams(historyQs);
  transitParams.set("view", "transits");
  const transitWorkspaceHref = `/insights/advanced?${transitParams.toString()}`;
  /* What ChartSyncPrompt would store, memoised: the sync effect keys on this
     object, and a fresh one each render would re-run it on every keystroke
     elsewhere on the page. */
  const chartToSync = useMemo(
    () =>
      historyQs
        ? {
            queryString: historyQs,
            ascendantSign: payload.chart.ascendant.sign ?? null,
            sunSign:
              payload.chart.planets.find((planet) => planet.name === "Sun")?.sign ?? null,
            moonSign:
              payload.chart.planets.find((planet) => planet.name === "Moon")?.sign ?? null,
          }
        : null,
    [historyQs, payload.chart.ascendant.sign, payload.chart.planets],
  );
  // Profile-scoped: the query string carries the subject's name and birth
  // details, so an unscoped key would leave one profile's charts listed in
  // storage for the next person on the device.
  const sectionStateScope = `${localScopedKey("astro_insights_section_state")}:${historyQs}`;
  /*
   * The life areas: the payload's own when it carries them, otherwise a set
   * fetched once the section nears the viewport. Derived from which request a
   * fetched set answers, rather than copied into state by an effect, so a new
   * payload or a retry shows the right state in the same render.
   */
  const suppliedDomainInsights = payload.chart.life_domain_insights ?? NO_DOMAIN_INSIGHTS;
  const hasSuppliedDomainInsights = suppliedDomainInsights.length > 0;
  const [domainRetryToken, setDomainRetryToken] = useState(0);
  const domainFetchKey = `${historyQs}#${domainRetryToken}`;
  /* Written only by the observer and the fetch below. */
  const [domainFetch, setDomainFetch] = useState<
    | { key: string; status: "loading" }
    | { key: string; status: "ready"; insights: LifeDomainInsight[] }
    | { key: string; status: "error"; error: string }
    | null
  >(null);
  const currentDomainFetch =
    !hasSuppliedDomainInsights && !isLifeDomainLocked && domainFetch?.key === domainFetchKey
      ? domainFetch
      : null;
  const domainInsights = hasSuppliedDomainInsights
    ? suppliedDomainInsights
    : currentDomainFetch?.status === "ready"
      ? currentDomainFetch.insights
      : NO_DOMAIN_INSIGHTS;
  const domainLoadState: DomainLoadState = hasSuppliedDomainInsights
    ? "ready"
    : currentDomainFetch?.status ?? "idle";
  const domainLoadError = currentDomainFetch?.status === "error" ? currentDomainFetch.error : "";
  const rankedDomainInsights = [...domainInsights].sort(
    (left, right) => right.confidence_score - left.confidence_score
  );
  /* Memoised for its identity, not its cost: the ?? [] branch produces a fresh
     array every render, which would re-run the methodAxes memo below on each
     one. */
  const availableEngines = useMemo(
    () => payload.engine.available_engines ?? [],
    [payload.engine.available_engines]
  );

  /* Every engine id is a (tradition, house system) pair -- "lahiri_classic",
     "krishnamurti_placidus" -- and the label is just the two joined with a
     space. The panel used to show that joined label plus a flat select of all
     36 combinations, which asks the reader to already know that "Krishnamurti
     Placidus" is two independent choices. Split back into its axes so the
     panel can show them as what they are: the tradition, then the style
     inside it.

     Grouped by id prefix rather than by a hardcoded key list, so a tradition
     added to the registry appears here with no change -- the same derivation
     app/m/engine-select uses. */
  const methodAxes = useMemo(() => {
    const traditions = TRADITION_ORDER.map((key) => ({
      key,
      engines: availableEngines.filter((engine) =>
        engine.engine_id.startsWith(`${key}_`)
      ),
    })).filter((tradition) => tradition.engines.length > 0);

    const active =
      traditions.find((tradition) =>
        tradition.engines.some(
          (engine) => engine.engine_id === payload.engine.engine_id
        )
      ) ?? traditions[0];

    /* payload.engine carries the house system's display label but not its
       code, and the code is what pairs the two axes. It is on the matching
       available_engines entry, so read it from there rather than widening the
       payload type for one field. */
    const activeCode =
      availableEngines.find(
        (engine) => engine.engine_id === payload.engine.engine_id
      )?.house_system_code ?? "whole_sign";

    return { traditions, active, activeCode, styles: active?.engines ?? [] };
  }, [availableEngines, payload.engine.engine_id]);

  /* Changing one axis holds the other. Switching tradition keeps the house
     system you were reading in if that pair exists -- it always does, the
     registry builds a full cross-product -- and otherwise falls back to whole
     sign, which is the Vedic default a tradition opens on. */
  const engineForAxes = (traditionKey: string, houseSystemCode: string) => {
    const within = availableEngines.filter((engine) =>
      engine.engine_id.startsWith(`${traditionKey}_`)
    );
    return (
      within.find((engine) => engine.house_system_code === houseSystemCode) ??
      within.find((engine) => engine.house_system_code === "whole_sign") ??
      within[0]
    );
  };
  const [selectedDomainKey, setSelectedDomainKey] = useState<
    LifeDomainInsight["key"]
  >(rankedDomainInsights[0]?.key ?? "love_life");
  const domainSectionRef = useRef<HTMLDivElement>(null);
  const { briefs: domainBriefs, pending: domainBriefPending } = useDomainBriefs(
    historyQs, selectedDomainKey, domainLoadState === "ready",
  );

  /* A new set of life areas opens on its strongest, as it always has. Adjusted
     during render, where an effect used to do it a commit late. */
  const [selectionMadeFor, setSelectionMadeFor] = useState(domainInsights);
  if (selectionMadeFor !== domainInsights) {
    setSelectionMadeFor(domainInsights);
    if (rankedDomainInsights[0]) setSelectedDomainKey(rankedDomainInsights[0].key);
  }
  const selectDomain = (key: LifeDomainInsight["key"]) => {
    if (key === selectedDomainKey) return;
    setSelectedDomainKey(key);
  };

  /*
   * Warm the Major Life Shifts chunk while the visitor is still at the top of
   * the page.
   *
   * That section sits ~3,200px down and had two gates in series before it: an
   * IntersectionObserver that fires only within 200px, and then a cold fetch
   * of its own chunk. Nothing was requested until someone had almost arrived,
   * so the wait was a full network round trip spent staring at "Loading…" —
   * for 12.7KB of minified JS whose whole module graph is React plus the
   * shifts engine. The split saves less than the round trip costs.
   *
   * Warming it here settles the chunk during idle time, so the observer
   * resolves against a module that is already in memory. Same idiom as the
   * date-picker warm on the intake page.
   */
  useEffect(() => {
    const warm = () => { void loadMajorShiftsPanel(); };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const handle = window.requestIdleCallback(warm, { timeout: 2500 });
      return () => window.cancelIdleCallback(handle);
    }
    const timer = setTimeout(warm, 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (hasSuppliedDomainInsights || isLifeDomainLocked) return;

    const key = domainFetchKey;
    const controller = new AbortController();
    let requested = false;

    const loadLifeDomains = async () => {
      if (requested) return;
      requested = true;

      try {
        const response = await fetch(`/api/chart/life-domains?${historyQs}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("failed");
        }

        const result = (await response.json()) as LifeDomainInsightsResponse;
        if (!Array.isArray(result.insights) || result.insights.length === 0) {
          throw new Error("empty");
        }
        if (controller.signal.aborted) return;

        setDomainFetch({ key, status: "ready", insights: result.insights });
      } catch (error) {
        if (controller.signal.aborted) return;
        /* A catalog key rather than a sentence, so the message renders in the
           reader's language; a network failure reads as "failed" too. */
        setDomainFetch({
          key,
          status: "error",
          error:
            error instanceof Error && error.message === "empty"
              ? "insights.page.domains.errorEmpty"
              : "insights.page.domains.errorFailed",
        });
      }
    };

    const section = domainSectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") {
      /* Nothing to wait on, so ask now. The panel keeps its queued copy until
         the answer lands, rather than being marked loading from in here. */
      void loadLifeDomains();
      return () => controller.abort();
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        setDomainFetch({ key, status: "loading" });
        void loadLifeDomains();
      },
      { rootMargin: "250px 0px" }
    );
    observer.observe(section);

    return () => {
      observer.disconnect();
      controller.abort();
    };
  }, [domainFetchKey, hasSuppliedDomainInsights, historyQs, isLifeDomainLocked]);

  /* The two signs the hero's arch shows alongside the rising sign. Read from
     the natal placements, so they are the chart's own numbers rather than a
     restatement of the summary sentence above them. */
  const heroIdentity = useMemo(
    () => ({
      sun: payload.chart.planets.find((planet) => planet.name === "Sun")?.sign,
      moon: payload.chart.planets.find((planet) => planet.name === "Moon")?.sign,
    }),
    [payload.chart.planets]
  );

  /* Hoisted out of the JSX because the three-column row has to know whether
     its third column exists before it can choose a track count. */
  const hasHouseSupport =
    payload.ashtakavarga?.sarvashtakavarga?.length === 12 &&
    payload.chart.houses?.length === 12;

  /*
   * The four tiles in the Practical Fortune strip.
   *
   * Each is gated on its own field rather than on the group, because
   * LuckyElementsInfo carries arrays that can legitimately be empty -- a tile
   * with a label and no value under it reads as a fault, whereas three tiles
   * just reads as three tiles.
   *
   * Note the fourth is the gemstone, not an element: despite its name,
   * lucky_elements has no Fire/Earth/Air/Water field at all, so the
   * reference's "Lucky Element" tile has nothing behind it. Saying "Lucky
   * stone" and showing the gemstone is the honest version.
   */
  const fortuneTiles = useMemo(() => {
    const lucky = payload.chart.lucky_elements;
    if (!lucky) return [];
    const tiles: Array<{ label: string; value: string; caption: string }> = [];
    if (lucky.primary_colors?.[0]) {
      tiles.push({
        label: t("insights.page.fortune.color"),
        value: luckyTerm("colors", lucky.primary_colors[0], t),
        caption: t("insights.page.fortune.colorCaption"),
      });
    }
    if (typeof lucky.lucky_numbers?.[0] === "number") {
      tiles.push({
        label: t("insights.page.fortune.number"),
        value: String(lucky.lucky_numbers[0]),
        caption: t("insights.page.fortune.numberCaption"),
      });
    }
    if (lucky.lucky_day) {
      tiles.push({
        label: t("insights.page.fortune.day"),
        value: weekdayName(lucky.lucky_day, locale),
        caption: t("insights.page.fortune.dayCaption"),
      });
    }
    if (lucky.primary_gemstone) {
      tiles.push({
        label: t("insights.page.fortune.stone"),
        value: luckyTerm("gems", lucky.primary_gemstone, t),
        caption: t("insights.page.fortune.stoneCaption"),
      });
    }
    return tiles;
  }, [payload.chart.lucky_elements, t, locale]);

  const payloadWithDomainInsights: ChartApiResponse =
    domainInsights.length > 0
      ? {
          ...payload,
          chart: { ...payload.chart, life_domain_insights: domainInsights },
        }
      : payload;

  const selectedDomainInsight =
    domainInsights.find((domain) => domain.key === selectedDomainKey) ??
    rankedDomainInsights[0];
  const copyCurrentChartLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/insights?${historyQs}`
      );
      pushToast(t("insights.page.hero.copied"), "success");
    } catch {
      pushToast(t("insights.page.hero.copyFailed"), "error");
    }
  };

  const switchEngine = (engineId: string) => {
    const params = new URLSearchParams(historyQs);
    params.set("engineId", engineId);
    startRouting(() => {
      router.push(`/insights?${params.toString()}`);
    });
  };

  /* â”€â”€â”€ Stagger animation for bento cells â”€â”€â”€ */
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
      <section className={`dashboard-shell ${styles.dashboard}`}>
        <SectionAnchorNav />
        {/* â”€â”€â”€ Hero Header â”€â”€â”€ */}
        <motion.header
          id="overview"
          className={`${styles.band} ${styles.hero} ${styles.anchorTarget}`}
          initial={shouldReduceMotion ? false : { opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 180, damping: 22 }}
        >
          <FoliageSprig className={`${decor.decor} ${decor.decorGold} ${decor.heroStart}`} />
          <FoliageSprig className={`${decor.decor} ${decor.decorTeal} ${decor.heroEnd}`} />

          <div className={styles.heroCopy}>
            <p className={styles.kicker}>{t("insights.kicker")}</p>
            <h1 className={styles.title}>
              <span className={styles.titleName}>{payload.client.name}</span>
              <span className={styles.titleSuffix}>{t("insights.headingSuffix")}</span>
            </h1>
            <p className={styles.lead}>{payload.chart.summary}</p>
            <div className={styles.heroActions} aria-label={t("insights.page.hero.actionsAria")}>
              <button
                type="button"
                className={styles.heroAction}
                onClick={() => void copyCurrentChartLink()}
              >
                <FiCopy size={16} />
                {t("insights.page.hero.copyLink")}
              </button>
              <PersonalStory
                payload={payloadWithDomainInsights}
                compact
                queryString={historyQs}
              />
            </div>
          </div>

          {/*
            The hero's right column.
            The arch carries the four facts that identify the chart rather than
            four decorative words. Two of them -- rising sign and current
            period -- used to be the .heroFacts chips directly above; they moved
            in here rather than being duplicated, and Sun and Moon join them
            because a reader naming their chart out loud names those four.
          */}
          {/* A div, not an <aside>: this is the hero's own content, and a
              complementary landmark may not sit inside <main>. */}
          <div className={styles.heroAside}>
            <p className={styles.heroScript}>
              {t("insights.page.hero.scriptLead")}
              <span>{t("insights.page.hero.scriptTail")}</span>
            </p>
            <ScriptRule className={`${decor.inline} ${decor.decorGold} ${decor.rule}`} />
            {/*
              The rising sign as a medallion, rather than four words on a slab.
              The arch it replaces was a 12%-white rectangle and the largest
              element on this side of the hero, which made a placeholder the
              focal point. The illustration is the reader's own ascendant, so
              the biggest thing here is now the most specific thing here.

              The remaining three facts sit under it in three equal columns.
              Three items in two columns lands 2 + 1, which reads as a wrap
              rather than a row.
            */}
            <div className={styles.heroMedallion}>
              <div className={styles.medallionDisc}>
                <ZodiacSignImage
                  sign={payload.chart.ascendant.sign}
                  size={168}
                  className={styles.medallionImage}
                />
                <Sparkle
                  className={`${decor.inline} ${decor.decorGold} ${decor.sparkleSm} ${styles.medallionSparkle}`}
                />
                <span className={styles.medallionSign}>
                  {t("insights.page.hero.rising", { sign: signName(payload.chart.ascendant.sign, t) })}
                </span>
              </div>

              <dl className={styles.medallionFacts} aria-label={t("insights.page.hero.identityAria")}>
                {heroIdentity.sun && (
                  <div>
                    <dt>{planetName("Sun", t)}</dt>
                    <dd>{signName(heroIdentity.sun, t)}</dd>
                  </div>
                )}
                {heroIdentity.moon && (
                  <div>
                    <dt>{planetName("Moon", t)}</dt>
                    <dd>{signName(heroIdentity.moon, t)}</dd>
                  </div>
                )}
                {payload.chart.dasha?.current_dasha && (
                  <div>
                    <dt>{t("insights.page.hero.period")}</dt>
                    <dd>{planetName(payload.chart.dasha.current_dasha, t)}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </motion.header>

        <TodaysSkyBand transits={payload.transits} />

        <TopTakeawaysModule
          payload={payloadWithDomainInsights}
          serverTopDomain={isLifeDomainLocked ? null : topLifeDomain}
        />

        <motion.div
          id="chart-map"
          className={`${styles.cardRow3} ${styles.anchorTarget}`}
          variants={bentoContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {/* Left: the birth chart in the reader's chosen style, its planet
              positions, and the three signals read off it, in one card. */}
          <motion.div
            className={`${styles.cardChart} ${styles.cardDepthFront}`}
            variants={bentoItemFromLeft}
          >
            <LagnaChartCard payload={payload} />
          </motion.div>

          {/* Right: the week. House support used to be a third panel here
              and is now paired with the insight zone below instead. */}
          <motion.div className={styles.rowPanel} variants={bentoItemFromRight}>
            <WeeklyEnergyPanel queryString={historyQs} />
          </motion.div>
        </motion.div>

        {/* â”€â”€â”€ Life Domain Deep Dives, beside house support â”€â”€â”€ */}
        <motion.div
          className={styles.insightPair}
          /* One track when there is no Ashtakavarga block, so the zone does not
             sit in 58% of the row with nothing beside it. */
          data-columns={hasHouseSupport ? "two" : "one"}
          variants={bentoContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <div
            id="ultimate"
            ref={domainSectionRef}
            className={`${styles.anchorTarget} ${styles.insightColumn}`}
          >
              {domainLoadState === "error" ? (
                <LifeDomainErrorState
                  message={t(domainLoadError)}
                  onRetry={() => setDomainRetryToken((value) => value + 1)}
                />
              ) : selectedDomainInsight ? (
                <motion.section
                className={styles.cardDomains}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 20 }}
              >
                {/* Centred, the way the reference heads this band. The intro
                    used to list all eight evidence families; that sentence is
                    now on the page that actually shows them. */}
                <div className={styles.zoneHeader}>
                  <p className={styles.kicker}>{t("insights.page.zone.kicker")}</p>
                  <h2 className={styles.zoneTitle}>
                    <Sparkle className={`${decor.inline} ${decor.decorGold} ${decor.sparkleSm}`} />
                    {t("insights.page.zone.title")}
                    <Sparkle className={`${decor.inline} ${decor.decorGold} ${decor.sparkleSm}`} />
                  </h2>
                  <p className={styles.zoneSubtitle}>{t("insights.page.zone.subtitle")}</p>
                </div>

                {/*
                  Still a tablist, and still the same seven buttons -- only the
                  shape changed, from a chip to a card with the domain's own
                  generated headline under its name. aria-selected was already
                  doing the work the reference draws as a highlighted card, so
                  there was no new state to invent.
                */}
                <div className={styles.zoneCards} role="tablist" aria-label={t("insights.page.nav.lifeAreas")}>
                  {rankedDomainInsights.map((domain) => (
                    <button
                      key={domain.key}
                      type="button"
                      role="tab"
                      aria-selected={domain.key === selectedDomainKey}
                      className={styles.zoneCard}
                      onClick={() => selectDomain(domain.key)}
                    >
                      {DOMAIN_ICONS[domain.key] && (
                        <span className={styles.zoneCardIcon} aria-hidden="true">
                          {DOMAIN_ICONS[domain.key]}
                        </span>
                      )}
                      <span className={styles.zoneCardText}>
                        <span className={styles.zoneCardTitle}>{domainName(domain, t)}</span>
                        <span className={styles.zoneCardBody}>
                          {domain.display.headline}
                        </span>
                      </span>
                      <span className={styles.zoneCardChevron} aria-hidden="true">
                        &rsaquo;
                      </span>
                    </button>
                  ))}
                </div>

                {/* The brief, and only the brief.
                    Detailed and Action Plan were tabs here, and the evidence
                    verdict, the six ranked subthemes, the timing windows,
                    guidance and long game rendered under all three. That is a
                    full consultation for one area, seven areas deep, on the page
                    a client sees first. It all lives at /insights/life-areas now;
                    what is left is the headline and the paragraph under it. */}
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
                          {domainName(selectedDomainInsight, t)}
                        </p>
                        <h3>{selectedDomainInsight.display.headline}</h3>
                      </div>
                      {selectedDomainInsight.signal_profile?.activity_band && (
                        <span className={styles.domainSignalBadge}>
                          {activityBadge(selectedDomainInsight.signal_profile.activity_band, t)}
                        </span>
                      )}
                    </div>

                    {/* The written brief when one has arrived, the engine's own
                        body until then and for good if none ever does. */}
                    <p
                      className={styles.domainOverview}
                      data-refining={
                        domainBriefPending && !domainBriefs[selectedDomainInsight.key]
                          ? "true"
                          : undefined
                      }
                      aria-busy={
                        domainBriefPending && !domainBriefs[selectedDomainInsight.key]
                      }
                    >
                      {domainBriefs[selectedDomainInsight.key] ??
                        selectedDomainInsight.display.body}
                    </p>

                    <Link
                      href={`${lifeAreasHref}&domain=${selectedDomainInsight.key}`}
                      className={styles.domainOpenLink}
                    >
                      {t("insights.page.zone.fullReadingFor", {
                        area: domainNameInSentence(selectedDomainInsight, t, language),
                      })}
                      <span aria-hidden="true">&rarr;</span>
                    </Link>
                  </motion.article>
                </AnimatePresence>
                </motion.section>
              ) : (
                <LifeDomainLoadingState queued={domainLoadState === "idle"} />
              )}
          </div>

          {/* House support, promoted out of its collapsible so it can hold a
              column. It keeps its id, so /insights#house-support still
              resolves -- but it loses CollapsibleSection's force-open-on-hash,
              so it relies on .anchorTarget's scroll-margin-top alone. */}
          {hasHouseSupport && (
            <motion.section
              id="house-support"
              className={`${styles.rowPanel} ${styles.card} ${styles.anchorTarget}`}
              variants={bentoItemFromRight}
              aria-labelledby="house-support-heading"
            >
              <p className={styles.kicker}>{t("insights.page.houseSupport.kicker")}</p>
              <h2 id="house-support-heading" className={styles.rowPanelTitle}>
                {t("insights.page.houseSupport.heading")}
              </h2>
              <PanelErrorBoundary panelName="House Support">
                <HouseSupportPanel
                  ashtakavarga={payload.ashtakavarga}
                  houses={payload.chart.houses}
                  variant="brief"
                />
              </PanelErrorBoundary>
              <Link href={houseSupportHref} className={styles.sectionOpenLink}>
                {t("insights.page.houseSupport.link")}
                <FiArrowUpRight aria-hidden="true" />
              </Link>
            </motion.section>
          )}
        </motion.div>

        <CollapsibleSection
          kicker={t("insights.page.details.kicker")}
          title={t("insights.page.details.title")}
          defaultOpen={false}
          className={styles.chartDetails}
          persistKey={`${sectionStateScope}:chart-details`}
          summary={
            <>
              <span>
                <Emphasise
                  text={t("insights.page.details.placements", {
                    count: String(payload.chart.planets.length),
                  })}
                />
              </span>
              <span>
                <Emphasise
                  text={t("insights.page.details.houses", {
                    count: String(payload.chart.houses.length),
                  })}
                />
              </span>
              {payload.chart.calculation_audit?.ayanamsha && (
                <span>{payload.chart.calculation_audit.ayanamsha}</span>
              )}
            </>
          }
        >
          <div className={styles.chartDetailsLayout}>
            {/* The calculation method reads as an instrument bar across the top
                rather than a narrow side column: it is one short fact set, and
                giving it a 240px rail was what squeezed the placement grid. */}
            <section className={styles.calculationPanel}>
              <div className={styles.calculationIdentity}>
                <p className={styles.kicker}>{t("insights.page.details.method")}</p>
                <h3>{payload.engine.engine_label}</h3>
                <p className={styles.calculationProvider}>
                  {payload.engine.fallback_mode
                    ? t("insights.page.details.fallback")
                    : payload.engine.ephemeris_provider}
                </p>
              </div>

              {/* Two tiers rather than one name: the tradition, then the style
                  inside it. Each shows its own value and, when there is more
                  than one engine to move between, the alternatives beside it. */}
              <div className={styles.methodTiers}>
                <div className={styles.methodTier}>
                  <div className={styles.methodTierHead}>
                    <span className={styles.methodTierKicker}>
                      {t("insights.page.details.mainMethod")} <span aria-hidden="true">·</span>{" "}
                      {t("insights.page.details.ayanamsha")}
                    </span>
                    <span className={styles.methodTierValue}>
                      {methodAxes.active
                        ? t(`engineSelect.groups.${methodAxes.active.key}.label`)
                        : payload.engine.ayanamsha}
                    </span>
                  </div>
                  {methodAxes.traditions.length > 1 && (
                    <div
                      className={styles.methodChips}
                      role="radiogroup"
                      aria-label={`${t("insights.page.details.mainMethod")}, ${t("insights.page.details.ayanamsha")}`}
                    >
                      {methodAxes.traditions.map((tradition) => {
                        const isActive = tradition.key === methodAxes.active?.key;
                        const target = engineForAxes(
                          tradition.key,
                          methodAxes.activeCode
                        );
                        return (
                          <button
                            key={tradition.key}
                            type="button"
                            role="radio"
                            aria-checked={isActive}
                            tabIndex={isActive ? 0 : -1}
                            disabled={isRouting}
                            className={`${styles.methodChip}${isActive ? ` ${styles.methodChipActive}` : ""}`}
                            onClick={() => target && switchEngine(target.engine_id)}
                          >
                            {t(`engineSelect.groups.${tradition.key}.label`)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className={styles.methodTier}>
                  <div className={styles.methodTierHead}>
                    <span className={styles.methodTierKicker}>
                      {t("insights.page.details.subMethod")} <span aria-hidden="true">·</span>{" "}
                      {t("insights.page.details.houseSystem")}
                    </span>
                    {/* The catalog label, not payload.engine.house_system:
                        the registry calls whole sign "Whole Sign" and the
                        chooser calls it "Classic Whole Sign", and the value
                        sitting above a chip that names it differently reads
                        as two settings rather than one. */}
                    <span className={styles.methodTierValue}>
                      {methodAxes.styles.length > 0
                        ? t(`engineSelect.styles.${methodAxes.activeCode}.label`)
                        : payload.engine.house_system}
                    </span>
                  </div>
                  {methodAxes.styles.length > 1 && (
                    <div
                      className={styles.methodChips}
                      role="radiogroup"
                      aria-label={`${t("insights.page.details.subMethod")}, ${t("insights.page.details.houseSystem")}`}
                    >
                      {methodAxes.styles.map((engine) => {
                        const isActive =
                          engine.engine_id === payload.engine.engine_id;
                        return (
                          <button
                            key={engine.engine_id}
                            type="button"
                            role="radio"
                            aria-checked={isActive}
                            tabIndex={isActive ? 0 : -1}
                            disabled={isRouting}
                            className={`${styles.methodChip}${isActive ? ` ${styles.methodChipActive}` : ""}`}
                            onClick={() => switchEngine(engine.engine_id)}
                          >
                            {t(`engineSelect.styles.${engine.house_system_code}.label`)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <div className={styles.cardPlanets}>
              <PanelErrorBoundary panelName="Planetary Snapshots">
                <PlanetarySnapshots planets={payload.chart.planets} />
              </PanelErrorBoundary>
            </div>
          </div>
        </CollapsibleSection>

        {/* The two reference panels sit together, then the three doorways.
            Previously the dasha table was wedged between the timing gateway
            and the varga gateway, which split the doorways apart and left the
            page a single column of full-width bars all the way down. */}
        {payload.chart.nakshatra && payload.chart.dasha && (
          <CollapsibleSection
            id="vimshottari-dashas"
            kicker={t("insights.page.dasha.kicker")}
            title={t("insights.page.dasha.title")}
            defaultOpen={true}
            className={`${styles.cardRules} ${styles.cardDasha}`}
            /* `:open-default` retires the keys written while this section
               defaulted closed. The section persists on every mount, not only
               on a click, so every earlier visitor has "closed" stored whether
               they chose it or not -- reusing the old key would leave the new
               default visible to first-time readers only. */
            persistKey={`${sectionStateScope}:vimshottari-dashas:open-default`}
            summary={
              <>
                <span>
                  <Emphasise
                    text={t("insights.page.dasha.maha", {
                      planet: planetName(payload.chart.dasha.current_dasha, t),
                    })}
                  />
                </span>
                {payload.chart.dasha.current_antardasha && (
                  <span>
                    <Emphasise
                      text={t("insights.page.dasha.antar", {
                        planet: planetName(payload.chart.dasha.current_antardasha, t),
                      })}
                    />
                  </span>
                )}
                {payload.chart.dasha.current_dasha_end && (
                  <span>
                    {t("insights.page.dasha.until", {
                      date:
                        formatMonthYear(payload.chart.dasha.current_dasha_end, locale) ??
                        payload.chart.dasha.current_dasha_end,
                    })}
                  </span>
                )}
              </>
            }
          >
            {/* Mounted on arrival, not at idle: its mount fires the paid
                current-period reading. So the placeholder reserves the height
                instead. Measured 1,553 / 1,459 / 1,391 / 1,285px at 1024 / 1280 /
                1440 / 1920 wide -- roughly 1860px - 30vw -- where a 200px default
                made the Timing tab's jump a 0.66 CLS. This tracks it about 60-100px
                under, so a chart with less to say still never leaves a gap. */}
            <LazyPanel minHeight="clamp(1150px, calc(1760px - 30vw), 1500px)">
              <PanelErrorBoundary panelName="Vimshottari Dashas">
                  <NakshatraDashaPanel
                    nakshatra={payload.chart.nakshatra}
                    dasha={payload.chart.dasha}
                    audit={payload.chart.calculation_audit}
                    planets={payload.chart.planets}
                  />
              </PanelErrorBoundary>
            </LazyPanel>
          </CollapsibleSection>
        )}

        {/* Row F. .gatewayGrid keeps its own auto-fit rule: it wins over
            .cardRowAuto on both columns and gap anyway (measured: 2 tracks at
            25.92px, which is --gateway-gap), and it carries the
            `:last-child:nth-child(odd)` full-width span that .cardRowAuto has
            no equivalent for. Adding the shared class here changed nothing. */}
        <div className={styles.gatewayGrid}>
          {/* ─── Timing & electional (gateway to its own page) ─── */}
          <GatewaySection id="timing">
            <SectionGateway
              href={`/insights/timing?${historyQs}`}
              icon={<Clock3 />}
              eyebrow={t("insights.page.gateways.timing.eyebrow")}
              variant="timing"
              heading={t("insights.page.gateways.timing.heading")}
              blurb={t("insights.page.gateways.timing.blurb")}
              footnote={t("insights.page.gateways.timing.footnote")}
              ctaLabel={t("insights.page.gateways.timing.cta")}
            >
              <TimingGatewayPreview dasha={payload.chart.dasha} href={`/insights/timing?${historyQs}`} />
            </SectionGateway>
          </GatewaySection>

          {payload.chart.divisional_charts && Object.keys(payload.chart.divisional_charts).length > 0 && (
            <GatewaySection id="divisional-charts">
              <PanelErrorBoundary panelName="Divisional Chart Atlas">
                <SectionGateway
                  href={`/insights/divisional-charts?${historyQs}`}
                  icon={<Layers3 />}
                  eyebrow={t("insights.page.gateways.atlas.eyebrow")}
                  variant="atlas"
                  heading={t("insights.page.gateways.atlas.heading")}
                  blurb={t("insights.page.gateways.atlas.blurb")}
                  footnote={t("insights.page.gateways.atlas.footnote")}
                  ctaLabel={t("insights.page.gateways.atlas.cta", {
                    count: String(Object.keys(payload.chart.divisional_charts).length),
                  })}
                >
                  <AtlasGatewayPreview charts={payload.chart.divisional_charts} historyQs={historyQs} />
                </SectionGateway>
              </PanelErrorBoundary>
            </GatewaySection>
          )}

          {/* ─── Full reading (gateway to its own page) ─── */}
          <GatewaySection id="core">
            <SectionGateway
              href={`/insights/full-reading?${historyQs}`}
              icon={<BookOpen />}
              eyebrow={t("insights.page.gateways.reading.eyebrow")}
              variant="reading"
              heading={t("insights.page.gateways.reading.heading")}
              blurb={t("insights.page.gateways.reading.blurb")}
              footnote={t("insights.page.gateways.reading.footnote")}
              ctaLabel={t("insights.page.gateways.reading.cta")}
            >
              <ReadingEvidencePreview rules={payload.chart.deterministic_rules} yogaCount={payload.chart.yogas?.length ?? 0} />
            </SectionGateway>
          </GatewaySection>
        </div>


        <CollapsibleSection
          id="life-shifts"
          kicker={t("insights.page.lifeShifts.kicker")}
          title={t("insights.page.lifeShifts.title")}
          defaultOpen={true}
          className={styles.cardKarma}
          persistKey={`${sectionStateScope}:life-shifts`}
        >
          {/* 800px rather than the 200px default: the warm above means the
              module is already in memory, so the only thing left to buy is
              enough lead time to render before the section is actually read. */}
          <LazyPanel minHeight={560} rootMargin="800px">
            <PanelErrorBoundary panelName="Major Life Shifts">
              <MajorShiftsPanel payload={payload} variant="brief" />
            </PanelErrorBoundary>
          </LazyPanel>
          <Link href={lifeShiftsHref} className={styles.sectionOpenLink}>
            {t("insights.page.lifeShifts.link")}
            <FiArrowUpRight aria-hidden="true" />
          </Link>
        </CollapsibleSection>

        {/* â”€â”€â”€ Lucky Elements â”€â”€â”€ */}
        {payload.chart.lucky_elements && fortuneTiles.length > 0 && (
          <section
            className={`${styles.band} ${styles.fortuneBand}`}
            aria-labelledby="fortune-band-heading"
          >
            <div className={styles.fortuneIntro}>
              <SunGlyph className={`${decor.inline} ${decor.decorGold} ${decor.sun}`} />
              <h2 id="fortune-band-heading" className={styles.fortuneTitle}>
                {t("insights.page.fortune.heading")}
              </h2>
              <p className={styles.fortuneSubtitle}>{t("insights.page.fortune.subtitle")}</p>
              <Flourish className={`${decor.inline} ${decor.decorGold} ${decor.flourish}`} />
            </div>

            {/*
              The four tiles the reference puts in this strip, read straight off
              lucky_elements. The full panel is still underneath in its own
              collapsible -- nothing was moved out of it, this is a summary of
              what it already holds, so that section's saved open/closed state
              keeps working exactly as before.
            */}
            <dl className={styles.fortuneTiles}>
              {fortuneTiles.map((tile) => (
                <div key={tile.label} className={styles.fortuneTile}>
                  <dt className={styles.fortuneLabel}>{tile.label}</dt>
                  <dd className={styles.fortuneValue}>{tile.value}</dd>
                  <dd className={styles.fortuneCaption}>{tile.caption}</dd>
                </div>
              ))}
            </dl>

            {/* Last, so it lands in the band's third track. It used to be an
                absolutely-positioned overlay and overlapped the final tile by
                134x64px; a track of its own makes that impossible. */}
            <LeafSprig className={`${decor.inline} ${decor.decorGold} ${styles.fortuneLeaf}`} />
          </section>
        )}

        {payload.chart.lucky_elements && (
          <CollapsibleSection
            id="fortune"
            kicker={t("insights.page.fortune.kicker")}
            title={t("insights.page.fortune.title")}
            defaultOpen={true}
            className={styles.cardRules}
            persistKey={`${sectionStateScope}:fortune`}
            summary={
              <>
                <span>{t("insights.page.fortune.summaryKinds")}</span>
                <span>
                  <Emphasise
                    text={t("insights.page.fortune.keyedTo", {
                      sign: signName(payload.chart.ascendant.sign, t),
                    })}
                  />
                </span>
              </>
            }
          >
            {/* Idle-mounted: no requests, and a height the placeholder cannot guess. */}
            <LazyPanel mountWhenIdle>
              <PanelErrorBoundary panelName="Lucky Elements">
                <LuckyElementsPanel luckyElements={payload.chart.lucky_elements} />
              </PanelErrorBoundary>
            </LazyPanel>
          </CollapsibleSection>
        )}

        <motion.section
          id="continue-reading"
          className={`${styles.continuationHub} ${styles.anchorTarget}`}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.28 }}
          aria-labelledby="continue-reading-heading"
        >
          <div className={styles.continuationHeader}>
            <div>
              <p className={styles.kicker}>{t("insights.page.next.kicker")}</p>
              <h2 id="continue-reading-heading" className={styles.continuationTitle}>
                {t("insights.page.next.heading")}
              </h2>
            </div>
            <p className={styles.continuationLead}>{t("insights.page.next.lead")}</p>
          </div>

          <div className={`${styles.continuationActions} ${styles.continuationActionsCompact}`}>
            <Link href={transitWorkspaceHref} className={styles.continuationAction} data-tone="sky">
              <span className={styles.continuationActionBody}>
                <strong>{t("insights.page.next.transitsTitle")}</strong>
                <span>{t("insights.page.next.transitsBody")}</span>
              </span>
              <span className={styles.continuationRoute}>
                {t("insights.page.next.openTool")} <span aria-hidden="true">→</span>
              </span>
            </Link>

            <Link href={compatibilityHref} className={styles.continuationAction} data-tone="rose">
              <span className={styles.continuationActionBody}>
                <strong>{t("insights.page.next.partnerTitle")}</strong>
                <span>{t("insights.page.next.partnerBody")}</span>
              </span>
              <span className={styles.continuationRoute}>
                {t("insights.page.next.openTool")} <span aria-hidden="true">→</span>
              </span>
            </Link>

            <Link href={advancedInsightsHref} className={styles.continuationAction} data-tone="gold">
              <span className={styles.continuationActionBody}>
                <strong>{t("insights.page.next.advancedTitle")}</strong>
                <span>{t("insights.page.next.advancedBody")}</span>
              </span>
              <span className={styles.continuationRoute}>
                {t("insights.page.next.browseTools")} <span aria-hidden="true">→</span>
              </span>
            </Link>
          </div>
        </motion.section>

        {/* â”€â”€â”€ Footer Actions â”€â”€â”€ */}
        <motion.div
          className={styles.actions}
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5, delay: 0.2 }}
        >
          <Link href="/" className={styles.actionBtnRefresh}>
            <FiRefreshCw size={16} />
            {t("insights.recalculate")}
          </Link>
        </motion.div>

        {/* Below the chart and below the actions, deliberately. The question
            is worth asking where somebody has finished reading, not in front
            of the thing they came for. */}
        <ChartSyncPrompt chart={chartToSync} />
      </section>
    </>
  );
}
