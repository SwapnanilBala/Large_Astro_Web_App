"use client";

import { useEffect, useRef, useState } from "react";
import type { DashaInfo, NakshatraInfo, PlanetPosition } from "@/lib/astro-types";
import {
  buildCurrentPeriodFacts,
  type CurrentPeriodResponse,
} from "@/lib/current-period-reading";

export type CurrentPeriodReadingState = "pending" | "ready" | "failed";

export type CurrentPeriodReading = {
  state: CurrentPeriodReadingState;
  /** The written reading, or null until `ready`. */
  reading: string | null;
};

/**
 * The written reading for the dasha stack the reader is currently in.
 *
 * Fetched exactly once per mount, and guarded twice, for the two unrelated
 * ways it could fire twice:
 *
 *   `startedRef` covers React's development double-invoke of effects, which
 *   does reach this hook -- NakshatraDashaPanel is pulled in through
 *   dynamic(..., { ssr: false }), so it mounts in the browser after hydration
 *   and React runs its effects twice. That is worth stating rather than
 *   assuming: the same double-invoke does not reach useVargaCommentary, whose
 *   host the server page renders directly (5aaed04). Without the guard every
 *   local page load bills two calls, and they do not even dedupe against each
 *   other, because the route writes its cache only once the model has answered
 *   and holds nothing in flight, so two concurrent callers both miss. Both are
 *   really billed here, precisely because nothing below aborts the first one.
 *
 *   The empty dependency array covers re-renders. Depending on `dasha` looks
 *   more correct and is worse: it is a field off a payload object that any
 *   parent re-render can hand back by a new identity, and the current stack
 *   cannot change without a navigation, which unmounts this anyway.
 *
 * DELIBERATELY NOT ABORTED ON UNMOUNT, which is the interesting half. An
 * AbortController does not survive contact with a *latched* `startedRef`: in
 * development StrictMode the sequence is run, clean up, run again, so the
 * cleanup aborts the only request and the second run reads the latched ref and
 * declines to start a replacement. The reading then never arrives and the
 * state sits on "pending" forever -- measured, not theorised, against a real
 * page before this comment was written. Cancelling with a boolean instead
 * fails identically, for the same reason.
 *
 * Read the caps as being about that pair, and not as a claim that a hook
 * shaped like this one cannot hold an AbortController. There are two ways out
 * and the codebase now uses both, so this file deliberately does not match its
 * siblings: drop the abort and keep the latch, which is what happens here, or
 * keep the abort and clear the latch in the cleanup, which is what
 * useLifeShiftReadings and useVargaCommentary do (bdf8dce, 5aaed04). Either is
 * correct on its own.
 *
 * Dropping it is the cheaper half of the trade at this call site. Leaving the
 * request to finish costs one setState after unmount, which is a no-op in
 * React 18 and later, and buys a server that finishes and caches the call
 * regardless: coming back to the section costs nothing. Clearing the latch
 * instead would issue a second request from the browser on every development
 * mount, and the first would go unbilled only because the abort beats it out
 * of the browser -- which it does, measured on the sibling, but nothing here
 * needs to depend on it. The double-invoke stays guarded either way, so this
 * is still one call.
 *
 * Deliberately off the critical path. The card renders its template sentence
 * immediately and swaps this in when it arrives; a failure -- no key, budget
 * spent, rate limited, the model declining -- leaves the card exactly as
 * complete as it was before this existed.
 *
 * Quiet on a refused free allowance, unlike the drill-down in the same panel,
 * which raises the sign-in prompt. The difference is who asked: drilling into a
 * chain is a click, so a dialog answers it, where this fires on mount and a
 * reader who has only scrolled past the timing section has not asked for
 * anything a modal would be a reply to.
 */
export function useCurrentPeriodReading(
  dasha: DashaInfo,
  nakshatra: NakshatraInfo,
  planets: PlanetPosition[] | undefined,
  progressPercent: number,
): CurrentPeriodReading {
  const [state, setState] = useState<CurrentPeriodReadingState>("pending");
  const [reading, setReading] = useState<string | null>(null);
  const startedRef = useRef(false);
  /* Read at fire time rather than depended on, so the once-per-mount contract
     above holds without the effect closing over a stale first render. */
  const inputRef = useRef({ dasha, nakshatra, planets, progressPercent });
  inputRef.current = { dasha, nakshatra, planets, progressPercent };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const current = inputRef.current;
    const facts = buildCurrentPeriodFacts(
      current.dasha,
      current.nakshatra,
      current.planets,
      current.progressPercent,
    );
    if (!facts) {
      setState("failed");
      return;
    }

    void (async () => {
      try {
        const response = await fetch("/api/chart/current-period", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(facts),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as Partial<CurrentPeriodResponse>;
        const text = typeof data.reading === "string" ? data.reading.trim() : "";
        if (!text) throw new Error("empty reading");
        setReading(text);
        setState("ready");
      } catch (error) {
        /* Quiet on purpose. Every failure here has the same consequence for
           the reader, which is that the card keeps its template sentence. */
        console.warn("current period reading unavailable:", error);
        setState("failed");
      }
    })();
  }, []);

  return { state, reading };
}
