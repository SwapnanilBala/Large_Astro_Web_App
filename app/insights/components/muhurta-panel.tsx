"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  appendChartApiSearchParams,
  appendProfileLocationApiSearchParams,
  parseProfileQueryString,
} from "@/lib/chart-query";
import styles from "./muhurta-panel.module.css";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface MuhurtaFactor {
  name: string;
  value: string;
  quality: string;
  score: number;
}

interface MuhurtaWindow {
  start: string;
  end: string;
  score: number;
  quality: "excellent" | "good" | "fair" | "poor";
  factors: MuhurtaFactor[];
  recommendation: string;
}

interface AvoidPeriod {
  date: string;
  rahukaala: { start: string; end: string };
  yamaghantaka: { start: string; end: string };
}

interface MuhurtaResponse {
  activity: string;
  activity_label: string;
  search_window: { start_date: string; end_date: string };
  timezone_offset_minutes: number;
  windows: MuhurtaWindow[];
  avoid_periods: AvoidPeriod[];
  computed_at_utc: string;
}

type MuhurtaPanelProps = {
  queryString: string;
};

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const ACTIVITIES = [
  { value: "general_auspicious", label: "General Auspicious" },
  { value: "marriage", label: "Marriage / Ceremony" },
  { value: "business_start", label: "Business Launch" },
  { value: "travel", label: "Travel / Journey" },
  { value: "education", label: "Education / Study" },
  { value: "property_purchase", label: "Property / Real Estate" },
  { value: "medical_procedure", label: "Medical / Surgery" },
  { value: "job_interview", label: "Job Interview" },
  { value: "investment", label: "Financial Investment" },
  { value: "spiritual_practice", label: "Spiritual Practice" },
];

const TIMEOUT_MS = 60_000;
const MAX_RANGE_DAYS = 30;
const PRESETS = [
  { label: "3 Days", days: 3 },
  { label: "7 Days", days: 7 },
  { label: "14 Days", days: 14 },
  { label: "30 Days", days: 30 },
] as const;
const MIN_SCORE_FLOOR = 60;
const MIN_SCORE_CEIL = 95;
const STORAGE_KEY = "muhurta-prefs-v1";

interface StoredPrefs {
  activity?: string;
  preset?: number;
  minScore?: number;
  daytimeOnly?: boolean;
}

function isDaytime(isoStr: string): boolean {
  const h = new Date(isoStr).getHours();
  return h >= 6 && h < 18;
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function todayStr(): string {
  return new Date().toISOString().split("T")[0] ?? "";
}

function futureStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0] ?? "";
}

function maxEndStr(start: string): string {
  const d = new Date(start);
  d.setDate(d.getDate() + MAX_RANGE_DAYS);
  return d.toISOString().split("T")[0] ?? "";
}

function formatWindowTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatWindowDate(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function qualityColor(quality: MuhurtaWindow["quality"]): string {
  switch (quality) {
    case "excellent": return "#1a7b6e";
    case "good": return "#C89B3C";
    case "fair": return "#b9a98a";
    case "poor": return "#F07068";
    default: return "#b9a98a";
  }
}

const DIAL_RADIUS = 20;
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS;

function ScoreDial({ score, quality }: { score: number; quality: MuhurtaWindow["quality"] }) {
  const color = qualityColor(quality);
  const offset = DIAL_CIRCUMFERENCE * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <div
      className={styles.scoreDial}
      role="img"
      aria-label={`Score ${score} out of 100, ${quality}`}
    >
      <svg viewBox="0 0 48 48" width="52" height="52" aria-hidden="true">
        <circle className={styles.dialTrack} cx="24" cy="24" r={DIAL_RADIUS} />
        <circle
          className={styles.dialValue}
          cx="24"
          cy="24"
          r={DIAL_RADIUS}
          style={{
            stroke: color,
            strokeDasharray: DIAL_CIRCUMFERENCE,
            strokeDashoffset: offset,
          }}
          transform="rotate(-90 24 24)"
        />
        <text className={styles.dialText} x="24" y="24" style={{ fill: color }}>
          {score}
        </text>
      </svg>
      <span className={styles.dialQuality} style={{ color }}>
        {quality}
      </span>
    </div>
  );
}

function factorClass(score: number): string {
  if (score > 0) return styles.factorPositive;
  if (score < 0) return styles.factorNegative;
  return styles.factorChip;
}

function factorSign(score: number): string {
  if (score > 0) return "▲";
  if (score < 0) return "▼";
  return "•";
}

function formatScore(score: number): string {
  if (score > 0) return `+${score}`;
  return String(score);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatTzOffset(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes === 0) return "UTC";
  const sign = minutes > 0 ? "+" : "−";
  const abs = Math.abs(minutes);
  return `UTC${sign}${Math.floor(abs / 60)}:${pad2(abs % 60)}`;
}

function buildLocationLabel(queryString: string): string {
  const profile = parseProfileQueryString(queryString);
  const place = [profile.town || profile.city, profile.country]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(", ");
  const tz = formatTzOffset(Number(profile.timezoneOffsetMinutes || "0"));
  const where = place || "your saved location";
  return `Times shown for ${where} · ${tz}`;
}

/** Floating (wall-clock) ICS stamp matching the times shown in the UI. */
function icsLocalStamp(d: Date): string {
  return (
    `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}${pad2(d.getMinutes())}00`
  );
}

function icsUtcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
  );
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function buildIcs(w: MuhurtaWindow, activityLabel: string): string {
  const start = new Date(w.start);
  const end = new Date(w.end);
  const uid = `muhurta-${start.getTime()}-${Math.round(w.score)}@astro-insights`;
  const summary = `Auspicious window — ${activityLabel} (${w.score}/100 ${w.quality})`;
  const description = `${w.recommendation}\n\n${w.factors
    .map((f) => `${f.name}: ${f.value} — ${f.quality}`)
    .join("\n")}`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Astro Insights//Muhurta//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${icsUtcStamp(new Date())}`,
    `DTSTART:${icsLocalStamp(start)}`,
    `DTEND:${icsLocalStamp(end)}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function downloadIcs(w: MuhurtaWindow, activityLabel: string): void {
  const blob = new Blob([buildIcs(w, activityLabel)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `muhurta-${activityLabel.toLowerCase().replace(/\s+/g, "-")}-${w.start.slice(0, 10)}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

interface DayGroup {
  label: string;
  sortTs: number;
  windows: MuhurtaWindow[];
}

function groupWindowsByDay(windows: MuhurtaWindow[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const w of windows) {
    const label = formatWindowDate(w.start);
    const ts = new Date(w.start).getTime();
    const existing = groups.get(label);
    if (existing) {
      existing.windows.push(w);
      existing.sortTs = Math.min(existing.sortTs, ts);
    } else {
      groups.set(label, { label, sortTs: ts, windows: [w] });
    }
  }
  const ordered = [...groups.values()].sort((a, b) => a.sortTs - b.sortTs);
  for (const g of ordered) {
    g.windows.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }
  return ordered;
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

export default function MuhurtaPanel({ queryString }: MuhurtaPanelProps) {
  const [activity, setActivity] = useState("general_auspicious");
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(() => futureStr(7));
  const [activePreset, setActivePreset] = useState<number>(7);
  const [result, setResult] = useState<MuhurtaResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [minScore, setMinScore] = useState(MIN_SCORE_FLOOR);
  const [daytimeOnly, setDaytimeOnly] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const copyWindow = useCallback(
    async (w: MuhurtaWindow, key: string, activityLabel: string) => {
      const text = [
        `${activityLabel} — ${formatWindowDate(w.start)}`,
        `${formatWindowTime(w.start)}–${formatWindowTime(w.end)} · ${w.score}/100 (${w.quality})`,
        "",
        ...w.factors.map(
          (f) => `${f.name}: ${f.value} — ${f.quality} (${formatScore(f.score)})`,
        ),
        "",
        w.recommendation,
      ].join("\n");
      try {
        await navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
      } catch {
        /* clipboard unavailable — silently ignore */
      }
    },
    [],
  );

  const handlePreset = (days: number) => {
    setStartDate(todayStr());
    setEndDate(futureStr(days));
    setActivePreset(days);
  };

  const handleStartChange = (val: string) => {
    setStartDate(val);
    setActivePreset(0);
    const max = maxEndStr(val);
    if (endDate > max) setEndDate(max);
  };

  const handleEndChange = (val: string) => {
    setEndDate(val);
    setActivePreset(0);
  };

  const search = useCallback(async () => {
    if (!startDate || !endDate) return;

    abortRef.current?.abort();
    setIsLoading(true);
    setError("");

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const url = new URL("/api/muhurta", window.location.origin);
      appendChartApiSearchParams(url.searchParams, {
        activity,
        start_date: startDate,
        end_date: endDate,
      });
      appendProfileLocationApiSearchParams(url.searchParams, queryString);

      const response = await fetch(url.toString(), { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? `API error (${response.status})`);
      }

      const data = (await response.json()) as MuhurtaResponse;
      setResult(data);
      setResultsOpen(true);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      setResult(null);

      if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
        setError(
          `Request timed out after ${Math.round(TIMEOUT_MS / 1000)} seconds. The server may be busy.`
        );
      } else {
        setError(
          fetchError instanceof Error ? fetchError.message : "Could not find auspicious times."
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [activity, startDate, endDate, queryString]);

  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as StoredPrefs;
      if (p.activity && ACTIVITIES.some((a) => a.value === p.activity)) {
        setActivity(p.activity);
      }
      if (typeof p.minScore === "number") {
        setMinScore(
          Math.min(MIN_SCORE_CEIL, Math.max(MIN_SCORE_FLOOR, p.minScore)),
        );
      }
      if (typeof p.daytimeOnly === "boolean") setDaytimeOnly(p.daytimeOnly);
      if (p.preset && PRESETS.some((pr) => pr.days === p.preset)) {
        setStartDate(todayStr());
        setEndDate(futureStr(p.preset));
        setActivePreset(p.preset);
      }
    } catch {
      /* ignore unreadable prefs */
    }
  }, []);

  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    try {
      const prefs: StoredPrefs = {
        activity,
        preset: activePreset,
        minScore,
        daytimeOnly,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* storage unavailable — ignore */
    }
  }, [activity, activePreset, minScore, daytimeOnly]);

  const visibleWindows =
    result?.windows.filter(
      (w) => w.score >= minScore && (!daytimeOnly || isDaytime(w.start)),
    ) ?? [];

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <p className={styles.kicker}>Electional Astrology</p>
        <h2 className={styles.heading}>Muhurta — Best Time Finder</h2>
      </div>

      <p className={styles.intro}>
        Choose an activity and date range for ranked auspicious windows.
      </p>

      <div className={styles.presetRow}>
        {PRESETS.map((p) => (
          <button
            key={p.days}
            type="button"
            className={`${styles.presetBtn} ${activePreset === p.days ? styles.presetBtnActive : ""}`}
            onClick={() => handlePreset(p.days)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Activity</span>
          <select
            className={styles.select}
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
          >
            {ACTIVITIES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>From</span>
          <input
            type="date"
            className={styles.dateInput}
            value={startDate}
            min={todayStr()}
            onChange={(e) => handleStartChange(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>To</span>
          <input
            type="date"
            className={styles.dateInput}
            value={endDate}
            min={startDate || todayStr()}
            max={maxEndStr(startDate || todayStr())}
            onChange={(e) => handleEndChange(e.target.value)}
          />
        </div>

        <button type="submit" className={styles.submitBtn} disabled={isLoading}>
          {isLoading ? "Searching..." : "Find Auspicious Times"}
        </button>
      </form>

      {error && (
        <div className={styles.error}>
          <p className={styles.errorText}>{error}</p>
          <button
            type="button"
            className={styles.retryBtn}
            onClick={() => void search()}
            disabled={isLoading}
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !result && !error && (
        <div className={styles.firstRun}>
          <span className={styles.firstRunIcon} aria-hidden="true">✦</span>
          <span>
            Set an activity and date range, then <strong>find the best times.</strong>
          </span>
        </div>
      )}

      {isLoading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>
            Scanning Panchanga factors across your date range...
          </p>
        </div>
      )}

      {!isLoading && result && (
        <p className={styles.locationNote}>{buildLocationLabel(queryString)}</p>
      )}

      {!isLoading && result && result.windows.length === 0 && (
        <p className={styles.empty}>
          No strongly auspicious windows found for {result.activity_label} in this date range.
          Try expanding the search window or selecting a different activity.
        </p>
      )}

      {!isLoading && result && result.windows.length > 0 && (
        <div className={styles.results}>
          <button
            type="button"
            className={styles.resultsToggle}
            aria-expanded={resultsOpen}
            onClick={() => setResultsOpen((o) => !o)}
          >
            <span className={styles.resultsToggleText}>
              Results: {visibleWindows.length} of {result.windows.length} window
              {result.windows.length !== 1 ? "s" : ""} shown
            </span>
            <span
              className={styles.resultsChevron}
              data-open={resultsOpen}
              aria-hidden="true"
            >
              ▾
            </span>
          </button>

          {resultsOpen && (
            <div className={styles.resultsBody}>
              <div className={styles.filterRow}>
            <label className={styles.filterField}>
              <span className={styles.filterLabel}>
                Min score: {minScore}
              </span>
              <input
                type="range"
                min={MIN_SCORE_FLOOR}
                max={MIN_SCORE_CEIL}
                step={5}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className={styles.slider}
              />
            </label>
            <label className={styles.filterToggle}>
              <input
                type="checkbox"
                checked={daytimeOnly}
                onChange={(e) => setDaytimeOnly(e.target.checked)}
              />
              <span>Daytime only (6 AM\u20136 PM)</span>
            </label>
          </div>

          <p className={styles.resultsSummary}>
            {formatWindowDate(result.search_window.start_date)} &mdash; {formatWindowDate(result.search_window.end_date)}
            {" \u00b7 "}
            Showing {visibleWindows.length} of {result.windows.length} window
            {result.windows.length !== 1 ? "s" : ""}
          </p>

          {visibleWindows.length === 0 && (
            <p className={styles.empty}>
              No windows match the current filters. Lower the minimum score
              {daytimeOnly ? " or allow non-daytime windows" : ""}.
            </p>
          )}

          {groupWindowsByDay(visibleWindows).map((group) => (
            <div key={group.label} className={styles.dayGroup}>
              <h4 className={styles.dayHeading}>
                <span>{group.label}</span>
                <span className={styles.dayCount}>
                  {group.windows.length} window{group.windows.length !== 1 ? "s" : ""}
                </span>
              </h4>
              {group.windows.map((w, idx) => {
                const isBest = w === result.windows[0];
                const key = `${w.start}-${w.score}-${idx}`;
                return (
                  <article
                    key={key}
                    className={`${styles.windowCard} ${isBest ? styles.windowCardBest : ""}`}
                  >
                    {isBest && (
                      <span className={styles.bestRibbon}>★ Best window</span>
                    )}
                    <div className={styles.windowHeader}>
                      <div>
                        <p className={styles.windowTime}>
                          {formatWindowTime(w.start)} &mdash; {formatWindowTime(w.end)}
                        </p>
                      </div>
                      <ScoreDial score={w.score} quality={w.quality} />
                    </div>

                    <div className={styles.factors}>
                      {w.factors.map((f) => (
                        <div
                          key={f.name}
                          className={factorClass(f.score)}
                          title={`${f.name}: ${f.value} — ${f.quality} (${formatScore(f.score)})`}
                        >
                          <span className={styles.factorSign} aria-hidden="true">
                            {factorSign(f.score)}
                          </span>
                          <span className={styles.factorBody}>
                            <span className={styles.factorTop}>
                              <span className={styles.factorName}>{f.name}</span>
                              <span className={styles.factorScore}>{formatScore(f.score)}</span>
                            </span>
                            <span className={styles.factorValue}>{f.value}</span>
                            <span className={styles.factorQuality}>{f.quality}</span>
                          </span>
                        </div>
                      ))}
                    </div>

                    <p className={styles.recommendation}>{w.recommendation}</p>

                    <div className={styles.windowActions}>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => downloadIcs(w, result.activity_label)}
                      >
                        Add to calendar
                      </button>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() =>
                          void copyWindow(w, key, result.activity_label)
                        }
                      >
                        {copiedKey === key ? "Copied ✓" : "Copy"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ))}
            </div>
          )}
        </div>
      )}

      {!isLoading && result && result.avoid_periods.length > 0 && (
        <div className={styles.avoidSection}>
          <h3 className={styles.avoidHeading}>
            <span aria-hidden="true">⚠</span> Inauspicious periods to avoid
          </h3>
          <p className={styles.avoidIntro}>
            Daylight Rahukaala and Yamaghantaka for each day in range —
            steer clear of these even outside the windows above.
          </p>
          <div className={styles.avoidGrid}>
            {result.avoid_periods.map((d) => (
              <div key={d.date} className={styles.avoidDay}>
                <p className={styles.avoidDate}>{formatWindowDate(d.date)}</p>
                <div className={styles.avoidPills}>
                  <span className={styles.avoidPill}>
                    <span className={styles.avoidPillLabel}>Rahukaala</span>
                    {formatWindowTime(d.rahukaala.start)} – {formatWindowTime(d.rahukaala.end)}
                  </span>
                  <span className={styles.avoidPill}>
                    <span className={styles.avoidPillLabel}>Yamaghantaka</span>
                    {formatWindowTime(d.yamaghantaka.start)} – {formatWindowTime(d.yamaghantaka.end)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
