"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isAskQuestionId,
  type AskClassicsAnswer,
  type AskClassicsAvailability,
  type AskQuestionId,
} from "@/lib/knowledge/ask-questions";
import type { ClassicalReading } from "@/lib/knowledge/classical-reading";

/** Where one question's answer stands. */
export type AskAnswer =
  | { status: "pending" }
  | { status: "ready"; reading: ClassicalReading }
  /* The books have nothing for this question in this chart. */
  | { status: "empty" }
  /* Today's allowance is spent; `signIn` when signing in would buy more. */
  | { status: "limited"; signIn: boolean }
  | { status: "failed" };

export type AskClassics = {
  /** The questions the books can answer for this chart; null until known, empty on any failure. */
  available: AskQuestionId[] | null;
  answers: Partial<Record<AskQuestionId, AskAnswer>>;
  ask: (id: AskQuestionId) => void;
};

/**
 * "Ask the classics": which questions this chart can be asked, fetched once
 * per mounted lifetime and paid for by nobody, and each question's answer,
 * fetched when the reader picks it and kept, so going back to a question never
 * asks again. A failed question can be picked again to retry; an answered one
 * cannot be re-bought.
 *
 * Like the other classics hooks, `startedRef` is cleared in the cleanup, so
 * StrictMode's remount can ask again after its unmount aborted the first
 * request, which never reached the route.
 */
export function useAskClassics(historyQs: string, enabled: boolean): AskClassics {
  const [available, setAvailable] = useState<AskQuestionId[] | null>(null);
  const [answers, setAnswers] = useState<Partial<Record<AskQuestionId, AskAnswer>>>({});
  const startedRef = useRef(false);
  /* What each question last came to, read by `ask` without re-creating it on every answer. */
  const settledRef = useRef(new Map<AskQuestionId, AskAnswer["status"]>());
  const controllersRef = useRef(new Set<AbortController>());
  const [query] = useState(() => historyQs);

  useEffect(() => {
    if (!enabled || startedRef.current) return;
    startedRef.current = true;
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch(`/api/chart/ask-classics?${query}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as Partial<AskClassicsAvailability>;
        setAvailable((data.available ?? []).filter(isAskQuestionId));
      } catch (error) {
        if (controller.signal.aborted) return;
        /* Quiet on purpose: the panel simply does not appear. */
        console.warn("ask the classics unavailable:", error);
        setAvailable([]);
      }
    })();

    return () => {
      controller.abort();
      startedRef.current = false;
    };
  }, [enabled, query]);

  /* Abandon any answer still in flight when the page goes away. */
  useEffect(() => {
    const controllers = controllersRef.current;
    return () => {
      for (const controller of controllers) controller.abort();
      controllers.clear();
    };
  }, []);

  const settle = useCallback((id: AskQuestionId, answer: AskAnswer) => {
    settledRef.current.set(id, answer.status);
    setAnswers((current) => ({ ...current, [id]: answer }));
  }, []);

  const ask = useCallback(
    (id: AskQuestionId) => {
      const status = settledRef.current.get(id);
      if (status === "pending" || status === "ready" || status === "empty") return;
      settle(id, { status: "pending" });
      const controller = new AbortController();
      controllersRef.current.add(controller);

      (async () => {
        try {
          const response = await fetch(`/api/chart/ask-classics?${query}&question=${encodeURIComponent(id)}`, {
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal,
          });
          if (response.status === 429) {
            const body = (await response.json().catch(() => null)) as
              | { error?: { details?: { scope?: string } } }
              | null;
            settle(id, { status: "limited", signIn: body?.error?.details?.scope === "anonymous" });
            return;
          }
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = (await response.json()) as Partial<AskClassicsAnswer>;
          const reading = data.reading;
          if (reading && reading.segments.length > 0 && reading.sources.length > 0) {
            settle(id, { status: "ready", reading });
          } else {
            settle(id, { status: "empty" });
          }
        } catch (error) {
          if (controller.signal.aborted) return;
          console.warn("a question to the classics failed:", error);
          settle(id, { status: "failed" });
        } finally {
          controllersRef.current.delete(controller);
        }
      })();
    },
    [query, settle],
  );

  return { available, answers, ask };
}
