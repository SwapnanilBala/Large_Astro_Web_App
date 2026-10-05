"use client";

import { useEffect, useRef, useState } from "react";
import type { ClassicalNoteState } from "@/app/(desktop)/insights/components/classical-note";
import type { AreaClassicsResponse } from "@/lib/knowledge/classical-reading";

export type AreaClassics = {
  /** "empty" when the book has nothing for any area of this chart. */
  state: ClassicalNoteState;
  readings: AreaClassicsResponse["readings"];
};

/**
 * The life areas' classical notes, every area in one request, fetched once
 * per mounted lifetime. Moving between areas reads from what came back and
 * never asks again, which is what keeps the reader's daily allowance for
 * other things.
 *
 * Shaped like useYogaClassics: the language is taken once, as state, so a
 * language switch mid-page applies on the next visit rather than paying to
 * re-word notes already on screen; and `startedRef` is cleared in the cleanup,
 * so StrictMode's remount can ask again after its unmount aborted the first
 * request, which never reached the route.
 */
export function useAreaClassics(historyQs: string, language: string): AreaClassics {
  const [state, setState] = useState<ClassicalNoteState>("pending");
  const [readings, setReadings] = useState<AreaClassicsResponse["readings"]>({});
  const startedRef = useRef(false);
  const [query] = useState(() => `${historyQs}&language=${encodeURIComponent(language)}`);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch(`/api/chart/area-classics?${query}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as Partial<AreaClassicsResponse>;
        const usable = Object.fromEntries(
          Object.entries(data.readings ?? {}).filter(
            ([, reading]) => reading && reading.segments.length > 0 && reading.sources.length > 0,
          ),
        );
        setReadings(usable);
        setState(Object.keys(usable).length > 0 ? "ready" : "empty");
      } catch (error) {
        if (controller.signal.aborted) return;
        /* Quiet on purpose: every failure has the same consequence for the
           reader, which is that the card does not appear. */
        console.warn("classical life-area notes unavailable:", error);
        setState("failed");
      }
    })();

    return () => {
      controller.abort();
      startedRef.current = false;
    };
  }, [query]);

  return { state, readings };
}
