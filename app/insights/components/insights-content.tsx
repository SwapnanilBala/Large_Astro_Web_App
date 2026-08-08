"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useMotionValue, animate as fmAnimate, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import { FiChevronDown, FiCopy, FiGrid, FiRefreshCw } from "react-icons/fi";
import AuthGate from "@/app/insights/components/auth-gate";
import PanelErrorBoundary from "@/app/insights/components/PanelErrorBoundary";
import ChartHistorySaver from "@/app/insights/components/chart-history-saver";
import PlanetarySnapshots from "@/app/insights/components/planetary-snapshots";
import PersonalStory from "@/app/insights/components/personal-story";
import ParallaxContainer from "@/app/components/ParallaxContainer";
import ParallaxLayer from "@/app/components/ParallaxLayer";
import CosmicOrbs from "@/app/components/CosmicOrbs";
import styles from "../insights.module.css";

// Lightweight skeleton for lazy-loaded panels
function PanelSkeleton() {
  const { t } = useTranslation();
  return <div className={styles.card} style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4 }}>{t("insights.loading")}</div>;
}

/* â”€â”€â”€ Intersection Observer Lazy Panel â”€â”€â”€ */
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
const NakshatraDashaPanel = dynamic(() => import("./nakshatra-dasha-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const FutureForecastPanel = dynamic(() => import("./future-forecast-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const MuhurtaPanel = dynamic(() => import("./muhurta-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const VarshaphalPanel = dynamic(() => import("./varshaphal-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const LuckyElementsPanel = dynamic(() => import("./lucky-elements-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const YogaLifetimeSummary = dynamic(() => import("./yoga-lifetime-summary"), { ssr: false, loading: () => <PanelSkeleton /> });
const PastLifeInsightsPanel = dynamic(() => import("./past-life-insights-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
const MajorShiftsPanel = dynamic(() => import("./major-shifts-panel"), { ssr: false, loading: () => <PanelSkeleton /> });
import type { ChartApiResponse, DeterministicRule, LifeDomainInsight } from "@/lib/astro-types";
import { useTranslation } from "@/lib/i18n-context";
import { useToast } from "@/lib/toast-context";
import ZodiacSignImage from "@/app/components/ZodiacSignImage";
import PlanetOrbRow from "@/app/components/PlanetOrbRow";
import type { PlanetName } from "@/app/components/PlanetOrb";

type HeroPlanetMetadata = {
  planet: PlanetName;
  sign?: string;
  house?: number;
  dignity?: string;
  shadbalaStrength?: number;
  strengthPercent?: number;
  isCurrentDashaLord: boolean;
  tooltip: string;
};

type FuturePlanetOrbRowProps = React.ComponentProps<typeof PlanetOrbRow> & {
  planetMetadata?: HeroPlanetMetadata[];
  activePlanet?: PlanetName;
  currentDashaLord?: PlanetName;
};

const PLANET_NAMES: PlanetName[] = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
  "Rahu",
  "Ketu",
];

const PLANET_NAME_SET = new Set<string>(PLANET_NAMES);
const HeroPlanetOrbRow = PlanetOrbRow as React.ComponentType<FuturePlanetOrbRowProps>;

function toPlanetName(name?: string | null): PlanetName | null {
  if (!name) return null;
  return PLANET_NAME_SET.has(name) ? (name as PlanetName) : null;
}

function formatDignity(dignity?: string) {
  if (!dignity) return undefined;
  return dignity
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildHeroPlanetMetadata(payload: ChartApiResponse) {
  const currentDashaLord = toPlanetName(payload.chart.dasha?.current_dasha);
  const shadbalaByPlanet = new Map(
    (payload.chart.shadbala ?? []).map((planet) => [planet.planet, planet])
  );
  const navamsaByPlanet = new Map(
    (payload.chart.navamsa ?? []).map((planet) => [planet.name, planet])
  );
  const seenPlanets = new Set<PlanetName>();
  const metadata: HeroPlanetMetadata[] = [];

  for (const planet of payload.chart.planets) {
    const planetName = toPlanetName(planet.name);
    if (!planetName || seenPlanets.has(planetName)) continue;

    seenPlanets.add(planetName);
    const shadbala = shadbalaByPlanet.get(planet.name);
    const dignity = formatDignity(navamsaByPlanet.get(planet.name)?.dignity);
    const house =
      planet.house ??
      payload.chart.houses.find((housePlacement) =>
        housePlacement.planets.includes(planet.name)
      )?.house_number;
    const strengthPercent =
      typeof shadbala?.strengthRatio === "number"
        ? Math.round(shadbala.strengthRatio * 100)
        : undefined;
    const details = [
      planet.sign,
      house ? `House ${house}` : undefined,
      dignity,
      currentDashaLord === planetName ? "Current dasha lord" : undefined,
    ].filter(Boolean);

    metadata.push({
      planet: planetName,
      sign: planet.sign,
      house,
      dignity,
      shadbalaStrength: shadbala?.strengthRatio,
      strengthPercent,
      isCurrentDashaLord: currentDashaLord === planetName,
      tooltip: `${planetName}${details.length > 0 ? ` - ${details.join(" - ")}` : ""}`,
    });
  }

  return {
    planets: metadata.map((planet) => planet.planet),
    metadata,
    currentDashaLord,
  };
}

type InsightsContentProps = {
  payload: ChartApiResponse;
  birthDate: string;
  historyQs: string;
};

type RuleCardProps = {
  rule: ChartApiResponse["chart"]["deterministic_rules"][number];
  index: number;
};

/* â”€â”€â”€ Animated Section Header â”€â”€â”€ */
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

/* â”€â”€â”€ Collapsible Section Wrapper â”€â”€â”€ */
function CollapsibleSection({
  id,
  title,
  kicker,
  defaultOpen = true,
  children,
  className = "",
  persistKey,
  openForHash,
}: {
  id?: string;
  title: string;
  kicker: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  persistKey?: string;
  openForHash?: string;
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
    if (
      !isOpen ||
      !openForHash ||
      window.location.hash.replace("#", "") !== openForHash
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(openForHash)?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, openForHash]);

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

const SECTION_ANCHORS = [
  { id: "chart-map", label: "Map" },
  { id: "timing", label: "Timing" },
  { id: "vimshottari-dashas", label: "Dashas" },
  { id: "core", label: "Core" },
  { id: "themes", label: "Themes" },
  { id: "karma", label: "Karma" },
  { id: "continue-reading", label: "Continue" },
  { id: "ultimate", label: "Ultimate" },
  { id: "fortune", label: "Fortune" },
];

function SectionAnchorNav() {
  const [activeAnchorId, setActiveAnchorId] = useState(SECTION_ANCHORS[0].id);
  const [availableAnchorIds, setAvailableAnchorIds] = useState(
    SECTION_ANCHORS.map((anchor) => anchor.id)
  );

  useEffect(() => {
    const getAvailableAnchorIds = () =>
      SECTION_ANCHORS.map((anchor) => anchor.id).filter((id) =>
        document.getElementById(id)
      );

    const resolveActiveAnchor = () => {
      const anchorIds = getAvailableAnchorIds();
      if (anchorIds.length === 0) return;

      setAvailableAnchorIds(anchorIds);

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
      {SECTION_ANCHORS.filter((anchor) =>
        availableAnchorIds.includes(anchor.id)
      ).map((anchor) => {
        const isActive = anchor.id === activeAnchorId;
        return (
          <a
            key={anchor.id}
            href={`#${anchor.id}`}
            className={`${styles.anchorLink} ${isActive ? styles.anchorLinkActive : ""}`}
            aria-current={isActive ? "location" : undefined}
            onClick={() => setActiveAnchorId(anchor.id)}
          >
            {anchor.label}
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

function ChartStrengthMap({ payload }: { payload: ChartApiResponse }) {
  const shadbala = payload.chart.shadbala ?? [];
  const strongest = [...shadbala]
    .sort((left, right) => right.strengthRatio - left.strengthRatio)
    .slice(0, 3);
  const watchPlanets = [...shadbala]
    .sort((left, right) => left.strengthRatio - right.strengthRatio)
    .slice(0, 3);
  const elementCounts = getElementCounts(payload.chart.planets);
  const dominantElement =
    Object.entries(elementCounts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "Mixed";
  const activeHouses = payload.chart.houses
    .filter((house) => house.planets.length > 0)
    .sort((left, right) => right.planets.length - left.planets.length)
    .slice(0, 4);

  return (
    <section id="chart-map" className={`${styles.strengthMap} ${styles.anchorTarget}`}>
      <div className={styles.strengthMapHeader}>
        <div>
          <p className={styles.kicker}>Chart Strength Map</p>
          <h2 className={styles.heading}>Fast scan of pressure, support, and emphasis</h2>
        </div>
        <span className={styles.strengthElement}>{dominantElement}</span>
      </div>

      <div className={styles.strengthGrid}>
        <div className={styles.strengthPanel}>
          <h3>Strongest Planets</h3>
          <div className={styles.strengthList}>
            {/* The bar still encodes the ratio; the printed percentage does
                not. A shadbala ratio is strength against a required minimum,
                so it exceeds 100% routinely -- printing it as a percentage
                invited a reading it cannot support. */}
            {strongest.map((planet) => (
              <div key={planet.planet} className={styles.strengthRow}>
                <span>{planet.planet}</span>
                <div className={styles.strengthTrack}>
                  <span style={{ width: `${Math.min(100, Math.round(planet.strengthRatio * 100))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.strengthPanel}>
          <h3>Needs Care</h3>
          <div className={styles.strengthList}>
            {watchPlanets.map((planet) => (
              <div key={planet.planet} className={styles.strengthRow}>
                <span>{planet.planet}</span>
                <div className={`${styles.strengthTrack} ${styles.strengthTrackWarm}`}>
                  <span style={{ width: `${Math.min(100, Math.round(planet.strengthRatio * 100))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.strengthPanel}>
          <h3>Active Houses</h3>
          <div className={styles.housePills}>
            {activeHouses.map((house) => (
              <span key={house.house_number}>
                H{house.house_number} {house.sign}: {house.planets.join(", ")}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ActionGuidanceChips({ payload }: { payload: ChartApiResponse }) {
  const highRules = payload.chart.deterministic_rules.filter((rule) => rule.priority === "high");
  const currentDasha = payload.chart.dasha?.current_dasha;
  const chips = [
    currentDasha ? `Use ${currentDasha} timing consciously` : "Use timing consciously",
    highRules[0]?.category === "career" ? "Prioritize work structure" : "Act on the clearest high-priority theme",
    highRules.some((rule) => rule.category === "love") ? "Keep relationship choices deliberate" : "Keep decisions deliberate",
    payload.chart.lucky_elements?.lucky_day ? `Plan key actions on ${payload.chart.lucky_elements.lucky_day}` : "Pick clean timing windows",
  ];

  return (
    <section className={styles.guidanceChips} aria-label="Action-oriented guidance">
      {chips.map((chip) => (
        <span key={chip}>{chip}</span>
      ))}
    </section>
  );
}

type ChartHighlight = {
  title: string;
  detail: string;
};

function buildChartHighlights(payload: ChartApiResponse): ChartHighlight[] {
  const highlights: ChartHighlight[] = [];
  const strongestPlanet = [...(payload.chart.shadbala ?? [])].sort(
    (left, right) => right.strengthRatio - left.strengthRatio,
  )[0];
  const strongestPlanetPlacement = strongestPlanet
    ? payload.chart.planets.find((planet) => planet.name === strongestPlanet.planet)
    : undefined;
  const primaryRule = [...payload.chart.deterministic_rules]
    .filter((rule) => rule.priority === "high")
    .sort((left, right) => (right.selection?.score ?? 0) - (left.selection?.score ?? 0))[0];
  const topDomain = [...(payload.chart.life_domain_insights ?? [])].sort(
    (left, right) => right.confidence_score - left.confidence_score,
  )[0];
  const strongestYoga = (payload.chart.yogas ?? [])
    .filter((yoga) => yoga.present)
    .sort((left, right) => {
      const strengthRank = { strong: 2, moderate: 1, weak: 0 };
      return strengthRank[right.strength] - strengthRank[left.strength];
    })[0];

  highlights.push({
    title: `${payload.chart.ascendant.sign} rising`,
    detail: "Your approach to life is a defining part of the chart's signature.",
  });

  if (strongestPlanet) {
    const placement = strongestPlanetPlacement
      ? ` in ${strongestPlanetPlacement.sign}, house ${strongestPlanetPlacement.house}`
      : "";
    highlights.push({
      title: `${strongestPlanet.planet} is a major strength`,
      // No percentage. A shadbala ratio is an internal comparison against a
      // required minimum, not a share of anything, so "117%" reads as nonsense
      // and "83%" reads as a failing grade. Neither is what it means.
      detail: `One of the cleaner sources of support in the chart${placement}.`,
    });
  }

  if (primaryRule) {
    highlights.push({ title: primaryRule.display.headline, detail: primaryRule.display.body });
  }

  if (topDomain) {
    highlights.push({
      title: `${topDomain.label} stands out`,
      detail: topDomain.display.body,
    });
  }

  if (strongestYoga) {
    highlights.push({
      title: `${strongestYoga.name} is active`,
      detail: strongestYoga.effects,
    });
  }

  return highlights.slice(0, 5);
}

function ChartHighlights({ payload }: { payload: ChartApiResponse }) {
  const highlights = buildChartHighlights(payload);
  if (highlights.length === 0) return null;

  return (
    <section className={styles.chartHighlights} aria-labelledby="chart-highlights-heading">
      <div className={styles.chartHighlightsHeader}>
        <p className={styles.kicker}>Your Chart Highlights</p>
        <h2 id="chart-highlights-heading" className={styles.chartHighlightsTitle}>
          What makes your chart distinct
        </h2>
      </div>
      <ul className={styles.chartHighlightsList}>
        {highlights.map((highlight) => (
          <li key={`${highlight.title}-${highlight.detail}`}>
            <strong>{highlight.title}</strong>
            <span>{highlight.detail}</span>
          </li>
        ))}
      </ul>
    </section>
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
      // The rarity phrase rather than the technical basis. The basis is still
      // one click away in the rule card's evidence disclosure.
      meta: primaryRule.display.rarity_label,
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
        ? `Runs through ${dasha.current_dasha_end}`
        : undefined,
      tone: "teal",
    });
  }

  if (topDomain) {
    takeaways.push({
      label: topDomain.label,
      title: topDomain.display.headline,
      body: topDomain.display.guidance,
      meta: topDomain.label,
      tone: "coral",
    });
  }

  if (strongestPlanet && takeaways.length < 3) {
    takeaways.push({
      label: "Strongest planet",
      title: `${strongestPlanet.planet} leads the strength map`,
      body: "This planet is one of the cleaner sources of support to lean on when the chart feels noisy.",
      meta: undefined,
      tone: "teal",
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
            <span className={styles.takeawayNumber}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <p className={styles.takeawayLabel}>{takeaway.label}</p>
              <h3>{takeaway.title}</h3>
            </div>
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

/**
 * Order by the measured rank, with unselected rules after the selected ones.
 *
 * `rank` is 0 for anything the selection layer did not pick, so a naive
 * ascending sort would float every unselected rule to the top.
 */
function bySelectionRank(left: DeterministicRule, right: DeterministicRule): number {
  const leftRank = left.selection?.selected ? left.selection.rank : Number.MAX_SAFE_INTEGER;
  const rightRank = right.selection?.selected ? right.selection.rank : Number.MAX_SAFE_INTEGER;
  if (leftRank !== rightRank) return leftRank - rightRank;
  return (right.selection?.score ?? 0) - (left.selection?.score ?? 0);
}

/* Rule Card (Animated) */
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
        <h3>{rule.display.headline}</h3>
      </header>
      {/* The measured rarity phrase, not the raw lowercase "high" literal.
          "priority" is an internal display-tone field; it was never meant to
          be read by a client.

          This is a full sentence, so it gets its own line. It briefly lived in
          the header as a flex sibling of the title, where `flex-shrink: 0` --
          correct for the one-word badge that used to sit there -- let it push
          the heading down to a single character per line. */}
      <p
        className={`${styles.rarityLabel} ${
          rule.priority === "high"
            ? styles.rarityHigh
            : rule.priority === "medium"
              ? styles.rarityMedium
              : styles.rarityLow
        }`}
      >
        {rule.display.rarity_label}
      </p>
      <p className={styles.ruleInsight}>{rule.display.body}</p>
      {rule.display.tension && (
        <p className={styles.ruleTension}>{rule.display.tension}</p>
      )}

      {/* The technical tier. Native <details> rather than a hand-rolled
          disclosure: it is keyboard accessible and correct by default, and
          nothing here needs to animate. The confidence bar that used to sit
          here is gone -- it rendered a hardcoded constant as a percentage. */}
      <details className={styles.evidence}>
        <summary className={styles.evidenceSummary}>Why this reading</summary>
        <div className={styles.evidenceBody}>
          <p className={styles.ruleBasis}>{rule.evidence.technical_note}</p>
          <dl className={styles.claims}>
            {rule.evidence.claims.map((claim) => (
              <div key={claim.label} className={styles.claim}>
                <dt className={styles.claimLabel}>{claim.label}</dt>
                <dd className={styles.claimValue}>
                  {claim.value}
                  {claim.detail && (
                    <span className={styles.claimDetail}>{claim.detail}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </details>
    </motion.article>
  );
}

/* â”€â”€â”€ Locked Feature Preview â”€â”€â”€ */

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

/* â”€â”€â”€ Constellation Section Divider â”€â”€â”€ */
function ConstellationDivider({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`${styles.constellationDivider} ${compact ? styles.constellationDividerCompact : ""}`}
      aria-hidden="true"
    >
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

type LifeDomainKey = LifeDomainInsight["key"];
type DomainViewMode = "brief" | "detailed" | "action";

type DomainReadCopy = {
  description: string;
  clarity: string;
  decisionRule: string;
  boundaryRule: string;
};

/* â”€â”€â”€ Domain Icon Map â”€â”€â”€ */
const DOMAIN_ICONS: Record<LifeDomainKey, string> = {
  love_life: "\u2661",
  career: "\u2726",
  family: "\u2302",
  inheritance: "\u229B",
  influence: "\u2605",
  life_cycle: "\u21BB",
  travel_destinations: "\u2708",
};

const DOMAIN_READ_COPY: Record<LifeDomainKey, DomainReadCopy> = {
  love_life: {
    description:
      "Separates attraction, partnership durability, emotional availability, and the timing that makes connection easier to sustain.",
    clarity:
      "Do not judge love from Venus alone. Read the 7th house for partnership, the 5th for romance, the house lord for delivery, and timing triggers for when the pattern becomes visible.",
    decisionRule:
      "A relationship signal is stronger when support, watchout, and timing notes repeat the same theme.",
    boundaryRule:
      "If the watchout contradicts the support, treat the watchout as the condition that must be managed before the support pays off.",
  },
  career: {
    description:
      "Distinguishes vocation, workload, authority, public reputation, service pressure, and the route through which professional recognition is built.",
    clarity:
      "Do not read career from the 10th house alone. Weigh the 10th sign, its lord, the 6th house work pattern, and Saturn's discipline filter together.",
    decisionRule:
      "Career moves are cleaner when the timing trigger reinforces both the 10th-house promise and the lord's placement.",
    boundaryRule:
      "If pressure houses are involved, advancement may require systems, mentors, and repeatable proof before visibility arrives.",
  },
  family: {
    description:
      "Clarifies home life, inherited emotional patterns, family support, private stability, and the habits that make belonging feel reliable.",
    clarity:
      "Read the 4th house for emotional ground, the 2nd for lineage and speech, the Moon for felt safety, and the house lord for where repair happens.",
    decisionRule:
      "Family guidance is strongest when the support pattern names the same need as the long-game statement.",
    boundaryRule:
      "When the watchout is active, protect steadiness first; resolution works better after the emotional baseline is restored.",
  },
  inheritance: {
    description:
      "Frames shared resources, legacy, debt, hidden obligations, family assets, and the maturity needed around resource transitions.",
    clarity:
      "Read the 8th house for transferred resources, the 2nd for stored value, Jupiter for stewardship, and the lord placement for the route of responsibility.",
    decisionRule:
      "Treat inheritance signals as practical planning prompts when they repeat across support, watchout, and timing sections.",
    boundaryRule:
      "If the watchout names hidden cost or delay, prioritize documentation, transparency, and patient sequencing.",
  },
  influence: {
    description:
      "Looks at public impact, allies, social reach, authority, reputation, and the conditions that help your voice move people.",
    clarity:
      "Read the 11th house for networks, the 10th for public standing, the Sun for visibility, and the lord for where influence is earned.",
    decisionRule:
      "Influence grows fastest when timing triggers amplify an existing support pattern rather than forcing visibility too early.",
    boundaryRule:
      "If the watchout names diffusion or delay, narrow the audience and make the message easier to repeat.",
  },
  life_cycle: {
    description:
      "Connects identity, reinvention, recovery cycles, resilience, and the periods where life asks for a cleaner version of self-direction.",
    clarity:
      "Read the 1st house for identity, the 8th for transformation, the Moon for adaptation, and the lord placement for the terrain of change.",
    decisionRule:
      "A life-cycle signal deserves priority when timing notes and long-game guidance both point toward the same kind of maturity.",
    boundaryRule:
      "If the watchout is active, slow the pace and make the next step smaller, clearer, and easier to sustain.",
  },
  travel_destinations: {
    description:
      "Clarifies long-distance travel, short journeys, relocation pull, foreign links, pilgrimage themes, and what makes a place feel meaningful.",
    clarity:
      "Read the 9th house for distance and meaning, the 3rd for movement and logistics, Jupiter for expansion, and the lord placement for travel purpose.",
    decisionRule:
      "Travel signals become practical when timing triggers support both opportunity and preparation.",
    boundaryRule:
      "If watchouts name friction, treat planning, documents, health, and timing buffers as part of the reading rather than afterthoughts.",
  },
};

/**
 * The technical read-out for a domain.
 *
 * These deliberately keep reading the legacy fields -- house-lord notation and
 * transit language are correct here, because this now renders only inside the
 * evidence disclosure.
 */
function buildDomainRules(domain: LifeDomainInsight) {
  return [
    {
      label: "House rule",
      body: `${domain.headline} Use this as the baseline before judging specific events.`,
    },
    {
      label: "Evidence rule",
      body:
        domain.supporting_patterns[0] ??
        "Give more weight to patterns that repeat across houses, lord placements, and timing indicators.",
    },
    {
      label: "Timing rule",
      body:
        domain.timing_triggers[0] ??
        "Use timing triggers as activation windows, not as isolated promises.",
    },
    {
      label: "Action rule",
      body: domain.guidance,
    },
  ];
}

function getDomainScore(domain: LifeDomainInsight) {
  return Math.round(domain.confidence_score * 100);
}

function getDomainScoreTone(score: number) {
  if (score >= 80) return "Dominant";
  if (score >= 65) return "Strong";
  if (score >= 50) return "Active";
  return "Subtle";
}

function getDomainTimingWindows(
  domain: LifeDomainInsight,
  currentDasha?: string,
  currentAntardasha?: string
) {
  // Display tier: these render above the fold, so they must not contain
  // transit or house vocabulary.
  const currentTiming = domain.display.timing[0];
  const nextTiming = domain.display.timing[1] ?? domain.display.timing[0];
  const caution = domain.display.watchouts[0];

  return [
    {
      label: "Current activation",
      value:
        currentTiming ??
        (currentDasha
          ? `${currentDasha}${currentAntardasha ? ` / ${currentAntardasha}` : ""} is the active timing lens.`
          : "Watch for repeated signals before treating this domain as active."),
    },
    {
      label: "Next favorable window",
      value:
        nextTiming ??
        "The next clean opening comes when support and guidance repeat the same theme.",
    },
    {
      label: "Caution window",
      value:
        caution ??
        "Avoid forcing outcomes when the evidence is mixed or timing feels noisy.",
    },
  ];
}

/* â”€â”€â”€ Animated Counter for Metric Values â”€â”€â”€ */
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
  const advancedInsightsHref = historyQs
    ? `/insights/advanced?${historyQs}`
    : "/insights/advanced";
  const compatibilityHref = historyQs
    ? `/insights/compatibility?${historyQs}`
    : "/insights/compatibility";
  const getAdvancedViewHref = (view: "transits" | "palm") => {
    const params = new URLSearchParams(historyQs);
    params.set("view", view);
    return `/insights/advanced?${params.toString()}`;
  };
  const transitWorkspaceHref = getAdvancedViewHref("transits");
  const palmWorkspaceHref = getAdvancedViewHref("palm");
  const sectionStateScope = `insights:section-state:${historyQs}`;
  const domainInsights = payload.chart.life_domain_insights ?? [];
  const availableEngines = payload.engine.available_engines ?? [];
  const [selectedDomainKey, setSelectedDomainKey] = useState<
    LifeDomainInsight["key"]
  >(domainInsights[0]?.key ?? "love_life");
  const [domainViewMode, setDomainViewMode] = useState<DomainViewMode>("brief");

  // Ranked by selection.rank, which is the measured ordering. Unselected rules
  // sort to the end rather than to the front -- rank 0 means "not selected",
  // not "ranked first".
  const coreRules = [...payload.chart.deterministic_rules]
    .filter((rule) => rule.category === "core")
    .sort((left, right) => bySelectionRank(left, right));
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
  const selectedDomainCopy = selectedDomainInsight
    ? DOMAIN_READ_COPY[selectedDomainInsight.key]
    : undefined;
  const selectedDomainRules = selectedDomainInsight
    ? buildDomainRules(selectedDomainInsight)
    : [];
  const rankedDomainInsights = [...domainInsights].sort(
    (left, right) => right.confidence_score - left.confidence_score
  );
  const topDomainInsight = rankedDomainInsights[0];
  const selectedDomainTimingWindows = selectedDomainInsight
    ? getDomainTimingWindows(
        selectedDomainInsight,
        payload.chart.dasha?.current_dasha,
        payload.chart.dasha?.current_antardasha
      )
    : [];
  const heroPlanetStrip = buildHeroPlanetMetadata(payload);

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
    <ParallaxContainer className={styles.parallaxShell}>
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

      <ParallaxLayer depth={0} className={styles.parallaxLayer}>
      <section className={`dashboard-shell ${styles.dashboard}`}>
        <SectionAnchorNav />
        {/* â”€â”€â”€ Hero Header â”€â”€â”€ */}
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

          {/* Planet orbs row â€“ key planets from this chart, centered */}
          {heroPlanetStrip.planets.length > 0 && (
            <section className={styles.heroPlanetStrip} aria-labelledby="hero-planet-strip-heading">
              <div className={styles.heroPlanetStripHeader}>
                <p className={styles.heroPlanetKicker}>Natal Signature</p>
                <h2 id="hero-planet-strip-heading" className={styles.heroPlanetTitle}>
                  Planetary field
                </h2>
                {heroPlanetStrip.currentDashaLord && (
                  <span className={styles.heroDashaPill}>
                    {heroPlanetStrip.currentDashaLord} dasha
                  </span>
                )}
              </div>
              <div className={styles.heroPlanetRail}>
                <div className={styles.heroPlanetScroller}>
                  <HeroPlanetOrbRow
                    planets={heroPlanetStrip.planets}
                    planetMetadata={heroPlanetStrip.metadata}
                    activePlanet={heroPlanetStrip.currentDashaLord ?? undefined}
                    currentDashaLord={heroPlanetStrip.currentDashaLord ?? undefined}
                    size="md"
                    showLabels
                    className={styles.heroPlanetRow}
                  />
                </div>
              </div>
            </section>
          )}
        </motion.div>

        {/* â”€â”€â”€ Top Metrics Bento Row â”€â”€â”€ */}
        <ActionGuidanceChips payload={payload} />
        <PersonalStory payload={payload} />
        <TopTakeawaysModule payload={payload} />

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
            {/* The raw degree-in-sign readout is gone. A number to two decimal
                places is a measurement, not a reading, and it was the first
                thing on the page. The exact degree is still in the planet
                table and in every rule's evidence. */}
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
            {/* Ayanamsha, house system and the engine switcher are calculation
                settings, not findings, so they sit behind a disclosure with
                the rest of the technical tier.

                The fallback marker used to read literally as "&bull; Fallback":
                inside a JS string that is not an HTML entity, only in JSX text.
                It is a real character now. */}
            <details className={styles.evidence}>
              <summary className={styles.evidenceSummary}>Calculation settings</summary>
              <div className={styles.evidenceBody}>
                <p className={styles.ruleBasis}>
                  {payload.engine.ayanamsha} • {payload.engine.house_system}
                  {payload.engine.fallback_mode ? " • Fallback" : ""}
                </p>
                {availableEngines.length > 1 && (
                  <label className={styles.engineSwitcher}>
                    <span className={styles.claimLabel}>Engine</span>
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
              </div>
            </details>
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

        {/* â”€â”€â”€ Main Bento Grid â”€â”€â”€ */}
        <motion.div
          className={styles.gridMain}
          variants={bentoContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {/* Birth Chart â€” Large card spanning 2 columns */}
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

          {/* Planetary Snapshots â€” Side card */}
          <motion.div
            className={`${styles.cardPlanets} ${styles.cardDepthFront}`}
            variants={bentoItemFromRight}
          >
            <PanelErrorBoundary panelName="Planetary Snapshots">
              <PlanetarySnapshots planets={payload.chart.planets} />
            </PanelErrorBoundary>
          </motion.div>

        </motion.div>

        <ConstellationDivider compact />

        {/* â”€â”€â”€ Forecasts & Timing (Collapsible) â”€â”€â”€ */}
        <ChartStrengthMap payload={payload} />

        <CollapsibleSection
          id="timing"
          kicker={t("insights.timingKicker")}
          title={t("insights.timingHeading")}
          defaultOpen={false}
          className={`${styles.cardRules} ${styles.timingSection}`}
          persistKey={`${sectionStateScope}:timing`}
          openForHash="muhurta"
        >
          <div className={styles.timingPanels}>
            <div className={styles.cardForecast}>
              <LazyPanel>
                <PanelErrorBoundary panelName="Future Forecast">
                  <FutureForecastPanel queryString={historyQs} />
                </PanelErrorBoundary>
              </LazyPanel>
            </div>

            <div id="muhurta" className={`${styles.cardForecast} ${styles.anchorTarget}`}>
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

        {/* â”€â”€â”€ Vimshottari Dashas Section â”€â”€â”€ */}
        {payload.chart.nakshatra && payload.chart.dasha && (
          <>
            <ConstellationDivider />

            <ChartHighlights payload={payload} />

            <CollapsibleSection
              id="vimshottari-dashas"
              kicker="Vimshottari Dashas"
              title="Life periods and sub-period branches"
              defaultOpen={true}
              className={`${styles.cardRules} ${styles.cardDasha}`}
              persistKey={`${sectionStateScope}:vimshottari-dashas`}
            >
              <LazyPanel>
                <PanelErrorBoundary panelName="Vimshottari Dashas">
                  <AuthGate
                    featureLabel="Vimshottari Dashas"
                    isLocked={lockedFeatures.has("nakshatra_dasha")}
                  >
                    <NakshatraDashaPanel
                      nakshatra={payload.chart.nakshatra}
                      dasha={payload.chart.dasha}
                      audit={payload.chart.calculation_audit}
                      planets={payload.chart.planets}
                    />
                  </AuthGate>
                </PanelErrorBoundary>
              </LazyPanel>
            </CollapsibleSection>
          </>
        )}

        {/* â”€â”€â”€ Core Rules Section â”€â”€â”€ */}
        {/* Guarded like every other rule section. Without this the heading and
            intro render over an empty scroller, and SectionAnchorNav keeps an
            entry pointing at nothing. */}
        {coreRules.length > 0 && (
          <CollapsibleSection
            id="core"
            kicker={t("insights.coreKicker")}
            title={t("insights.coreHeading")}
            defaultOpen={true}
            className={styles.cardRules}
            persistKey={`${sectionStateScope}:core`}
          >
            <p className={styles.sectionIntro}>
              This section pulls together the backbone of the chart: your lagna
              path, house emphasis, elemental style, nodal direction, and the
              structural signatures most likely to shape major outcomes.
            </p>
            <div className={styles.rulesScroll}>
              {coreRules.map((rule, i) => (
                <RuleCard
                  key={rule.instance_key}
                  rule={rule}
                  index={i}
                />
              ))}
            </div>
          </CollapsibleSection>
        )}

        <ConstellationDivider />

        {/* â”€â”€â”€ Yoga Lifetime Summary â”€â”€â”€ */}
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

        {/* â”€â”€â”€ Career & Love in Bento Grid â”€â”€â”€ */}
        {(careerRules.length > 0 || loveRules.length > 0) && (
          <div id="themes" className={`${styles.gridThemes} ${styles.anchorTarget}`}>
            {careerRules.length > 0 && (
              <CollapsibleSection
                kicker={t("insights.careerKicker")}
                title={t("insights.careerHeading")}
                defaultOpen={false}
                className={styles.cardCareer}
                persistKey={`${sectionStateScope}:career`}
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
                      key={rule.instance_key}
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
                defaultOpen={false}
                className={styles.cardLove}
                persistKey={`${sectionStateScope}:love`}
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
                      key={rule.instance_key}
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

        <CollapsibleSection
          id="karma"
          kicker="Past-Life Pattern"
          title="Karma, fate, and vocation"
          defaultOpen={true}
          className={styles.cardKarma}
          persistKey={`${sectionStateScope}:karma`}
        >
          <LazyPanel>
            <PanelErrorBoundary panelName="Karma, Fate, and Vocation">
              <PastLifeInsightsPanel payload={payload} />
            </PanelErrorBoundary>
          </LazyPanel>
        </CollapsibleSection>

        <ConstellationDivider />

        <CollapsibleSection
          id="life-shifts"
          kicker="Major Life Shifts"
          title="Five windows where your life pivots"
          defaultOpen={true}
          className={styles.cardKarma}
          persistKey={`${sectionStateScope}:life-shifts`}
        >
          <LazyPanel>
            <PanelErrorBoundary panelName="Major Life Shifts">
              <MajorShiftsPanel payload={payload} />
            </PanelErrorBoundary>
          </LazyPanel>
        </CollapsibleSection>

        <ConstellationDivider />

        {/* â”€â”€â”€ Continue your reading â”€â”€â”€ */}
        <motion.section
          id="continue-reading"
          className={`${styles.continuationHub} ${styles.anchorTarget}`}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 20 }}
          aria-labelledby="continue-reading-heading"
        >
          <div className={styles.continuationHeader}>
            <div>
              <p className={styles.kicker}>Continue your reading</p>
              <h2 id="continue-reading-heading" className={styles.continuationTitle}>
                What would you like to explore next?
              </h2>
            </div>
            <p className={styles.continuationLead}>
              Choose a focused next step. Every option tells you whether it keeps
              you here, opens a workspace, or needs a palm photo.
            </p>
          </div>

          <div className={styles.continuationGroups}>
            <section className={styles.continuationGroup} aria-labelledby="continue-here-heading">
              <div className={styles.continuationGroupHeader}>
                <h3 id="continue-here-heading" className={styles.continuationGroupTitle}>
                  Continue here
                </h3>
                <p className={styles.continuationGroupHint}>Stay on this page</p>
              </div>
              <div className={styles.continuationActions}>
                <Link
                  href="#muhurta"
                  className={`${styles.continuationAction} ${styles.continuationActionRecommended}`}
                  data-tone="gold"
                >
                  <span className={styles.continuationActionGlyph} aria-hidden="true">âŒ</span>
                  <span className={styles.continuationActionBody}>
                    <span className={styles.continuationRecommendation}>Recommended next</span>
                    <strong>Find a good time</strong>
                    <span>Use your personalised timing windows for the decision in front of you.</span>
                  </span>
                  <span className={styles.continuationRoute}>Stay on this page <span aria-hidden="true">â†’</span></span>
                </Link>

                <Link href="#life-shifts" className={styles.continuationAction} data-tone="green">
                  <span className={styles.continuationActionGlyph} aria-hidden="true">â†</span>
                  <span className={styles.continuationActionBody}>
                    <strong>Your life timeline</strong>
                    <span>See the pivotal life windows and dasha transitions still unfolding.</span>
                  </span>
                  <span className={styles.continuationRoute}>Stay on this page <span aria-hidden="true">â†’</span></span>
                </Link>
              </div>
            </section>

            <section className={styles.continuationGroup} aria-labelledby="specialist-tools-heading">
              <div className={styles.continuationGroupHeader}>
                <h3 id="specialist-tools-heading" className={styles.continuationGroupTitle}>
                  Open a specialist tool
                </h3>
                <p className={styles.continuationGroupHint}>Focused workspace</p>
              </div>
              <div className={styles.continuationActions}>
                <Link href={transitWorkspaceHref} className={styles.continuationAction} data-tone="sky">
                  <span className={styles.continuationActionGlyph} aria-hidden="true">âœ¦</span>
                  <span className={styles.continuationActionBody}>
                    <strong>Current transits</strong>
                    <span>Compare the present sky with the promise carried in your natal chart.</span>
                  </span>
                  <span className={styles.continuationRoute}>Opens workspace <span aria-hidden="true">â†’</span></span>
                </Link>

                <Link href={compatibilityHref} className={styles.continuationAction} data-tone="rose">
                  <span className={styles.continuationActionGlyph} aria-hidden="true">âˆž</span>
                  <span className={styles.continuationActionBody}>
                    <strong>Compare with a partner</strong>
                    <span>Open a relationship workspace to compare two full birth profiles.</span>
                  </span>
                  <span className={styles.continuationRoute}>Opens workspace <span aria-hidden="true">â†’</span></span>
                </Link>

                <Link href={palmWorkspaceHref} className={styles.continuationAction} data-tone="violet">
                  <span className={styles.continuationActionGlyph} aria-hidden="true">â—ˆ</span>
                  <span className={styles.continuationActionBody}>
                    <strong>Chart + palm synthesis</strong>
                    <span>Bring your palm and chart together to surface recurring strengths.</span>
                  </span>
                  <span className={styles.continuationRoute}>Requires a palm photo <span aria-hidden="true">â†’</span></span>
                </Link>
              </div>
            </section>
          </div>

          <Link href={advancedInsightsHref} className={styles.continuationBrowse}>
            Browse all advanced tools <span aria-hidden="true">â†’</span>
          </Link>
        </motion.section>

        {/* â”€â”€â”€ Life Domain Deep Dives â”€â”€â”€ */}
        <AuthGate
          featureLabel="Life Domain Deep Dives"
          isLocked={lockedFeatures.has("life_domain_readings")}
          requiredTier="ultimate"
        >
          {selectedDomainInsight ? (
            <motion.section
              id="ultimate"
              className={`${styles.cardDomains} ${styles.anchorTarget}`}
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
                Choose a life area for a full house, lord, timing, evidence, and rule-based read.
              </p>

              {topDomainInsight && (
                <section className={styles.domainPriorityPanel}>
                  <div>
                    <p className={styles.kicker}>Most active right now</p>
                    <h3>{topDomainInsight.display.headline}</h3>
                    <p>{topDomainInsight.display.guidance}</p>
                  </div>
                </section>
              )}

              {/* Domains are ordered by signal, but the number itself is gone.
                  confidence_score lives on an arbitrary [0.55, 0.94] scale, so
                  "86%" was never a probability of anything -- rendering it as
                  one implied a precision the model does not have. The relative
                  ordering it drives is still here; the false precision is not. */}
              <div className={styles.domainScoreGrid} aria-label="Life domains, most active first">
                {rankedDomainInsights.map((domain) => {
                  const score = getDomainScore(domain);
                  return (
                    <button
                      key={domain.key}
                      type="button"
                      className={domain.key === selectedDomainKey ? styles.domainScoreCardActive : styles.domainScoreCard}
                      data-domain={domain.key}
                      onClick={() => setSelectedDomainKey(domain.key)}
                      aria-label={`${domain.label}, ${getDomainScoreTone(score)} signal`}
                    >
                      <span className={styles.domainScoreIcon}>{DOMAIN_ICONS[domain.key]}</span>
                      <span className={styles.domainScoreLabel}>{domain.label}</span>
                      <span className={styles.domainScoreTone}>{getDomainScoreTone(score)}</span>
                    </button>
                  );
                })}
              </div>

              <p className={styles.domainSelectLabel}>Select a focus area</p>
              <div className={styles.domainChips}>
                {rankedDomainInsights.map((domain) => (
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

              <div className={styles.domainModeTabs} role="tablist" aria-label="Domain reading depth">
                {(["brief", "detailed", "action"] as DomainViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={domainViewMode === mode}
                    className={domainViewMode === mode ? styles.domainModeTabActive : styles.domainModeTab}
                    onClick={() => setDomainViewMode(mode)}
                  >
                    {mode === "brief" ? "Brief" : mode === "detailed" ? "Detailed" : "Action Plan"}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.article
                  key={`${selectedDomainInsight.key}-${domainViewMode}`}
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
                  </div>

                  <p className={styles.domainOverview}>
                    {selectedDomainInsight.display.body}
                  </p>

                  <div className={styles.domainTimingWindows}>
                    {selectedDomainTimingWindows.map((window) => (
                      <section key={window.label}>
                        <h4>{window.label}</h4>
                        <p>{window.value}</p>
                      </section>
                    ))}
                  </div>

                  {domainViewMode === "brief" && (
                    <div className={styles.domainGrid}>
                      <section className={styles.domainCol}>
                        <h4>Top support</h4>
                        <ul>
                          {selectedDomainInsight.display.strengths.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </section>
                      {selectedDomainInsight.display.watchouts.length > 0 && (
                        <section className={styles.domainCol}>
                          <h4>Top watchout</h4>
                          <ul>
                            {selectedDomainInsight.display.watchouts.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </section>
                      )}
                    </div>
                  )}

                  {domainViewMode === "detailed" && selectedDomainCopy && (
                    <div className={styles.domainClarityBlock}>
                      <p className={styles.domainDeepDescription}>
                        {selectedDomainCopy.description}
                      </p>
                      <div className={styles.domainStatementGrid}>
                        <section className={styles.domainStatement}>
                          <h4>Clarity statement</h4>
                          <p>{selectedDomainCopy.clarity}</p>
                        </section>
                        <section className={styles.domainStatement}>
                          <h4>Decision rule</h4>
                          <p>{selectedDomainCopy.decisionRule}</p>
                        </section>
                        <section className={styles.domainStatement}>
                          <h4>Boundary rule</h4>
                          <p>{selectedDomainCopy.boundaryRule}</p>
                        </section>
                      </div>
                    </div>
                  )}

                  {domainViewMode === "detailed" && (
                    <div className={styles.domainGrid}>
                      <section className={styles.domainCol}>
                        <h4>Support</h4>
                        <ul>
                          {selectedDomainInsight.display.strengths.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </section>
                      {selectedDomainInsight.display.watchouts.length > 0 && (
                        <section className={styles.domainCol}>
                          <h4>Watch</h4>
                          <ul>
                            {selectedDomainInsight.display.watchouts.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </section>
                      )}
                      <section className={styles.domainCol}>
                        <h4>Timing</h4>
                        <ul>
                          {selectedDomainInsight.display.timing.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </section>
                    </div>
                  )}

                  {/* The technical read. This used to be two more stacked
                      lists in the default view -- house-lord notation, transit
                      windows and the "How this domain is being read" rule
                      trace, none of which mean anything without training. */}
                  {domainViewMode === "detailed" && (
                    <details className={styles.evidence}>
                      <summary className={styles.evidenceSummary}>
                        How this domain is being read
                      </summary>
                      <div className={styles.evidenceBody}>
                        <p className={styles.ruleBasis}>
                          {selectedDomainInsight.evidence.technical_note}
                        </p>
                        <dl className={styles.claims}>
                          {selectedDomainInsight.evidence.claims.map((claim) => (
                            <div key={claim.label} className={styles.claim}>
                              <dt className={styles.claimLabel}>{claim.label}</dt>
                              <dd className={styles.claimValue}>
                                {claim.value}
                                {claim.detail && (
                                  <span className={styles.claimDetail}>{claim.detail}</span>
                                )}
                              </dd>
                            </div>
                          ))}
                        </dl>
                        <div className={styles.domainRulesPanel}>
                          <ol>
                            {selectedDomainRules.map((rule) => (
                              <li key={rule.label}>
                                <strong>{rule.label}:</strong> {rule.body}
                              </li>
                            ))}
                          </ol>
                        </div>
                        {selectedDomainInsight.supporting_patterns.length > 0 && (
                          <ul className={styles.evidencePatterns}>
                            {selectedDomainInsight.supporting_patterns.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </details>
                  )}

                  {domainViewMode === "action" && (
                    <div className={styles.domainActionPanel}>
                      <section>
                        <h4>Do next</h4>
                        <p>{selectedDomainInsight.guidance}</p>
                      </section>
                      <section>
                        <h4>Keep in mind</h4>
                        <p>{selectedDomainInsight.long_game}</p>
                      </section>
                      <section>
                        <h4>Decision filter</h4>
                        <p>
                          {selectedDomainCopy?.decisionRule ??
                            "Move when the support, timing, and evidence point in the same direction."}
                        </p>
                      </section>
                    </div>
                  )}

                  {domainViewMode !== "action" && (
                    <>
                      <p className={styles.domainGuidance}>
                        <strong>Guidance:</strong>{" "}
                        {selectedDomainInsight.display.guidance}
                      </p>
                      <p className={styles.domainLongGame}>
                        <strong>Long game:</strong>{" "}
                        {selectedDomainInsight.display.long_game}
                      </p>
                    </>
                  )}
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

        {/* â”€â”€â”€ Lucky Elements â”€â”€â”€ */}
        {payload.chart.lucky_elements && (
          <div id="fortune" className={styles.anchorTarget}>
          <LazyPanel>
            <PanelErrorBoundary panelName="Lucky Elements">
              <LuckyElementsPanel luckyElements={payload.chart.lucky_elements} />
            </PanelErrorBoundary>
          </LazyPanel>
          </div>
        )}

        {/* â”€â”€â”€ Footer Actions â”€â”€â”€ */}
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
