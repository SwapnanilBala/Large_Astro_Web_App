"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isAskQuestionId,
  type AskClassicsAnswer,
  type AskClassicsAvailability,
  type AskQuestionId,
  type AskRefusal,
  type AskTypedAnswer,
} from "@/lib/knowledge/ask-questions";
import type { ClassicalReading } from "@/lib/knowledge/classical-reading";

/** Where one question's answer stands. */
export type AskAnswer =
  | { status: "pending" }
  | { status: "ready"; reading: ClassicalReading }
  /* The books have nothing for this question in this chart. */
  | { status: "empty" }
  /* A typed question the screen would not let through, and why. */
  | { status: "refused"; reason: AskRefusal }
  /* Today's allowance is spent; `signIn` when signing in would buy more. */
  | { status: "limited"; signIn: boolean }
  | { status: "failed" };

/** The question the reader last typed, as they typed it, and where its answer stands. */
export type TypedAnswer = { text: string; answer: AskAnswer };

export type AskClassics = {
  /** The fixed questions the books can answer for this chart; null until known, empty on any failure. */
  available: AskQuestionId[] | null;
  /** Whether finding that out failed, in which case the panel does not appear. */
  unavailable: boolean;
  /** A fixed question's answer in a language, or undefined if it has not been asked in it. */
  answerFor: (id: AskQuestionId, language: string) => AskAnswer | undefined;
  ask: (id: AskQuestionId, language: string) => void;
  typed: TypedAnswer | null;
  askTyped: (text: string, language: string) => void;
};

const OK: Pick<RequestInit, "cache" | "credentials"> = { cache: "no-store", credentials: "same-origin" };

/** What a response that is not an answer means for the reader. */
async function notAnswered(response: Response): Promise<AskAnswer | null> {
  if (response.status === 429) {
    const body = (await response.json().catch(() => null)) as { error?: { details?: { scope?: string } } } | null;
    return { status: "limited", signIn: body?.error?.details?.scope === "anonymous" };
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return null;
}

const readingOrEmpty = (reading: ClassicalReading | null | undefined): AskAnswer =>
  reading && reading.segments.length > 0 && reading.sources.length > 0 ? { status: "ready", reading } : { status: "empty" };

/**
 * "Ask the classics": which fixed questions this chart can be asked, fetched
 * once per mounted lifetime and paid for by nobody; each fixed question's
 * answer, fetched when the reader picks it and kept per language, so going
 * back to it never asks again; and the answer to a question the reader types.
 * A failed question can be asked again; an answered one is not re-bought.
 *
 * The language is read at the moment of asking, not taken once: every
 * request here follows a click, after the page knows the reader's language.
 *
 * Like the other classics hooks, `startedRef` is cleared in the cleanup, so
 * StrictMode's remount can ask again after its unmount aborted the first
 * request, which never reached the route.
 */
export function useAskClassics(historyQs: string): AskClassics {
  const [available, setAvailable] = useState<AskQuestionId[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [answers, setAnswers] = useState<Record<string, AskAnswer>>({});
  const [typed, setTyped] = useState<TypedAnswer | null>(null);
  const startedRef = useRef(false);
  /* What each question last came to, read by `ask` without re-creating it on every answer. */
  const settledRef = useRef(new Map<string, AskAnswer["status"]>());
  const typingRef = useRef(false);
  const controllersRef = useRef(new Set<AbortController>());
  const [query] = useState(() => historyQs);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch(`/api/chart/ask-classics?${query}`, { ...OK, signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as Partial<AskClassicsAvailability>;
        setAvailable((data.available ?? []).filter(isAskQuestionId));
      } catch (error) {
        if (controller.signal.aborted) return;
        /* Quiet on purpose: the panel simply does not appear. */
        console.warn("ask the classics unavailable:", error);
        setAvailable([]);
        setUnavailable(true);
      }
    })();

    return () => {
      controller.abort();
      startedRef.current = false;
    };
  }, [query]);

  /* Abandon any answer still in flight when the page goes away. */
  useEffect(() => {
    const controllers = controllersRef.current;
    return () => {
      for (const controller of controllers) controller.abort();
      controllers.clear();
    };
  }, []);

  /** A request that is abandoned with the page; resolves to null when it was. */
  const send = useCallback(async (url: string, init: RequestInit = {}): Promise<Response | null> => {
    const controller = new AbortController();
    controllersRef.current.add(controller);
    try {
      return await fetch(url, { ...OK, ...init, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) return null;
      throw error;
    } finally {
      controllersRef.current.delete(controller);
    }
  }, []);

  const settle = useCallback((key: string, answer: AskAnswer) => {
    settledRef.current.set(key, answer.status);
    setAnswers((current) => ({ ...current, [key]: answer }));
  }, []);

  const ask = useCallback(
    (id: AskQuestionId, language: string) => {
      const key = `${language}|${id}`;
      const status = settledRef.current.get(key);
      if (status === "pending" || status === "ready" || status === "empty") return;
      settle(key, { status: "pending" });

      (async () => {
        try {
          const params = `question=${encodeURIComponent(id)}&language=${encodeURIComponent(language)}`;
          const response = await send(`/api/chart/ask-classics?${query}&${params}`);
          if (!response) return;
          const refused = await notAnswered(response);
          if (refused) return settle(key, refused);
          const data = (await response.json()) as Partial<AskClassicsAnswer>;
          settle(key, readingOrEmpty(data.reading));
        } catch (error) {
          console.warn("a question to the classics failed:", error);
          settle(key, { status: "failed" });
        }
      })();
    },
    [query, send, settle],
  );

  const askTyped = useCallback(
    (text: string, language: string) => {
      /* One typed question at a time: a second click while one is out would spend another of the day's questions. */
      if (typingRef.current) return;
      typingRef.current = true;
      setTyped({ text, answer: { status: "pending" } });

      (async () => {
        let answer: AskAnswer;
        try {
          const response = await send(`/api/chart/ask-classics?${query}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, language }),
          });
          if (!response) return;
          const refused = await notAnswered(response);
          if (refused) {
            answer = refused;
          } else {
            const data = (await response.json()) as Partial<AskTypedAnswer>;
            answer = data.refused ? { status: "refused", reason: data.refused } : readingOrEmpty(data.reading);
          }
        } catch (error) {
          console.warn("a typed question to the classics failed:", error);
          answer = { status: "failed" };
        } finally {
          typingRef.current = false;
        }
        setTyped({ text, answer });
      })();
    },
    [query, send],
  );

  const answerFor = useCallback((id: AskQuestionId, language: string) => answers[`${language}|${id}`], [answers]);

  return { available, unavailable, answerFor, ask, typed, askTyped };
}
