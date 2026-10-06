"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { CSSProperties } from "react";
import type {
  CalculationAuditInfo,
  NakshatraInfo,
  DashaInfo,
  PlanetPosition,
  SubPeriodInfo,
} from "@/lib/astro-types";
import { useTranslation, LOCALE_TAGS } from "@/lib/i18n-context";
import { nakshatraName, planetName, signName } from "@/lib/chart-labels";
import { PLANET_COLORS, PLANET_INK } from "@/lib/constellation-geometry";
import { announceIfFreeUsageExhausted } from "@/lib/free-usage-store";
import { useCurrentPeriodReading } from "./use-current-period-reading";

/* ────────────────────────────────────────────────
   Deterministic Dasha Interpretations
   Based on classical Vedic (Parashari) principles.
   Each planet as Maha Dasha lord carries a core theme,
   then we refine with house placement from the birth chart.
   ──────────────────────────────────────────────── */

const DASHA_LORD_THEMES: Record<string, { theme: string; keywords: string[]; general: string }> = {
  Sun: {
    theme: "Authority & Self-Expression",
    keywords: ["leadership", "government", "father figures", "vitality", "recognition"],
    general:
      "The Sun dasha activates themes of authority, career prominence, and self-confidence. This is a period where your identity crystallizes — you seek recognition and may gain positions of leadership. Relations with father figures and authority become central. Health of the heart and vitality are emphasized.",
  },
  Moon: {
    theme: "Emotions & Public Life",
    keywords: ["mother", "mind", "nurturing", "public", "travel", "comfort"],
    general:
      "The Moon dasha brings emotional depth, heightened intuition, and connection to the public. Matters related to mother, home life, and mental peace come into focus. Travel over water, changes of residence, and fluctuating fortunes are common. Nurturing relationships and inner contentment define this period.",
  },
  Mars: {
    theme: "Energy & Courage",
    keywords: ["action", "property", "siblings", "surgery", "competition", "strength"],
    general:
      "The Mars dasha ignites drive, ambition, and physical energy. This is a period of bold action — property transactions, competitive pursuits, and asserting yourself. Siblings and close allies play a role. Watch for impulsiveness, accidents, or surgical interventions. Channel this fire into disciplined action for best results.",
  },
  Mercury: {
    theme: "Intellect & Communication",
    keywords: ["business", "writing", "learning", "trade", "humor", "adaptability"],
    general:
      "The Mercury dasha sharpens intellect, communication skills, and commercial instincts. This is an excellent period for education, writing, business ventures, and networking. Analytical thinking and adaptability are your strengths. Skin-related health and nervous system may need attention.",
  },
  Jupiter: {
    theme: "Wisdom & Expansion",
    keywords: ["spirituality", "children", "fortune", "teaching", "dharma", "growth"],
    general:
      "The Jupiter dasha is widely regarded as one of the most auspicious periods. Spiritual growth, higher learning, and expansion of fortune are key themes. Children, mentors, and religious pursuits gain prominence. Legal and financial matters tend to resolve favorably. Generosity and moral clarity guide this era.",
  },
  Venus: {
    theme: "Love & Luxury",
    keywords: ["marriage", "arts", "wealth", "pleasure", "beauty", "vehicles"],
    general:
      "The Venus dasha brings themes of love, relationships, luxury, and artistic expression. Marriage, romantic connections, and aesthetic pursuits flourish. Financial prosperity through creative endeavors or partnerships is likely. Comfort, vehicles, and material pleasures are highlighted. Balance indulgence with purpose.",
  },
  Saturn: {
    theme: "Discipline & Karma",
    keywords: ["hard work", "delays", "structure", "longevity", "service", "lessons"],
    general:
      "The Saturn dasha demands patience, discipline, and perseverance. This is a karmic period where past actions bear fruit — for better or worse. Hard work is required, and shortcuts are blocked. Chronic health issues, career restructuring, and service to others define this time. The rewards for genuine effort are lasting and solid.",
  },
  Rahu: {
    theme: "Ambition & Transformation",
    keywords: ["foreign", "obsession", "unconventional", "technology", "sudden gains", "illusion"],
    general:
      "The Rahu dasha brings intense ambition, sudden opportunities, and unconventional paths. Foreign connections, technology, and out-of-the-box thinking are favored. This period can bring rapid material gains but also confusion and restlessness. Guard against obsessive tendencies and deceptive situations. Transformation through breaking old patterns is the deeper purpose.",
  },
  Ketu: {
    theme: "Spirituality & Detachment",
    keywords: ["liberation", "loss", "intuition", "past lives", "renunciation", "healing"],
    general:
      "The Ketu dasha activates spiritual seeking, detachment, and inner transformation. Material losses or separations may occur to redirect focus inward. Psychic sensitivity, past-life themes, and healing abilities are heightened. This is a deeply introspective period — worldly ambitions may feel hollow. Trust the process of letting go; liberation is the ultimate gift.",
  },
};

/* A lord's theme as a label, in the reader's language: dasha.panel.themes.<planet>.
   The theme also runs inside the English prose below, which keeps the English. */
export const DASHA_THEME_PLANETS = Object.keys(DASHA_LORD_THEMES);

function themeLabelFor(planet: string, t: (key: string) => string, fallbackKey: string): string {
  const theme = DASHA_LORD_THEMES[planet]?.theme;
  if (!theme) return t(fallbackKey);
  const key = `dasha.panel.themes.${planet.toLowerCase()}`;
  const text = t(key);
  return text === key ? theme : text;
}

/* House-based modifiers: where the dasha lord sits alters the expression */
const HOUSE_MODIFIER: Record<number, string> = {
  1: "Placed in the 1st house (Lagna), this planet directly influences your personality and physical body during this period. Self-driven initiatives and health matters take center stage.",
  2: "Placed in the 2nd house, this dasha emphasizes family wealth, speech, and accumulated resources. Financial growth and family dynamics are prominent.",
  3: "Placed in the 3rd house, courage, siblings, short travels, and creative self-expression are activated. A period of initiative and bold communication.",
  4: "Placed in the 4th house, domestic happiness, property, mother, and emotional security are the focus. Real estate and educational pursuits may thrive.",
  5: "Placed in the 5th house, creativity, children, romance, and speculative gains are highlighted. Intellectual pursuits and artistic expression flourish.",
  6: "Placed in the 6th house, competition, health challenges, and service are themes. You may overcome enemies and debts, but watch for chronic ailments or workplace stress.",
  7: "Placed in the 7th house, partnerships — both romantic and professional — take center stage. Marriage prospects, contracts, and public dealings are amplified.",
  8: "Placed in the 8th house, transformation, hidden matters, and sudden changes define this period. Research, occult interests, and inheritances may surface, but watch for upheavals.",
  9: "Placed in the 9th house, fortune, higher learning, long-distance travel, and spiritual growth are strongly activated. A very favorable placement bringing dharmic opportunities.",
  10: "Placed in the 10th house, career achievement, public reputation, and professional ambitions are the main themes. A powerful period for worldly accomplishment.",
  11: "Placed in the 11th house, gains, social networks, and fulfillment of desires are highlighted. Income growth and supportive friendships mark this period.",
  12: "Placed in the 12th house, foreign lands, spiritual retreats, and expenditure are themes. This can mean overseas opportunities but also isolation or hidden expenses.",
};

/* ────────────────────────────────────────────────
   Combination Effects: how a sub-lord modifies
   the Maha Dasha lord's expression.
   Keys are "MahaLord-SubLord" pairs.
   ──────────────────────────────────────────────── */
const DASHA_COMBO_EFFECTS: Record<string, string> = {
  // Sun combinations
  "Sun-Sun":     "A concentrated period of authority and self-assertion. Career visibility peaks and ego-driven decisions dominate.",
  "Sun-Moon":    "Authority meets emotional intelligence. Public image softens; dealings with government or father figures carry an emotional undertone.",
  "Sun-Mars":    "Fiery ambition and bold leadership. Expect career aggression, possible conflicts with authority, and physical vitality surges.",
  "Sun-Mercury": "Leadership through communication. Administrative acumen peaks — writing, public speaking, and intellectual authority thrive.",
  "Sun-Jupiter": "Benevolent authority and spiritual leadership. Promotions, honors, and mentorship roles are strongly favored.",
  "Sun-Venus":   "Power meets pleasure. Career gains may come through art, diplomacy, or romantic connections. Public charm is enhanced.",
  "Sun-Saturn":  "Authority tested by discipline. Hard work under pressure; father-figure tensions. Lasting achievements if you persevere.",
  "Sun-Rahu":    "Unconventional rise to power. Sudden recognition or controversy in public life. Foreign authority figures become relevant.",
  "Sun-Ketu":    "Ego dissolution through service. Spiritual authority grows while worldly ambition fades. Detachment from status.",

  // Moon combinations
  "Moon-Sun":    "Emotional life brightened by confidence. Public visibility and nurturing leadership; mother-father dynamics come alive.",
  "Moon-Moon":   "Deep emotional immersion. Heightened intuition and sensitivity. Domestic matters and inner peace take full focus.",
  "Moon-Mars":   "Emotional energy channeled into action. Property moves, protective instincts, and passion intensify. Watch for emotional impulsiveness.",
  "Moon-Mercury":"Mental agility meets emotional depth. Excellent for writing, counseling, and intuitive business decisions.",
  "Moon-Jupiter":"Emotional wisdom and spiritual nurturing. A very auspicious period for family, children, and inner growth.",
  "Moon-Venus":  "Love and comfort merge. Romantic feelings deepen, artistic inspiration flows, and domestic life becomes luxurious.",
  "Moon-Saturn": "Emotional maturity through hardship. Melancholy or loneliness may surface, but builds lasting emotional resilience.",
  "Moon-Rahu":   "Restless mind and unusual emotional experiences. Foreign travels, unconventional relationships, or public obsessions.",
  "Moon-Ketu":   "Emotional detachment and psychic sensitivity. Past-life memories or spiritual experiences. Solitude brings clarity.",

  // Mars combinations
  "Mars-Sun":    "Courageous leadership and physical assertiveness. Military or competitive success. Father-sibling dynamics activated.",
  "Mars-Moon":   "Action driven by emotion. Property and domestic energy spike. Protective instincts but also impulsive reactions.",
  "Mars-Mars":   "Peak intensity — doubled fire energy. Major physical undertakings, property deals, or competitions. Guard against aggression and accidents.",
  "Mars-Mercury":"Strategic action and sharp communication. Technical skills shine. Legal disputes or negotiations require quick thinking.",
  "Mars-Jupiter":"Righteous action and expansion. Property growth, athletic success, and courageous dharmic pursuits are favored.",
  "Mars-Venus":  "Passion meets beauty. Romantic intensity, creative boldness, and luxury through action. Property and vehicles highlighted.",
  "Mars-Saturn": "Disciplined force under pressure. Hard physical labor or delayed results. Perseverance through obstacles builds resilience.",
  "Mars-Rahu":   "Explosive ambition and unconventional courage. Sudden property gains or technological ventures. Risk of reckless moves.",
  "Mars-Ketu":   "Spiritual warrior energy. Past-life karmic actions surface. Surgery, martial arts, or renunciation of conflict.",

  // Mercury combinations
  "Mercury-Sun":    "Intellectual authority and expressive leadership. Writing, commerce, and analytical roles gain official backing.",
  "Mercury-Moon":   "Intuitive intellect. Emotional intelligence fuels communication and business. Trade and travel blend with nurturing.",
  "Mercury-Mars":   "Sharp, decisive communication. Technical problem-solving, competitive debates, and bold business moves.",
  "Mercury-Mercury":"Peak mental clarity. Exceptional for learning, writing, coding, trading, and all forms of information processing.",
  "Mercury-Jupiter":"Wisdom meets intellect. Higher education, publishing, and philosophical communication flourish. Financial acumen sharpens.",
  "Mercury-Venus":  "Artistic intellect and diplomatic speech. Creative writing, design, and luxurious commerce. Charming negotiations.",
  "Mercury-Saturn": "Disciplined thinking and systematic work. Accounting, research, and structured learning. Slow but thorough progress.",
  "Mercury-Rahu":   "Innovative ideas and unconventional communication. Tech breakthroughs, foreign trade, and outside-the-box thinking.",
  "Mercury-Ketu":   "Intuitive analysis and detached reasoning. Spiritual study, occult research, and letting go of overthinking.",

  // Jupiter combinations
  "Jupiter-Sun":    "Spiritual authority and divine leadership. Teachers, mentors, and father figures bring blessings. Recognition for wisdom.",
  "Jupiter-Moon":   "Emotional wisdom and nurturing faith. Family blessings, spiritual comfort, and public goodwill. A deeply auspicious time.",
  "Jupiter-Mars":   "Expansive action and righteous courage. Property growth, adventurous dharma, and bold philosophical pursuits.",
  "Jupiter-Mercury":"Intellectual expansion and scholarly communication. Publishing, teaching, and commercial wisdom combine powerfully.",
  "Jupiter-Jupiter":"Maximum expansion and fortune. The most auspicious sub-period — spiritual growth, wealth, children, and blessings multiply.",
  "Jupiter-Venus":  "Abundance in love and luxury. Marriage blessings, artistic patronage, and wealth through wisdom. A beautiful period.",
  "Jupiter-Saturn": "Wisdom tested by karma. Spiritual discipline, structured growth, and service-oriented expansion. Patient faith rewarded.",
  "Jupiter-Rahu":   "Unconventional spiritual expansion. Foreign teachers, unorthodox philosophies, and rapid but restless growth.",
  "Jupiter-Ketu":   "Deep spiritual liberation. Detachment from material expansion. Mystical experiences and past-life wisdom emerge.",

  // Venus combinations
  "Venus-Sun":    "Love illuminated by confidence. Creative recognition, romantic visibility, and luxury through authority connections.",
  "Venus-Moon":   "Deep romantic feelings and aesthetic comfort. Domestic beauty, emotional harmony, and artistic flow.",
  "Venus-Mars":   "Passionate love and bold creativity. Romantic intensity, luxury acquisitions, and creative action. Exciting but impulsive pleasures.",
  "Venus-Mercury":"Refined taste and eloquent charm. Design, writing, diplomacy, and commercial aesthetics thrive. Witty and graceful communication.",
  "Venus-Jupiter":"Love and wisdom merge. Marriage blessings, artistic expansion, and financial prosperity through partnerships. Highly auspicious.",
  "Venus-Venus":  "Peak indulgence and beauty. Relationships, art, and luxury fully activated. Balance enjoyment with deeper purpose.",
  "Venus-Saturn": "Love tested by responsibility. Mature relationships, disciplined creativity, and delayed but lasting material gains.",
  "Venus-Rahu":   "Unconventional love and exotic luxury. Foreign romance, technology-aided art, and sudden financial shifts.",
  "Venus-Ketu":   "Spiritual love and detachment from pleasure. Artistic transcendence, past-life romantic karma, and inner beauty.",

  // Saturn combinations
  "Saturn-Sun":    "Karmic authority and disciplined leadership. Career restructuring through hard work. Father-figure lessons intensify.",
  "Saturn-Moon":   "Emotional endurance and stoic patience. Loneliness or domestic responsibility. Inner strength through emotional hardship.",
  "Saturn-Mars":   "Grinding effort and focused force. Hard physical labor, property struggles, and disciplined competitive drive.",
  "Saturn-Mercury":"Methodical intellect and structured communication. Research, accounting, and systematic learning. Slow but precise results.",
  "Saturn-Jupiter":"Karma meets wisdom. Spiritual discipline, structured growth, and service-oriented expansion bear lasting fruit.",
  "Saturn-Venus":  "Discipline in love and measured luxury. Mature relationships, structured creativity, and financial prudence.",
  "Saturn-Saturn": "Peak karmic intensity. The most demanding sub-period — maximum discipline required. Lasting foundations built through patience.",
  "Saturn-Rahu":   "Relentless ambition under pressure. Foreign hardships, unconventional labor, and karmic breakthroughs through persistence.",
  "Saturn-Ketu":   "Deep karmic release and spiritual austerity. Letting go of worldly structures. Monastic energy and liberation through suffering.",

  // Rahu combinations
  "Rahu-Sun":    "Sudden ambition for authority. Unconventional career rise, foreign government connections, and shadow-side of power.",
  "Rahu-Moon":   "Restless emotions and public obsession. Unusual domestic situations, foreign travel, and heightened psychic sensitivity.",
  "Rahu-Mars":   "Explosive, risk-taking energy. Technology meets aggression. Sudden property gains or dangerous ventures. Channel carefully.",
  "Rahu-Mercury":"Brilliant but scattered intellect. Tech innovation, foreign trade, and unconventional communication. Guard against deception.",
  "Rahu-Jupiter":"Rapid spiritual seeking and unorthodox wisdom. Foreign teachers, philosophical experimentation, and mixed blessings.",
  "Rahu-Venus":  "Exotic romance and unconventional luxury. Foreign love affairs, technology-driven art, and glamorous but unstable pleasures.",
  "Rahu-Saturn": "Intense karmic pressure with unconventional labor. Foreign hardships, systematic disruption, and transformative perseverance.",
  "Rahu-Rahu":   "Maximum disruption and transformation. Obsessive ambition, identity confusion, and radical life changes. Navigate with awareness.",
  "Rahu-Ketu":   "Axis of destiny activated. Past and future collide. Major karmic turning points, spiritual crisis, and profound shifts.",

  // Ketu combinations
  "Ketu-Sun":    "Ego dissolution and spiritual authority. Detachment from power, but inner radiance grows. Father-figure karmic closure.",
  "Ketu-Moon":   "Emotional release and psychic awakening. Past-life memories, maternal karma, and intuitive depth. Solitude is healing.",
  "Ketu-Mars":   "Spiritual warrior energy. Surgical precision, martial discipline turned inward, and releasing anger or aggression patterns.",
  "Ketu-Mercury":"Intuitive intellect beyond logic. Spiritual study, occult communication, and releasing attachment to analytical thinking.",
  "Ketu-Jupiter":"Liberation through wisdom. Deep spiritual realization, detachment from worldly expansion, and guru-disciple karma.",
  "Ketu-Venus":  "Transcending attachment to pleasure. Spiritual art, past-life romantic closure, and finding beauty in simplicity.",
  "Ketu-Saturn": "Ultimate karmic release. Intense austerity, letting go of worldly structures, and liberation through disciplined surrender.",
  "Ketu-Rahu":   "Destiny axis reversed. Karmic crossroads — past-life patterns demand resolution. Confusion yields to spiritual clarity.",
  "Ketu-Ketu":   "Maximum spiritual intensity. Complete withdrawal from material concerns. Mystical experiences and final karmic dissolution.",
};

/* ────────────────────────────────────────────────
   Planet colours for the timeline

   From lib/constellation-geometry rather than a set of its own. The chart
   wheel and the mobile chart already colour their grahas from there, and
   this panel carried an unrelated flat palette -- so Mars was coral in the
   wheel and a flat red in the timeline underneath it, and Rahu went from
   grey to purple between the two. One planet, one colour.

   Only the fallback stays local: an unrecognised lord gets the teal that
   the rest of this panel uses for neutral furniture.
   ──────────────────────────────────────────────── */
const DASHA_FALLBACK_COLOR = '#6ce1d4';

const dashaColor = (planet: string) =>
  PLANET_COLORS[planet] ?? DASHA_FALLBACK_COLOR;

/* The same planet as text. dashaColor is for fills, borders and glows, which
   sit on the bars and the starfield and stay dark in either theme; a planet
   name printed on a themed card needs the ink cut instead -- the pastels are
   1.4-2.4:1 on the light one. */
const dashaInk = (planet: string) =>
  PLANET_INK[planet] ?? DASHA_FALLBACK_COLOR;

/* English, for the English sentence getCombinationInsight builds; everything
   the interface prints reads LEVEL_LABEL_KEYS. */
const LEVEL_NAMES_EN: Record<number, string> = {
  1: "Maha Dasha",
  2: "Antardasha",
  3: "Pratyantardasha",
  4: "Sookshma Dasha",
  5: "Prana Dasha",
};

const LEVEL_LABEL_KEYS: Record<number, string> = {
  1: "dasha.mahaDasha",
  2: "dasha.antardasha",
  3: "dasha.pratyantardasha",
  4: "dasha.sookshmaDasha",
  5: "dasha.pranaDasha",
};

const LEVEL_COLORS: Record<number, string> = {
  1: "var(--accent-gold)",
  2: "var(--accent-aqua)",
  3: "var(--accent-coral)",
  4: "#c490e4",
  5: "#8bb8f0",
};

type DrillStep = {
  level: number;
  planet: string;
  startDate: string;
  endDate: string;
  sequenceStartDate?: string;
  sequenceEndDate?: string;
};

/* The chain a drill path asks the API about: three lords and deeper, over a
   dated window. Null where the built-in map is the answer. The key matches the
   route's, so drilling back and forth costs one request per chain. */
function chainRequestFor(drillPath: DrillStep[]) {
  if (drillPath.length < 3) return null;
  const deepest = drillPath[drillPath.length - 1];
  if (!deepest.startDate || !deepest.endDate) return null;
  const lords = drillPath.map((step) => step.planet);
  return {
    lords,
    startDate: deepest.startDate,
    endDate: deepest.endDate,
    key: `${lords.join(">")}|${deepest.startDate}|${deepest.endDate}`,
  };
}

type PopupData = {
  planet: string;
  isCurrent: boolean;
  /* Where the popup sits in the timeline container, measured when the bar was
     clicked: reading the container's rect during render is not allowed. */
  position?: { left: string; top: string };
  level: number;
  startDate: string;
  endDate: string;
  sequenceStartDate?: string;
  sequenceEndDate?: string;
  years?: number;
};

type DashaViewMode = "timeline" | "lens" | "table";

type DashaDisplayPeriod = {
  planet: string;
  start_date: string;
  end_date: string;
  level: number;
  years?: number;
  lords?: string[];
  sequence_start_date?: string;
  sequence_end_date?: string;
};

type NakshatraDashaPanelProps = {
  nakshatra: NakshatraInfo;
  dasha: DashaInfo;
  audit?: CalculationAuditInfo;
  planets?: PlanetPosition[];
};

export default function NakshatraDashaPanel({
  nakshatra,
  dasha,
  audit,
  planets,
}: NakshatraDashaPanelProps) {
  const { t, language } = useTranslation();
  const currentPlanet = dasha.current_dasha;
  const [showAudit, setShowAudit] = useState(false);
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [drillPath, setDrillPath] = useState<DrillStep[]>([]);
  const [subPeriodCache, setSubPeriodCache] = useState<Record<string, SubPeriodInfo[]>>({});
  const [loadingLevel, setLoadingLevel] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<DashaViewMode>("timeline");
  /* Interpretations for chains the built-in map cannot express -- three lords
     and deeper. Keyed by the chain plus its window, which is what the route
     keys on too, so drilling back and forth costs one request per chain. */
  const [chainInsights, setChainInsights] = useState<Record<string, string>>({});
  /* The drill path whose chain request came back empty. Held by path, not by
     chain, so drilling back to the same chain asks again, as it always has. */
  const [chainFailedPath, setChainFailedPath] = useState<DrillStep[] | null>(null);
  /* One "now" for the whole panel, taken at mount: the progress ring, the
     days-remaining counts and "is this period current" all agree with each
     other, and render stays pure. The panel only mounts in the browser. */
  const [now] = useState(() => Date.now());
  const popupRef = useRef<HTMLDivElement>(null);

  /* Close popup on outside click */
  useEffect(() => {
    if (!popup) return;
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopup(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [popup]);

  /* Close popup on Escape */
  useEffect(() => {
    if (!popup) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopup(null);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [popup]);

  /* Build cache key for sub-period requests */
  const cacheKey = (
    lord: string,
    start: string,
    end: string,
    level: number,
    sequenceStart?: string,
    sequenceEnd?: string
  ) => `${lord}-${start}-${end}-${level}-${sequenceStart ?? start}-${sequenceEnd ?? end}`;

  /* Fetch sub-periods from API */
  const fetchSubPeriods = useCallback(
    async (
      parentLord: string,
      parentStart: string,
      parentEnd: string,
      level: number,
      parentLords: string[],
      sequenceStart?: string,
      sequenceEnd?: string
    ) => {
      const key = cacheKey(parentLord, parentStart, parentEnd, level, sequenceStart, sequenceEnd);
      if (subPeriodCache[key]) return subPeriodCache[key];

      setLoadingLevel(level);
      try {
        const url = new URL("/api/chart/dasha-subperiods", window.location.origin);
        url.searchParams.set("parent_lord", parentLord);
        url.searchParams.set("parent_start", parentStart);
        url.searchParams.set("parent_end", parentEnd);
        if (sequenceStart) {
          url.searchParams.set("sequence_start", sequenceStart);
        }
        if (sequenceEnd) {
          url.searchParams.set("sequence_end", sequenceEnd);
        }
        url.searchParams.set("level", String(level));
        if (parentLords.length > 0) {
          url.searchParams.set("parent_lords", parentLords.join(","));
        }

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const data: SubPeriodInfo[] = await res.json();

        setSubPeriodCache((prev) => ({ ...prev, [key]: data }));
        return data;
      } catch (err) {
        console.error("Failed to fetch sub-periods:", err);
        return [];
      } finally {
        setLoadingLevel(null);
      }
    },
    [subPeriodCache]
  );

  /* Handle drill-down click on a bar */
  const handleDrillDown = async (
    planet: string,
    startDate: string,
    endDate: string,
    currentLevel: number,
    parentLords: string[],
    sequenceStartDate?: string,
    sequenceEndDate?: string
  ) => {
    const nextLevel = currentLevel + 1;
    if (nextLevel > 5) return;

    const lords = [...parentLords, planet];
    const data = await fetchSubPeriods(
      planet,
      startDate,
      endDate,
      nextLevel,
      lords,
      sequenceStartDate,
      sequenceEndDate
    );
    if (data.length > 0) {
      setDrillPath((prev) => [
        ...prev,
        { level: currentLevel, planet, startDate, endDate, sequenceStartDate, sequenceEndDate },
      ]);
      setViewMode("lens");
      setPopup(null);
    }
  };

  /* Handle breadcrumb navigation */
  const handleBreadcrumbClick = (index: number) => {
    if (index < 0) {
      setDrillPath([]);
      setViewMode("timeline");
    } else {
      setDrillPath((prev) => prev.slice(0, index + 1));
      setViewMode("lens");
    }
    setPopup(null);
  };

  /*
   * Up one level.
   *
   * The breadcrumb could already do this, but only by aiming at the
   * second-to-last crumb -- the last one is the level you are already on, so
   * the obvious target is the one that does nothing. Five levels deep that is
   * a lot of precision to ask for just to back out, which is why the way out
   * was reading as "reload the page".
   *
   * Slicing to length - 2 lands on -1 when there is one step left, which
   * handleBreadcrumbClick already treats as "back to the timeline".
   */
  const handleStepBack = useCallback(() => {
    setDrillPath((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice(0, prev.length - 1);
      setViewMode(next.length === 0 ? "timeline" : "lens");
      return next;
    });
    setPopup(null);
  }, []);

  /* Escape steps back out one level. The popup owns Escape while it is open
     (see the effect above, which returns early when there is no popup), so
     the two never both fire for one press. */
  useEffect(() => {
    if (popup || drillPath.length === 0) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const el = document.activeElement;
      /* leave text entry alone */
      if (el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      handleStepBack();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [popup, drillPath.length, handleStepBack]);

  /*
   * Ask the API for the chains DASHA_COMBO_EFFECTS cannot express.
   *
   * That map is 81 strings -- every maha/antar pair -- and the lookup below
   * keys on first-and-last lord, so at three lords and deeper the middle of
   * the chain is dropped and a four-lord period reads exactly like its
   * two-lord parent. Two lords stay on the map: it is written, it is
   * reviewed, and it costs nothing.
   */
  useEffect(() => {
    const request = chainRequestFor(drillPath);
    if (!request || chainInsights[request.key]) return;
    const { lords, startDate, endDate, key } = request;

    let cancelled = false;
    fetch("/api/chart/dasha-interpretation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lords, startDate, endDate }),
    })
      .then(async (res) => {
        if (res.ok) return res.json();
        /* A refused free allowance raises the sign-in prompt; every other
           failure stays silent, as it did before this feature existed. */
        await announceIfFreeUsageExhausted(res, "dashaInterpretation");
        return null;
      })
      .then((data) => {
        if (cancelled) return;
        if (data?.interpretation) {
          setChainInsights((prev) => ({ ...prev, [key]: data.interpretation }));
        } else {
          setChainFailedPath(drillPath);
        }
      })
      .catch(() => {
        /* The deterministic sentence is still on screen; a failed request
           leaves the panel exactly as it was before this feature existed. */
        if (!cancelled) setChainFailedPath(drillPath);
      });

    return () => {
      cancelled = true;
    };
  }, [drillPath, chainInsights]);

  const handleBarClick = (
    planet: string,
    isCurrent: boolean,
    startDate: string,
    endDate: string,
    level: number,
    sequenceStartDate: string | undefined,
    sequenceEndDate: string | undefined,
    years: number | undefined,
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    const barRect = e.currentTarget.getBoundingClientRect();
    /* The section the popup is positioned against, found from the bar rather
       than through a ref: every bar sits inside it. */
    const containerRect = e.currentTarget
      .closest(".dasha-timeline-section")
      ?.getBoundingClientRect();
    let position: PopupData["position"];
    if (containerRect) {
      const barCenter = barRect.left + barRect.width / 2 - containerRect.left;
      const clampedLeft = Math.max(0, Math.min(barCenter - 180, containerRect.width - 360));
      position = {
        left: `${clampedLeft}px`,
        top: `${barRect.bottom - containerRect.top + 10}px`,
      };
    }
    setPopup({
      planet,
      isCurrent,
      position,
      level,
      startDate,
      endDate,
      sequenceStartDate,
      sequenceEndDate,
      years,
    });
  };

  /* Build interpretation for a given dasha lord */
  const getInterpretation = (planetName: string) => {
    const theme = DASHA_LORD_THEMES[planetName];
    if (!theme) return null;

    const placement = planets?.find((p) => p.name === planetName);
    const houseNote = placement ? HOUSE_MODIFIER[placement.house] : null;

    return { ...theme, placement, houseNote };
  };

  /* Get sub-periods to show for current drill level */
  const getCurrentSubPeriods = (): SubPeriodInfo[] | null => {
    if (drillPath.length === 0) return null;
    const last = drillPath[drillPath.length - 1];
    const nextLevel = last.level + 1;
    const key = cacheKey(
      last.planet,
      last.startDate,
      last.endDate,
      nextLevel,
      last.sequenceStartDate,
      last.sequenceEndDate
    );
    return subPeriodCache[key] ?? null;
  };

  /* Determine if a date range contains today */
  const isCurrentPeriod = (startDate: string, endDate: string) => {
    const today = new Date(now).toISOString().split("T")[0];
    return startDate <= today && today <= endDate;
  };

  /* Compute days between two date strings */
  const daysBetween = (start: string, end: string) => {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    return ms / (1000 * 60 * 60 * 24);
  };

  /* Format date for display, in the interface language.
   *
   * Parsed as local midnight and formatted in the local zone, so the two
   * cancel out and the day cannot slip -- which is why there is no timeZone
   * option here, unlike the /m twin that reads its boundaries as UTC. */
  const formatDate = (dateStr: string) => {
    return new Date(dateStr + "T00:00:00").toLocaleDateString(LOCALE_TAGS[language], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  /* Numbers in the reader's notation: 2.5 in English, 2,5 in German. */
  const formatYears = (years: number, digits: number) =>
    new Intl.NumberFormat(LOCALE_TAGS[language], {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(years);

  const levelLabel = (level: number) =>
    LEVEL_LABEL_KEYS[level]
      ? t(LEVEL_LABEL_KEYS[level])
      : t("dasha.panel.level", { level: String(level) });

  const formatPeriodDuration = (startDate: string, endDate: string) => {
    const days = Math.max(1, Math.round(daysBetween(startDate, endDate)));
    if (days >= 730) {
      return t("dasha.panel.durationYears", { count: formatYears(days / 365.25, 1) });
    }
    if (days >= 60) {
      return t("dasha.panel.durationMonths", { count: String(Math.round(days / 30.44)) });
    }
    return t("dasha.panel.durationDays", { count: String(days) });
  };

  const getPeriodLords = (period: DashaDisplayPeriod) => {
    if (period.lords && period.lords.length > 0) return period.lords;
    if (selectedParent) return [...drillPath.map((step) => step.planet), period.planet];
    return [period.planet];
  };

  const getSubtlePeriodDetails = (period: DashaDisplayPeriod) => {
    const lords = getPeriodLords(period);
    const mahaLord = lords[0] ?? period.planet;
    const activeLord = period.planet;
    const theme = DASHA_LORD_THEMES[activeLord];
    const placement = planets?.find((planet) => planet.name === activeLord);
    const housePhrase = placement
      ? `Natal house ${placement.house} adds ${HOUSE_MODIFIER[placement.house]?.toLowerCase() ?? "a chart-specific emphasis."}`
      : "Use this branch as a timing lens for choices that need finer judgment.";
    const combo =
      lords.length > 1
        ? DASHA_COMBO_EFFECTS[`${mahaLord}-${activeLord}`]
        : theme?.general;

    return [
      theme ? `${theme.theme}: ${theme.keywords.slice(0, 3).join(", ")}.` : null,
      combo,
      housePhrase,
    ].filter(Boolean);
  };

  const formatAuditTimestamp = (value: string) => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return value.replace("T", " ");

    const [, year, month, day, hour, minute] = match;
    /* The wall-clock digits as written, in the reader's language: built in UTC
       and formatted in UTC, so no time zone moves them. */
    const instant = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)),
    );
    return instant.toLocaleString(LOCALE_TAGS[language], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    });
  };

  /*
   * The lookup instant on the reader's own clock, with the zone named.
   *
   * Not the audit's local field: that is birthplace wall time, and printed
   * bare it read as a "now" 9.5 hours ahead to someone in New York looking at
   * a chart born in India. This panel only renders in the browser, so the
   * browser's zone is the reader's.
   */
  const formatReaderTime = (utcIso: string) => {
    const instant = new Date(`${utcIso}:00Z`);
    if (Number.isNaN(instant.getTime())) return `${formatAuditTimestamp(utcIso)} UTC`;
    return new Intl.DateTimeFormat(LOCALE_TAGS[language], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(instant);
  };

  const formatUtcOffset = (minutes: number) => {
    const sign = minutes >= 0 ? "+" : "-";
    const absolute = Math.abs(minutes);
    const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
    const mins = String(absolute % 60).padStart(2, "0");
    return `UTC${sign}${hours}:${mins}`;
  };

  /* Build a brief summary from DASHA_LORD_THEMES for current dasha/antardasha */
  const getCurrentPeriodSummary = () => {
    const mahaDashaTheme = DASHA_LORD_THEMES[dasha.current_dasha];
    const antarDashaTheme = DASHA_LORD_THEMES[dasha.current_antardasha];
    if (!mahaDashaTheme || !antarDashaTheme) return null;

    return `Your life is currently shaped by ${mahaDashaTheme.theme} (${dasha.current_dasha} Maha Dasha), refined through ${antarDashaTheme.theme} (${dasha.current_antardasha} Antardasha). Key themes include ${mahaDashaTheme.keywords.slice(0, 3).join(", ")} blended with ${antarDashaTheme.keywords.slice(0, 3).join(", ")}.`;
  };

  /* Calculate remaining days and progress percentage for the current antardasha */
  const getAntardashaProgress = () => {
    const today = new Date(now);
    const start = new Date(dasha.current_antardasha_start + "T00:00:00");
    const end = new Date(dasha.current_antardasha_end + "T00:00:00");
    const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const elapsedDays = (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const remainingDays = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    const progressPercent = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
    return { remainingDays, progressPercent };
  };

  /* Build combination insight from the current drill path */
  const getCombinationInsight = (): { lords: string[]; effect: string; themes: string[]; generated: boolean } | null => {
    if (drillPath.length === 0) return null;

    const lords = drillPath.map((step) => step.planet);
    const themes = lords
      .map((lord) => DASHA_LORD_THEMES[lord]?.theme)
      .filter(Boolean) as string[];

    /* Use the deepest two lords for the combination effect */
    const mahaLord = lords[0];
    const deepestLord = lords[lords.length - 1];
    const comboKey = `${mahaLord}-${deepestLord}`;
    const fallback = DASHA_COMBO_EFFECTS[comboKey]
      ?? `${DASHA_LORD_THEMES[mahaLord]?.theme ?? mahaLord} energy is filtered through ${DASHA_LORD_THEMES[deepestLord]?.theme ?? deepestLord} at the ${LEVEL_NAMES_EN[drillPath.length + 1] ?? "sub-period"} level.`;

    /* Three lords and deeper, prefer the generated reading -- it is the only
       one that has seen the middle of the chain. Until it arrives, and if it
       never does, the map sentence stands. */
    const deepest = drillPath[drillPath.length - 1];
    const chainKey = `${lords.join(">")}|${deepest.startDate}|${deepest.endDate}`;
    const generated = lords.length >= 3 ? chainInsights[chainKey] : undefined;

    return { lords, effect: generated ?? fallback, themes, generated: Boolean(generated) };
  };

  const interpretation = popup ? getInterpretation(popup.planet) : null;
  const currentSubPeriods = getCurrentSubPeriods();
  const currentDrillLevel = drillPath.length > 0 ? drillPath[drillPath.length - 1].level + 1 : 1;
  const combinationInsight = getCombinationInsight();
  /* Derived, not set before the fetch: a request is out for this chain while
     it has neither an answer nor a failure on this visit. */
  const chainRequest = chainRequestFor(drillPath);
  const chainInsightLoading =
    chainRequest !== null && !chainInsights[chainRequest.key] && chainFailedPath !== drillPath;
  const currentProgress = getAntardashaProgress();
  /*
   * The written reading for the stack the reader is standing in.
   *
   * Below currentProgress because it needs the progress figure, and above
   * everything that renders because this is a hook -- there is no conditional
   * return between here and the top of the component, and there must not be
   * one, or this stops being called on some renders.
   *
   * It is also the one call in this panel that fires without a click, so it is
   * the one worth reading twice before changing: whatever is passed here is
   * bought, once per mount, for every visitor who opens the timing section.
   */
  const currentPeriodReading = useCurrentPeriodReading(
    dasha,
    nakshatra,
    planets,
    currentProgress.progressPercent,
  );
  /* The template stays the fallback rather than the thing replaced: it is on
     screen from the first paint, and it is what remains if the reading never
     arrives. */
  const templateSummary = getCurrentPeriodSummary();
  const currentPeriodCopy = currentPeriodReading.reading ?? templateSummary;
  const selectedParent = drillPath.length > 0 ? drillPath[drillPath.length - 1] : null;
  /* One level shallower than what is on screen; at the first step that is the
     Maha Dasha timeline itself. */
  const stepBackTarget = levelLabel(LEVEL_LABEL_KEYS[currentDrillLevel - 1] ? currentDrillLevel - 1 : 1);
  const displayLevel = currentSubPeriods ? currentDrillLevel : 1;
  const displayPeriods: DashaDisplayPeriod[] = currentSubPeriods
    ? currentSubPeriods
    : dasha.periods.map((period) => ({ ...period, level: 1 }));
  const visiblePeriods = displayPeriods.slice(0, viewMode === "lens" ? 9 : displayPeriods.length);
  const activeStack = [
    {
      label: levelLabel(1),
      planet: dasha.current_dasha,
      startDate: dasha.current_dasha_start,
      endDate: dasha.current_dasha_end,
    },
    {
      label: levelLabel(2),
      planet: dasha.current_antardasha,
      startDate: dasha.current_antardasha_start,
      endDate: dasha.current_antardasha_end,
    },
    dasha.current_pratyantar
      ? {
          label: levelLabel(3),
          planet: dasha.current_pratyantar,
          startDate: dasha.current_pratyantar_start ?? "",
          endDate: dasha.current_pratyantar_end ?? "",
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    planet: string;
    startDate: string;
    endDate: string;
  }>;

  return (
    <section className="nakshatra-panel">
      <div className="rules-header">
        <p className="kicker">{t("dasha.kicker")}</p>
        <h2>{t("dasha.heading")}</h2>
      </div>

      <section className="dasha-command-hero">
        <div className="dasha-command-copy">
          <p className="dasha-command-kicker">{t("dasha.panel.chapterKicker")}</p>
          <h3>
            {planetName(dasha.current_dasha, t)} <span>{t("dasha.panel.chainJoin")}</span>{" "}
            {planetName(dasha.current_antardasha, t)}
            {dasha.current_pratyantar ? (
              <span>
                {" "}
                {t("dasha.panel.chainJoin")} {planetName(dasha.current_pratyantar, t)}
              </span>
            ) : null}
          </h3>
          {/* The orienting line, not the reading. The written paragraph goes in
              the Current Period card below, where it has room; the two used to
              print the same sentence twice on one screen. */}
          {templateSummary && (
            <p className="dasha-command-summary">{templateSummary}</p>
          )}
        </div>

        <div className="dasha-command-meter" aria-label={t("dasha.panel.meterAria")}>
          <div className="dasha-command-meter-ring">
            <span>{Math.round(currentProgress.progressPercent)}%</span>
            <small>{t("dasha.panel.complete")}</small>
          </div>
          <div className="dasha-command-meter-copy">
            <strong>
              {t("dasha.daysRemaining", {
                days: currentProgress.remainingDays.toLocaleString(LOCALE_TAGS[language]),
              })}
            </strong>
            <span>{formatDate(dasha.current_antardasha_start)} - {formatDate(dasha.current_antardasha_end)}</span>
          </div>
        </div>
      </section>

      <div className="dasha-active-stack" aria-label={t("dasha.panel.stackAria")}>
        {activeStack.map((step) => {
          const color = dashaInk(step.planet);
          return (
            <article key={`${step.label}-${step.planet}`} className="dasha-active-stack-card">
              <span className="dasha-active-stack-level">{step.label}</span>
              <strong style={{ color }}>{planetName(step.planet, t)}</strong>
              <small>
                {step.startDate && step.endDate
                  ? `${formatDate(step.startDate)} - ${formatDate(step.endDate)}`
                  : t("dasha.panel.detailsLoading")}
              </small>
              <p>{themeLabelFor(step.planet, t, "dasha.panel.themeActive")}</p>
            </article>
          );
        })}
      </div>

      {audit && (
        <section className="dasha-audit">
          <div className="dasha-audit-header">
            <div>
              <p className="dasha-audit-kicker">{t("dasha.panel.auditKicker")}</p>
              <h3>{t("dasha.panel.auditHeading")}</h3>
            </div>
            <button
              className="dasha-audit-toggle"
              type="button"
              onClick={() => setShowAudit((previous) => !previous)}
            >
              {showAudit ? t("dasha.panel.hideAudit") : t("dasha.panel.showAudit")}
            </button>
          </div>

          {showAudit && (
            <>
              <p className="dasha-audit-note">{t("dasha.panel.auditNote")}</p>
              <div className="dasha-audit-grid">
                <article className="dasha-audit-card">
                  <span className="dasha-audit-label">{t("dasha.panel.auditEngine")}</span>
                  <strong>{audit.engine_label}</strong>
                  <small>{audit.ayanamsha} / {audit.house_system}</small>
                </article>

                <article className="dasha-audit-card">
                  <span className="dasha-audit-label">{t("dasha.panel.auditBirthTime")}</span>
                  <strong>{formatAuditTimestamp(audit.birth_local_iso)}</strong>
                  <small>
                    {audit.time_zone_id ? `${audit.time_zone_id} / ` : ""}
                    {formatUtcOffset(audit.timezone_offset_minutes)}
                  </small>
                  <small>UTC: {formatAuditTimestamp(audit.birth_utc_iso)} UTC</small>
                </article>

                <article className="dasha-audit-card">
                  <span className="dasha-audit-label">{t("dasha.panel.auditCoordinates")}</span>
                  <strong>
                    {audit.latitude.toFixed(4)}, {audit.longitude.toFixed(4)}
                  </strong>
                  <small>{t("dasha.panel.auditCoordinatesNote")}</small>
                </article>

                <article className="dasha-audit-card">
                  <span className="dasha-audit-label">{t("dasha.panel.auditMoon")}</span>
                  <strong>
                    {t("dasha.panel.auditMoonValue", {
                      sign: signName(audit.moon_sign, t),
                      degree: audit.moon_degree_in_sign.toFixed(4),
                    })}
                  </strong>
                  <small>
                    {t("dasha.panel.auditSidereal", { degree: audit.moon_sidereal_longitude.toFixed(4) })}
                  </small>
                </article>

                <article className="dasha-audit-card">
                  <span className="dasha-audit-label">{t("dasha.panel.auditNakshatra")}</span>
                  <strong>
                    {nakshatraName(audit.nakshatra_name, t)} / {planetName(audit.nakshatra_lord, t)} /{" "}
                    {t("dasha.panel.auditPada", { pada: String(audit.nakshatra_pada) })}
                  </strong>
                  <small>
                    {t("dasha.panel.auditIntoNakshatra", { degree: audit.degree_in_nakshatra.toFixed(4) })}
                  </small>
                  <small>
                    {t("dasha.panel.auditCompleteAtBirth", {
                      percent: audit.nakshatra_progress_percent.toFixed(2),
                    })}
                  </small>
                </article>

                <article className="dasha-audit-card">
                  <span className="dasha-audit-label">{t("dasha.panel.auditSeed")}</span>
                  <strong>
                    {t("dasha.panel.auditSeedLord", { planet: planetName(audit.dasha_seed_lord, t) })}
                  </strong>
                  <small>
                    {t("dasha.panel.auditElapsed", {
                      elapsed: formatYears(audit.dasha_seed_elapsed_years, 2),
                      total: formatYears(audit.dasha_seed_total_years, 2),
                    })}
                  </small>
                  <small>
                    {t("dasha.panel.auditRemaining", { remaining: formatYears(audit.dasha_seed_remaining_years, 2) })}
                  </small>
                  <small>
                    {t("dasha.panel.auditWindow", {
                      start: formatAuditTimestamp(audit.dasha_seed_start_local_iso),
                      end: formatAuditTimestamp(audit.dasha_seed_end_local_iso),
                    })}
                  </small>
                </article>

                <article className="dasha-audit-card">
                  <span className="dasha-audit-label">{t("dasha.panel.auditTimingCheck")}</span>
                  <strong>{formatReaderTime(audit.reference_utc_iso)}</strong>
                  <small>{t("dasha.panel.auditTimingNote")}</small>
                  <small>UTC: {formatAuditTimestamp(audit.reference_utc_iso)} UTC</small>
                </article>
              </div>
            </>
          )}
        </section>
      )}

      <div className="nakshatra-grid">
        <article className="nakshatra-card">
          <h3>{t("dasha.nakshatra")}</h3>
          <p className="nakshatra-name">{nakshatraName(nakshatra.name, t)}</p>
          <div className="nakshatra-details">
            <span>
              <strong>{t("dasha.lord")}:</strong> {planetName(nakshatra.lord, t)}
            </span>
            <span>
              <strong>{t("dasha.pada")}:</strong> {nakshatra.pada}
            </span>
            <span>
              <strong>{t("dasha.degree")}:</strong> {nakshatra.degree_in_nakshatra.toFixed(2)}°
            </span>
          </div>
        </article>

        <article className="nakshatra-card">
          <h3>{t("dasha.currentPeriod")}</h3>
          <p className="nakshatra-period-label">
            {t("dasha.youAreIn")} <strong>{planetName(dasha.current_dasha, t)}</strong> {t("dasha.mahaDasha")}{" "}
            &rarr; <strong>{planetName(dasha.current_antardasha, t)}</strong> {t("dasha.antardasha")}
          </p>
          <div className="nakshatra-details">
            <span>
              <strong>{t("dasha.panel.dashaLabel")}:</strong> {dasha.current_dasha_start} &ndash;{" "}
              {dasha.current_dasha_end}
            </span>
            <span>
              <strong>{t("dasha.antardasha")}:</strong> {dasha.current_antardasha_start}{" "}
              &ndash; {dasha.current_antardasha_end}
            </span>
          </div>

          {currentPeriodCopy && (
            <div className="dasha-current-summary">
              <h4>{t("dasha.currentSummaryLabel")}</h4>
              <p>
                {currentPeriodCopy}
                {/* Quiet, and only while the template is what is showing: once
                    the reading has landed there is nothing still coming. */}
                {currentPeriodReading.state === "pending" && (
                  <span className="dasha-combo-pending"> {t("dasha.currentReadingPending")}</span>
                )}
              </p>
            </div>
          )}

          {(() => {
            const { remainingDays, progressPercent } = getAntardashaProgress();
            return (
              <div className="dasha-progress-section">
                <div className="dasha-progress-header">
                  <span className="dasha-progress-label">{t("dasha.periodProgress")}</span>
                  <span className="dasha-progress-remaining">
                    {t("dasha.daysRemaining", { days: String(remainingDays) })}
                  </span>
                </div>
                <div className="dasha-progress-track">
                  <div
                    className="dasha-progress-fill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            );
          })()}
        </article>
      </div>

      <div className="dasha-timeline-section" style={{ position: "relative" }}>
        <h3>{t("dasha.panel.timelineTitle")}</h3>
        <p className="dasha-timeline-hint">{t("dasha.panel.timelineHint")}</p>

        <div className="dasha-view-switcher" aria-label={t("dasha.panel.viewsAria")}>
          {(["timeline", "lens", "table"] as DashaViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`dasha-view-button${viewMode === mode ? " dasha-view-button--active" : ""}`}
              onClick={() => setViewMode(mode)}
            >
              {mode === "timeline"
                ? t("dasha.panel.viewTimeline")
                : mode === "lens"
                  ? t("dasha.panel.viewLens")
                  : t("dasha.panel.viewTable")}
            </button>
          ))}
        </div>

        {/* ── Breadcrumb Navigation ── */}
        {drillPath.length > 0 && (
          <nav className="dasha-breadcrumb anim-fade-in">
            {/* Named after where it lands, not just "back": five levels in,
                "Back" alone does not say how far. */}
            <button
              className="dasha-breadcrumb-back"
              onClick={handleStepBack}
              type="button"
              title={t("dasha.stepBackTo", { level: stepBackTarget })}
              aria-label={t("dasha.stepBackTo", { level: stepBackTarget })}
            >
              <span aria-hidden="true">&larr;</span>
              {t("dasha.stepBack")}
            </button>
            <span className="dasha-breadcrumb-divider" aria-hidden="true" />
            <button
              className="dasha-breadcrumb-item"
              onClick={() => handleBreadcrumbClick(-1)}
              type="button"
            >
              {t("dasha.mahaDasha")}
            </button>
            {drillPath.map((step, idx) => (
              <span key={`${step.planet}-${idx}`} className="dasha-breadcrumb-step">
                <span className="dasha-breadcrumb-arrow">&rsaquo;</span>
                <button
                  className={`dasha-breadcrumb-item${idx === drillPath.length - 1 ? " dasha-breadcrumb-item--active" : ""}`}
                  onClick={() => handleBreadcrumbClick(idx)}
                  type="button"
                  style={{ color: LEVEL_COLORS[step.level] }}
                >
                  {planetName(step.planet, t)}
                </button>
              </span>
            ))}
          </nav>
        )}

        {/* ── Combination Insight Card ── */}
        {combinationInsight && (
          <div className="dasha-combo-card anim-fade-in">
            <div className="dasha-combo-header">
              <span className="dasha-combo-label">{t("dasha.panel.combined")}</span>
              <div className="dasha-combo-lords">
                {combinationInsight.lords.map((lord, idx) => (
                  <span key={lord + idx} className="dasha-combo-lord-chip" style={{ backgroundColor: `color-mix(in srgb, ${dashaColor(lord)} 13%, transparent)`, color: dashaInk(lord), borderColor: `color-mix(in srgb, ${dashaColor(lord)} 27%, transparent)` }}>
                    {planetName(lord, t)}
                    {idx < combinationInsight.lords.length - 1 && <span className="dasha-combo-arrow">&rarr;</span>}
                  </span>
                ))}
              </div>
            </div>
            <p className="dasha-combo-effect">
              {combinationInsight.effect}
              {chainInsightLoading && !combinationInsight.generated && (
                <span className="dasha-combo-pending"> {t("dasha.panel.readingChain")}</span>
              )}
            </p>
            <div className="dasha-combo-themes">
              {combinationInsight.themes.map((theme, idx) => (
                <span key={theme} className="dasha-combo-theme-tag">
                  {planetName(combinationInsight.lords[idx], t)}:{" "}
                  {themeLabelFor(combinationInsight.lords[idx], t, "dasha.panel.themeActive")}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Level 1: Maha Dasha Gantt Timeline ── */}
        {viewMode === "timeline" && drillPath.length === 0 && (() => {
          /* Compute total span in days from first start → last end */
          const allStarts = dasha.periods.map((p) => new Date(p.start_date + "T00:00:00").getTime());
          const allEnds   = dasha.periods.map((p) => new Date(p.end_date   + "T00:00:00").getTime());
          const spanStart = Math.min(...allStarts);
          const spanEnd   = Math.max(...allEnds);
          const totalMs   = spanEnd - spanStart || 1;

          const todayMs   = new Date(now).setHours(0, 0, 0, 0);
          const todayPct  = Math.max(0, Math.min(100, ((todayMs - spanStart) / totalMs) * 100));
          const todayInSpan = todayMs >= spanStart && todayMs <= spanEnd;

          const activePeriod = dasha.periods.find((p) => p.planet === currentPlanet);
          const activeDaysRemaining = activePeriod
            ? Math.max(0, Math.ceil((new Date(activePeriod.end_date + "T00:00:00").getTime() - now) / 86_400_000))
            : null;

          return (
            <div className="dasha-level-section">
              <span className="dasha-level-label" style={{ color: LEVEL_COLORS[1] }}>
                {levelLabel(1)}
              </span>

              {/* ── Gantt track wrapper ── */}
              <div className="dasha-gantt-wrap">
                <div className="dasha-gantt-track">
                  {dasha.periods.map((period, index) => {
                    const pStart   = new Date(period.start_date + "T00:00:00").getTime();
                    const pEnd     = new Date(period.end_date   + "T00:00:00").getTime();
                    const leftPct  = ((pStart - spanStart) / totalMs) * 100;
                    const widthPct = ((pEnd   - pStart)   / totalMs) * 100;
                    const isCurrent = period.planet === currentPlanet;
                    const isActive  = popup?.planet === period.planet && popup?.level === 1;
                    const baseColor = dashaColor(period.planet);

                    return (
                      <div
                        key={`${period.planet}-${index}`}
                        className={`dasha-gantt-bar${isCurrent ? " dasha-gantt-bar--current" : ""}${isActive ? " dasha-bar--active" : ""}`}
                        style={{
                          left:  `${leftPct}%`,
                          width: `${widthPct}%`,
                          /*
                           * The colour, not the finished background. CSS builds the
                           * fill, the lit top edge and the current-period glow off
                           * this, which an inline backgroundColor cannot do -- and an
                           * inline background would win over those rules anyway.
                           */
                          "--dasha-color": baseColor,
                        } as CSSProperties}
                        title={t("dasha.panel.barTitle", {
                          planet: planetName(period.planet, t),
                          years: String(period.years),
                          start: period.start_date,
                          end: period.end_date,
                        })}
                        onClick={(e) => {
                          handleBarClick(
                            period.planet,
                            isCurrent,
                            period.start_date,
                            period.end_date,
                            1,
                            period.sequence_start_date,
                            period.sequence_end_date,
                            period.years,
                            e
                          );
                          handleDrillDown(
                            period.planet,
                            period.start_date,
                            period.end_date,
                            1,
                            [],
                            period.sequence_start_date,
                            period.sequence_end_date
                          );
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            handleBarClick(
                              period.planet,
                              isCurrent,
                              period.start_date,
                              period.end_date,
                              1,
                              period.sequence_start_date,
                              period.sequence_end_date,
                              period.years,
                              e as unknown as React.MouseEvent<HTMLDivElement>
                            );
                            handleDrillDown(
                              period.planet,
                              period.start_date,
                              period.end_date,
                              1,
                              [],
                              period.sequence_start_date,
                              period.sequence_end_date
                            );
                          }
                        }}
                      >
                        <span className="dasha-gantt-label">{planetName(period.planet, t)}</span>
                      </div>
                    );
                  })}

                  {/* ── TODAY needle ── */}
                  {todayInSpan && (
                    <div
                      className="dasha-gantt-needle"
                      style={{ left: `${todayPct}%` }}
                      title={t("dasha.panel.today")}
                    >
                      <span className="dasha-gantt-needle-label">
                        {t("dasha.panel.today").toLocaleUpperCase(LOCALE_TAGS[language])}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Active dasha detail card ── */}
              {activePeriod && (
                <div
                  className="dasha-active-card"
                  style={{ borderColor: `${dashaColor(activePeriod.planet)}44` }}
                >
                  <span
                    className="dasha-active-card-planet"
                    style={{ color: dashaInk(activePeriod.planet) }}
                  >
                    {planetName(activePeriod.planet, t)}
                  </span>
                  <span className="dasha-active-card-badge">{t("dasha.panel.activeMaha")}</span>
                  <div className="dasha-active-card-meta">
                    <span>{formatDate(activePeriod.start_date)} &ndash; {formatDate(activePeriod.end_date)}</span>
                    {activeDaysRemaining !== null && (
                      <span className="dasha-active-card-days">
                        {t("dasha.daysRemaining", { days: activeDaysRemaining.toLocaleString(LOCALE_TAGS[language]) })}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Sub-Period Drill-Down Levels ── */}
        {viewMode === "timeline" && currentSubPeriods && currentSubPeriods.length > 0 && (
          <div className="dasha-level-section anim-fade-in">
            <span className="dasha-level-label" style={{ color: LEVEL_COLORS[currentDrillLevel] || LEVEL_COLORS[5] }}>
              {levelLabel(currentDrillLevel)}
            </span>
            <div className="dasha-timeline">
              {currentSubPeriods.map((sub, index) => {
                const parentStart = drillPath[drillPath.length - 1].startDate;
                const parentEnd = drillPath[drillPath.length - 1].endDate;
                const parentDays = daysBetween(parentStart, parentEnd);
                const subDays = daysBetween(sub.start_date, sub.end_date);
                const widthPercent = parentDays > 0 ? (subDays / parentDays) * 100 : 11.1;
                const isCurrent = isCurrentPeriod(sub.start_date, sub.end_date);
                const isActive = popup?.planet === sub.planet && popup?.level === sub.level;
                const canDrillDeeper = sub.level < 5;

                return (
                  <div
                    key={`${sub.planet}-${index}`}
                    className={`dasha-bar dasha-bar--level-${sub.level}${isCurrent ? " dasha-bar--current" : ""}${isActive ? " dasha-bar--active" : ""}`}
                    style={{
                      width: `${widthPercent}%`,
                      borderColor: LEVEL_COLORS[sub.level] || LEVEL_COLORS[5],
                      /* Sub-periods were one flat teal for every lord, so a run of
                         nine of them said nothing about whose period it was. */
                      "--dasha-color": dashaColor(sub.planet),
                    } as CSSProperties}
                    title={`${planetName(sub.planet, t)}: ${formatDate(sub.start_date)} – ${formatDate(sub.end_date)}`}
                    onClick={(e) => {
                      handleBarClick(
                        sub.planet,
                        isCurrent,
                        sub.start_date,
                        sub.end_date,
                        sub.level,
                        sub.sequence_start_date,
                        sub.sequence_end_date,
                        undefined,
                        e
                      );
                      if (canDrillDeeper) {
                        handleDrillDown(
                          sub.planet,
                          sub.start_date,
                          sub.end_date,
                          sub.level,
                          sub.lords,
                          sub.sequence_start_date,
                          sub.sequence_end_date
                        );
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        handleBarClick(
                          sub.planet,
                          isCurrent,
                          sub.start_date,
                          sub.end_date,
                          sub.level,
                          sub.sequence_start_date,
                          sub.sequence_end_date,
                          undefined,
                          e as unknown as React.MouseEvent<HTMLDivElement>
                        );
                        if (canDrillDeeper) {
                          handleDrillDown(
                            sub.planet,
                            sub.start_date,
                            sub.end_date,
                            sub.level,
                            sub.lords,
                            sub.sequence_start_date,
                            sub.sequence_end_date
                          );
                        }
                      }
                    }}
                  >
                    <span className="dasha-label">{planetName(sub.planet, t)}</span>
                  </div>
                );
              })}
            </div>
            <div className="dasha-sub-dates">
              {currentSubPeriods.map((sub, index) => (
                <small key={`date-${index}`} className="dasha-sub-date-label">
                  {planetName(sub.planet, t)}: {formatDate(sub.start_date)} – {formatDate(sub.end_date)}
                </small>
              ))}
            </div>
          </div>
        )}

        {/* ── Loading Spinner ── */}
        {viewMode === "lens" && (
          <section className="dasha-lens-panel anim-fade-in">
            <div className="dasha-lens-header">
              <div>
                <span className="dasha-level-label" style={{ color: LEVEL_COLORS[displayLevel] || LEVEL_COLORS[5] }}>
                  {levelLabel(displayLevel)}
                </span>
                <h4>
                  {selectedParent
                    ? t("dasha.panel.lensSub", { planet: planetName(selectedParent.planet, t) })
                    : t("dasha.panel.lensMaha")}
                </h4>
              </div>
              {selectedParent && (
                <p>
                  {formatDate(selectedParent.startDate)} - {formatDate(selectedParent.endDate)}
                </p>
              )}
            </div>

            <div className="dasha-lens-grid">
              {visiblePeriods.map((period, index) => {
                const isCurrent = isCurrentPeriod(period.start_date, period.end_date);
                const color = dashaColor(period.planet);
                const theme = themeLabelFor(period.planet, t, "dasha.panel.themeSubPeriod");
                const duration = period.years
                  ? t("dasha.panel.durationYears", { count: formatYears(period.years, 2) })
                  : formatPeriodDuration(period.start_date, period.end_date);

                return (
                  <article
                    key={`${period.planet}-${period.start_date}-${index}`}
                    className={`dasha-lens-card${isCurrent ? " dasha-lens-card--current" : ""}`}
                    style={{ borderTopColor: color }}
                    role={period.level < 5 ? "button" : undefined}
                    tabIndex={period.level < 5 ? 0 : undefined}
                    onClick={() => {
                      if (period.level >= 5) return;
                      void handleDrillDown(
                        period.planet,
                        period.start_date,
                        period.end_date,
                        period.level,
                        period.lords ?? drillPath.map((step) => step.planet),
                        period.sequence_start_date,
                        period.sequence_end_date
                      );
                    }}
                    onKeyDown={(event) => {
                      if (period.level >= 5 || (event.key !== "Enter" && event.key !== " ")) return;
                      event.preventDefault();
                      void handleDrillDown(
                        period.planet,
                        period.start_date,
                        period.end_date,
                        period.level,
                        period.lords ?? drillPath.map((step) => step.planet),
                        period.sequence_start_date,
                        period.sequence_end_date
                      );
                    }}
                  >
                    <div className="dasha-lens-card-top">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      {isCurrent && <strong>{t("dasha.activeNow")}</strong>}
                    </div>
                    <h5 style={{ color }}>{planetName(period.planet, t)}</h5>
                    <p>{theme}</p>
                    <div className="dasha-subtle-details">
                      {getSubtlePeriodDetails(period).map((detail) => (
                        <small key={detail}>{detail}</small>
                      ))}
                    </div>
                    <small>{formatDate(period.start_date)} - {formatDate(period.end_date)}</small>
                    <small>{duration}</small>
                    {period.level < 5 && (
                      <small className="dasha-lens-drill">{t("dasha.panel.openBranch")}</small>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {viewMode === "table" && (
          <section className="dasha-table-panel anim-fade-in">
            <div className="dasha-table-header">
              <span className="dasha-level-label" style={{ color: LEVEL_COLORS[displayLevel] || LEVEL_COLORS[5] }}>
                {levelLabel(displayLevel)}
              </span>
              <p>
                {selectedParent
                  ? t("dasha.panel.tableSub", { planet: planetName(selectedParent.planet, t) })
                  : t("dasha.panel.tableMaha")}
              </p>
            </div>
            <div className="dasha-table-scroll">
              <table className="dasha-period-table">
                <thead>
                  <tr>
                    <th>{t("dasha.lord")}</th>
                    <th>{t("dasha.panel.colTheme")}</th>
                    <th>{t("dasha.panel.colStart")}</th>
                    <th>{t("dasha.panel.colEnd")}</th>
                    <th>{t("dasha.panel.colDuration")}</th>
                    <th>{t("dasha.panel.colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayPeriods.map((period, index) => {
                    const isCurrent = isCurrentPeriod(period.start_date, period.end_date);
                    const color = dashaInk(period.planet);
                    return (
                      <tr key={`${period.planet}-${period.start_date}-${index}`} className={isCurrent ? "dasha-period-row--current" : ""}>
                        <td>
                          <span className="dasha-period-planet" style={{ color }}>
                            {planetName(period.planet, t)}
                          </span>
                        </td>
                        <td>{DASHA_LORD_THEMES[period.planet]?.theme ?? "Timing influence"}</td>
                        <td>{formatDate(period.start_date)}</td>
                        <td>{formatDate(period.end_date)}</td>
                        <td>
                          {period.years
                            ? t("dasha.panel.durationYears", { count: formatYears(period.years, 2) })
                            : formatPeriodDuration(period.start_date, period.end_date)}
                        </td>
                        <td>{isCurrent ? t("dasha.activeNow") : t("dasha.panel.upcomingOrPast")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {loadingLevel !== null && (
          <div className="dasha-loading anim-fade-in">
            <span className="dasha-loading-spinner" />
            <span>
              {t("dasha.loading")}{" "}
              {LEVEL_LABEL_KEYS[loadingLevel] ? levelLabel(loadingLevel) : t("dasha.panel.subPeriods")}…
            </span>
          </div>
        )}

        {/* ── Interpretation Popup ── */}
        {popup && interpretation && (
          <div
            ref={popupRef}
            className="dasha-popup anim-fade-in"
            style={popup.position}
          >
            <button
              className="dasha-popup-close"
              onClick={() => setPopup(null)}
              type="button"
              aria-label={t("dasha.panel.close")}
            >
              &times;
            </button>

            <div className="dasha-popup-header">
              <span className="dasha-popup-planet">{planetName(popup.planet, t)}</span>
              <span className="dasha-popup-theme">{interpretation.theme}</span>
              {popup.isCurrent && <span className="dasha-popup-badge">{t("dasha.activeNow")}</span>}
            </div>

            <div className="dasha-popup-dates">
              <span className="dasha-popup-level-badge" style={{ color: LEVEL_COLORS[popup.level] || LEVEL_COLORS[5] }}>
                {levelLabel(popup.level)}
              </span>
              {" "}{formatDate(popup.startDate)} &ndash; {formatDate(popup.endDate)}
              {popup.years ? ` · ${popup.years} ${t("dasha.years")}` : ""}
            </div>

            <div className="dasha-popup-keywords">
              {interpretation.keywords.map((kw) => (
                <span key={kw} className="dasha-keyword-chip">{kw}</span>
              ))}
            </div>

            <p className="dasha-popup-text">{interpretation.general}</p>

            {interpretation.houseNote && interpretation.placement && (
              <div className="dasha-popup-house">
                <p className="dasha-popup-house-header">
                  {t("dasha.panel.placement", {
                    planet: planetName(popup.planet, t),
                    sign: signName(interpretation.placement.sign, t),
                    house: String(interpretation.placement.house),
                  })}
                </p>
                <p className="dasha-popup-house-text">{interpretation.houseNote}</p>
              </div>
            )}

            {popup.level < 5 && (
              <p className="dasha-popup-drill-hint">
                {t("dasha.drillDeeper", {
                  level: LEVEL_LABEL_KEYS[popup.level + 1]
                    ? levelLabel(popup.level + 1)
                    : t("dasha.panel.deeperSubPeriods"),
                })}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
