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
 * The atlas's chart-specific notes, fetched once per mounted lifetime.
 *
 * "Once" is the whole point of this hook and it is guarded twice, because the
 * two ways it could fire twice are unrelated:
 *
 *   `startedRef` stops a second request inside one lifetime, and is cleared
 *   in the cleanup rather than left latched. Latching it is what deadlocks
 *   this shape: if anything unmounts and remounts the hook on the same
 *   instance, the cleanup aborts the in-flight request and the ref then
 *   refuses to start another, so the only request ever made is one that was
 *   cancelled before it left the browser -- and the server never sees a
 *   request at all. That is what had happened to the sibling
 *   `useLifeShiftReadings` (bdf8dce).
 *
 *   It is not what happens here, which is worth writing down because the two
 *   hooks look identical. Measured on this page, the effect runs once and this
 *   cleanup does not run before the notes arrive: the atlas client is rendered
 *   straight from the server page, where the brief life-shifts panel is
 *   reached through `dynamic(..., { ssr: false })`. So the reset is insurance
 *   for the day the atlas moves behind a lazy boundary rather than a fix for
 *   anything visible today, and it is free either way -- an aborted request
 *   never reaches the route, so clearing the ref cannot buy a second billed
 *   call.
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
       dead component. */
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

    return () => {
      controller.abort();
      /* So a remount can ask again; see the note above. */
      startedRef.current = false;
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount; see above.
       `language` is read at fire time on purpose: a locale switch mid-page does
       not re-fetch, because that would spend a second call to re-word a note
       the reader already has. It applies on the next visit. */
  }, []);

  return { state, notes };
}
