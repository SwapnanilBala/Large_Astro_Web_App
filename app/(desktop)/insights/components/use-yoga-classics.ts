"use client";

import { useEffect, useRef, useState } from "react";
import type { YogaDetectionResult } from "@/lib/astro-types";
import {
  yogaClassicsRequest,
  type YogaClassicsReading,
  type YogaClassicsResponse,
} from "@/lib/knowledge/yoga-classics";

/**
 * "pending" until the route answers. "empty" when it answers that none of the
 * chart's yogas is in the library, which costs nothing and shows nothing.
 * "failed" covers everything else the reader cannot act on: no key, budget
 * spent, rate limited, the model declining.
 */
export type YogaClassicsState = "pending" | "ready" | "empty" | "failed";

export type YogaClassics = {
  state: YogaClassicsState;
  reading: YogaClassicsReading | null;
};

/**
 * The classical note for the yoga section, fetched once per mounted lifetime.
 *
 * The same shape as `useVargaCommentary`, for the same reasons, and one of
 * them is not optional here: the yoga panel is reached through
 * `dynamic(..., { ssr: false })` inside a LazyPanel, which is exactly the
 * mounting that lets StrictMode abort the first request. So `startedRef` is
 * cleared in the cleanup, letting the remount ask again; an aborted request
 * never reaches the route, so that cannot buy a second billed call.
 *
 * The yogas and the language are taken once, as state, so a re-render with a
 * new array identity -- every category tab click is one -- does not re-fetch,
 * and a language switch mid-page applies on the next visit rather than paying
 * to re-word a note already on screen.
 */
export function useYogaClassics(yogas: YogaDetectionResult[], language: string): YogaClassics {
  const [state, setState] = useState<YogaClassicsState>("pending");
  const [reading, setReading] = useState<YogaClassicsReading | null>(null);
  const startedRef = useRef(false);
  const [request] = useState(() => yogaClassicsRequest(yogas));
  const [requestLanguage] = useState(language);

  useEffect(() => {
    if (request.length === 0 || startedRef.current) return;
    startedRef.current = true;
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch("/api/chart/yoga-classics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ yogas: request, language: requestLanguage }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as YogaClassicsResponse;
        if (!data.reading) {
          setState("empty");
          return;
        }
        if (data.reading.segments.length === 0 || data.reading.sources.length === 0) {
          throw new Error("reading without sources");
        }
        setReading(data.reading);
        setState("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        /* Quiet on purpose: every failure has the same consequence for the
           reader, which is that this one card does not appear. */
        console.warn("classical yoga note unavailable:", error);
        setState("failed");
      }
    })();

    return () => {
      controller.abort();
      startedRef.current = false;
    };
  }, [request, requestLanguage]);

  return { state: request.length === 0 ? "empty" : state, reading };
}
