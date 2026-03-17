"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type {
  CalculationAuditInfo,
  NakshatraInfo,
  DashaInfo,
  PlanetPosition,
  SubPeriodInfo,
} from "@/lib/astro-types";
import { useTranslation } from "@/lib/i18n-context";

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
   Planet color palette for the Gantt timeline
   ──────────────────────────────────────────────── */
const DASHA_COLORS: Record<string, string> = {
  Sun:     '#f5a623',
  Moon:    '#a8d8ea',
  Mars:    '#e74c3c',
  Rahu:    '#8e44ad',
  Jupiter: '#f1c40f',
  Saturn:  '#7f8c8d',
  Mercury: '#2ecc71',
  Ketu:    '#e67e22',
  Venus:   '#e91e8c',
};

const LEVEL_LABELS: Record<number, string> = {
  1: "Maha Dasha",
  2: "Antardasha",
  3: "Pratyantardasha",
  4: "Sookshma Dasha",
  5: "Prana Dasha",
};

const LEVEL_COLORS: Record<number, string> = {
  1: "var(--accent-gold)",
  2: "var(--accent-aqua)",
  3: "var(--accent-coral)",
  4: "#c490e4",
  5: "#8bb8f0",
};

const AUDIT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type DrillStep = {
  level: number;
  planet: string;
  startDate: string;
  endDate: string;
  sequenceStartDate?: string;
  sequenceEndDate?: string;
};

type PopupData = {
  planet: string;
  isCurrent: boolean;
  rect: DOMRect;
  level: number;
  startDate: string;
  endDate: string;
  sequenceStartDate?: string;
  sequenceEndDate?: string;
  years?: number;
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
  const { t } = useTranslation();
  const currentPlanet = dasha.current_dasha;
  const [showAudit, setShowAudit] = useState(true);
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [drillPath, setDrillPath] = useState<DrillStep[]>([]);
  const [subPeriodCache, setSubPeriodCache] = useState<Record<string, SubPeriodInfo[]>>({});
  const [loadingLevel, setLoadingLevel] = useState<number | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

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
      setPopup(null);
    }
  };

  /* Handle breadcrumb navigation */
  const handleBreadcrumbClick = (index: number) => {
    if (index < 0) {
      setDrillPath([]);
    } else {
      setDrillPath((prev) => prev.slice(0, index + 1));
    }
    setPopup(null);
  };

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
    setPopup({
      planet,
      isCurrent,
      rect: barRect,
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

  /* Compute popup position relative to the timeline container */
  const getPopupStyle = (): React.CSSProperties => {
    if (!popup || !timelineRef.current) return {};
    const containerRect = timelineRef.current.getBoundingClientRect();
    const barCenter = popup.rect.left + popup.rect.width / 2 - containerRect.left;
    const clampedLeft = Math.max(0, Math.min(barCenter - 180, containerRect.width - 360));

    return {
      left: `${clampedLeft}px`,
      top: `${popup.rect.bottom - containerRect.top + 10}px`,
    };
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
    const today = new Date().toISOString().split("T")[0];
    return startDate <= today && today <= endDate;
  };

  /* Compute days between two date strings */
  const daysBetween = (start: string, end: string) => {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    return ms / (1000 * 60 * 60 * 24);
  };

  /* Format date for display */
  const formatDate = (dateStr: string) => {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatAuditTimestamp = (value: string) => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return value.replace("T", " ");

    const [, year, month, day, hour, minute] = match;
    const numericHour = Number(hour);
    const suffix = numericHour >= 12 ? "PM" : "AM";
    const twelveHour = numericHour % 12 || 12;

    return `${AUDIT_MONTHS[Number(month) - 1]} ${Number(day)}, ${year}, ${twelveHour}:${minute} ${suffix}`;
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
    const today = new Date();
    const start = new Date(dasha.current_antardasha_start + "T00:00:00");
    const end = new Date(dasha.current_antardasha_end + "T00:00:00");
    const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const elapsedDays = (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const remainingDays = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    const progressPercent = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
    return { remainingDays, progressPercent };
  };

  /* Build combination insight from the current drill path */
  const getCombinationInsight = (): { lords: string[]; effect: string; themes: string[] } | null => {
    if (drillPath.length === 0) return null;

    const lords = drillPath.map((step) => step.planet);
    const themes = lords
      .map((lord) => DASHA_LORD_THEMES[lord]?.theme)
      .filter(Boolean) as string[];

    /* Use the deepest two lords for the combination effect */
    const mahaLord = lords[0];
    const deepestLord = lords[lords.length - 1];
    const comboKey = `${mahaLord}-${deepestLord}`;
    const effect = DASHA_COMBO_EFFECTS[comboKey]
      ?? `${DASHA_LORD_THEMES[mahaLord]?.theme ?? mahaLord} energy is filtered through ${DASHA_LORD_THEMES[deepestLord]?.theme ?? deepestLord} at the ${LEVEL_LABELS[drillPath.length + 1] ?? "sub-period"} level.`;

    return { lords, effect, themes };
  };

  const interpretation = popup ? getInterpretation(popup.planet) : null;
  const currentSubPeriods = getCurrentSubPeriods();
  const currentDrillLevel = drillPath.length > 0 ? drillPath[drillPath.length - 1].level + 1 : 1;
  const combinationInsight = getCombinationInsight();

  return (
    <section className="nakshatra-panel">
      <div className="rules-header">
        <p className="kicker">{t("dasha.kicker")}</p>
        <h2>{t("dasha.heading")}</h2>
      </div>

      {audit && (
        <section className="dasha-audit">
          <div className="dasha-audit-header">
            <div>
              <p className="dasha-audit-kicker">Calculation audit</p>
              <h3>See the exact inputs behind this timing result</h3>
            </div>
            <button
              className="dasha-audit-toggle"
              type="button"
              onClick={() => setShowAudit((previous) => !previous)}
            >
              {showAudit ? "Hide audit" : "Show audit"}
            </button>
          </div>

          {showAudit && (
            <>
              <p className="dasha-audit-note">
                If a dasha result looks off, compare this box with the chart source you expected before
                changing the interpretation.
              </p>
              <div className="dasha-audit-grid">
                <article className="dasha-audit-card">
                  <span className="dasha-audit-label">Engine</span>
                  <strong>{audit.engine_label}</strong>
                  <small>{audit.ayanamsha} / {audit.house_system}</small>
                </article>

                <article className="dasha-audit-card">
                  <span className="dasha-audit-label">Birth Time Used</span>
                  <strong>{formatAuditTimestamp(audit.birth_local_iso)}</strong>
                  <small>
                    {audit.time_zone_id ? `${audit.time_zone_id} / ` : ""}
                    {formatUtcOffset(audit.timezone_offset_minutes)}
                  </small>
                  <small>UTC: {formatAuditTimestamp(audit.birth_utc_iso)} UTC</small>
                </article>

                <article className="dasha-audit-card">
                  <span className="dasha-audit-label">Coordinates</span>
                  <strong>
                    {audit.latitude.toFixed(4)}, {audit.longitude.toFixed(4)}
                  </strong>
                  <small>Latitude and longitude used for this chart</small>
                </article>

                <article className="dasha-audit-card">
                  <span className="dasha-audit-label">Moon Position</span>
                  <strong>
                    {audit.moon_sign} {audit.moon_degree_in_sign.toFixed(4)} deg
                  </strong>
                  <small>Sidereal longitude {audit.moon_sidereal_longitude.toFixed(4)} deg</small>
                </article>

                <article className="dasha-audit-card">
                  <span className="dasha-audit-label">Nakshatra Seed</span>
                  <strong>
                    {audit.nakshatra_name} / {audit.nakshatra_lord} / Pada {audit.nakshatra_pada}
                  </strong>
                  <small>{audit.degree_in_nakshatra.toFixed(4)} deg into the nakshatra</small>
                  <small>{audit.nakshatra_progress_percent.toFixed(2)}% complete at birth</small>
                </article>

                <article className="dasha-audit-card">
                  <span className="dasha-audit-label">Birth Dasha Seed</span>
                  <strong>{audit.dasha_seed_lord} Mahadasha</strong>
                  <small>
                    Elapsed at birth: {audit.dasha_seed_elapsed_years.toFixed(2)} /{" "}
                    {audit.dasha_seed_total_years.toFixed(2)} years
                  </small>
                  <small>
                    Remaining at birth: {audit.dasha_seed_remaining_years.toFixed(2)} years
                  </small>
                  <small>
                    Window: {formatAuditTimestamp(audit.dasha_seed_start_local_iso)} to{" "}
                    {formatAuditTimestamp(audit.dasha_seed_end_local_iso)} local
                  </small>
                </article>

                <article className="dasha-audit-card">
                  <span className="dasha-audit-label">Timing Check</span>
                  <strong>{formatAuditTimestamp(audit.reference_local_iso)}</strong>
                  <small>Current period lookup time used by this chart</small>
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
          <p className="nakshatra-name">{nakshatra.name}</p>
          <div className="nakshatra-details">
            <span>
              <strong>{t("dasha.lord")}:</strong> {nakshatra.lord}
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
            {t("dasha.youAreIn")} <strong>{dasha.current_dasha}</strong> {t("dasha.mahaDasha")}{" "}
            &rarr; <strong>{dasha.current_antardasha}</strong> {t("dasha.antardasha")}
          </p>
          <div className="nakshatra-details">
            <span>
              <strong>Dasha:</strong> {dasha.current_dasha_start} &ndash;{" "}
              {dasha.current_dasha_end}
            </span>
            <span>
              <strong>Antardasha:</strong> {dasha.current_antardasha_start}{" "}
              &ndash; {dasha.current_antardasha_end}
            </span>
          </div>

          {getCurrentPeriodSummary() && (
            <div className="dasha-current-summary">
              <h4>{t("dasha.currentSummaryLabel")}</h4>
              <p>{getCurrentPeriodSummary()}</p>
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

      <div className="dasha-timeline-section" ref={timelineRef} style={{ position: "relative" }}>
        <h3>{t("dasha.timeline")}</h3>
        <p className="dasha-timeline-hint">{t("dasha.drillHint")}</p>

        {/* ── Breadcrumb Navigation ── */}
        {drillPath.length > 0 && (
          <nav className="dasha-breadcrumb anim-fade-in">
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
                  {step.planet}
                </button>
              </span>
            ))}
          </nav>
        )}

        {/* ── Combination Insight Card ── */}
        {combinationInsight && (
          <div className="dasha-combo-card anim-fade-in">
            <div className="dasha-combo-header">
              <span className="dasha-combo-label">Combined Influence</span>
              <div className="dasha-combo-lords">
                {combinationInsight.lords.map((lord, idx) => (
                  <span key={lord + idx} className="dasha-combo-lord-chip" style={{ backgroundColor: `${DASHA_COLORS[lord] ?? '#6ce1d4'}22`, color: DASHA_COLORS[lord] ?? '#6ce1d4', borderColor: `${DASHA_COLORS[lord] ?? '#6ce1d4'}44` }}>
                    {lord}
                    {idx < combinationInsight.lords.length - 1 && <span className="dasha-combo-arrow">&rarr;</span>}
                  </span>
                ))}
              </div>
            </div>
            <p className="dasha-combo-effect">{combinationInsight.effect}</p>
            <div className="dasha-combo-themes">
              {combinationInsight.themes.map((theme, idx) => (
                <span key={theme} className="dasha-combo-theme-tag">
                  {combinationInsight.lords[idx]}: {theme}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Level 1: Maha Dasha Gantt Timeline ── */}
        {drillPath.length === 0 && (() => {
          /* Compute total span in days from first start → last end */
          const allStarts = dasha.periods.map((p) => new Date(p.start_date + "T00:00:00").getTime());
          const allEnds   = dasha.periods.map((p) => new Date(p.end_date   + "T00:00:00").getTime());
          const spanStart = Math.min(...allStarts);
          const spanEnd   = Math.max(...allEnds);
          const totalMs   = spanEnd - spanStart || 1;

          const todayMs   = new Date().setHours(0, 0, 0, 0);
          const todayPct  = Math.max(0, Math.min(100, ((todayMs - spanStart) / totalMs) * 100));
          const todayInSpan = todayMs >= spanStart && todayMs <= spanEnd;

          const activePeriod = dasha.periods.find((p) => p.planet === currentPlanet);
          const activeDaysRemaining = activePeriod
            ? Math.max(0, Math.ceil((new Date(activePeriod.end_date + "T00:00:00").getTime() - Date.now()) / 86_400_000))
            : null;

          return (
            <div className="dasha-level-section">
              <span className="dasha-level-label" style={{ color: LEVEL_COLORS[1] }}>
                {LEVEL_LABELS[1]}
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
                    const baseColor = DASHA_COLORS[period.planet] ?? '#6ce1d4';

                    return (
                      <div
                        key={`${period.planet}-${index}`}
                        className={`dasha-gantt-bar${isCurrent ? " dasha-gantt-bar--current" : ""}${isActive ? " dasha-bar--active" : ""}`}
                        style={{
                          left:  `${leftPct}%`,
                          width: `${widthPct}%`,
                          backgroundColor: baseColor,
                          boxShadow: isCurrent
                            ? `0 0 12px 3px ${baseColor}88, inset 0 0 8px ${baseColor}44`
                            : undefined,
                        }}
                        title={`${period.planet}: ${period.years} years (${period.start_date} – ${period.end_date})`}
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
                        <span className="dasha-gantt-label">{period.planet}</span>
                      </div>
                    );
                  })}

                  {/* ── TODAY needle ── */}
                  {todayInSpan && (
                    <div
                      className="dasha-gantt-needle"
                      style={{ left: `${todayPct}%` }}
                      title="Today"
                    >
                      <span className="dasha-gantt-needle-label">TODAY</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Active dasha detail card ── */}
              {activePeriod && (
                <div
                  className="dasha-active-card"
                  style={{ borderColor: `${DASHA_COLORS[activePeriod.planet] ?? '#6ce1d4'}44` }}
                >
                  <span
                    className="dasha-active-card-planet"
                    style={{ color: DASHA_COLORS[activePeriod.planet] ?? '#6ce1d4' }}
                  >
                    {activePeriod.planet}
                  </span>
                  <span className="dasha-active-card-badge">Active Maha Dasha</span>
                  <div className="dasha-active-card-meta">
                    <span>{formatDate(activePeriod.start_date)} &ndash; {formatDate(activePeriod.end_date)}</span>
                    {activeDaysRemaining !== null && (
                      <span className="dasha-active-card-days">{activeDaysRemaining.toLocaleString()} days remaining</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Sub-Period Drill-Down Levels ── */}
        {currentSubPeriods && currentSubPeriods.length > 0 && (
          <div className="dasha-level-section anim-fade-in">
            <span className="dasha-level-label" style={{ color: LEVEL_COLORS[currentDrillLevel] || LEVEL_COLORS[5] }}>
              {LEVEL_LABELS[currentDrillLevel] || `Level ${currentDrillLevel}`}
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
                    }}
                    title={`${sub.planet}: ${formatDate(sub.start_date)} – ${formatDate(sub.end_date)}`}
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
                    <span className="dasha-label">{sub.planet}</span>
                  </div>
                );
              })}
            </div>
            <div className="dasha-sub-dates">
              {currentSubPeriods.map((sub, index) => (
                <small key={`date-${index}`} className="dasha-sub-date-label">
                  {sub.planet}: {formatDate(sub.start_date)} – {formatDate(sub.end_date)}
                </small>
              ))}
            </div>
          </div>
        )}

        {/* ── Loading Spinner ── */}
        {loadingLevel !== null && (
          <div className="dasha-loading anim-fade-in">
            <span className="dasha-loading-spinner" />
            <span>{t("dasha.loading")} {LEVEL_LABELS[loadingLevel] || "sub-periods"}…</span>
          </div>
        )}

        {/* ── Interpretation Popup ── */}
        {popup && interpretation && (
          <div
            ref={popupRef}
            className="dasha-popup anim-fade-in"
            style={getPopupStyle()}
          >
            <button
              className="dasha-popup-close"
              onClick={() => setPopup(null)}
              type="button"
              aria-label="Close"
            >
              &times;
            </button>

            <div className="dasha-popup-header">
              <span className="dasha-popup-planet">{popup.planet}</span>
              <span className="dasha-popup-theme">{interpretation.theme}</span>
              {popup.isCurrent && <span className="dasha-popup-badge">{t("dasha.activeNow")}</span>}
            </div>

            <div className="dasha-popup-dates">
              <span className="dasha-popup-level-badge" style={{ color: LEVEL_COLORS[popup.level] || LEVEL_COLORS[5] }}>
                {LEVEL_LABELS[popup.level] || `Level ${popup.level}`}
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
                  {popup.planet} in {interpretation.placement.sign} (House {interpretation.placement.house})
                </p>
                <p className="dasha-popup-house-text">{interpretation.houseNote}</p>
              </div>
            )}

            {popup.level < 5 && (
              <p className="dasha-popup-drill-hint">
                {t("dasha.drillDeeper", { level: LEVEL_LABELS[popup.level + 1] || "deeper sub-periods" })}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
