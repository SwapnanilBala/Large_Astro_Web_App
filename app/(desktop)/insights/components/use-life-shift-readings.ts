"use client";

import { useEffect, useRef, useState } from "react";
import type { MajorLifeShift } from "@/lib/engines/major-shifts-engine";
import type { ClassicalReading } from "@/lib/knowledge/classical-reading";
import {
  LIFE_SHIFTS_STREAM_TYPE,
  MAX_LIFE_SHIFTS,
  lifeShiftId,
  type LifeShiftDepth,
  type LifeShiftReading,
} from "@/lib/life-shift-reading";

export type LifeShiftReadingsState = "pending" | "ready" | "failed";

export type LifeShiftReadings = {
  state: LifeShiftReadingsState;
  /** Chapter id -> the cited reading written for it. Empty until `ready`. */
  readings: Map<string, ClassicalReading>;
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
 *   on nothing that can change but the language. Depending on `shifts` looks
 *   more correct and is worse: the array is rebuilt by a useMemo in the panel,
 *   and any parent re-render that changed its identity would re-fetch every
 *   reading. The chapters cannot change without a navigation, which unmounts
 *   this anyway.
 *
 * The reading is written in the page's language, so a language switch asks
 * again, and readings in the old language are not shown meanwhile: they are
 * filed with the language they were written in.
 *
 * What is sent is the chart's query string, the ids of the chapters and the
 * language, not the chapters themselves: the route rebuilds the chart and writes the facts
 * the model reads from it, so nothing typed into a request reaches the
 * prompt. The readings come back on the same ids the panel files them under.
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
const NO_READINGS: Map<string, ClassicalReading> = new Map();

export function useLifeShiftReadings(
  shifts: MajorLifeShift[],
  depth: LifeShiftDepth,
  /** The chart's query string, which the route rebuilds the chapters from. */
  historyQs: string,
  /** The page's language, which the readings are written in. */
  language: string = "en",
): LifeShiftReadings {
  const [result, setResult] = useState<{
    language: string;
    /* "pending" while a stream has delivered some chapters and not the rest. */
    state: LifeShiftReadingsState;
    readings: Map<string, ClassicalReading>;
  } | null>(null);
  const startedRef = useRef(false);
  /* Taken once, from the render this hook mounted with. The request is once
     per mounted lifetime, so these are the only inputs it will ever send;
     holding them in state keeps the effect free of anything that changes,
     where refs updated during render are something React's rules forbid. */
  const [ids] = useState(() => shifts.slice(0, MAX_LIFE_SHIFTS).map(lifeShiftId));
  const [requestDepth] = useState(depth);
  const [query] = useState(historyQs);

  useEffect(() => {
    if (ids.length === 0 || startedRef.current) return;
    startedRef.current = true;

    /* Aborted on unmount so navigating away does not land a setState on a dead
       component. */
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch(`/api/chart/life-shifts?${query}`, {
          method: "POST",
          /* The stream when the route splits the set (the chapters ahead in a
             call of their own); plain JSON otherwise, and always on a cache hit. */
          headers: { "Content-Type": "application/json", Accept: `${LIFE_SHIFTS_STREAM_TYPE}, application/json` },
          body: JSON.stringify({ ids, depth: requestDepth, language }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const next = new Map<string, ClassicalReading>();
        const take = (entries: unknown) => {
          for (const entry of Array.isArray(entries) ? (entries as LifeShiftReading[]) : []) {
            if (entry && typeof entry.id === "string" && Array.isArray(entry.reading?.segments) && Array.isArray(entry.reading?.sources)) {
              next.set(entry.id, entry.reading);
            }
          }
        };
        const streamed = (response.headers.get("content-type") ?? "").includes(LIFE_SHIFTS_STREAM_TYPE);
        if (streamed && response.body) {
          /* Each batch shows as it lands; the cards still waiting keep their bar. */
          await readLines(response.body, (line) => {
            if (line.type !== "readings") return;
            take(line.readings);
            if (next.size > 0) setResult({ language, state: "pending", readings: new Map(next) });
          });
        } else {
          take(((await response.json()) as { readings?: unknown }).readings);
        }
        if (next.size === 0) throw new Error("no readings");
        setResult({ language, state: "ready", readings: next });
      } catch (error) {
        if (controller.signal.aborted) return;
        /* Quiet on purpose. Every failure here has the same consequence for
           the reader, which is that the chapters keep their template wording. */
        console.warn("life shift readings unavailable:", error);
        setResult({ language, state: "failed", readings: new Map() });
      }
    })();

    return () => {
      controller.abort();
      /* So the StrictMode remount can ask again; see the note above. */
      startedRef.current = false;
    };
  }, [ids, requestDepth, query, language]);

  /* No chapters means nothing to ask for, which reads the same as a failure. */
  if (ids.length === 0) return { state: "failed", readings: NO_READINGS };
  if (!result || result.language !== language) return { state: "pending", readings: NO_READINGS };
  return { state: result.state, readings: result.readings };
}

/** Each line of an NDJSON body, parsed; a line that is not JSON is skipped. */
async function readLines(body: ReadableStream<Uint8Array>, onLine: (line: Record<string, unknown>) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  const take = (text: string) => {
    if (!text.trim()) return;
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === "object") onLine(parsed as Record<string, unknown>);
    } catch {
      /* not a line of ours */
    }
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffered += decoder.decode(value, { stream: true });
    let newline = buffered.indexOf("\n");
    while (newline >= 0) {
      take(buffered.slice(0, newline));
      buffered = buffered.slice(newline + 1);
      newline = buffered.indexOf("\n");
    }
  }
  take(buffered + decoder.decode());
}
