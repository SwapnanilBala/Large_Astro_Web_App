"use client";

import { useCallback, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { ChartApiResponse } from "@/lib/astro-types";
import {
  buildPersonalStory,
  type PersonalStory as PersonalStoryData,
} from "@/lib/story-engine";
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

const STAGE_LABELS: Record<Exclude<GenerationStage, "idle" | "error">, string> = {
  calculating: "Completing calculations...",
  verifying: "Cross-checking the chart...",
  writing: "Writing your story...",
  typesetting: "Typesetting the PDF...",
};

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

      setStage("writing");
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
