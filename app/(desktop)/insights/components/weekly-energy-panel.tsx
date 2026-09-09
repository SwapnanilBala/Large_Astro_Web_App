"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FiChevronLeft, FiChevronRight, FiRefreshCw } from "react-icons/fi";
import {
  BookOpen,
  Compass,
  Heart,
  MessageCircle,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { useRouteMessages } from "@/lib/i18n-context";
import sharedMessages from "@/messages/en.shared.json";
import { addWeeks, currentWeekStart, formatWeekRangeLabel } from "@/lib/format-week";
import type { WeeklyEnergyResponse } from "@/lib/astro-types";
import WeeklyEnergyChart from "./weekly-energy-chart";
import styles from "./weekly-energy-panel.module.css";

/** Matches the route's own bound, so the UI cannot produce a 400. */
const WEEK_RANGE_WEEKS = 104;
const REQUEST_TIMEOUT_MS = 15_000;
const MEMO_LIMIT = 12;

/* A ReactNode cannot cross JSON, so the engine sends an icon_key and the
   mapping lives here. Same division as DOMAIN_ICONS in life-domain-copy.ts. */
const CARD_ICONS: Record<string, React.ReactNode> = {
  sparkles: <Sparkles size={16} />,
  heart: <Heart size={16} />,
  message: <MessageCircle size={16} />,
  trending: <TrendingUp size={16} />,
  users: <Users size={16} />,
  book: <BookOpen size={16} />,
  compass: <Compass size={16} />,
};

type LoadState = "idle" | "loading" | "ready" | "error";

export type WeeklyEnergyPanelProps = {
  /** The birth-details query string the rest of the page already holds. */
  queryString: string;
};

export default function WeeklyEnergyPanel({ queryString }: WeeklyEnergyPanelProps) {
  /* Resolves both the baseline namespaces this panel reads (quotes.*) and the
     "shared" catalog the chart below needs, which the layout does not ship. */
  const t = useRouteMessages(sharedMessages);
  const shouldReduceMotion = useReducedMotion();

  const [weekStart, setWeekStart] = useState(() => currentWeekStart());
  const [data, setData] = useState<WeeklyEnergyResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const [hasEnteredView, setHasEnteredView] = useState(false);

  const sectionRef = useRef<HTMLElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const memoRef = useRef<Map<string, WeeklyEnergyResponse>>(new Map());

  const minWeek = currentWeekStart(new Date());
  const earliest = addWeeks(minWeek, -WEEK_RANGE_WEEKS);
  const latest = addWeeks(minWeek, WEEK_RANGE_WEEKS);

  /*
   * Observation and fetching are two effects, not one.
   *
   * The life-domains module next door does both in a single effect. Copying
   * that here would re-arm the IntersectionObserver on every pager click, since
   * weekStart would be in the same dependency list.
   */
  useEffect(() => {
    if (hasEnteredView) return;
    const node = sectionRef.current;
    if (!node) return;

    /* No `typeof IntersectionObserver === "undefined"` guard, matching
       LazyPanel below -- which gates four panels on this same page without
       one. The API has been baseline in every browser this app supports since
       2019, and the one guarded call site nearby can afford to fall back by
       calling its loader directly; this effect is deliberately split from the
       fetch (so a pager click does not re-arm the observer), so its only way
       to fall back would be a setState in an effect body. Not worth a lint
       warning for a browser that does not exist. */
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setHasEnteredView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "250px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasEnteredView]);

  useEffect(() => {
    if (!hasEnteredView || !queryString) return;

    const memoKey = `${queryString}|${weekStart}`;
    const memoised = memoRef.current.get(memoKey);
    if (memoised) {
      setData(memoised);
      setLoadState("ready");
      return;
    }

    /*
     * Abort the previous request, always.
     *
     * Four quick clicks on the forward arrow issue four requests; without this
     * whichever resolves last wins, which is not necessarily the week the label
     * is showing. Same guard as the varshaphal panel.
     */
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    setLoadState("loading");
    setErrorMessage("");

    fetch(`/api/chart/weekly-energy?${queryString}&week_start=${weekStart}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(body?.error?.message ?? "Weekly energy is unavailable right now.");
        }
        return body as WeeklyEnergyResponse;
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        const memo = memoRef.current;
        memo.set(memoKey, result);
        // Bounded, oldest-first: Map preserves insertion order.
        if (memo.size > MEMO_LIMIT) memo.delete(memo.keys().next().value as string);
        setData(result);
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMessage(error instanceof Error ? error.message : "Weekly energy failed to load.");
        setLoadState("error");
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [hasEnteredView, queryString, weekStart, retryToken]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const step = useCallback(
    (direction: -1 | 1) => setWeekStart((current) => addWeeks(current, direction)),
    []
  );

  const isBusy = loadState === "loading";
  /* The label follows the pager immediately; the chart catches up. Without
     this the header would lag a click behind on a slow request. */
  const label = formatWeekRangeLabel(weekStart);

  return (
    <section
      ref={sectionRef}
      className={styles.panel}
      aria-labelledby="weekly-energy-heading"
      aria-busy={isBusy}
    >
      <header className={styles.header}>
        <div>
          <h2 id="weekly-energy-heading" className={styles.title}>
            Your Weekly Energy
          </h2>
          <p className={styles.subtitle}>Flows, moods and momentum</p>
        </div>

        <div className={styles.pager}>
          <button
            type="button"
            className={styles.pagerButton}
            onClick={() => step(-1)}
            disabled={isBusy || weekStart <= earliest}
            aria-label="Previous week"
          >
            <FiChevronLeft size={16} />
          </button>
          <span className={styles.pagerLabel}>{label}</span>
          <button
            type="button"
            className={styles.pagerButton}
            onClick={() => step(1)}
            disabled={isBusy || weekStart >= latest}
            aria-label="Next week"
          >
            <FiChevronRight size={16} />
          </button>
        </div>
      </header>

      {loadState === "error" && !data && (
        <div className={styles.errorState} role="alert">
          <p className={styles.errorTitle}>This week&apos;s energy did not load</p>
          <p className={styles.errorBody}>{errorMessage}</p>
          <button
            type="button"
            className={styles.retryButton}
            onClick={() => setRetryToken((n) => n + 1)}
          >
            <FiRefreshCw size={14} />
            Try again
          </button>
        </div>
      )}

      {!data && loadState !== "error" && (
        <div className={styles.loadingState} aria-live="polite">
          <span className={styles.loadingBar} />
          <span className={styles.loadingBar} />
          <span className={styles.loadingBar} />
          <p className={styles.loadingNote}>
            {loadState === "idle" ? "Weekly energy is ready to load" : "Reading the week ahead"}
          </p>
        </div>
      )}

      {/*
        A page must not blank the chart. While a new week is in flight the
        previous one stays on screen, dimmed -- a chart that vanishes and
        reappears on every arrow click is what makes a pager feel broken.
      */}
      {data && (
        <div className={styles.body} data-stale={isBusy ? "true" : undefined}>
          <WeeklyEnergyChart
            days={data.days}
            bands={data.bands}
            peak={data.peak}
            altText={data.chart_alt_text}
            weekLabel={data.week.label}
            animate={!shouldReduceMotion}
            idPrefix="weekly-energy"
            t={t}
          />

          <div className={styles.forecast}>
            <h3 className={styles.forecastTitle}>Weekly Forecast</h3>
            <div className={styles.cards}>
              {data.cards.map((card) => (
                <motion.article
                  key={card.intent}
                  className={styles.card}
                  data-quality={card.quality}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3 }}
                >
                  <span className={styles.cardIcon} aria-hidden="true">
                    {CARD_ICONS[card.icon_key] ?? <Sparkles size={16} />}
                  </span>
                  <span className={styles.cardTitle}>{card.title}</span>
                  <span className={styles.cardBody}>{card.body}</span>
                </motion.article>
              ))}
            </div>
          </div>

          {/*
            The week's own headline. Both of these come from the same response
            as the chart, so they cost no second request and cannot describe a
            different week from the line above them.
          */}
          <div className={styles.vibe}>
            <h3 className={styles.vibeTitle}>{data.headline.title}</h3>
            <p className={styles.vibeBody}>{data.headline.paragraph}</p>
            {/* The quote arrives as a key so it resolves through i18n. */}
            <p className={styles.quote}>{t(`quotes.${data.headline.quote_key}`)}</p>
          </div>
        </div>
      )}
    </section>
  );
}
