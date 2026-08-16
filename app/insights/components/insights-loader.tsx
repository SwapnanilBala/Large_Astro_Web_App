"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import InsightsContent from "@/app/insights/components/insights-content";
import InsightsSkeleton from "@/app/insights/components/insights-skeleton";
import ErrorBoundary from "@/app/components/ErrorBoundary";
import type { ChartApiResponse } from "@/lib/astro-types";
import { chartCache, ChartCache } from "@/lib/chart-cache";
import { buildBirthProfileApiUrl } from "@/lib/chart-query";

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
  birthTimeAccuracy: string;
  birthTimeSource: string;
  birthTimeFallback: string;
};

type InsightsLoaderProps = {
  chartParams: ChartParams;
  initialPayload?: ChartApiResponse | null;
  initialError?: string;
};

function buildChartApiUrl(params: ChartParams): string {
  return buildBirthProfileApiUrl("/api/chart", window.location.origin, params, {
    include_transits: true,
  });
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
  if (params.birthTimeAccuracy) qs.birthTimeAccuracy = params.birthTimeAccuracy;
  if (params.birthTimeSource) qs.birthTimeSource = params.birthTimeSource;
  if (params.birthTimeFallback) qs.birthTimeFallback = params.birthTimeFallback;
  return new URLSearchParams(qs).toString();
}

export default function InsightsLoader({
  chartParams,
  initialPayload = null,
  initialError = "",
}: InsightsLoaderProps) {
  const [payload, setPayload] = useState<ChartApiResponse | null>(initialPayload);
  const [error, setError] = useState<string>(initialError);
  const [isLoading, setIsLoading] = useState(!initialPayload && !initialError);

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
    setPayload(initialPayload);
    setError(initialError);
    setIsLoading(!initialPayload && !initialError);

    if (initialPayload) {
      const chartUrl = buildChartApiUrl(chartParams);
      chartCache.set(ChartCache.makeKey(chartUrl), initialPayload);
      return;
    }

    if (!initialError) {
      void fetchChart();
    }
  }, [chartParams, fetchChart, initialError, initialPayload]);

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
              The chart engine could not finish this request. Please review the birth details,
              location, and selected engine, then try again.
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
