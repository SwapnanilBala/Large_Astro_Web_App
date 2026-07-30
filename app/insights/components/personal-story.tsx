"use client";

import { useCallback, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { ChartApiResponse } from "@/lib/astro-types";
import { buildPersonalStory } from "@/lib/story-engine";
import styles from "./personal-story.module.css";

export type PersonalStoryProps = {
  payload: ChartApiResponse;
  className?: string;
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

/**
 * The story is a document, so the results page offers it as one: a single
 * download, read wherever the client prefers to read. It used to be a CTA
 * card that opened a modal sidebar with a chapter accordion, which put two
 * navigation steps and a scroll trap between the reader and the text.
 */
export default function PersonalStory({ payload, className }: PersonalStoryProps) {
  const [status, setStatus] = useState<"idle" | "generating" | "error">("idle");
  const story = useMemo(() => buildPersonalStory(payload), [payload]);

  const handleDownload = useCallback(async () => {
    if (status === "generating") return;
    setStatus("generating");
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
      setStatus("idle");
    } catch (error) {
      console.error("Failed to generate story PDF", error);
      setStatus("error");
    }
  }, [payload, status, story]);

  const generating = status === "generating";

  return (
    <section className={[styles.storyRow, className].filter(Boolean).join(" ")}>
      <div className={styles.copy}>
        <p className={styles.kicker}>Personal reading</p>
        <h2 className={styles.title}>{story.title}</h2>
        <p className={styles.subtitle}>
          {story.chapters.length} chapters — marriage, family, career, wealth, timing and more.
        </p>
      </div>

      <div className={styles.action}>
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
          <span>{generating ? "Preparing PDF…" : "Download PDF"}</span>
        </button>

        {status === "error" && (
          <p className={styles.error} role="alert">
            The PDF could not be generated. Please try again.
          </p>
        )}
      </div>
    </section>
  );
}
