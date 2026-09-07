"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  deletePalmReading,
  listPalmReadings,
  subscribeToPalmReadings,
} from "@/lib/palm-readings/local-store";
import type { PalmReadingSummary } from "@/lib/palm-readings/types";

/* ──────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return d.toDateString();
  }
}

function truncate(text: string, max = 180): string {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

/* ──────────────────────────────────────────────────────────
   Component
   ────────────────────────────────────────────────────────── */

export default function PalmHistoryClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const compareWithId = searchParams?.get("compareWith") ?? null;

  const [readings, setReadings] = useState<PalmReadingSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [compareMode, setCompareMode] = useState<boolean>(Boolean(compareWithId));
  const [selected, setSelected] = useState<string[]>(
    compareWithId ? [compareWithId] : [],
  );
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Load the saved readings ──
  useEffect(() => {
    setSelected(compareWithId ? [compareWithId] : []);

    const load = () => {
      setReadings(listPalmReadings());
      setLoadError(null);
      setLoading(false);
    };

    load();
    return subscribeToPalmReadings(load);
  }, [compareWithId]);

  // ── Selection handling ──
  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) {
        // Replace the oldest pick to keep at most 2
        return [prev[1], id];
      }
      return [...prev, id];
    });
  }, []);

  const toggleCompareMode = useCallback(() => {
    setCompareMode((prev) => {
      const next = !prev;
      if (!next) setSelected([]);
      return next;
    });
  }, []);

  const startCompare = useCallback(() => {
    if (selected.length !== 2) return;
    router.push(
      `/insights/palm-history/compare?ids=${selected[0]},${selected[1]}`,
    );
  }, [router, selected]);

  // ── Delete handling ──
  const confirmDelete = useCallback(
    (id: string) => {
      setDeletingId(id);
      try {
        if (!deletePalmReading(id)) {
          throw new Error("Failed to delete reading.");
        }
        setReadings((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
        setSelected((prev) => prev.filter((x) => x !== id));
      } catch (e) {
        setLoadError(
          e instanceof Error ? e.message : "Failed to delete reading.",
        );
      } finally {
        setDeletingId(null);
        setPendingDeleteId(null);
      }
    },
    [],
  );

  const total = readings?.length ?? 0;

  const subtitle = useMemo(() => {
    if (loading) return "Loading your saved readings…";
    if (total === 0) return "Nothing here yet.";
    if (total === 1) return "1 saved reading.";
    return `${total} saved readings.`;
  }, [loading, total]);

  return (
    <section className="palm-history-shell">
      <header className="palm-history-header">
        <span className="palm-kicker">Your archive</span>
        <h1>Your Palm Readings</h1>
        <p className="palm-history-subtitle">{subtitle}</p>
      </header>

      {/* Toolbar */}
      {(total > 0 || loading) && (
        <div className="palm-history-toolbar">
          <button
            type="button"
            className={`palm-history-compare-toggle ${
              compareMode ? "is-on" : ""
            }`}
            onClick={toggleCompareMode}
            aria-pressed={compareMode}
          >
            {compareMode ? "Cancel compare" : "Compare two readings"}
          </button>
          {compareMode && (
            <span className="palm-history-toolbar-hint">
              {selected.length === 0
                ? "Pick 2 readings to compare."
                : selected.length === 1
                  ? "Pick 1 more reading."
                  : "Ready to compare."}
            </span>
          )}
          {compareMode && selected.length === 2 && (
            <button
              type="button"
              className="palm-history-compare-cta"
              onClick={startCompare}
            >
              Compare these &rarr;
            </button>
          )}
        </div>
      )}

      {/* Inline error */}
      {loadError && (
        <div className="palm-error" role="alert">
          {loadError}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="palm-history-grid" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="palm-history-card palm-history-card--skeleton">
              <div className="palm-skel-block" style={{ height: 18, width: "40%" }} />
              <div className="palm-skel-block" style={{ height: 22, width: "70%", marginTop: 10 }} />
              <div className="palm-skel-block" style={{ height: 14, marginTop: 12 }} />
              <div className="palm-skel-block" style={{ height: 14, marginTop: 6, width: "85%" }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && readings && readings.length === 0 && (
        <div className="palm-history-empty">
          <p>You haven't saved any palm readings yet.</p>
          <div className="palm-history-empty-cta">
            <Link href="/insights/advanced" className="palm-btn-camera">
              Read your palm
            </Link>
          </div>
        </div>
      )}

      {/* List */}
      {!loading && readings && readings.length > 0 && (
        <ul className="palm-history-grid" role="list">
          {readings.map((r) => {
            const isSelected = selected.includes(r.id);
            const summary = r.reading_summary?.overall_summary ?? "";
            const title = r.title?.trim() || "Untitled reading";
            const cardClass = [
              "palm-history-card",
              compareMode ? "is-selectable" : "",
              isSelected ? "is-selected" : "",
            ]
              .filter(Boolean)
              .join(" ");

            const onCardActivate = () => {
              if (compareMode) {
                toggleSelected(r.id);
              } else {
                router.push(`/insights/palm-history/${r.id}`);
              }
            };

            return (
              <li key={r.id} className={cardClass}>
                <div
                  className="palm-history-card-body"
                  role="button"
                  tabIndex={0}
                  onClick={onCardActivate}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onCardActivate();
                    }
                  }}
                  aria-label={
                    compareMode
                      ? `${isSelected ? "Deselect" : "Select"} reading from ${formatDate(r.created_at)}`
                      : `Open reading from ${formatDate(r.created_at)}`
                  }
                >
                  {compareMode && (
                    <span
                      className={`palm-history-card-check ${
                        isSelected ? "is-on" : ""
                      }`}
                      aria-hidden="true"
                    >
                      {isSelected ? "✓" : ""}
                    </span>
                  )}
                  <div className="palm-history-card-date">
                    {formatDate(r.created_at)}
                  </div>
                  <div className="palm-history-card-title">{title}</div>
                  {summary && (
                    <p className="palm-history-card-summary">
                      {truncate(summary, 220)}
                    </p>
                  )}
                  {r.classical_mode && (
                    <span className="palm-history-card-badge">
                      Hasta Samudrika Shastra
                    </span>
                  )}
                </div>
                {!compareMode && (
                  <div className="palm-history-card-actions">
                    {pendingDeleteId === r.id ? (
                      <div className="palm-history-card-confirm">
                        <span>Delete this reading?</span>
                        <button
                          type="button"
                          className="palm-history-card-delete"
                          onClick={() => confirmDelete(r.id)}
                          disabled={deletingId === r.id}
                        >
                          {deletingId === r.id ? "Deleting…" : "Yes, delete"}
                        </button>
                        <button
                          type="button"
                          className="palm-history-card-delete-cancel"
                          onClick={() => setPendingDeleteId(null)}
                          disabled={deletingId === r.id}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="palm-history-card-delete"
                        onClick={() => setPendingDeleteId(r.id)}
                        aria-label="Delete reading"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
