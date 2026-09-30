"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import advStyles from "./advanced.module.css";
import type { AdvancedModuleKey } from "@/lib/engines/advanced-digest";

/**
 * The prose that stands in front of the advanced panels.
 *
 * The panels are unchanged and still on the page; they move behind a toggle.
 * Everything here degrades to exactly the old page: a missing passage renders
 * its panel open the way it always did.
 */

export type AdvancedStory = {
  opening: string;
  passages: Partial<Record<AdvancedModuleKey, string>>;
};

/**
 * How long the whole page's prose takes.
 *
 * One measured cold run against a real key: 23.9s for eight passages. That is a
 * single sample, not a distribution, so treat this as an order of magnitude
 * rather than a promise -- which is why overrunning it is handled explicitly
 * below instead of letting the countdown run past zero.
 */
const ESTIMATED_MS = 24_000;

const TICK_MS = 250;

/** One retry, because most of what fails here is a slow provider, not a bad request. */
const MAX_ATTEMPTS = 2;

/**
 * In-flight requests, keyed by chart and retry attempt.
 *
 * This exists because the route costs money and the allowance is per day. With
 * `reactStrictMode` on, React mounts, unmounts and remounts every effect in
 * development, so the naive version issued two requests per page view --
 * measured, not theorised. Aborting the first does not help: the server has
 * already taken the request and spent the budget by the time the abort lands.
 *
 * Sharing the promise makes a second mount attach to the first call instead of
 * starting another, which is correct in production too for anything that
 * remounts this component. The start time and the attempt live on the entry
 * for the same reason: a mount that joins reports the request's progress, not
 * its own.
 */
type InFlightStory = {
  promise: Promise<AdvancedStoryOutcome>;
  startedAt: number;
  attempt: number;
};

const inFlight = new Map<string, InFlightStory>();

type AdvancedStoryOutcome =
  | { kind: "story"; story: AdvancedStory }
  | { kind: "limit" }
  | { kind: "signedOut" }
  | { kind: "off" };

export type StoryState =
  | { status: "loading"; elapsedMs: number; attempt: number }
  | { status: "ready"; story: AdvancedStory }
  /* `limit` and `unavailable` are the two the reader can act on -- one by
     signing in, one by trying again. `off` is a deployment with no key, where
     there is nothing to say and nothing to retry. */
  | { status: "failed"; reason: "limit" | "unavailable" | "signedOut"; retry: () => void }
  | { status: "off" };

const LOADING_FROM_ZERO: StoryState = { status: "loading", elapsedMs: 0, attempt: 1 };
const STORY_OFF: StoryState = { status: "off" };

/**
 * Fetches the whole page's prose in one request.
 *
 * One request is a budget constraint, not a style choice -- see the route.
 *
 * A transient failure retries once on its own before the reader is told
 * anything, and offers a manual retry after that. Falling straight through to
 * the raw panels was the old behaviour and it is still the floor, but it should
 * not be the first answer to a provider that was merely slow.
 */
export function useAdvancedStory(queryString: string): StoryState {
  const [retryToken, setRetryToken] = useState(0);
  const requestKey = `${queryString}#${retryToken}`;
  /* The latest state recorded for a request, and which request. One with
     nothing recorded yet is loading from zero -- derived, where it used to be
     set as the effect started. */
  const [recorded, setRecorded] = useState<{ key: string; state: StoryState } | null>(null);

  const retry = useCallback(() => setRetryToken((token) => token + 1), []);

  useEffect(() => {
    if (!queryString) return;

    /* Cancelled rather than aborted: the request may be shared with another
       mount of this component, so this instance stops listening instead of
       tearing down work somebody else is waiting on. */
    let cancelled = false;
    let ticker: ReturnType<typeof setInterval> | null = null;

    const stopTicking = () => {
      if (ticker) clearInterval(ticker);
      ticker = null;
    };

    const key = requestKey;
    const record = (next: (previous: StoryState) => StoryState) => {
      if (cancelled) return;
      setRecorded((current) => ({
        key,
        state: next(current?.key === key ? current.state : LOADING_FROM_ZERO),
      }));
    };

    const fetchOnce = async (entry: InFlightStory): Promise<AdvancedStoryOutcome> => {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
          const response = await fetch(`/api/chart/advanced-story?${queryString}`);

          /* None of these three improve by asking again: 503 is "no key
             configured", 429 is "you have used today's", and 401 is a session
             that has gone. The page gate means a signed-out visitor normally
             never gets here -- 401 is the expiry case, reached by sitting on
             the page long enough. */
          if (response.status === 503) return { kind: "off" };
          if (response.status === 429) return { kind: "limit" };
          if (response.status === 401) return { kind: "signedOut" };
          if (!response.ok) throw new Error(`status ${response.status}`);

          return { kind: "story", story: (await response.json()) as AdvancedStory };
        } catch (error) {
          if (attempt >= MAX_ATTEMPTS) throw error;
          /* Straight back in. The wait is already long; a backoff on top of it
             would cost more than the retry saves. The next tick reports it. */
          entry.attempt = attempt + 1;
        }
      }
      throw new Error("unreachable");
    };

    let entry = inFlight.get(key);
    if (!entry) {
      const fresh = { startedAt: Date.now(), attempt: 1 } as InFlightStory;
      fresh.promise = fetchOnce(fresh).finally(() => {
        inFlight.delete(key);
      });
      inFlight.set(key, fresh);
      entry = fresh;
    }
    const shared = entry;

    ticker = setInterval(() => {
      record((previous) =>
        previous.status === "loading"
          ? { ...previous, elapsedMs: Date.now() - shared.startedAt, attempt: shared.attempt }
          : previous,
      );
    }, TICK_MS);

    shared.promise
      .then((outcome) => {
        stopTicking();
        if (outcome.kind === "story") record(() => ({ status: "ready", story: outcome.story }));
        else if (outcome.kind === "limit") record(() => ({ status: "failed", reason: "limit", retry }));
        else if (outcome.kind === "signedOut")
          record(() => ({ status: "failed", reason: "signedOut", retry }));
        else record(() => ({ status: "off" }));
      })
      .catch(() => {
        stopTicking();
        record(() => ({ status: "failed", reason: "unavailable", retry }));
      });

    return () => {
      cancelled = true;
      stopTicking();
    };
  }, [queryString, requestKey, retry]);

  if (!queryString) return STORY_OFF;
  return recorded?.key === requestKey ? recorded.state : LOADING_FROM_ZERO;
}

/**
 * The wait, made legible.
 *
 * Twenty-four seconds of nothing reads as broken. A countdown reads as work.
 */
export function StoryProgress({ state }: { state: StoryState }) {
  /* Portalled to <body>, and this is load-bearing rather than tidiness.
     `position: fixed` resolves against the nearest ancestor with a transform,
     and this page is built out of Framer Motion wrappers -- one of which sits
     at `matrix(1, 0, 0, 1, 0, 0)`. An identity transform still establishes a
     containing block, so the panel was laid out against a div a thousand pixels
     down the document: measured at top 1640 in a 1000px viewport, present in
     the DOM, correct in every computed style, and entirely off screen.
     The portal needs document.body, so nothing renders until hydration. */
  const mounted = useHydrated();

  if (state.status !== "loading" || !mounted) return null;

  const remainingMs = Math.max(0, ESTIMATED_MS - state.elapsedMs);
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const percent = Math.min(100, Math.round((state.elapsedMs / ESTIMATED_MS) * 100));

  return createPortal(
    <aside
      className={advStyles.storyProgress}
      role="status"
      aria-live="polite"
      aria-label="Writing your reading"
    >
      <p className={advStyles.storyProgressTitle}>Writing your reading</p>
      <p className={advStyles.storyProgressNote}>
        {state.attempt > 1
          ? "Taking a second run at it…"
          : remainingSeconds > 0
            ? `About ${remainingSeconds} second${remainingSeconds === 1 ? "" : "s"} left`
            : "Almost there…"}
      </p>
      {/* aria-hidden: the sentence above already says it, and a screen reader
          announcing a percentage four times a second is unusable. */}
      <div className={advStyles.storyProgressTrack} aria-hidden="true">
        <div className={advStyles.storyProgressFill} style={{ width: `${percent}%` }} />
      </div>
      {/* The sections are collapsed while this runs, but their toggles work
          from first paint -- so this says "one click away", not "open". */}
      <p className={advStyles.storyProgressHint}>
        Every table is one click away below in the meantime.
      </p>
    </aside>,
    document.body,
  );
}

export function StoryOpening({ state }: { state: StoryState }) {
  if (state.status === "loading") {
    return (
      <p className={`${advStyles.storyOpening} ${advStyles.storyPending}`}>
        Reading your chart&#8230;
      </p>
    );
  }

  if (state.status === "failed") {
    return (
      <p className={advStyles.storyOpening}>
        {state.reason === "signedOut" ? (
          <>
            Your session ended.{" "}
            <a className={advStyles.storyToggle} href="/login">
              Sign in again
            </a>{" "}
            to rewrite this reading. Every table is still here, below.
          </>
        ) : state.reason === "limit" ? (
          <>You have used today&#39;s readings. Every table is still here, below.</>
        ) : (
          <>
            The reading could not be written just now.{" "}
            <button type="button" className={advStyles.storyToggle} onClick={state.retry}>
              Try again
            </button>
          </>
        )}
      </p>
    );
  }

  if (state.status === "off") return null;

  return <p className={advStyles.storyOpening}>{state.story.opening}</p>;
}

type StorySectionProps = {
  /**
   * Omit for a panel that shares another panel's passage -- the yoga table
   * sits under the strength passage, and repeating that prose above it would
   * say the same thing twice on one screen. Those sections are a plain
   * disclosure: no prose, and closed until asked for.
   */
  moduleKey?: AdvancedModuleKey;
  state: StoryState;
  /** What the toggle is called, e.g. "the aspect table". */
  detailLabel: string;
  children: ReactNode;
};

/**
 * One module: its passage, then its panel behind a toggle.
 *
 * When a module that should have a passage has none, its panel renders open,
 * because a collapsed section with nothing above it is strictly worse than the
 * page we started with.
 */
export function StorySection({ moduleKey, state, detailLabel, children }: StorySectionProps) {
  const passage =
    moduleKey && state.status === "ready" ? state.story.passages[moduleKey] : undefined;
  const hasPassage = Boolean(passage);
  const isLoading = Boolean(moduleKey) && state.status === "loading";
  const [isOpen, setIsOpen] = useState(false);

  /* Kept in state rather than purely derived, so a reader who closed a section
     stays closed once the prose arrives and changes the default. */
  const [userTouched, setUserTouched] = useState(false);
  const open = userTouched
    ? isOpen
    : Boolean(moduleKey) && !hasPassage && state.status !== "loading";

  return (
    <div className={advStyles.storySection}>
      {isLoading && (
        <p className={`${advStyles.storyPassage} ${advStyles.storyPending}`}>
          Writing this section&#8230;
        </p>
      )}
      {passage && <p className={advStyles.storyPassage}>{passage}</p>}

      <button
        type="button"
        className={advStyles.storyToggle}
        aria-expanded={open}
        onClick={() => {
          setUserTouched(true);
          setIsOpen(!open);
        }}
      >
        {open ? `Hide ${detailLabel}` : `Show ${detailLabel}`}
      </button>

      {open && <div className={advStyles.storyDetail}>{children}</div>}
    </div>
  );
}
