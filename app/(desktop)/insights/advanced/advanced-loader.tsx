"use client";

import type { ChartParams as SharedChartParams } from "@/lib/chart-params-url";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import AdvancedContent from "./advanced-content";
import InsightsSkeleton from "@/app/(desktop)/insights/components/insights-skeleton";
import ErrorBoundary from "@/app/components/ErrorBoundary";
import type { ChartApiResponse } from "@/lib/astro-types";
import { chartCache, ChartCache } from "@/lib/chart-cache";
import { buildBirthProfileApiUrl } from "@/lib/chart-query";
import { buildChartHistoryQuery } from "@/lib/chart-params-url";
import { useRouteMessages } from "@/lib/i18n-context";
import sharedMessages from "@/messages/en.shared.json";
import type { AdvancedFocusView } from "./advanced-views";

const REQUEST_TIMEOUT_MS = 55_000;

/* The shared shape, so a new chart field cannot be dropped here. */
type ChartParams = SharedChartParams;

type AdvancedLoaderProps = {
  chartParams: ChartParams;
  focusView: AdvancedFocusView | null;
};

function buildChartApiUrl(params: ChartParams): string {
  return buildBirthProfileApiUrl("/api/chart", window.location.origin, params, {
    include_transits: true,
  });
}

/* The payload this tab already holds for these params, while it is fresh --
   /insights puts its server payload there. Null on the server, which has no
   origin to build the key from and never fills the cache. */
function readCachedChart(params: ChartParams): ChartApiResponse | null {
  if (typeof window === "undefined") return null;
  return chartCache.get(ChartCache.makeKey(buildChartApiUrl(params))) as ChartApiResponse | null;
}

/* A chart fetch the browser owes. A new object per request, so the effect that
   serves it runs once per request rather than once per render. */
type ChartRequest = { params: ChartParams };

export default function AdvancedLoader({
  chartParams,
  focusView,
}: AdvancedLoaderProps) {
  const t = useRouteMessages(sharedMessages);
  /* Read while rendering, so a chart this tab already has renders at once
     instead of after a skeleton. Safe for hydration: on a hard load the
     in-memory cache is empty, so this render still matches the server's
     skeleton, and a client navigation has no server HTML to match. */
  const [initialCached] = useState(() => readCachedChart(chartParams));
  const [payload, setPayload] = useState<ChartApiResponse | null>(initialCached);
  const [error, setError] = useState<string>("");
  /* Loading is "a request is owed". */
  const [request, setRequest] = useState<ChartRequest | null>(() =>
    initialCached ? null : { params: chartParams },
  );
  const isLoading = request !== null;

  /* Another chart while mounted -- back and forward between two charts'
     advanced pages -- starts over, from the cache when it can. By value, not
     identity: switching views re-renders the page with equal params, and that
     must not refetch. */
  const paramsKey = buildChartHistoryQuery(chartParams);
  const [shownKey, setShownKey] = useState(paramsKey);
  if (shownKey !== paramsKey) {
    setShownKey(paramsKey);
    const cached = readCachedChart(chartParams);
    setPayload(cached);
    setError("");
    setRequest(cached ? null : { params: chartParams });
  }

  /* `t` is read when a request fails, not when the request starts, so it is
     held in a ref rather than listed as a dependency: its identity changes on
     every language switch, and the effect below would re-request the chart
     each time the visitor changes language. */
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

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
    const cached = readCachedChart(chartParams);
    if (cached) {
      setPayload(cached);
      setRequest(null);
      return;
    }
    setPayload(null);
    setRequest({ params: chartParams });
  };

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
