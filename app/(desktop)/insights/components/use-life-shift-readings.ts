"use client";

import { useEffect, useRef, useState } from "react";
import type { MajorLifeShift } from "@/lib/engines/major-shifts-engine";
import {
  buildLifeShiftFacts,
  type LifeShiftDepth,
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
 * Fetched once per mounted lifetime, and the bookkeeping is fussier than it
 * looks because reactStrictMode is on:
 *
 *   `startedRef` stops a second request inside one lifetime. It is reset in
 *   the cleanup rather than left latched, and that reset is the whole reason
 *   this works in development. StrictMode mounts, unmounts and remounts; the
 *   unmount aborts the in-flight request, and a latched ref then refuses to
 *   start another on the remount. The section sat on its template forever
 *   locally -- the server never saw a single request, because the only one
 *   ever made was cancelled before it left the browser. It came back clean in
 *   production, where there is no second invoke, which is exactly the shape
 *   of bug that survives review.
 *
 *   Resetting it does not buy a double call. The aborted request never
 *   reaches the route, so the remount's request is the first and only one to
 *   be billed. In production the cleanup runs on a real navigation, where
 *   clearing the ref is meaningless anyway.
 *
 *   Taking the inputs once, as state, covers re-renders: the effect depends
 *   on nothing that can change. Depending on `shifts` looks
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
 * reading, where /insights/life-shifts renders up to five. `depth` is the
 * other half of that trade -- the one chapter the results page does buy is
 * the one worth writing at length.
 */
export function useLifeShiftReadings(
  shifts: MajorLifeShift[],
  depth: LifeShiftDepth,
): LifeShiftReadings {
  const [state, setState] = useState<LifeShiftReadingsState>("pending");
  const [readings, setReadings] = useState<Map<string, string>>(() => new Map());
  const startedRef = useRef(false);
  /* Taken once, from the render this hook mounted with. The request is once
     per mounted lifetime, so these are the only inputs it will ever send;
     holding them in state keeps the effect free of anything that changes,
     where refs updated during render are something React's rules forbid. */
  const [facts] = useState(() => buildLifeShiftFacts(shifts));
  const [requestDepth] = useState(depth);

  useEffect(() => {
    if (facts.length === 0 || startedRef.current) return;
    startedRef.current = true;

    /* Aborted on unmount so navigating away does not land a setState on a dead
       component. */
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch("/api/chart/life-shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shifts: facts, depth: requestDepth }),
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

    return () => {
      controller.abort();
      /* So the StrictMode remount can ask again; see the note above. */
      startedRef.current = false;
    };
  }, [facts, requestDepth]);

  /* No chapters means nothing to ask for, which reads the same as a failure. */
  return { state: facts.length === 0 ? "failed" : state, readings };
}
