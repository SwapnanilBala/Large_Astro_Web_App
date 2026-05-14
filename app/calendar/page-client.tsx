"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiAlertTriangle, FiCalendar, FiClock, FiRefreshCw, FiStar } from "react-icons/fi";
import BackButton from "../components/BackButton";
import { useAuth } from "@/lib/auth-context";
import { buildBirthProfileApiUrl } from "@/lib/chart-query";
import type {
  CalendarPlannerDay,
  CalendarPlannerIntent,
  CalendarPlannerIntentAdvice,
  CalendarPlannerResponse,
  CalendarPlannerWindow,
  CalendarPlannerDashaContext,
  SavedChartRecord,
} from "@/lib/astro-types";
import type { ChartHistoryEntry } from "@/app/insights/components/chart-history-saver";
import { listSavedCharts } from "@/lib/workspace-store";
import styles from "./calendar.module.css";

type CalendarIntent = CalendarPlannerIntent | "all";

type ChartOption = {
  id: string;
  name: string;
  city: string;
  birthDate: string;
  ascendantSign: string;
  queryString: string;
  source: "workspace" | "recent";
};

const STORAGE_KEY = "astro_chart_history";
const RANGE_OPTIONS = [
  { label: "7 days", days: 7 },
  { label: "10 days", days: 10 },
  { label: "14 days", days: 14 },
] as const;

const INTENTS: Array<{ value: CalendarIntent; label: string; hint: string }> = [
  { value: "all", label: "All signals", hint: "Rank every daily theme" },
  { value: "action", label: "Action", hint: "Launches, decisions, momentum" },
  { value: "rest", label: "Rest", hint: "Recovery and lower-noise days" },
  { value: "communication", label: "Communication", hint: "Writing, calls, interviews" },
  { value: "relationships", label: "Relationships", hint: "Connection and harmony" },
  { value: "money", label: "Money", hint: "Investments, purchases, resources" },
  { value: "study", label: "Study", hint: "Learning and focused practice" },
  { value: "travel", label: "Travel", hint: "Movement and trip timing" },
];

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    ...options,
  }).format(new Date(`${value}T12:00:00`));
}

function formatWindowRange(window: CalendarPlannerWindow) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${formatter.format(new Date(window.start))} - ${formatter.format(new Date(window.end))}`;
}

function normalizeRecentCharts(): ChartOption[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const entries = JSON.parse(raw) as ChartHistoryEntry[];
    if (!Array.isArray(entries)) return [];

    return entries
      .filter((entry) => entry.queryString)
      .map((entry, index) => ({
        id: `recent-${entry.name}-${entry.birthDate}-${index}`,
        name: entry.name || "Recent chart",
        city: entry.city || "Unknown city",
        birthDate: entry.birthDate,
        ascendantSign: entry.ascendantSign,
        queryString: entry.queryString,
        source: "recent" as const,
      }));
  } catch {
    return [];
  }
}

function chartRecordToOption(chart: SavedChartRecord): ChartOption {
  return {
    id: chart.saved_chart_id,
    name: chart.name,
    city: chart.city || chart.town || "Unknown city",
    birthDate: chart.birth_date,
    ascendantSign: chart.ascendant_sign,
    queryString: chart.query_string,
    source: "workspace",
  };
}

function scoreTone(score: number) {
  if (score >= 82) return styles.scoreHigh;
  if (score >= 68) return styles.scoreMedium;
  return styles.scoreLow;
}

function watchoutClass(level: "low" | "medium" | "high") {
  if (level === "high") return styles.watchoutHigh;
  if (level === "medium") return styles.watchoutMedium;
  return styles.watchoutLow;
}

function formatWeekday(value: string) {
  return formatDate(value, { weekday: "short" }).split(",")[0] ?? "";
}

function getIntentLabel(intent: CalendarPlannerIntent) {
  return INTENTS.find((item) => item.value === intent)?.label ?? intent;
}

function getTopIntentAdvice(day: CalendarPlannerDay, selectedIntent: CalendarIntent) {
  const advice =
    selectedIntent === "all"
      ? [...day.intents].sort((left, right) => right.score - left.score)[0]
      : day.intents.find((item) => item.intent === selectedIntent);

  return advice ?? day.intents[0];
}

function getTopIntents(day: CalendarPlannerDay, selectedIntent: CalendarIntent, limit: number) {
  const items =
    selectedIntent === "all"
      ? day.intents
      : day.intents.filter((item) => item.intent === selectedIntent);

  return [...items].sort((left, right) => right.score - left.score).slice(0, limit);
}

function getDayScore(day: CalendarPlannerDay) {
  return Math.max(...day.intents.map((item) => item.score), 0);
}

function getBestWindow(day: CalendarPlannerDay, intent: CalendarPlannerIntent) {
  return [...day.muhurta_windows]
    .filter((window) => window.intent === intent)
    .sort((left, right) => right.score - left.score)[0];
}

function getWeekWatchoutCount(planner: CalendarPlannerResponse, week: CalendarPlannerDashaContext) {
  return planner.watchouts.filter(
    (watchout) => watchout.date >= week.week_start && watchout.date <= week.week_end
  ).length;
}

function buildPlannerSummary(planner: CalendarPlannerResponse, selectedIntent: CalendarIntent) {
  const rankedDays = planner.days
    .map((day) => ({
      day,
      advice: getTopIntentAdvice(day, selectedIntent),
    }))
    .filter((item): item is { day: CalendarPlannerDay; advice: CalendarPlannerIntentAdvice } =>
      Boolean(item.advice)
    )
    .sort((left, right) => right.advice.score - left.advice.score);

  const totals = new Map<CalendarPlannerIntent, { score: number; count: number }>();
  for (const day of planner.days) {
    for (const advice of day.intents) {
      const current = totals.get(advice.intent) ?? { score: 0, count: 0 };
      totals.set(advice.intent, {
        score: current.score + advice.score,
        count: current.count + 1,
      });
    }
  }

  const strongestIntent =
    [...totals.entries()]
      .sort((left, right) => right[1].score / right[1].count - left[1].score / left[1].count)[0]?.[0] ??
    "action";
  const best = rankedDays[0];

  return {
    bestOverallDate: best?.day.date ?? planner.search_window.start_date,
    bestOverallReason: best?.advice.summary ?? "No standout recommendation yet.",
    watchoutCount: planner.watchouts.length,
    strongestIntent,
  };
}

export default function CalendarPageClient() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [chartOptions, setChartOptions] = useState<ChartOption[]>([]);
  const [selectedChartId, setSelectedChartId] = useState("");
  const [startDate, setStartDate] = useState(() => localDateString());
  const [rangeDays, setRangeDays] = useState(7);
  const [intent, setIntent] = useState<CalendarIntent>("all");
  const [planner, setPlanner] = useState<CalendarPlannerResponse | null>(null);
  const [pageError, setPageError] = useState("");
  const [isFetchingPlanner, setIsFetchingPlanner] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const selectedChart = useMemo(
    () => chartOptions.find((chart) => chart.id === selectedChartId) ?? chartOptions[0],
    [chartOptions, selectedChartId]
  );
  const endDate = useMemo(() => addDays(startDate, rangeDays - 1), [rangeDays, startDate]);
  const selectedIntentLabel = INTENTS.find((item) => item.value === intent)?.label ?? "All signals";

  useEffect(() => {
    let isCancelled = false;

    const loadCharts = async () => {
      try {
        const recentCharts = normalizeRecentCharts();
        if (isAuthenticated && user) {
          const savedCharts = await listSavedCharts(user.user_id);
          if (isCancelled) return;

          const workspaceCharts = savedCharts.map(chartRecordToOption);
          const seen = new Set(workspaceCharts.map((chart) => chart.queryString));
          const uniqueRecent = recentCharts.filter((chart) => !seen.has(chart.queryString));
          const nextCharts = [...workspaceCharts, ...uniqueRecent];
          setChartOptions(nextCharts);
          setSelectedChartId((previous) => previous || nextCharts[0]?.id || "");
          return;
        }

        if (!isLoading) {
          setChartOptions(recentCharts);
          setSelectedChartId((previous) => previous || recentCharts[0]?.id || "");
        }
      } catch (error) {
        setPageError(error instanceof Error ? error.message : "Could not load saved charts.");
      }
    };

    void loadCharts();

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, isLoading, user]);

  const loadPlanner = useCallback(async () => {
    if (!selectedChart) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsFetchingPlanner(true);
    setPageError("");

    try {
      const url = buildBirthProfileApiUrl(
        "/api/calendar",
        window.location.origin,
        selectedChart.queryString,
        {
          start_date: startDate,
          end_date: endDate,
          intent: intent === "all" ? undefined : intent,
        }
      );
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? `Planner request failed (${response.status})`);
      }

      const data = (await response.json()) as CalendarPlannerResponse;
      setPlanner(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setPlanner(null);
      setPageError(error instanceof Error ? error.message : "Could not build the astro calendar.");
    } finally {
      setIsFetchingPlanner(false);
    }
  }, [endDate, intent, selectedChart, startDate]);

  useEffect(() => {
    if (!selectedChart) return;
    void loadPlanner();
  }, [loadPlanner, selectedChart]);

  const bestIntentDays = useMemo(() => {
    if (!planner) return [];
    return planner.days
      .flatMap((day) => {
        const advice = getTopIntentAdvice(day, intent);
        if (!advice) return [];
        const bestWindow = advice ? getBestWindow(day, advice.intent) : undefined;
        return [{ day, advice, bestWindow }];
      })
      .sort((left, right) => right.advice.score - left.advice.score)
      .slice(0, 3);
  }, [intent, planner]);

  const plannerSummary = useMemo(
    () => (planner ? buildPlannerSummary(planner, intent) : null),
    [intent, planner]
  );

  if (isLoading) {
    return (
      <main className="insights-shell">
        <BackButton href="/" />
        <section className="dashboard-shell">
          <p className="kicker">Astro Calendar</p>
          <h1>Loading your planner...</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="insights-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <BackButton href="/" />

      <section className="dashboard-shell">
        <div className={styles.heroHeader}>
          <div>
            <p className="kicker">Astro Calendar</p>
            <h1>Plan the next window with timing intelligence</h1>
            <p className="lead">
              Rank days for action, rest, communication, relationships, money, study, and travel
              while keeping dasha context and transit pressure in view.
            </p>
          </div>
          <span className={styles.heroIcon} aria-hidden="true">
            <FiCalendar />
          </span>
        </div>

        <section className={`rules-panel ${styles.controlPanel}`}>
          <div className={styles.controlGrid}>
            <label className={`${styles.field} input-glow-gold`}>
              Chart
              <select
                value={selectedChartId}
                onChange={(event) => {
                  setSelectedChartId(event.target.value);
                  setPlanner(null);
                }}
              >
                {chartOptions.map((chart) => (
                  <option key={chart.id} value={chart.id}>
                    {chart.name} - {chart.city} - {chart.ascendantSign || "Lagna"}
                  </option>
                ))}
              </select>
            </label>

            <label className={`${styles.field} input-glow-aqua`}>
              Start date
              <input
                type="date"
                value={startDate}
                min={localDateString()}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>

            <label className={`${styles.field} input-glow-coral`}>
              Range
              <select
                value={rangeDays}
                onChange={(event) => setRangeDays(Number(event.target.value))}
              >
                {RANGE_OPTIONS.map((option) => (
                  <option key={option.days} value={option.days}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.intentTabs} aria-label="Calendar intent">
            {INTENTS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={intent === item.value ? styles.intentTabActive : styles.intentTab}
                onClick={() => setIntent(item.value)}
                aria-pressed={intent === item.value}
              >
                <span>{item.label}</span>
                <small>{item.hint}</small>
              </button>
            ))}
          </div>

          <div className={styles.controlActions}>
            <button
              type="button"
              className="recalculate-btn"
              onClick={() => void loadPlanner()}
              disabled={!selectedChart || isFetchingPlanner}
            >
              <FiRefreshCw /> {isFetchingPlanner ? "Building planner..." : "Refresh planner"}
            </button>
            {selectedChart && (
              <Link href={`/insights?${selectedChart.queryString}`} className="ghost-link">
                Open source chart
              </Link>
            )}
          </div>
        </section>

        {chartOptions.length === 0 && (
          <section className={`rules-panel ${styles.emptyPanel}`}>
            <h2>No chart history yet</h2>
            <p className="section-intro">
              Generate a chart first, then come back here to turn it into a day-by-day planner.
            </p>
            <Link href="/" className="recalculate-btn">
              Create a chart
            </Link>
          </section>
        )}

        {pageError && <p className="error-note">{pageError}</p>}

        {planner && plannerSummary && (
          <>
            <div className={styles.summaryGrid}>
              <article className="metric-card">
                <h3>Best overall day</h3>
                <p>{formatDate(plannerSummary.bestOverallDate, { weekday: "short" })}</p>
                <small>{plannerSummary.bestOverallReason}</small>
              </article>
              <article className="metric-card">
                <h3>Watchout days</h3>
                <p>{plannerSummary.watchoutCount}</p>
                <small>Days with stronger pressure or difficult timing signals.</small>
              </article>
              <article className="metric-card">
                <h3>Strongest theme</h3>
                <p>{getIntentLabel(plannerSummary.strongestIntent)}</p>
                <small>{selectedIntentLabel} view for {planner.client.name}.</small>
              </article>
            </div>

            {bestIntentDays.length > 0 && (
              <section className={`rules-panel ${styles.bestDaysPanel}`}>
                <div className="rules-header">
                  <p className="kicker">Best Days</p>
                  <h2>{selectedIntentLabel} recommendations</h2>
                </div>
                <div className={styles.bestDayGrid}>
                  {bestIntentDays.map(({ day, advice, bestWindow }) => (
                    <article key={`${day.date}-${advice.intent}`} className={styles.bestDayCard}>
                      <div className={styles.bestDayTop}>
                        <span>
                          {formatWeekday(day.date)}, {formatDate(day.date)}
                        </span>
                        <strong className={scoreTone(advice.score)}>{advice.score}</strong>
                      </div>
                      <h3>{getIntentLabel(advice.intent)}</h3>
                      <p>{advice.summary}</p>
                      {bestWindow && (
                        <small>
                          <FiClock /> {formatWindowRange(bestWindow)}
                        </small>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}

            <section className={`rules-panel ${styles.weekPanel}`}>
              <div className="rules-header">
                <p className="kicker">Dasha Context</p>
                <h2>Weekly timing layer</h2>
              </div>
              <div className={styles.weekGrid}>
                {planner.weekly_dasha_context.map((week) => {
                  const weekWatchouts = getWeekWatchoutCount(planner, week);
                  return (
                  <article key={`${week.week_start}-${week.week_end}`} className={styles.weekCard}>
                    <span>
                      {formatDate(week.week_start)} - {formatDate(week.week_end)}
                    </span>
                    <h3>
                      {week.current_dasha} / {week.current_antardasha}
                    </h3>
                    <p>{week.summary}</p>
                    {weekWatchouts > 0 && (
                      <small>
                        <FiAlertTriangle /> {weekWatchouts} watchout day
                        {weekWatchouts === 1 ? "" : "s"}
                      </small>
                    )}
                  </article>
                  );
                })}
              </div>
            </section>

            <section className={`rules-panel ${styles.dayPanel}`}>
              <div className="rules-header">
                <p className="kicker">Daily Map</p>
                <h2>{formatDate(planner.search_window.start_date)} to {formatDate(planner.search_window.end_date)}</h2>
              </div>
              <div className={styles.dayGrid}>
                {planner.days.map((day) => (
                  <article key={day.date} className={styles.dayCard}>
                    <div className={styles.dayHeader}>
                      <div>
                        <span>{formatWeekday(day.date)}</span>
                        <h3>{formatDate(day.date, { month: "long" })}</h3>
                      </div>
                      <strong className={scoreTone(getDayScore(day))}>{getDayScore(day)}</strong>
                    </div>
                    <p>{day.headline}</p>
                    <div className={styles.intentList}>
                      {getTopIntents(day, intent, intent === "all" ? 3 : 1).map((item) => (
                        <span key={item.intent}>
                          <FiStar /> {getIntentLabel(item.intent)} {item.score}
                        </span>
                      ))}
                    </div>
                    <div className={`${styles.watchout} ${watchoutClass(day.watchout?.severity ?? day.dasha.pressure)}`}>
                      <FiAlertTriangle />
                      <span>
                        {day.watchout
                          ? day.watchout.reasons.join("; ")
                          : "No major pressure marker. Keep the day steady and intentional."}
                      </span>
                    </div>
                    <div className={styles.dashaLine}>
                      {day.dasha.current_dasha} / {day.dasha.current_antardasha}
                    </div>
                    {day.muhurta_windows.length > 0 && (
                      <div className={styles.windowList}>
                        {day.muhurta_windows.slice(0, 2).map((window) => (
                          <span key={`${window.intent}-${window.start}`}>
                            {window.intent}: {formatWindowRange(window)}
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
