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
import SectionGateway from "./section-gateway";
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
import { IMPORTANT_DIVISIONAL_CHARTS } from "@/lib/divisional-chart-guide";
import divisionalMessages from "@/messages/en.divisional.json";
import { FiClock, FiBookOpen, FiLayers, FiArrowUpRight } from "react-icons/fi";

/* Read as data rather than through useRouteMessages: the varga gateway that
   renders these chips is still hard-coded English down to its heading, blurb,
   footnote and CTA, so translating the ten chip labels alone would leave one
   card speaking two languages. They move with the rest of this file when it
   is routed through i18n. */
const ENGLISH_DIVISIONAL_GUIDE = divisionalMessages.divisional.guide as Record<
  string,
  { name: string; focus: string }
>;

// Lightweight skeleton for lazy-loaded panels
function PanelSkeleton({ minHeight = 200 }: { minHeight?: number }) {
  const { t } = useTranslation();
  return <div className={styles.card} style={{ minHeight, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4 }}>{t("insights.loading")}</div>;
}

/* â”€â”€â”€ Intersection Observer Lazy Panel â”€â”€â”€ */
function LazyPanel({
  children,
  fallback,
  rootMargin = "200px",
  minHeight = 200,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
  minHeight?: number;
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
    <div ref={ref} className={styles.lazyPanel} style={{ minHeight }}>
      {isVisible ? children : (fallback ?? <PanelSkeleton minHeight={minHeight} />)}
    </div>
  );
}

/* The diamond (North Indian) chart was removed: its house geometry placed
 * houses 2 and 12 outside the chart box and the placements did not line up.
 * The constellation view is the only chart here now, so it is imported
 * directly rather than through the old toggle wrapper. Recover the diamond
 * from git history if it is ever fixed. */
const ConstellationChart = dynamic(() => import("./constellation-chart"), { ssr: false, loading: () => <PanelSkeleton /> });
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
} from "@/lib/astro-types";
import { useTranslation } from "@/lib/i18n-context";
import { localScopedKey } from "@/lib/local-scope";
import { DOMAIN_ICONS } from "@/app/(desktop)/insights/components/life-domain-copy";
import { useToast } from "@/lib/toast-context";

type InsightsContentProps = {
  payload: ChartApiResponse;
  birthDate: string;
  historyQs: string;
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
  const [hasRestored, setHasRestored] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const contentIdBase =
    (id ?? persistKey ?? title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "section";
  const contentId = `${contentIdBase}-content`;

  useEffect(() => {
    const hashId = window.location.hash.replace("#", "");
    const isDeepLinked =
      (Boolean(id) && hashId === id) ||
      (Boolean(openForHash) && hashId === openForHash);

    if (isDeepLinked) {
      setIsOpen(true);
      setHasRestored(true);
      return;
    }

    if (!persistKey) {
      setHasRestored(true);
      return;
    }

    try {
      const storedState = window.localStorage.getItem(persistKey);
      if (storedState === "open") {
        setIsOpen(true);
      } else if (storedState === "closed") {
        setIsOpen(false);
      }
    } catch {
      // Ignore storage failures so results still render in private contexts.
    } finally {
      setHasRestored(true);
    }
  }, [defaultOpen, id, openForHash, persistKey]);

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
  { id: "overview", label: "Overview" },
  { id: "chart-map", label: "Chart" },
  { id: "ultimate", label: "Life areas" },
  { id: "timing", label: "Timing" },
  { id: "continue-reading", label: "More" },
];

const SECTION_ANCHOR_LABELS: Record<string, string> = Object.fromEntries(
  SECTION_ANCHORS.map((anchor) => [anchor.id, anchor.label])
);

function SectionAnchorNav() {
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
    <nav className={styles.anchorNav} aria-label="Results page sections">
      {/* Rendered from availableAnchorIds, which is in document order, so the
          pills read left to right in the order the reader will meet the
          sections -- and cannot disagree with the scan line that highlights
          them. */}
      {availableAnchorIds.map((id) => {
        const label = SECTION_ANCHOR_LABELS[id];
        if (!label) return null;
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

function getElementCounts(planets: ChartApiResponse["chart"]["planets"]) {
  const signElements: Record<string, string> = {
    Aries: "Fire",
    Leo: "Fire",
    Sagittarius: "Fire",
    Taurus: "Earth",
    Virgo: "Earth",
    Capricorn: "Earth",
    Gemini: "Air",
    Libra: "Air",
    Aquarius: "Air",
    Cancer: "Water",
    Scorpio: "Water",
    Pisces: "Water",
  };

  return planets
    .filter((planet) => ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"].includes(planet.name))
    .reduce<Record<string, number>>((counts, planet) => {
      const element = signElements[planet.sign] ?? "Fire";
      counts[element] = (counts[element] ?? 0) + 1;
      return counts;
    }, {});
}

function ChartAtAGlance({ payload }: { payload: ChartApiResponse }) {
  const shadbala = payload.chart.shadbala ?? [];
  const strongest = [...shadbala].sort(
    (left, right) => right.strengthRatio - left.strengthRatio,
  )[0];
  const elementCounts = getElementCounts(payload.chart.planets);
  const dominantElement =
    Object.entries(elementCounts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "Mixed";
  const activeHouse = [...payload.chart.houses]
    .filter((house) => house.planets.length > 0)
    .sort((left, right) => right.planets.length - left.planets.length)[0];

  return (
    <aside className={styles.chartGlance} aria-label="Chart at a glance">
      <div>
        <p className={styles.kicker}>Chart at a glance</p>
        <h2>{payload.chart.ascendant.sign} rising</h2>
        <p className={styles.chartGlanceIntro}>
          The three chart signals worth carrying into the interpretation.
        </p>
      </div>
      <div className={styles.chartGlanceRight}>
        <dl className={styles.chartGlanceFacts}>
          <div>
            <dt>Strongest support</dt>
            <dd>{strongest?.planet ?? "Balanced"}</dd>
          </div>
          <div>
            <dt>Dominant tone</dt>
            <dd>{dominantElement}</dd>
          </div>
          <div>
            <dt>Most active area</dt>
            <dd>
              {activeHouse
                ? `House ${activeHouse.house_number} · ${activeHouse.sign}`
                : "Evenly distributed"}
            </dd>
          </div>
        </dl>
        {activeHouse && (
          <p className={styles.chartGlanceNote}>
            {activeHouse.planets.join(", ")} concentrate in this part of the chart.
          </p>
        )}
      </div>
    </aside>
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
 * Still en-US, deliberately, while its callers are.
 *
 * Both of them wrap this in English the catalog has no key for -- "Runs
 * through {date}" in buildTopTakeaways, and "<strong>{planet}</strong> maha
 * dasha … to {date}" in the panel summary below. LOCALE_TAGS[language] is what
 * this wants the day that copy moves into the catalog; localising the date on
 * its own would only put "12 मार्च 2030" inside an English sentence, which is
 * a worse mix than the uniform English it is today.
 */
function formatMonthYear(iso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function buildTopTakeaways(payload: ChartApiResponse): TopTakeaway[] {
  const priorityRank = { high: 0, medium: 1, low: 2 };
  const sortedRules = [...payload.chart.deterministic_rules].sort(
    (left, right) =>
      priorityRank[left.priority] - priorityRank[right.priority]
  );
  const primaryRule = sortedRules[0];
  const dasha = payload.chart.dasha;
  const topDomain = [...(payload.chart.life_domain_insights ?? [])].sort(
    (left, right) => right.confidence_score - left.confidence_score
  )[0];
  const strongestPlanet = [...(payload.chart.shadbala ?? [])].sort(
    (left, right) => right.strengthRatio - left.strengthRatio
  )[0];
  const takeaways: TopTakeaway[] = [];

  if (primaryRule) {
    takeaways.push({
      label: primaryRule.priority === "high" ? "Highest signal" : "Chart signal",
      title: primaryRule.display.headline,
      body: primaryRule.display.body,
      tone: "gold",
    });
  }

  if (dasha) {
    takeaways.push({
      label: "Current timing",
      title: `${dasha.current_dasha} dasha is active`,
      body: dasha.current_antardasha
        ? `${dasha.current_antardasha} antardasha narrows the period into more immediate choices and responses.`
        : "Use the current dasha as the main timing lens for near-term decisions.",
      meta: dasha.current_dasha_end
        ? `Runs through ${formatMonthYear(dasha.current_dasha_end) ?? dasha.current_dasha_end}`
        : undefined,
      tone: "teal",
    });
  }

  if (topDomain) {
    takeaways.push({
      label: topDomain.label,
      title: topDomain.display.headline,
      body: topDomain.display.guidance,
      /* No meta: this used to repeat topDomain.label, which is already the
         card's label, so the same words appeared twice on one card. */
      tone: "coral",
    });
  }

  if (strongestPlanet && takeaways.length < 3) {
    takeaways.push({
      label: "Strongest planet",
      title: `${strongestPlanet.planet} leads the strength map`,
      body: "This planet is one of the cleaner sources of support to lean on when the chart feels noisy.",
      meta: undefined,
      tone: "coral",
    });
  }

  if (takeaways.length < 3) {
    takeaways.push({
      label: "Chart orientation",
      title: `${payload.chart.ascendant.sign} rising sets the approach`,
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

function TopTakeawaysModule({ payload }: { payload: ChartApiResponse }) {
  const shouldReduceMotion = useReducedMotion();
  const takeaways = buildTopTakeaways(payload);

  return (
    <motion.section
      className={styles.takeaways}
      aria-labelledby="top-takeaways-heading"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 190, damping: 22 }}
    >
      <div className={styles.takeawaysHeader}>
        <p className={styles.kicker}>Top 3 Takeaways</p>
        <h2 id="top-takeaways-heading" className={styles.takeawaysTitle}>
          What deserves attention first
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
  return (
    <section
      className={styles.domainLoading}
      aria-live="polite"
      aria-busy={!queued}
    >
      <div className={styles.domainLoadingHeader}>
        <p className={styles.kicker}>Life domain analysis</p>
        <h2>
          {queued
            ? "Your deeper reading is ready to begin"
            : "Calculating seven life areas separately"}
        </h2>
        <p>
          {queued
            ? "The detailed formulas will start as you approach this section, keeping the first part of your report fast."
            : "We are comparing the promise, supporting ruler, pressure points, and timing path for each area—not recycling one general reading."}
        </p>
      </div>

      <div className={styles.domainLoadingSteps} aria-hidden="true">
        <span>House and ruler relationships</span>
        <span>Strength and pressure signals</span>
        <span>Timing and tailored synthesis</span>
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
  return (
    <section className={styles.domainLoadError} role="alert">
      <p className={styles.kicker}>Life domain analysis</p>
      <h2>The detailed reading did not finish</h2>
      <p>{message}</p>
      <button type="button" className={styles.domainRetryButton} onClick={onRetry}>
        <FiRefreshCw size={16} />
        Try again
      </button>
    </section>
  );
}

type DomainLoadState = "idle" | "loading" | "ready" | "error";

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   MAIN INSIGHTS DASHBOARD (BENTO GRID LAYOUT)
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

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
  const initialDomainInsights = payload.chart.life_domain_insights ?? [];
  const [domainInsights, setDomainInsights] = useState<LifeDomainInsight[]>(
    initialDomainInsights
  );
  const rankedDomainInsights = [...domainInsights].sort(
    (left, right) => right.confidence_score - left.confidence_score
  );
  const availableEngines = payload.engine.available_engines ?? [];
  const [selectedDomainKey, setSelectedDomainKey] = useState<
    LifeDomainInsight["key"]
  >(
    [...initialDomainInsights].sort(
      (left, right) => right.confidence_score - left.confidence_score
    )[0]?.key ?? "love_life"
  );
  const [domainLoadState, setDomainLoadState] = useState<DomainLoadState>(
    initialDomainInsights.length > 0 ? "ready" : "idle"
  );
  const [domainLoadError, setDomainLoadError] = useState("");
  const [domainRetryToken, setDomainRetryToken] = useState(0);
  const domainSectionRef = useRef<HTMLDivElement>(null);

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
    const suppliedInsights = payload.chart.life_domain_insights ?? [];
    if (suppliedInsights.length > 0) {
      const topDomain = [...suppliedInsights].sort(
        (left, right) => right.confidence_score - left.confidence_score
      )[0];
      setDomainInsights(suppliedInsights);
      if (topDomain) setSelectedDomainKey(topDomain.key);
      setDomainLoadError("");
      setDomainLoadState("ready");
      return;
    }

    setDomainInsights([]);
    setDomainLoadError("");
    setDomainLoadState("idle");
    if (isLifeDomainLocked) return;

    const controller = new AbortController();
    let requested = false;

    const loadLifeDomains = async () => {
      if (requested) return;
      requested = true;
      setDomainLoadState("loading");

      try {
        const response = await fetch(`/api/chart/life-domains?${historyQs}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("We could not complete the domain formulas.");
        }

        const result = (await response.json()) as LifeDomainInsightsResponse;
        if (!Array.isArray(result.insights) || result.insights.length === 0) {
          throw new Error("The domain analysis returned no results.");
        }
        if (controller.signal.aborted) return;

        const topDomain = [...result.insights].sort(
          (left, right) => right.confidence_score - left.confidence_score
        )[0];
        setDomainInsights(result.insights);
        if (topDomain) setSelectedDomainKey(topDomain.key);
        setDomainLoadState("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        setDomainLoadError(
          error instanceof Error
            ? error.message
            : "We could not complete the domain formulas."
        );
        setDomainLoadState("error");
      }
    };

    const section = domainSectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") {
      void loadLifeDomains();
      return () => controller.abort();
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        void loadLifeDomains();
      },
      { rootMargin: "250px 0px" }
    );
    observer.observe(section);

    return () => {
      observer.disconnect();
      controller.abort();
    };
  }, [domainRetryToken, historyQs, isLifeDomainLocked, payload.chart.life_domain_insights]);

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
        label: "Lucky color",
        value: lucky.primary_colors[0],
        caption: "Wear it when it matters.",
      });
    }
    if (typeof lucky.lucky_numbers?.[0] === "number") {
      tiles.push({
        label: "Lucky number",
        value: String(lucky.lucky_numbers[0]),
        caption: "Turns tend to land on it.",
      });
    }
    if (lucky.lucky_day) {
      tiles.push({
        label: "Lucky day",
        value: lucky.lucky_day,
        caption: "Begin things here.",
      });
    }
    if (lucky.primary_gemstone) {
      tiles.push({
        label: "Lucky stone",
        value: lucky.primary_gemstone,
        caption: "Amplifies your intent.",
      });
    }
    return tiles;
  }, [payload.chart.lucky_elements]);

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
            <div className={styles.heroActions} aria-label="Report actions">
              <button
                type="button"
                className={styles.heroAction}
                onClick={() => void copyCurrentChartLink()}
              >
                <FiCopy size={16} />
                Copy link
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
          <aside className={styles.heroAside}>
            <p className={styles.heroScript}>
              Read it as a map,
              <span>not a verdict.</span>
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
                  {payload.chart.ascendant.sign} rising
                </span>
              </div>

              <dl className={styles.medallionFacts} aria-label="Chart identity">
                {heroIdentity.sun && (
                  <div>
                    <dt>Sun</dt>
                    <dd>{heroIdentity.sun}</dd>
                  </div>
                )}
                {heroIdentity.moon && (
                  <div>
                    <dt>Moon</dt>
                    <dd>{heroIdentity.moon}</dd>
                  </div>
                )}
                {payload.chart.dasha?.current_dasha && (
                  <div>
                    <dt>Period</dt>
                    <dd>{payload.chart.dasha.current_dasha}</dd>
                  </div>
                )}
              </dl>
            </div>
          </aside>
        </motion.header>

        <TodaysSkyBand transits={payload.transits} />

        <TopTakeawaysModule payload={payloadWithDomainInsights} />

        <motion.div
          id="chart-map"
          className={`${styles.cardRow3} ${styles.anchorTarget}`}
          /* Two tracks rather than three when the Ashtakavarga block is absent,
             so the row closes up instead of leaving a third of itself empty. */
          data-columns={hasHouseSupport ? "three" : "two"}
          variants={bentoContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {/* Left: the wheel and the three signals read off it, one card.
              These were two siblings in a one-column grid; the glance panel
              held three short facts in a column half of which was empty, and
              it belongs against the chart it describes. */}
          <motion.div
            className={`${styles.cardChart} ${styles.cardDepthFront}`}
            variants={bentoItemFromLeft}
          >
            <PanelErrorBoundary panelName="Lagna Chart">
              <ConstellationChart
                ascendantSign={payload.chart.ascendant.sign}
                houses={payload.chart.houses}
                planets={payload.chart.planets}
              />
            </PanelErrorBoundary>
            <ChartAtAGlance payload={payload} />
          </motion.div>

          {/* Centre: the week. */}
          <motion.div className={styles.rowPanel} variants={bentoItemFromRight}>
            <WeeklyEnergyPanel queryString={historyQs} />
          </motion.div>

          {/* Right: house support, promoted out of its collapsible so it can
              hold a column. It keeps its id, so /insights#house-support still
              resolves -- but it loses CollapsibleSection's force-open-on-hash,
              so it now relies on .anchorTarget's scroll-margin-top alone. */}
          {hasHouseSupport && (
            <motion.section
              id="house-support"
              className={`${styles.rowPanel} ${styles.card} ${styles.anchorTarget}`}
              variants={bentoItemFromRight}
              aria-labelledby="house-support-heading"
            >
              <p className={styles.kicker}>House support</p>
              <h2 id="house-support-heading" className={styles.rowPanelTitle}>
                How much support your chart receives from the houses
              </h2>
              <PanelErrorBoundary panelName="House Support">
                <HouseSupportPanel
                  ashtakavarga={payload.ashtakavarga}
                  houses={payload.chart.houses}
                  variant="brief"
                />
              </PanelErrorBoundary>
              <Link href={houseSupportHref} className={styles.sectionOpenLink}>
                What each house is responsible for
                <FiArrowUpRight aria-hidden="true" />
              </Link>
            </motion.section>
          )}
        </motion.div>

        {/* â”€â”€â”€ Life Domain Deep Dives â”€â”€â”€ */}
        <div
          id="ultimate"
          ref={domainSectionRef}
          className={styles.anchorTarget}
        >
            {domainLoadState === "error" ? (
              <LifeDomainErrorState
                message={domainLoadError}
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
                <p className={styles.kicker}>Ultimate Module</p>
                <h2 className={styles.zoneTitle}>
                  <Sparkle className={`${decor.inline} ${decor.decorGold} ${decor.sparkleSm}`} />
                  Connected Insight Zone
                  <Sparkle className={`${decor.inline} ${decor.decorGold} ${decor.sparkleSm}`} />
                </h2>
                <p className={styles.zoneSubtitle}>
                  Seven areas, each read against its own evidence. Most active
                  first; the full workup opens on its own page.
                </p>
              </div>

              {/*
                Still a tablist, and still the same seven buttons -- only the
                shape changed, from a chip to a card with the domain's own
                generated headline under its name. aria-selected was already
                doing the work the reference draws as a highlighted card, so
                there was no new state to invent.
              */}
              <div className={styles.zoneCards} role="tablist" aria-label="Life areas">
                {rankedDomainInsights.map((domain) => (
                  <button
                    key={domain.key}
                    type="button"
                    role="tab"
                    aria-selected={domain.key === selectedDomainKey}
                    className={styles.zoneCard}
                    onClick={() => setSelectedDomainKey(domain.key)}
                  >
                    {DOMAIN_ICONS[domain.key] && (
                      <span className={styles.zoneCardIcon} aria-hidden="true">
                        {DOMAIN_ICONS[domain.key]}
                      </span>
                    )}
                    <span className={styles.zoneCardText}>
                      <span className={styles.zoneCardTitle}>{domain.label}</span>
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
                        {selectedDomainInsight.label}
                      </p>
                      <h3>{selectedDomainInsight.display.headline}</h3>
                    </div>
                    {selectedDomainInsight.signal_profile?.activity_band && (
                      <span className={styles.domainSignalBadge}>
                        {selectedDomainInsight.signal_profile.activity_band} activity
                      </span>
                    )}
                  </div>

                  <p className={styles.domainOverview}>
                    {selectedDomainInsight.display.body}
                  </p>

                  <Link
                    href={`${lifeAreasHref}&domain=${selectedDomainInsight.key}`}
                    className={styles.domainOpenLink}
                  >
                    Full reading for {selectedDomainInsight.label.toLowerCase()}
                    <span aria-hidden="true">&rarr;</span>
                  </Link>
                </motion.article>
              </AnimatePresence>
              </motion.section>
            ) : (
              <LifeDomainLoadingState queued={domainLoadState === "idle"} />
            )}
        </div>

        <CollapsibleSection
          kicker="Chart details"
          title="Placements and calculation settings"
          defaultOpen={false}
          className={styles.chartDetails}
          persistKey={`${sectionStateScope}:chart-details`}
          summary={
            <>
              <span>
                <strong>{payload.chart.planets.length}</strong> placements
              </span>
              <span>
                <strong>{payload.chart.houses.length}</strong> houses
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
                <p className={styles.kicker}>Calculation method</p>
                <h3>{payload.engine.engine_label}</h3>
              </div>

              <dl className={styles.calculationFacts}>
                <div className={styles.calculationFact}>
                  <dt>Ayanamsha</dt>
                  <dd>{payload.engine.ayanamsha}</dd>
                </div>
                <div className={styles.calculationFact}>
                  <dt>House system</dt>
                  <dd>{payload.engine.house_system}</dd>
                </div>
                <div className={styles.calculationFact}>
                  <dt>Mode</dt>
                  <dd>
                    {payload.engine.fallback_mode ? "Fallback calculation" : payload.engine.ephemeris_provider}
                  </dd>
                </div>
              </dl>

              {availableEngines.length > 1 && (
                <label className={styles.engineSwitcher}>
                  <span className={styles.claimLabel}>Change method</span>
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
            kicker="Timing detail"
            title="Dasha periods and sub-periods"
            defaultOpen={false}
            className={`${styles.cardRules} ${styles.cardDasha}`}
            persistKey={`${sectionStateScope}:vimshottari-dashas`}
            summary={
              <>
                <span>
                  <strong>{payload.chart.dasha.current_dasha}</strong> maha dasha
                </span>
                {payload.chart.dasha.current_antardasha && (
                  <span>
                    <strong>{payload.chart.dasha.current_antardasha}</strong> antardasha
                  </span>
                )}
                {payload.chart.dasha.current_dasha_end && (
                  <span>
                    to{" "}
                    {formatMonthYear(payload.chart.dasha.current_dasha_end) ??
                      payload.chart.dasha.current_dasha_end}
                  </span>
                )}
              </>
            }
          >
            <LazyPanel>
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
          <GatewaySection id="timing" className={styles.timingSection}>
            <SectionGateway
              href={`/insights/timing?${historyQs}`}
              icon={<FiClock />}
              heading="Forecast, electional windows, and the year ahead"
              blurb={
                "Three long views that were burying the rest of this report. They " +
                "now have a page of their own, with room for the explanations each " +
                "one needs."
              }
              chipsLabel="What the timing page covers"
              chips={[
                { label: "Forecast", note: "periods now and next" },
                { label: "Muhurta", note: "when to begin" },
                { label: "Varshaphal", note: "this year's chart" },
              ]}
              footnote="Electional windows are scored against this chart, not a generic calendar."
              footnoteIcon={<FiClock aria-hidden="true" />}
              ctaLabel="Open timing and electional"
            />
          </GatewaySection>

          {payload.chart.divisional_charts && Object.keys(payload.chart.divisional_charts).length > 0 && (
            <GatewaySection id="divisional-charts">
              <PanelErrorBoundary panelName="Divisional Chart Atlas">
                <SectionGateway
                  href={`/insights/divisional-charts?${historyQs}`}
                  icon={<FiLayers />}
                  heading="See the layers behind your main chart"
                  blurb={
                    `All ${Object.keys(payload.chart.divisional_charts).length} supported vargas from D1 through D60, ` +
                    "with guidance for the ten that matter most in a client reading."
                  }
                  chipsLabel="Ten key divisional charts"
                  chips={IMPORTANT_DIVISIONAL_CHARTS.map((chart) => ({
                    label: chart.label,
                    note: ENGLISH_DIVISIONAL_GUIDE[`d${chart.division}`].name,
                    title: ENGLISH_DIVISIONAL_GUIDE[`d${chart.division}`].focus,
                  }))}
                  footnote="Higher divisions are shown with birth-time reliability guidance."
                  footnoteIcon={<FiClock aria-hidden="true" />}
                  ctaLabel="Open your varga atlas"
                />
              </PanelErrorBoundary>
            </GatewaySection>
          )}

          {/* ─── Full reading (gateway to its own page) ─── */}
          <GatewaySection id="core">
            <SectionGateway
              href={`/insights/full-reading?${historyQs}`}
              icon={<FiBookOpen />}
              heading="Every finding, with the placement behind it"
              blurb={
                `All ${payload.chart.deterministic_rules.length} matched patterns, the ` +
                "long-term combinations, and the karmic reading — laid out in a grid " +
                "with the type set to be read rather than skimmed."
              }
              chipsLabel="What the full reading covers"
              chips={[
                {
                  label: String(payload.chart.deterministic_rules.length),
                  note: "chart findings",
                },
                {
                  label: String(payload.chart.yogas?.length ?? 0),
                  note: "lifetime combinations",
                },
                { label: "Karma", note: "inherited patterns" },
              ]}
              footnote="The three priorities at the top of this report are drawn from this set."
              ctaLabel="Open the full reading"
            />
          </GatewaySection>
        </div>


        <CollapsibleSection
          id="life-shifts"
          kicker="Major Life Shifts"
          title="Active and upcoming life shifts"
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
            Every chapter, past and ahead
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
                Your Practical Fortune
              </h2>
              <p className={styles.fortuneSubtitle}>Everyday magic, made simple.</p>
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
            kicker="Secondary details"
            title="Lucky elements and practical fortune"
            defaultOpen={true}
            className={styles.cardRules}
            persistKey={`${sectionStateScope}:fortune`}
            summary={
              <>
                <span>Colours, numbers, days</span>
                <span>
                  keyed to <strong>{payload.chart.ascendant.sign}</strong> lagna
                </span>
              </>
            }
          >
            <LazyPanel>
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
              <p className={styles.kicker}>Explore next</p>
              <h2 id="continue-reading-heading" className={styles.continuationTitle}>
                Keep going with a focused tool
              </h2>
            </div>
            <p className={styles.continuationLead}>
              Three clear next steps, without repeating the reading you just finished.
            </p>
          </div>

          <div className={`${styles.continuationActions} ${styles.continuationActionsCompact}`}>
            <Link href={transitWorkspaceHref} className={styles.continuationAction} data-tone="sky">
              <span className={styles.continuationActionBody}>
                <strong>Current transits</strong>
                <span>Compare today’s sky with your natal chart.</span>
              </span>
              <span className={styles.continuationRoute}>Open tool <span aria-hidden="true">→</span></span>
            </Link>

            <Link href={compatibilityHref} className={styles.continuationAction} data-tone="rose">
              <span className={styles.continuationActionBody}>
                <strong>Partner comparison</strong>
                <span>Compare two complete birth profiles.</span>
              </span>
              <span className={styles.continuationRoute}>Open tool <span aria-hidden="true">→</span></span>
            </Link>

            <Link href={advancedInsightsHref} className={styles.continuationAction} data-tone="gold">
              <span className={styles.continuationActionBody}>
                <strong>All advanced tools</strong>
                <span>Choose another specialist reading.</span>
              </span>
              <span className={styles.continuationRoute}>Browse tools <span aria-hidden="true">→</span></span>
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
