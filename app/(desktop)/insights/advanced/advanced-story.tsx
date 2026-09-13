"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import advStyles from "./advanced.module.css";
import type { AdvancedModuleKey } from "@/lib/engines/advanced-digest";

/**
 * The prose that stands in front of the advanced panels.
 *
 * The panels are unchanged and still on the page; they move behind a toggle.
 * Everything here degrades to exactly the old page: no key, an exhausted
 * budget, a refusal or a timeout all leave the passage absent, and a module
 * with no passage renders its panel open the way it always did.
 */

export type AdvancedStory = {
  opening: string;
  passages: Partial<Record<AdvancedModuleKey, string>>;
};

type StoryState =
  | { status: "loading" }
  | { status: "ready"; story: AdvancedStory }
  /* `reason` separates "you have run out" from "this is broken", because only
     one of them is worth showing the reader. */
  | { status: "absent"; reason: "limit" | "unavailable" };

/**
 * Fetches the whole page's prose in one request.
 *
 * One request is a budget constraint, not a style choice -- see the route.
 */
export function useAdvancedStory(queryString: string): StoryState {
  const [state, setState] = useState<StoryState>({ status: "loading" });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!queryString) {
      setState({ status: "absent", reason: "unavailable" });
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setState({ status: "loading" });

    fetch(`/api/chart/advanced-story?${queryString}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 429) {
          setState({ status: "absent", reason: "limit" });
          return;
        }
        if (!response.ok) {
          setState({ status: "absent", reason: "unavailable" });
          return;
        }
        const data = (await response.json()) as AdvancedStory;
        if (controller.signal.aborted) return;
        setState({ status: "ready", story: data });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ status: "absent", reason: "unavailable" });
        }
      });

    return () => controller.abort();
  }, [queryString]);

  return state;
}

export function StoryOpening({ state }: { state: StoryState }) {
  if (state.status === "loading") {
    return (
      <p className={`${advStyles.storyOpening} ${advStyles.storyPending}`} aria-live="polite">
        Reading your chart&#8230;
      </p>
    );
  }
  if (state.status === "absent") {
    if (state.reason === "limit") {
      return (
        <p className={advStyles.storyOpening}>
          You have used today&#39;s readings. The full detail is all still here, in
          every section below.
        </p>
      );
    }
    return null;
  }
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
 * When a module that should have a passage has none -- no key, spent budget, a
 * refusal -- its panel renders open, because a collapsed section with nothing
 * above it is strictly worse than the page we started with.
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
        <p className={`${advStyles.storyPassage} ${advStyles.storyPending}`} aria-live="polite">
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
