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
import { createPortal } from "react-dom";
import { Download, Loader2 } from "lucide-react";
import type { ChartApiResponse } from "@/lib/astro-types";
import {
  buildPersonalStory,
  type PersonalStory as PersonalStoryData,
  type PersonalStoryChapterId,
} from "@/lib/story-engine";
import styles from "./personal-story.module.css";

export type PersonalStoryDrawerProps = {
  story: PersonalStoryData;
  payload: ChartApiResponse;
  open: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
};

export type PersonalStoryProps = {
  payload: ChartApiResponse;
  className?: string;
  onOpenChange?: (open: boolean) => void;
};

const CHAPTER_ICONS: Partial<Record<PersonalStoryChapterId, string>> = {
  essence: "✦",
  marriage: "♥",
  family: "⌂",
  career: "✧",
  wealth: "◆",
  strengths: "★",
  "emotional-orientation": "☾",
  timing: "⏳",
  grounding: "⛰",
};

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("hidden") && element.offsetParent !== null);
}

function slugify(value: string): string {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "personal-story";
}

function formatLocation(client: ChartApiResponse["client"]): string | undefined {
  const parts = [client.city, client.state, client.country].filter(
    (part): part is string => Boolean(part?.trim()),
  );
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function formatGeneratedDate(isoValue: string): string | undefined {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * A controlled, reusable dialog/modal for the deterministic story model.
 * Most integrations can use the default PersonalStory launcher below.
 */
export function PersonalStoryDrawer({
  story,
  payload,
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
  const chapterRefs = useRef<Partial<Record<string, HTMLDetailsElement | null>>>({});
  const [allExpanded, setAllExpanded] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<"idle" | "generating" | "error">("idle");

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

  useEffect(() => {
    if (!open) setPdfStatus("idle");
  }, [open]);

  const jumpToChapter = useCallback((id: string) => {
    const element = chapterRefs.current[id];
    if (!element) return;
    element.open = true;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const toggleAllChapters = useCallback(() => {
    const next = !allExpanded;
    Object.values(chapterRefs.current).forEach((element) => {
      if (element) element.open = next;
    });
    setAllExpanded(next);
  }, [allExpanded]);

  const handleDownloadPdf = useCallback(async () => {
    if (pdfStatus === "generating") return;
    setPdfStatus("generating");
    try {
      const [{ pdf }, { PersonalStoryPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./personal-story-pdf"),
      ]);

      const blob = await pdf(
        <PersonalStoryPdfDocument
          story={story}
          clientName={payload.client.name}
          ascendant={payload.chart.ascendant?.sign}
          locationLabel={formatLocation(payload.client)}
          generatedOn={formatGeneratedDate(payload.generated_at_utc)}
        />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slugify(story.title)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setPdfStatus("idle");
    } catch (error) {
      console.error("Failed to generate story PDF", error);
      setPdfStatus("error");
    }
  }, [payload, pdfStatus, story]);

  if (!open) return null;

  const downloadLabel = pdfStatus === "generating" ? "Preparing PDF…" : "Download PDF";

  // Rendered through a portal straight into <body>: the results page wraps every
  // route in a `.page-transition-enter` element that sets `will-change: transform`
  // for its Framer Motion page transition. That permanently creates a new
  // containing block for any `position: fixed` descendant, so once the page is
  // scrolled the backdrop would anchor to the scrolled document instead of the
  // viewport and render off-screen. A portal sidesteps that ancestor entirely.
  return createPortal(
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
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.pdfButton}
              onClick={handleDownloadPdf}
              disabled={pdfStatus === "generating"}
              aria-label={downloadLabel}
            >
              {pdfStatus === "generating" ? (
                <Loader2 className={styles.spinIcon} size={16} aria-hidden="true" />
              ) : (
                <Download size={16} aria-hidden="true" />
              )}
              <span>{downloadLabel}</span>
            </button>
            <button
              ref={closeRef}
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Close your story"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </header>

        <div className={styles.intro}>
          <h2 id={titleId}>{story.title}</h2>
          <p id={descriptionId}>{story.introduction}</p>
        </div>

        {pdfStatus === "error" && (
          <p className={styles.pdfError} role="alert">
            The PDF could not be generated. Please try again.
          </p>
        )}

        <div className={styles.tocBar}>
          <div className={styles.tocChips}>
            {story.chapters.map((chapter) => (
              <button
                key={chapter.id}
                type="button"
                className={styles.tocChip}
                onClick={() => jumpToChapter(chapter.id)}
              >
                <span aria-hidden="true">{CHAPTER_ICONS[chapter.id] ?? "•"}</span>
                {chapter.eyebrow}
              </button>
            ))}
          </div>
          <button type="button" className={styles.expandAllButton} onClick={toggleAllChapters}>
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        </div>

        <ol className={styles.chapterList} aria-label="Your story chapters">
          {story.chapters.map((chapter, index) => (
            <li key={chapter.id}>
              <details
                ref={(element) => {
                  chapterRefs.current[chapter.id] = element;
                }}
                className={styles.chapter}
                open={index === 0}
              >
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
          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.pdfButtonSecondary}
              onClick={handleDownloadPdf}
              disabled={pdfStatus === "generating"}
            >
              {pdfStatus === "generating" ? (
                <Loader2 className={styles.spinIcon} size={16} aria-hidden="true" />
              ) : (
                <Download size={16} aria-hidden="true" />
              )}
              <span>{pdfStatus === "generating" ? "Preparing PDF…" : "Download your story as PDF"}</span>
            </button>
            <button type="button" className={styles.doneButton} onClick={onClose}>
              Done
            </button>
          </div>
        </footer>
      </aside>
    </div>,
    document.body,
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
          <span className={styles.triggerKicker}>Personal reading · {story.chapters.length} chapters</span>
          <span className={styles.triggerLabel}>Here is your Story</span>
          <span className={styles.triggerSubLabel}>
            Marriage, family, career, wealth, timing &amp; more — plus a downloadable PDF
          </span>
        </span>
        <span className={styles.triggerArrow} aria-hidden="true">→</span>
      </button>

      <PersonalStoryDrawer
        story={story}
        payload={payload}
        open={open}
        onClose={closeDrawer}
        returnFocusRef={triggerRef}
      />
    </>
  );
}
