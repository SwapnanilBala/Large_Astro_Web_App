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

  /* Fetch sub-periods from backend */
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
        const baseUrl = process.env.NEXT_PUBLIC_ASTRO_API_BASE_URL ?? "http://127.0.0.1:8000";
        const url = new URL("/api/v1/chart/dasha-subperiods", baseUrl);
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

  const interpretation = popup ? getInterpretation(popup.planet) : null;
  const currentSubPeriods = getCurrentSubPeriods();
  const currentDrillLevel = drillPath.length > 0 ? drillPath[drillPath.length - 1].level + 1 : 1;

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

        {/* ── Level 1: Maha Dasha Timeline ── */}
        {drillPath.length === 0 && (
          <div className="dasha-level-section">
            <span className="dasha-level-label" style={{ color: LEVEL_COLORS[1] }}>
              {LEVEL_LABELS[1]}
            </span>
            <div className="dasha-timeline">
              {dasha.periods.map((period, index) => {
                const widthPercent = (period.years / 120) * 100;
                const isCurrent = period.planet === currentPlanet;
                const isActive = popup?.planet === period.planet && popup?.level === 1;

                return (
                  <div
                    key={`${period.planet}-${index}`}
                    className={`dasha-bar${isCurrent ? " dasha-bar--current" : ""}${isActive ? " dasha-bar--active" : ""}`}
                    style={{ width: `${widthPercent}%` }}
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
                    <span className="dasha-label">{period.planet}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
