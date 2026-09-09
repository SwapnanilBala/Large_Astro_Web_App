"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import AdvancedContent from "./advanced-content";
import InsightsSkeleton from "@/app/(desktop)/insights/components/insights-skeleton";
import ErrorBoundary from "@/app/components/ErrorBoundary";
import type { ChartApiResponse } from "@/lib/astro-types";
import { chartCache, ChartCache } from "@/lib/chart-cache";
import { buildBirthProfileApiUrl } from "@/lib/chart-query";
import { buildChartHistoryQuery } from "@/lib/chart-params";
import { useRouteMessages } from "@/lib/i18n-context";
import sharedMessages from "@/messages/en.shared.json";
import type { AdvancedFocusView } from "./advanced-views";

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

type AdvancedLoaderProps = {
  chartParams: ChartParams;
  focusView: AdvancedFocusView | null;
};

function buildChartApiUrl(params: ChartParams): string {
  return buildBirthProfileApiUrl("/api/chart", window.location.origin, params, {
    include_transits: true,
  });
}

export default function AdvancedLoader({
  chartParams,
  focusView,
}: AdvancedLoaderProps) {
  const t = useRouteMessages(sharedMessages);
  const [payload, setPayload] = useState<ChartApiResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  /* `t` is read when a request fails, not when the callback is built, so it is
     held in a ref rather than listed as a dependency: its identity changes on
     every language switch, and re-creating fetchChart re-runs the effect below,
     which would re-request the chart each time the visitor changes language. */
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const fetchChart = useCallback(async () => {
    setIsLoading(true);
    setError("");
    setPayload(null);

    const chartUrl = buildChartApiUrl(chartParams);
    const cacheKey = ChartCache.makeKey(chartUrl);

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
          tRef.current("shared.chartRequestTimedOut", {
            seconds: String(Math.round(REQUEST_TIMEOUT_MS / 1000)),
          })
        );
      } else {
        setError(
          err instanceof Error ? err.message : tRef.current("shared.chartUnknownApiError")
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [chartParams]);

  useEffect(() => {
    void fetchChart();
  }, [fetchChart]);

  const historyQs = payload ? buildChartHistoryQuery(chartParams) : "";

  /* The package name is a literal in <code>, not something to translate, so the
     sentence carries a {package} token and is split around it. One key keeps the
     clause whole for a translator instead of handing them two half-sentences. */
  const [leadBeforePackage, ...leadAfterPackage] = t("shared.chartErrorLeadAdvanced").split(
    "{package}"
  );
  const advancedLead = (
    <>
      {leadBeforePackage}
      <code>swisseph</code>
      {leadAfterPackage.join("")}
    </>
  );

  return (
    <AnimatePresence mode="wait">
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
            <p className="kicker">{t("shared.chartErrorKicker")}</p>
            <h1>{t("shared.chartErrorHeading")}</h1>
            <p className="lead">{advancedLead}</p>
            <p className="error-note">
              {t("shared.chartErrorDetail", {
                detail: error || t("shared.chartErrorNoData"),
              })}
            </p>
            <div className="skel-error-actions">
              <button
                type="button"
                className="skel-retry-btn"
                onClick={() => void fetchChart()}
              >
                <span className="skel-retry-icon">&#x21BB;</span>
                {t("shared.chartErrorRetry")}
              </button>
              <Link href="/" className="ghost-link">
                {t("insights.editIntake")}
              </Link>
            </div>
          </section>
        </motion.div>
      )}

      {!isLoading && !error && payload && (
        <motion.div
          key="content"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <ErrorBoundary>
            <AdvancedContent
              payload={payload}
              historyQs={historyQs}
              focusView={focusView}
            />
          </ErrorBoundary>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
