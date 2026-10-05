"use client";

import type { ChartParams as SharedChartParams } from "@/lib/chart-params-url";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import InsightsContent from "@/app/(desktop)/insights/components/insights-content";
import InsightsSkeleton from "@/app/(desktop)/insights/components/insights-skeleton";
import ErrorBoundary from "@/app/components/ErrorBoundary";
import type { ChartApiResponse, TopLifeDomainSummary } from "@/lib/astro-types";
import { chartCache, ChartCache } from "@/lib/chart-cache";
import { buildBirthProfileApiUrl } from "@/lib/chart-query";
import { buildChartHistoryQuery } from "@/lib/chart-params-url";
import { useRouteMessages } from "@/lib/i18n-context";
import sharedMessages from "@/messages/en.shared.json";

const REQUEST_TIMEOUT_MS = 55_000;

/* The shared shape, so a new chart field cannot be dropped here. */
type ChartParams = SharedChartParams;

type InsightsLoaderProps = {
  chartParams: ChartParams;
  initialPayload?: ChartApiResponse | null;
  initialError?: string;
  /** The Top Takeaways card's life area, computed with initialPayload. */
  initialTopLifeDomain?: TopLifeDomainSummary | null;
};

function buildChartApiUrl(params: ChartParams): string {
  return buildBirthProfileApiUrl("/api/chart", window.location.origin, params, {
    include_transits: true,
  });
}

/* A chart fetch the browser owes. A new object per request, so the effect that
   serves it runs once per request rather than once per render. */
type ChartRequest = { params: ChartParams };

export default function InsightsLoader({
  chartParams,
  initialPayload = null,
  initialError = "",
  initialTopLifeDomain = null,
}: InsightsLoaderProps) {
  const t = useRouteMessages(sharedMessages);
  const [payload, setPayload] = useState<ChartApiResponse | null>(initialPayload);
  const [error, setError] = useState<string>(initialError);
  /* Owed on mount only when the server sent neither a payload nor an error;
     otherwise only after Retry. Loading is "a request is owed". */
  const [request, setRequest] = useState<ChartRequest | null>(() =>
    !initialPayload && !initialError ? { params: chartParams } : null,
  );
  const isLoading = request !== null;

  /* New server props replace what is shown: another chart, or a refresh that
     re-rendered this one -- after signing in, say, with more of it unlocked.
     Adjusted during render, where an effect used to do it a commit late. The
     chart is compared by value; the payload by identity, as before. */
  const paramsKey = buildChartHistoryQuery(chartParams);
  const [shownProps, setShownProps] = useState({ paramsKey, initialPayload, initialError });
  if (
    shownProps.paramsKey !== paramsKey ||
    shownProps.initialPayload !== initialPayload ||
    shownProps.initialError !== initialError
  ) {
    setShownProps({ paramsKey, initialPayload, initialError });
    setPayload(initialPayload);
    setError(initialError);
    setRequest(!initialPayload && !initialError ? { params: chartParams } : null);
  }

  /* `t` is read when a request fails, not when the request starts, so it is
     held in a ref rather than listed as a dependency: its identity changes on
     every language switch, and the effect below would re-request the chart
     each time the visitor changes language. */
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  /* The server's payload goes into this tab's cache, which is what lets
     /insights/advanced open on it instead of asking again. */
  useEffect(() => {
    if (!initialPayload) return;
    chartCache.set(ChartCache.makeKey(buildChartApiUrl(chartParams)), initialPayload);
  }, [chartParams, initialPayload]);

  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    /* Set by cleanup, so a superseded request is told apart from a timeout. */
    let superseded = false;
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const chartUrl = buildChartApiUrl(request.params);

    void (async () => {
      try {
        const response = await fetch(chartUrl, {
          cache: "no-store",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Chart API error (${response.status})`);
        }

        const data = (await response.json()) as ChartApiResponse;
        chartCache.set(ChartCache.makeKey(chartUrl), data);
        if (!superseded) setPayload(data);
      } catch (err) {
        if (superseded) return;
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
        if (!superseded) setRequest((current) => (current === request ? null : current));
      }
    })();

    return () => {
      superseded = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [request]);

  const retry = () => {
    setError("");
    const cached = chartCache.get(
      ChartCache.makeKey(buildChartApiUrl(chartParams))
    ) as ChartApiResponse | null;
    if (cached) {
      setPayload(cached);
      setRequest(null);
      return;
    }
    setPayload(null);
    setRequest({ params: chartParams });
  };

  const historyQs = payload ? buildChartHistoryQuery(chartParams) : "";

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
            <p className="kicker">{t("shared.chartErrorKicker")}</p>
            <h1>{t("shared.chartErrorHeading")}</h1>
            <p className="lead">{t("shared.chartErrorLead")}</p>
            <p className="error-note">
              {t("shared.chartErrorDetail", {
                detail: error || t("shared.chartErrorNoData"),
              })}
            </p>
            <div className="skel-error-actions">
              <button
                type="button"
                className="skel-retry-btn"
                onClick={retry}
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
              topLifeDomain={initialTopLifeDomain}
            />
          </ErrorBoundary>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
