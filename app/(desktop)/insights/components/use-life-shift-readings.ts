"use client";

import { useEffect, useRef, useState } from "react";
import type { MajorLifeShift } from "@/lib/engines/major-shifts-engine";
import {
  buildLifeShiftFacts,
  type LifeShiftReading,
} from "@/lib/life-shift-reading";

export type LifeShiftReadingsState = "pending" | "ready" | "failed";

export type LifeShiftReadings = {
  state: LifeShiftReadingsState;
  /** Chapter id -> the reading written for it. Empty until `ready`. */
  readings: Map<string, string>;
};

/**
 * The written reading for each chapter the panel is about to render.
 *
 * Fetched exactly once per mount, and guarded twice, because the two ways it
 * could fire twice are unrelated:
 *
 *   `startedRef` covers React's development double-invoke of effects. Without
 *   it every local page load would bill two calls -- and they would not even
 *   dedupe against each other, because both would miss the server's cache on
 *   the way in.
 *
 *   The empty dependency array covers re-renders. Depending on `shifts` looks
 *   more correct and is worse: the array is rebuilt by a useMemo in the panel,
 *   and any parent re-render that changed its identity would re-fetch every
 *   reading. The chapters cannot change without a navigation, which unmounts
 *   this anyway.
 *
 * Deliberately off the critical path. The panel renders the engine's own
 * narrative for every chapter immediately and swaps in the written reading
 * when it arrives; a failure -- no key, budget spent, rate limited, the model
 * declining -- leaves the section exactly as complete as it was before this
 * existed.
 *
 * Only the chapters the caller passes are asked for, which is what keeps the
 * results page cheap: the brief variant renders one chapter and so buys one
 * reading, where /insights/life-shifts renders up to five.
 */
export function useLifeShiftReadings(shifts: MajorLifeShift[]): LifeShiftReadings {
  const [state, setState] = useState<LifeShiftReadingsState>("pending");
  const [readings, setReadings] = useState<Map<string, string>>(() => new Map());
  const startedRef = useRef(false);
  /* Read at fire time rather than depended on, so the once-per-mount contract
     above holds without the effect closing over a stale first render. */
  const shiftsRef = useRef(shifts);
  shiftsRef.current = shifts;

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const facts = buildLifeShiftFacts(shiftsRef.current);
    if (facts.length === 0) {
      setState("failed");
      return;
    }

    /* Aborted on unmount so navigating away does not land a setState on a dead
       component. The request itself is already in flight and the server will
       finish and cache it, which is the right outcome -- coming back to the
       section then costs nothing. */
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch("/api/chart/life-shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shifts: facts }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as { readings?: LifeShiftReading[] };
        const next = new Map<string, string>();
        for (const entry of data.readings ?? []) {
          if (entry && typeof entry.reading === "string" && entry.reading.trim()) {
            next.set(entry.id, entry.reading.trim());
          }
        }
        if (next.size === 0) throw new Error("no readings");
        setReadings(next);
        setState("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        /* Quiet on purpose. Every failure here has the same consequence for
           the reader, which is that the chapters keep their template wording. */
        console.warn("life shift readings unavailable:", error);
        setState("failed");
      }
    })();

    return () => controller.abort();
  }, []);

  return { state, readings };
}
