"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import InsightsContent from "@/app/insights/components/insights-content";
import InsightsSkeleton from "@/app/insights/components/insights-skeleton";
import ErrorBoundary from "@/app/components/ErrorBoundary";
import type { ChartApiResponse } from "@/lib/astro-types";
import { chartCache, ChartCache } from "@/lib/chart-cache";
import { useAuth } from "@/lib/auth-context";
import { saveAuthenticatedReading, saveGuestReading } from "@/lib/reading-store";

const REQUEST_TIMEOUT_MS = 55_000;

type ChartParams = {
  name: string;
  birthDate: string;
  birthTime: string;
  timezoneOffsetMinutes: string;
  latitude: string;
  longitude: string;
  country: string;
  state: string;
  city: string;
  town: string;
  timeZoneId: string;
  engineId: string;
};

type InsightsLoaderProps = {
  chartParams: ChartParams;
};

function buildChartApiUrl(params: ChartParams): string {
  const url = new URL("/api/chart", window.location.origin);
  url.searchParams.set("name", params.name);
  url.searchParams.set("birth_date", params.birthDate);
  url.searchParams.set("birth_time", params.birthTime);
  url.searchParams.set("engine_id", params.engineId || "lahiri_classic");
  url.searchParams.set("timezone_offset_minutes", params.timezoneOffsetMinutes);
  url.searchParams.set("latitude", params.latitude);
  url.searchParams.set("longitude", params.longitude);
  url.searchParams.set("country", params.country);
  url.searchParams.set("state", params.state);
  url.searchParams.set("city", params.city);
  url.searchParams.set("town", params.town);
  url.searchParams.set("time_zone_id", params.timeZoneId);
  url.searchParams.set("include_transits", "true");
  return url.toString();
}

function buildHistoryQs(params: ChartParams): string {
  const qs: Record<string, string> = {
    name: params.name,
    birthDate: params.birthDate,
    birthTime: params.birthTime,
    timezoneOffsetMinutes: params.timezoneOffsetMinutes,
    latitude: params.latitude,
    longitude: params.longitude,
    country: params.country,
    state: params.state,
    city: params.city,
    engineId: params.engineId,
  };
  if (params.town) qs.town = params.town;
  if (params.timeZoneId) qs.timeZoneId = params.timeZoneId;
  return new URLSearchParams(qs).toString();
}

async function persistReading(
  params: ChartParams,
  data: ChartApiResponse,
  userId?: string | null
) {
  try {
    if (userId) {
      await saveAuthenticatedReading(userId, params, data);
    } else {
      await saveGuestReading(params, data);
    }
  } catch {
    // Silent — persistence is best-effort, never blocks the UI
  }
}

export default function InsightsLoader({ chartParams }: InsightsLoaderProps) {
  const [payload, setPayload] = useState<ChartApiResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const persistedRef = useRef(false);

  const fetchChart = useCallback(async () => {
    setIsLoading(true);
    setError("");
    setPayload(null);

    const chartUrl = buildChartApiUrl(chartParams);
    const cacheKey = ChartCache.makeKey(chartUrl);

    // Check client-side cache first
    const cached = chartCache.get(cacheKey) as ChartApiResponse | null;
    if (cached) {
      setPayload(cached);
      setIsLoading(false);
      // Persist even on cache hit (first time only)
      if (!persistedRef.current) {
        persistedRef.current = true;
        void persistReading(chartParams, cached, user?.user_id);
      }
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(chartUrl, {
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Chart API error (${response.status})`);
      }

      const data = (await response.json()) as ChartApiResponse;
      chartCache.set(cacheKey, data);
      setPayload(data);

      // Fire-and-forget: persist reading to Supabase
      if (!persistedRef.current) {
        persistedRef.current = true;
        void persistReading(chartParams, data, user?.user_id);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError(
          `Request timed out after ${Math.round(REQUEST_TIMEOUT_MS / 1000)} seconds. ` +
          "The server may be busy. Please try again."
        );
      } else {
        setError(err instanceof Error ? err.message : "Unknown API error");
      }
    } finally {
      setIsLoading(false);
    }
  }, [chartParams]);

  useEffect(() => {
    void fetchChart();
  }, [fetchChart]);

  const historyQs = payload ? buildHistoryQs(chartParams) : "";

  return (
    <AnimatePresence mode="wait">
      {/* ── Loading state ── */}
      {isLoading && (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <InsightsSkeleton />
        </motion.div>
      )}

      {/* ── Error state ── */}
      {!isLoading && (error || !payload) && (
        <motion.div
          key="error"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <div className="ambient ambient-left" />
          <div className="ambient ambient-right" />
          <section className="dashboard-shell">
            <p className="kicker">Chart Error</p>
            <h1>Chart calculation could not be completed.</h1>
            <p className="lead">
              The chart engine encountered an error. Please check that the <code>swisseph</code> npm
              package is installed and your input data is valid, then try again.
            </p>
            <p className="error-note">Error: {error || "No data received"}</p>
            <div className="skel-error-actions">
              <button
                type="button"
                className="skel-retry-btn"
                onClick={() => void fetchChart()}
              >
                <span className="skel-retry-icon">&#x21BB;</span>
                Retry
              </button>
              <Link href="/" className="ghost-link">
                Edit Intake Data
              </Link>
            </div>
          </section>
        </motion.div>
      )}

      {/* ── Success state ── */}
      {!isLoading && !error && payload && (
        <motion.div
          key="content"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <ErrorBoundary>
            <InsightsContent
              payload={payload}
              birthDate={chartParams.birthDate}
              historyQs={historyQs}
            />
          </ErrorBoundary>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
