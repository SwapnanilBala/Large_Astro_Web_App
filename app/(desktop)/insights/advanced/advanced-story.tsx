"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
 * remounts this component.
 */
const inFlight = new Map<string, Promise<AdvancedStoryOutcome>>();

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
  const [state, setState] = useState<StoryState>({
    status: "loading",
    elapsedMs: 0,
    attempt: 1,
  });
  const [retryToken, setRetryToken] = useState(0);
  const startedAt = useRef<number>(Date.now());
  /* Lives across the effect's own re-runs so a second mount joining a request
     already in flight reports the attempt that request is really on. */
  const attemptRef = useRef(1);

  const retry = useCallback(() => setRetryToken((token) => token + 1), []);

  useEffect(() => {
    if (!queryString) {
      setState({ status: "off" });
      return;
    }

    /* Cancelled rather than aborted: the request may be shared with another
       mount of this component, so this instance stops listening instead of
       tearing down work somebody else is waiting on. */
    let cancelled = false;
    let ticker: ReturnType<typeof setInterval> | null = null;

    const stopTicking = () => {
      if (ticker) clearInterval(ticker);
      ticker = null;
    };

    const key = `${queryString}#${retryToken}`;

    const fetchOnce = async (): Promise<AdvancedStoryOutcome> => {
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
             would cost more than the retry saves. */
          attemptRef.current = attempt + 1;
          if (!cancelled) {
            setState((previous) =>
              previous.status === "loading"
                ? { ...previous, attempt: attempt + 1 }
                : previous,
            );
          }
        }
      }
      throw new Error("unreachable");
    };

    let pending = inFlight.get(key);
    if (!pending) {
      startedAt.current = Date.now();
      attemptRef.current = 1;
      pending = fetchOnce().finally(() => {
        inFlight.delete(key);
      });
      inFlight.set(key, pending);
    }

    setState({
      status: "loading",
      elapsedMs: Date.now() - startedAt.current,
      attempt: attemptRef.current,
    });
    ticker = setInterval(() => {
      if (cancelled) return;
      setState((previous) =>
        previous.status === "loading"
          ? { ...previous, elapsedMs: Date.now() - startedAt.current }
          : previous,
      );
    }, TICK_MS);

    pending
      .then((outcome) => {
        if (cancelled) return;
        stopTicking();
        if (outcome.kind === "story") setState({ status: "ready", story: outcome.story });
        else if (outcome.kind === "limit") setState({ status: "failed", reason: "limit", retry });
        else if (outcome.kind === "signedOut")
          setState({ status: "failed", reason: "signedOut", retry });
        else setState({ status: "off" });
      })
      .catch(() => {
        if (cancelled) return;
        stopTicking();
        setState({ status: "failed", reason: "unavailable", retry });
      });

    return () => {
      cancelled = true;
      stopTicking();
    };
  }, [queryString, retry, retryToken]);

  return state;
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
