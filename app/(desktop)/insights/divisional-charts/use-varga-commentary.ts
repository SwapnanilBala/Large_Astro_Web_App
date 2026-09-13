"use client";

import { useEffect, useRef, useState } from "react";
import type { DivisionalChartInfo } from "@/lib/astro-types";
import { buildVargaFacts, type VargaNote } from "@/lib/varga-commentary";

export type VargaCommentaryState = "pending" | "ready" | "failed";

export type VargaCommentary = {
  state: VargaCommentaryState;
  /** Division number -> the note written for it. Empty until `ready`. */
  notes: Map<number, string>;
};

/**
 * The atlas's chart-specific notes, fetched exactly once per mount.
 *
 * "Once" is the whole point of this hook and it is guarded twice, because the
 * two ways it could fire twice are unrelated:
 *
 *   `startedRef` covers React's development double-invoke of effects. Without
 *   it, every local page load would bill two calls -- and they would not even
 *   dedupe against each other, because both would miss the server's cache on
 *   the way in.
 *
 *   The empty dependency array covers re-renders. The obvious alternative,
 *   depending on `charts`, looks more correct and is worse: the atlas re-renders
 *   on every tab click, and a new object identity on any of them would re-fetch
 *   all ten notes. The chart cannot change without a navigation, which unmounts
 *   this anyway.
 *
 * Deliberately off the critical path. The atlas renders its curated guidance
 * for every varga immediately; these notes arrive when they arrive -- around
 * 25 seconds on a cold chart, instantly on a warm one -- and a failure leaves
 * the page exactly as complete as it was before the feature existed.
 */
export function useVargaCommentary(
  charts: Record<number, DivisionalChartInfo>,
  language: string,
): VargaCommentary {
  const [state, setState] = useState<VargaCommentaryState>("pending");
  const [notes, setNotes] = useState<Map<number, string>>(() => new Map());
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const facts = buildVargaFacts(charts);
    if (facts.length === 0) {
      setState("failed");
      return;
    }

    /* Aborted on unmount so a navigation away does not land a setState on a
       dead component. The request itself is already in flight and the server
       will finish and cache it, which is the right outcome -- coming back to
       the atlas then costs nothing. */
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch("/api/chart/varga-commentary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ divisions: facts, language }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as { notes?: VargaNote[] };
        const next = new Map<number, string>();
        for (const entry of data.notes ?? []) {
          if (entry && typeof entry.note === "string" && entry.note.trim()) {
            next.set(entry.division, entry.note.trim());
          }
        }
        if (next.size === 0) throw new Error("no notes");
        setNotes(next);
        setState("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        /* Quiet on purpose. Every failure here -- no API key, budget spent,
           rate limited, the model declining -- has the same consequence for
           the reader, which is that this one panel does not appear. */
        console.warn("varga commentary unavailable:", error);
        setState("failed");
      }
    })();

    return () => controller.abort();
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount; see above.
       `language` is read at fire time on purpose: a locale switch mid-page does
       not re-fetch, because that would spend a second call to re-word a note
       the reader already has. It applies on the next visit. */
  }, []);

  return { state, notes };
}
