"use client";

/**
 * Asking whether a chart may be stored, and storing it once the answer is yes.
 *
 * Three states, and only one of them is ever visible at a time:
 *
 * - `asking`   — no answer on file yet.
 * - `pushing`  — the answer was yes; the chart on screen is being sent.
 * - `nudging`  — the answer was no, on an earlier visit, and this is the one
 *                and only time the case for changing it gets made.
 *
 * The nudge deliberately cannot fire in the same page view as the decline. A
 * dialog that reappears the moment you dismiss it is not persuasion, and a
 * consent record extracted that way is evidence of pestering rather than of
 * agreement — which defeats the purpose of keeping the record at all. So the
 * decline timestamp is compared against when this component mounted: the
 * answer has to predate the visit for the nudge to be due.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { backfillCharts } from "@/lib/chart-sync-backfill";
import {
  markNudgeShown,
  readChartSyncState,
  recordDecision,
  subscribeToChartSync,
  type ChartSyncState,
} from "@/lib/chart-sync-store";

export type ChartToSync = {
  queryString: string;
  ascendantSign: string | null;
  sunSign: string | null;
  moonSign: string | null;
};

export type ChartSyncPhase = "idle" | "asking" | "nudging";

export type ChartSyncController = {
  phase: ChartSyncPhase;
  /** True once this chart is known to be stored. */
  stored: boolean;
  grant: (prompt: string, source: "intake" | "nudge") => void;
  decline: () => void;
  dismissNudge: () => void;
};

type PushBody = {
  queryString: string;
  ascendantSign: string | null;
  sunSign: string | null;
  moonSign: string | null;
  consent: { granted: true; prompt: string; captureSource: "intake" | "nudge" | "settings" };
};

/**
 * Stands in for the wording on a push that rides on an earlier grant.
 *
 * Never shown to anyone. It exists so `evidence_json` says plainly that the
 * agreement was recorded on a previous visit, rather than claiming the visitor
 * was shown a prompt during this one.
 */
const STORED_CONSENT_REFERENCE =
  "Consent previously granted on this device; see the earlier consent record.";

/** Two tries, then wait for the next visit. See the note in `push`. */
const MAX_PUSH_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1200;

/**
 * @param chart  what is on screen, or null when there is nothing to store.
 */
export function useChartSync(chart: ChartToSync | null): ChartSyncController {
  /*
   * `null` is "not read yet", and it is also what the server sees.
   *
   * This used to initialise from `readChartSyncState()`. That reads
   * localStorage, which the server cannot, so the server rendered the ask
   * while a visitor who had already declined hydrated straight into the
   * nudge: one `<section>`, the same buttons, two different wordings, which
   * React reports as a text mismatch and which broke hydration on every
   * results page. Both sides now render nothing until the answer is in hand,
   * so the first client render agrees with the HTML it is hydrating.
   */
  const [state, setState] = useState<ChartSyncState | null>(null);
  const [stored, setStored] = useState(false);

  /**
   * When this view began. Anything decided after it was decided *here*, and a
   * nudge for an answer given seconds ago is the thing this exists to prevent.
   *
   * State rather than a ref, and stamped on mount rather than during render.
   * The phase is read off it, which makes it render data and so the wrong job
   * for a ref; and reading the clock while rendering is the same impurity that
   * the decision above was guilty of. It is set in the effect that reads the
   * decision, which is what makes the two timestamps comparable at all — and
   * it stays put afterwards, so a decline recorded in this view can never be
   * mistaken for one that predates it.
   */
  const [viewStartedAt, setViewStartedAt] = useState(0);

  /** Query strings already sent in this view, so a re-render is not a re-POST. */
  const pushed = useRef(new Set<string>());

  /** The wording to record as evidence, set when the visitor says yes. */
  const pendingConsent = useRef<PushBody["consent"] | null>(null);

  useEffect(() => {
    setViewStartedAt(Date.now());
    setState(readChartSyncState());
    return subscribeToChartSync(() => setState(readChartSyncState()));
  }, []);

  useEffect(() => {
    if (state?.decision !== "granted" || !chart?.queryString) return;

    const consent = pendingConsent.current;

    /* Granted on an earlier visit, so there is no freshly-shown wording to
       quote. The server already holds the record from when they agreed; this
       push rides on it. */
    const evidence: PushBody["consent"] =
      consent ?? { granted: true, prompt: STORED_CONSENT_REFERENCE, captureSource: "settings" };

    if (pushed.current.has(chart.queryString)) return;
    pushed.current.add(chart.queryString);

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const attemptPush = async () => {
      const response = await fetch("/api/sync/charts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          queryString: chart.queryString,
          ascendantSign: chart.ascendantSign,
          sunSign: chart.sunSign,
          moonSign: chart.moonSign,
          consent: evidence,
        } satisfies PushBody),
      });

      if (response.ok) return "stored" as const;

      /* A 4xx says this chart cannot be stored — a malformed query string, a
         birth date outside what the table accepts. Retrying is a loop against
         a wall. A 5xx or a thrown fetch is the server or the network, which
         may well work in a moment. */
      return response.status >= 500 ? ("retry" as const) : ("rejected" as const);
    };

    const push = async () => {
      for (let attempt = 0; attempt < MAX_PUSH_ATTEMPTS; attempt += 1) {
        if (attempt > 0) {
          await new Promise((resolve) => {
            retryTimer = setTimeout(resolve, RETRY_DELAY_MS);
          });
          if (cancelled) return;
        }

        try {
          const outcome = await attemptPush();
          if (cancelled) return;

          if (outcome === "stored") {
            setStored(true);

            /*
             * The chart on screen is stored; now the rest of this browser's
             * history, which the grant covers just as much. Deliberately after
             * the visible one so the thing they were looking at is safe first,
             * and deliberately not awaited into the caller — a twenty-chart
             * backfill must not hold up anything on the page.
             */
            void backfillCharts(
              { prompt: evidence.prompt, captureSource: evidence.captureSource },
              {
                alreadyPushed: pushed.current,
                isCancelled: () => cancelled,
              },
            );
            return;
          }
          if (outcome === "rejected") return;
        } catch {
          if (cancelled) return;
          /* Network error. Falls through to the next attempt. */
        }
      }

      /*
       * Both attempts failed, so let the next page view try again.
       *
       * That is the whole of the retry policy on purpose. The chart is in
       * localStorage either way, so a failed sync costs a sync and not a
       * chart, and the visitor opens /insights often enough that a persistent
       * outage does not need a queue in here to survive.
       */
      pushed.current.delete(chart.queryString);
    };

    void push();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [chart, state?.decision]);

  const grant = useCallback((prompt: string, source: "intake" | "nudge") => {
    pendingConsent.current = { granted: true, prompt, captureSource: source };
    recordDecision("granted");
  }, []);

  const decline = useCallback(() => {
    pendingConsent.current = null;
    recordDecision("declined");
  }, []);

  const dismissNudge = useCallback(() => markNudgeShown(), []);

  const phase = useMemo<ChartSyncPhase>(() => {
    if (!chart?.queryString) return "idle";
    /* Nothing to say before the stored answer has been read. */
    if (!state) return "idle";
    if (state.decision === null) return "asking";
    if (state.decision === "granted") return "idle";

    /* Declined. One nudge, ever, and never in the view it was declined in. */
    if (state.nudgeShownAt) return "idle";
    const decidedAt = state.decidedAt ? Date.parse(state.decidedAt) : 0;
    return decidedAt && decidedAt < viewStartedAt ? "nudging" : "idle";
  }, [chart?.queryString, state, viewStartedAt]);

  return { phase, stored, grant, decline, dismissNudge };
}
