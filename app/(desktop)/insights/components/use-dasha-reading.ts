"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClassicalReading, ClassicalReadingResponse } from "@/lib/knowledge/classical-reading";
import { announceIfFreeUsageExhausted } from "@/lib/free-usage-store";

/** Where one period's reading stands. */
export type DashaReadingState =
  | { status: "pending" }
  | { status: "ready"; reading: ClassicalReading }
  /* The books have nothing on this period's planets for this chart. */
  | { status: "empty" }
  /* Today's allowance is spent; `signIn` when signing in would buy more. */
  | { status: "limited"; signIn: boolean }
  | { status: "failed" };

export type DashaReadings = {
  /** A period's reading in a language, or undefined if it has not been asked for in it. */
  readingFor: (key: string, language: string) => DashaReadingState | undefined;
  /** Ask for a period's reading: its lords from the Maha Dasha down, and its first day. */
  read: (key: string, lords: readonly string[], start: string, language: string) => void;
};

const OK: Pick<RequestInit, "cache" | "credentials"> = { cache: "no-store", credentials: "same-origin" };

/**
 * The period readings on the dasha panel: one per period and language, asked
 * for only when the reader presses "Read this period", and kept for as long as
 * the panel is mounted, so going back to a period never asks again. A failed
 * reading can be asked for again; an answered one is not re-bought.
 *
 * A refused allowance raises the sign-in prompt, as the drill-down's paid
 * reading always has: here too the reader asked, by clicking.
 *
 * Every request follows a click, so nothing fires on mount and there is no
 * once-per-mount latch for StrictMode to trip over. Requests still in flight
 * when the panel unmounts are abandoned.
 */
export function useDashaReading(historyQs: string): DashaReadings {
  const [readings, setReadings] = useState<Record<string, DashaReadingState>>({});
  /* What each period last came to, read by `read` without re-creating it on every answer. */
  const settledRef = useRef(new Map<string, DashaReadingState["status"]>());
  const controllersRef = useRef(new Set<AbortController>());

  useEffect(() => {
    const controllers = controllersRef.current;
    return () => {
      for (const controller of controllers) controller.abort();
      controllers.clear();
    };
  }, []);

  const settle = useCallback((key: string, state: DashaReadingState) => {
    settledRef.current.set(key, state.status);
    setReadings((current) => ({ ...current, [key]: state }));
  }, []);

  const read = useCallback(
    (period: string, lords: readonly string[], start: string, language: string) => {
      const key = `${language}|${period}`;
      const status = settledRef.current.get(key);
      if (status === "pending" || status === "ready" || status === "empty") return;
      settle(key, { status: "pending" });

      const controller = new AbortController();
      controllersRef.current.add(controller);
      (async () => {
        try {
          const response = await fetch(`/api/chart/dasha-reading?${historyQs}`, {
            ...OK,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lords, start, language }),
            signal: controller.signal,
          });
          if (response.status === 429) {
            const signIn = await announceIfFreeUsageExhausted(response, "dashaInterpretation");
            return settle(key, { status: "limited", signIn });
          }
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = (await response.json()) as Partial<ClassicalReadingResponse>;
          const reading = data.reading;
          settle(
            key,
            reading && reading.segments.length > 0 && reading.sources.length > 0
              ? { status: "ready", reading }
              : { status: "empty" },
          );
        } catch (error) {
          if (controller.signal.aborted) return;
          console.warn("period reading failed:", error);
          settle(key, { status: "failed" });
        } finally {
          controllersRef.current.delete(controller);
        }
      })();
    },
    [historyQs, settle],
  );

  const readingFor = useCallback((period: string, language: string) => readings[`${language}|${period}`], [readings]);

  return { readingFor, read };
}
