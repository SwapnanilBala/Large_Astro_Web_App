"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import { FiChevronDown, FiCopy, FiGrid, FiRefreshCw } from "react-icons/fi";
import AuthGate from "@/app/insights/components/auth-gate";
import PanelErrorBoundary from "@/app/insights/components/PanelErrorBoundary";
import ChartHistorySaver from "@/app/insights/components/chart-history-saver";
import PlanetarySnapshots from "@/app/insights/components/planetary-snapshots";
import PersonalStory from "@/app/insights/components/personal-story";
import styles from "../insights.module.css";

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
  { id: "overview", label: "Overview" },
  { id: "chart-map", label: "Chart" },
  { id: "timing", label: "Timing" },
  { id: "ultimate", label: "Life areas" },
  { id: "continue-reading", label: "More" },
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
  const transitParams = new URLSearchParams(historyQs);
  transitParams.set("view", "transits");
  const transitWorkspaceHref = `/insights/advanced?${transitParams.toString()}`;
  const sectionStateScope = `insights:section-state:${historyQs}`;
  const domainInsights = payload.chart.life_domain_insights ?? [];
  const rankedDomainInsights = [...domainInsights].sort(
    (left, right) => right.confidence_score - left.confidence_score
  );
  const availableEngines = payload.engine.available_engines ?? [];
  const [selectedDomainKey, setSelectedDomainKey] = useState<
    LifeDomainInsight["key"]
  >(rankedDomainInsights[0]?.key ?? "love_life");
  const [domainViewMode, setDomainViewMode] = useState<DomainViewMode>("brief");

  // Ranked by selection.rank, which is the measured ordering. Unselected rules
  // sort to the end rather than to the front -- rank 0 means "not selected",
  // not "ranked first".
  const coreRules = [...payload.chart.deterministic_rules]
    .filter((rule) => rule.category === "core")
    .sort((left, right) => bySelectionRank(left, right));
  const selectedDomainInsight =
    domainInsights.find((domain) => domain.key === selectedDomainKey) ??
    rankedDomainInsights[0];
  const selectedDomainCopy = selectedDomainInsight
    ? DOMAIN_READ_COPY[selectedDomainInsight.key]
    : undefined;
  const selectedDomainRules = selectedDomainInsight
    ? buildDomainRules(selectedDomainInsight)
    : [];
  const selectedDomainTimingWindows = selectedDomainInsight
    ? getDomainTimingWindows(
        selectedDomainInsight,
        payload.chart.dasha?.current_dasha,
        payload.chart.dasha?.current_antardasha
      )
    : [];
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
          className={`${styles.hero} ${styles.anchorTarget}`}
          initial={shouldReduceMotion ? false : { opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 180, damping: 22 }}
        >
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>{t("insights.kicker")}</p>
            <h1 className={styles.title}>
              {payload.client.name}
              {t("insights.headingSuffix")}
            </h1>
            <p className={styles.lead}>{payload.chart.summary}</p>
            <div className={styles.heroFacts} aria-label="Key chart facts">
              <span>{payload.chart.ascendant.sign} rising</span>
              {payload.chart.dasha?.current_dasha && (
                <span>{payload.chart.dasha.current_dasha} period</span>
              )}
            </div>
          </div>
          <div className={styles.heroActions} aria-label="Report actions">
            <button
              type="button"
              className={styles.heroAction}
              onClick={() => void copyCurrentChartLink()}
            >
              <FiCopy size={16} />
              Copy link
            </button>
            <PersonalStory payload={payload} compact />
          </div>
        </motion.header>

        <TopTakeawaysModule payload={payload} />

        <motion.div
          id="chart-map"
          className={`${styles.gridMain} ${styles.anchorTarget}`}
          variants={bentoContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {/* Birth Chart â€” Large card spanning 2 columns */}
          <motion.div
            className={`${styles.cardChart} ${styles.cardDepthFront}`}
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

          <motion.div
            className={styles.chartGlanceShell}
            variants={bentoItemFromRight}
          >
            <ChartAtAGlance payload={payload} />
          </motion.div>
        </motion.div>

        <CollapsibleSection
          kicker="Chart details"
          title="Placements and calculation settings"
          defaultOpen={false}
          className={styles.chartDetails}
          persistKey={`${sectionStateScope}:chart-details`}
        >
          <div className={styles.chartDetailsGrid}>
            <div className={styles.cardPlanets}>
              <PanelErrorBoundary panelName="Planetary Snapshots">
                <PlanetarySnapshots planets={payload.chart.planets} />
              </PanelErrorBoundary>
            </div>
            <section className={styles.calculationPanel}>
              <p className={styles.kicker}>Calculation method</p>
              <h3>{payload.engine.engine_label}</h3>
              <p>
                {payload.engine.ayanamsha} · {payload.engine.house_system}
                {payload.engine.fallback_mode ? " · Fallback" : ""}
              </p>
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
          </div>
        </CollapsibleSection>

        {/* â”€â”€â”€ Forecasts & Timing (Collapsible) â”€â”€â”€ */}
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

        {payload.chart.nakshatra && payload.chart.dasha && (
          <CollapsibleSection
            id="vimshottari-dashas"
            kicker="Timing detail"
            title="Dasha periods and sub-periods"
            defaultOpen={false}
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
        )}

        <CollapsibleSection
          id="core"
          kicker="Full reading"
          title="All chart findings"
          defaultOpen={false}
          className={styles.cardRules}
          persistKey={`${sectionStateScope}:core`}
        >
          {coreRules.length > 0 && (
            <div className={styles.deepReadingBlock}>
              <h3>Core patterns</h3>
              <p className={styles.sectionIntro}>
                The supporting patterns behind the three priorities at the top of this report.
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
            </div>
          )}

          {payload.chart.yogas && payload.chart.yogas.length > 0 && (
            <div className={styles.deepReadingBlock}>
              <h3>Long-term combinations</h3>
              <LazyPanel>
                <PanelErrorBoundary panelName="Yoga Lifetime Summary">
                  <YogaLifetimeSummary yogas={payload.chart.yogas} />
                </PanelErrorBoundary>
              </LazyPanel>
            </div>
          )}

          <div id="karma" className={`${styles.deepReadingBlock} ${styles.anchorTarget}`}>
            <h3>Karma, fate, and vocation</h3>
            <p className={styles.sectionIntro}>
              A secondary reading of inherited patterns, release points, and vocation.
            </p>
            <LazyPanel>
              <PanelErrorBoundary panelName="Karma, Fate, and Vocation">
                <PastLifeInsightsPanel payload={payload} />
              </PanelErrorBoundary>
            </LazyPanel>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          id="life-shifts"
          kicker="Major Life Shifts"
          title="Active and upcoming life shifts"
          defaultOpen={true}
          className={styles.cardKarma}
          persistKey={`${sectionStateScope}:life-shifts`}
        >
          <LazyPanel minHeight={560}>
            <PanelErrorBoundary panelName="Major Life Shifts">
              <MajorShiftsPanel payload={payload} />
            </PanelErrorBoundary>
          </LazyPanel>
        </CollapsibleSection>

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

              <div className={styles.domainSelectorHeader}>
                <p className={styles.domainSelectLabel}>Choose a life area</p>
                <span>Most active areas appear first</span>
              </div>
              <div className={styles.domainChips} role="tablist" aria-label="Life areas">
                {rankedDomainInsights.map((domain) => (
                  <button
                    key={domain.key}
                    type="button"
                    role="tab"
                    aria-selected={domain.key === selectedDomainKey}
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
          <CollapsibleSection
            id="fortune"
            kicker="Secondary details"
            title="Lucky elements and practical fortune"
            defaultOpen={false}
            className={styles.cardRules}
            persistKey={`${sectionStateScope}:fortune`}
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
