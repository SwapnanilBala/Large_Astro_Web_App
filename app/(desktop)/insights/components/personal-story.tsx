"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Loader2, Sparkles } from "lucide-react";
import type { ChartApiResponse } from "@/lib/astro-types";
import {
  buildPersonalStory,
  type PersonalStory as PersonalStoryData,
} from "@/lib/story-engine";
import {
  applyStoryProse,
  buildStoryProseFacts,
  parseStoryProse,
} from "@/lib/story-prose";
import styles from "./personal-story.module.css";

export type PersonalStoryProps = {
  payload: ChartApiResponse;
  className?: string;
  compact?: boolean;
  queryString?: string;
};

type GenerationStage =
  | "idle"
  | "calculating"
  | "verifying"
  | "writing"
  | "typesetting"
  | "error";

/*
 * The four steps, in order, as the dialog lists them.
 *
 * `writing` is the one that matters: it is a single Opus 5 call at high effort
 * over the whole nine-chapter report, and it measures at about three minutes.
 * The other three are fast. Listing all four with the current one marked is
 * what makes a three-minute wait legible -- a spinner alone reads as a hang,
 * and a progress bar would have to invent a percentage the model never
 * reports.
 */
const STAGES = [
  { id: "calculating", label: "Completing the calculation" },
  { id: "verifying", label: "Cross-checking the chart" },
  { id: "writing", label: "Writing your reading" },
  { id: "typesetting", label: "Typesetting the PDF" },
] as const satisfies ReadonlyArray<{ id: Exclude<GenerationStage, "idle" | "error">; label: string }>;

const STAGE_LABELS = Object.fromEntries(
  STAGES.map((stage) => [stage.id, `${stage.label}...`]),
) as Record<Exclude<GenerationStage, "idle" | "error">, string>;

const STAGE_ORDER = STAGES.map((stage) => stage.id) as ReadonlyArray<string>;

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

export default function PersonalStory({
  payload,
  className,
  compact = false,
  queryString,
}: PersonalStoryProps) {
  const [stage, setStage] = useState<GenerationStage>("idle");
  /* The dialog is portalled, so it cannot render until there is a document. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const previewStory = useMemo(() => buildPersonalStory(payload), [payload]);

  const handleDownload = useCallback(async () => {
    if (stage !== "idle" && stage !== "error") return;
    setStage("calculating");

    try {
      let story: PersonalStoryData;
      if (queryString) {
        const response = await fetch(`/api/chart/story-report?${queryString}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          const result = await response.json().catch(() => null) as
            | { error?: { message?: string } }
            | null;
          throw new Error(
            result?.error?.message ?? "The verified report could not be prepared.",
          );
        }
        setStage("verifying");
        const result = await response.json() as { story: PersonalStoryData };
        story = result.story;
      } else {
        story = buildPersonalStory(payload);
      }

      /*
       * The written pass. One Opus 5 call at high effort over the whole
       * report, which takes about three minutes -- hence the dialog.
       *
       * Deliberately not fatal. Every way this can fail (no API key, the daily
       * budget spent, a rate limit, the model declining, a timeout) leaves the
       * engine's own prose in place, and the reader gets the report that
       * shipped before this route existed rather than an error. The only thing
       * they lose is the writing, which is exactly the thing that was
       * optional.
       */
      setStage("writing");
      try {
        const facts = buildStoryProseFacts(story, payload.client.name);
        const response = await fetch("/api/chart/story-prose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ facts }),
        });
        if (response.ok) {
          const result = await response.json() as { prose?: unknown };
          const prose = parseStoryProse(result.prose);
          if (prose) story = applyStoryProse(story, prose);
        } else {
          console.warn("story prose unavailable:", response.status);
        }
      } catch (error) {
        console.warn("story prose unavailable:", error);
      }

      const [{ pdf }, { PersonalStoryPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./personal-story-pdf"),
      ]);

      setStage("typesetting");
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
      setStage("idle");
    } catch (error) {
      console.error("Failed to generate story PDF", error);
      setStage("error");
    }
  }, [payload, queryString, stage]);

  const generating = stage !== "idle" && stage !== "error";
  const buttonLabel = generating
    ? STAGE_LABELS[stage as Exclude<GenerationStage, "idle" | "error">]
    : compact
      ? "Download reading"
      : "Download PDF";

  /*
   * The dialog, not a second button label.
   *
   * It is modal and has no dismiss control on purpose: the work is a paid call
   * already in flight, and a cancel button that cannot actually stop the
   * billing would be a lie. It also blocks a second click on the button, which
   * is what the previous `disabled` attribute was doing less visibly.
   *
   * PORTALLED TO THE BODY, and that is load-bearing rather than tidy. Rendered
   * in place, the scrim covered about a third of the screen: this component
   * sits inside <PageTransition>, a framer-motion subtree that animates
   * `scale`, and a transformed ancestor becomes the containing block for
   * `position: fixed` -- so `inset: 0` resolved to the animated box instead of
   * the viewport. The same ancestor is a stacking context, so `z-index: 200`
   * could not have risen above the navbar either. A portal escapes both.
   */
  const dialog = generating ? (
    <div className={styles.overlay} role="presentation">
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="story-dialog-title"
        aria-describedby="story-dialog-lead"
      >
        <span className={styles.dialogMark} aria-hidden="true">
          <Sparkles size={20} />
        </span>
        <h2 id="story-dialog-title" className={styles.dialogTitle}>
          Your PDF is being written
        </h2>
        <p id="story-dialog-lead" className={styles.dialogLead}>
          Every chapter is being composed against your own placements, to
          pin-point accuracy. This takes a couple of minutes, and it is worth
          the wait.
        </p>

        <ol className={styles.stageList}>
          {STAGES.map((item) => {
            const position = STAGE_ORDER.indexOf(item.id);
            const current = STAGE_ORDER.indexOf(stage);
            const state =
              position < current
                ? styles.stageDone
                : position === current
                  ? styles.stageActive
                  : "";
            return (
              <li key={item.id} className={`${styles.stageRow} ${state}`}>
                <span className={styles.stageDot} aria-hidden="true" />
                {item.label}
              </li>
            );
          })}
        </ol>

        <p className={styles.dialogNote}>
          Keep this tab open. The download starts on its own when the report is
          ready.
        </p>
      </div>
    </div>
  ) : null;

  /*
   * Portalled to <main>, not to <body>, and the difference is the typeface.
   *
   * app/(desktop)/layout.tsx puts the next/font variables on a wrapper <div>
   * rather than on <html>, because only the root layout may render <html>.
   * Custom properties inherit, so everything inside that wrapper resolves
   * `var(--font-display)` and nothing outside it does -- a dialog portalled to
   * the body lost Cinzel and fell back to the UI sans.
   *
   * #main-content sits inside that wrapper and outside <PageTransition>, which
   * is the one ancestor whose transform would capture `position: fixed`. So it
   * is the shallowest node that solves both problems. Falling back to the body
   * rather than not rendering: losing the display face is a blemish, losing
   * the dialog during a three-minute wait is not.
   */
  const dialogHost = mounted
    ? document.getElementById("main-content") ?? document.body
    : null;
  const dialogLayer = dialog && dialogHost ? createPortal(dialog, dialogHost) : null;

  const downloadAction = (
    <button
      type="button"
      className={styles.downloadButton}
      onClick={handleDownload}
      disabled={generating}
    >
      {generating ? (
        <Loader2 className={styles.spinIcon} size={18} aria-hidden="true" />
      ) : (
        <Download size={18} aria-hidden="true" />
      )}
      <span>{buttonLabel}</span>
    </button>
  );

  if (compact) {
    return (
      <div className={[styles.compactAction, className].filter(Boolean).join(" ")}>
        {dialogLayer}
        {downloadAction}
        {stage === "error" && (
          <p className={styles.error} role="alert">
            The report did not pass generation. Please try again.
          </p>
        )}
      </div>
    );
  }

  return (
    <section className={[styles.storyRow, className].filter(Boolean).join(" ")}>
      <div className={styles.copy}>
        <p className={styles.kicker}>Personal reading</p>
        <h2 className={styles.title}>{previewStory.title}</h2>
        <p className={styles.subtitle}>
          {previewStory.chapters.length} verified chapters covering identity,
          relationships, family, vocation, resources, timing, and grounded action.
        </p>
      </div>

      <div className={styles.action}>
        {dialogLayer}
        {downloadAction}
        {stage === "error" && (
          <p className={styles.error} role="alert">
            The report did not pass generation. Please try again.
          </p>
        )}
      </div>
    </section>
  );
}
