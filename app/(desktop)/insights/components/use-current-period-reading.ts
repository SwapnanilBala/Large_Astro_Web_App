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
 * ways it could fire twice -- the same shape as useLifeShiftReadings, and for
 * the same reasons:
 *
 *   `startedRef` covers React's development double-invoke of effects. Without
 *   it every local page load bills two calls, and they do not even dedupe
 *   against each other, because both miss the server's cache on the way in.
 *
 *   The empty dependency array covers re-renders. Depending on `dasha` looks
 *   more correct and is worse: it is a field off a payload object that any
 *   parent re-render can hand back by a new identity, and the current stack
 *   cannot change without a navigation, which unmounts this anyway.
 *
 * DELIBERATELY NOT ABORTED ON UNMOUNT, which is the interesting half. An
 * AbortController here does not survive contact with `startedRef`: in
 * development StrictMode the sequence is run, clean up, run again, so the
 * cleanup aborts the only request and the second run reads `startedRef` and
 * declines to start a replacement. The reading then never arrives and the
 * state sits on "pending" forever -- measured, not theorised, against a real
 * page before this comment was written. Cancelling with a boolean instead
 * fails identically, for the same reason.
 *
 * So the request is left to finish. A setState after unmount is a no-op in
 * React 18 and later, and the server was going to finish and cache the call
 * regardless, which is the outcome worth having: coming back to the section
 * costs nothing. The double-invoke stays guarded, so this is still one call.
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
