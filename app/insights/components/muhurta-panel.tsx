"use client";

import { useState, useCallback, useRef } from "react";
import {
  appendChartApiSearchParams,
  appendProfileLocationApiSearchParams,
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

interface MuhurtaResponse {
  activity: string;
  activity_label: string;
  search_window: { start_date: string; end_date: string };
  timezone_offset_minutes: number;
  windows: MuhurtaWindow[];
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
const MAX_RANGE_DAYS = 14;
const PRESETS = [
  { label: "3 Days", days: 3 },
  { label: "7 Days", days: 7 },
  { label: "14 Days", days: 14 },
] as const;

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

function scoreClass(quality: MuhurtaWindow["quality"]): string {
  switch (quality) {
    case "excellent": return styles.scoreExcellent;
    case "good": return styles.scoreGood;
    case "fair": return styles.scoreFair;
    case "poor": return styles.scorePoor;
    default: return styles.scoreFair;
  }
}

function factorClass(score: number): string {
  if (score > 0) return styles.factorPositive;
  if (score < 0) return styles.factorNegative;
  return styles.factorChip;
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
  const abortRef = useRef<AbortController | null>(null);

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

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <p className={styles.kicker}>Electional Astrology</p>
        <h2 className={styles.heading}>Muhurta — Best Time Finder</h2>
      </div>

      <p className={styles.intro}>
        Select an activity and date range to find the most auspicious time windows based on
        Panchanga factors: Tithi, Nakshatra, Yoga, Karana, and weekday alignment.
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
            Pick an activity and date range above, then{" "}
            <strong>Find Auspicious Times</strong> to see ranked windows with a
            full Panchanga breakdown for each.
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

      {!isLoading && result && result.windows.length === 0 && (
        <p className={styles.empty}>
          No strongly auspicious windows found for {result.activity_label} in this date range.
          Try expanding the search window or selecting a different activity.
        </p>
      )}

      {!isLoading && result && result.windows.length > 0 && (
        <div className={styles.results}>
          <p className={styles.resultsSummary}>
            {formatWindowDate(result.search_window.start_date)} &mdash; {formatWindowDate(result.search_window.end_date)}
            {" \u00b7 "}
            Found {result.windows.length} auspicious window{result.windows.length !== 1 ? "s" : ""}
          </p>
          {result.windows.map((w, idx) => (
            <article key={`${w.start}-${idx}`} className={styles.windowCard}>
              <div className={styles.windowHeader}>
                <div>
                  <p className={styles.windowTime}>
                    {formatWindowTime(w.start)} &mdash; {formatWindowTime(w.end)}
                  </p>
                  <p className={styles.windowDate}>{formatWindowDate(w.start)}</p>
                </div>
                <span className={scoreClass(w.quality)}>
                  {w.score}/100 &middot; {w.quality}
                </span>
              </div>

              <div className={styles.factors}>
                {w.factors.map((f) => (
                  <span key={f.name} className={factorClass(f.score)}>
                    <span className={styles.factorName}>{f.name}:</span> {f.value}
                  </span>
                ))}
              </div>

              <p className={styles.recommendation}>{w.recommendation}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
