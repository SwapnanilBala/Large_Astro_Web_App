"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { ChartApiResponse } from "@/lib/astro-types";
import {
  buildPersonalStory,
  type PersonalStory as PersonalStoryData,
} from "@/lib/story-engine";
import styles from "./personal-story.module.css";

export type PersonalStoryDrawerProps = {
  story: PersonalStoryData;
  open: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
};

export type PersonalStoryProps = {
  payload: ChartApiResponse;
  className?: string;
  onOpenChange?: (open: boolean) => void;
};

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("hidden") && element.offsetParent !== null);
}

/**
 * A controlled, reusable dialog/drawer for the deterministic story model.
 * Most integrations can use the default PersonalStory launcher below.
 */
export function PersonalStoryDrawer({
  story,
  open,
  onClose,
  returnFocusRef,
}: PersonalStoryDrawerProps) {
  const dialogId = useId();
  const titleId = useId();
  const descriptionId = useId();
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = getFocusableElements(drawerRef.current);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      return;
    }
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;
    const focusFrame = window.requestAnimationFrame(() => {
      returnFocusRef?.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [open, returnFocusRef]);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        ref={drawerRef}
        id={dialogId}
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className={styles.drawerHeader}>
          <p className={styles.kicker}>Personal synthesis</p>
          <button
            ref={closeRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close your story"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className={styles.intro}>
          <h2 id={titleId}>{story.title}</h2>
          <p id={descriptionId}>{story.introduction}</p>
        </div>

        <ol className={styles.chapterList} aria-label="Your story chapters">
          {story.chapters.map((chapter, index) => (
            <li key={chapter.id}>
              <details className={styles.chapter} open={index === 0}>
                <summary className={styles.chapterSummary}>
                  <span className={styles.chapterIndex} aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <span className={styles.chapterEyebrow}>{chapter.eyebrow}</span>
                    <strong>{chapter.title}</strong>
                  </span>
                  <span className={styles.chevron} aria-hidden="true">⌄</span>
                </summary>
                <div className={styles.chapterContent}>
                  <p>{chapter.body}</p>

                  {chapter.highlights.length > 0 && (
                    <ul className={styles.highlightList}>
                      {chapter.highlights.map((highlight) => (
                        <li key={highlight}>{highlight}</li>
                      ))}
                    </ul>
                  )}

                  {chapter.signals.length > 0 && (
                    <dl className={styles.signalList}>
                      {chapter.signals.map((signal) => (
                        <div key={`${signal.label}-${signal.value}`}>
                          <dt>{signal.label}</dt>
                          <dd>{signal.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ol>

        <footer className={styles.drawerFooter}>
          <p>{story.reflectionNote}</p>
          <button type="button" className={styles.doneButton} onClick={onClose}>
            Done
          </button>
        </footer>
      </aside>
    </div>
  );
}

/**
 * Self-contained Results-page integration. It owns the literal trigger label
 * requested by product and can be dropped into any existing insight section.
 */
export default function PersonalStory({
  payload,
  className,
  onOpenChange,
}: PersonalStoryProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const story = useMemo(() => buildPersonalStory(payload), [payload]);

  const setDialogOpen = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [onOpenChange],
  );

  const closeDrawer = useCallback(() => setDialogOpen(false), [setDialogOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={[styles.trigger, className].filter(Boolean).join(" ")}
        onClick={() => setDialogOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={styles.triggerGlyph} aria-hidden="true">✦</span>
        <span>
          <span className={styles.triggerKicker}>Personal reading</span>
          <span className={styles.triggerLabel}>Here is your Story</span>
        </span>
        <span className={styles.triggerArrow} aria-hidden="true">→</span>
      </button>

      <PersonalStoryDrawer
        story={story}
        open={open}
        onClose={closeDrawer}
        returnFocusRef={triggerRef}
      />
    </>
  );
}
