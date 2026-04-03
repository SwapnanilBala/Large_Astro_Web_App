"use client";

import Link from "next/link";
import { useDeferredValue, useCallback, useEffect, useMemo, useState } from "react";
import type { SavedChartRecord, SavedComparisonRecord } from "@/lib/astro-types";
import BackButton from "../components/BackButton";
import FlipCard from "../components/FlipCard";
import CompatibilityScoreRing from "../components/CompatibilityScoreRing";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "@/lib/i18n-context";
import { useToast } from "@/lib/toast-context";
import styles from "./workspace.module.css";
import {
  deleteSavedChart,
  deleteSavedComparison,
  exportWorkspaceSnapshot,
  listSavedCharts,
  listSavedComparisons,
  toggleSavedChartArchive,
  toggleSavedComparisonArchive,
  updateSavedChartNotes,
  updateSavedComparisonNotes,
} from "@/lib/workspace-store";

type SaveState = "idle" | "saving" | "saved" | "error";
type StatusFilter = "active" | "archived" | "all";
type ContentFilter = "all" | "charts" | "comparisons";
type SortMode = "newest" | "oldest" | "alphabetical";

function sortByMode<T extends SavedChartRecord | SavedComparisonRecord>(
  items: T[],
  sortMode: SortMode,
  getLabel: (item: T) => string
) {
  const sorted = [...items];
  sorted.sort((left, right) => {
    if (sortMode === "alphabetical") {
      return getLabel(left).localeCompare(getLabel(right));
    }
    const leftValue = new Date(left.updated_at).getTime();
    const rightValue = new Date(right.updated_at).getTime();
    return sortMode === "oldest" ? leftValue - rightValue : rightValue - leftValue;
  });
  return sorted;
}

function matchesStatus<T extends SavedChartRecord | SavedComparisonRecord>(
  item: T,
  statusFilter: StatusFilter
) {
  if (statusFilter === "all") return true;
  if (statusFilter === "archived") return !!item.archived_at;
  return !item.archived_at;
}

function matchesSearch<T extends SavedChartRecord | SavedComparisonRecord>(
  item: T,
  search: string,
  getLabel: (item: T) => string,
  getSummary: (item: T) => string
) {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return true;

  if (getLabel(item).toLowerCase().includes(normalized)) {
    return true;
  }

  if (getSummary(item).toLowerCase().includes(normalized)) {
    return true;
  }

  if ("notes" in item && item.notes.toLowerCase().includes(normalized)) {
    return true;
  }

  if ("city" in item) {
    return (
      item.city.toLowerCase().includes(normalized) ||
      item.ascendant_sign.toLowerCase().includes(normalized)
    );
  }

  return false;
}

export default function WorkspacePageClient() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { t } = useTranslation();
  const { pushToast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [contentFilter, setContentFilter] = useState<ContentFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const deferredSearch = useDeferredValue(search);
  const [savedCharts, setSavedCharts] = useState<SavedChartRecord[]>([]);
  const [savedComparisons, setSavedComparisons] = useState<SavedComparisonRecord[]>([]);
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({});
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [pageError, setPageError] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});

  const toggleCardFlip = useCallback((id: string) => {
    setFlippedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setSavedCharts([]);
      setSavedComparisons([]);
      return;
    }

    let isCancelled = false;

    const loadWorkspace = async () => {
      try {
        setPageError("");
        const [charts, comparisons] = await Promise.all([
          listSavedCharts(user.user_id),
          listSavedComparisons(user.user_id),
        ]);

        if (isCancelled) {
          return;
        }

        setSavedCharts(charts);
        setSavedComparisons(comparisons);
        setNotesDrafts((previous) => {
          const next = { ...previous };
          for (const item of charts) {
            next[item.saved_chart_id] ??= item.notes;
          }
          for (const item of comparisons) {
            next[item.saved_comparison_id] ??= item.notes;
          }
          return next;
        });
      } catch (error) {
        setPageError(error instanceof Error ? error.message : "Workspace request failed.");
      }
    };

    void loadWorkspace();

    return () => {
      isCancelled = true;
    };
  }, [deferredSearch, isAuthenticated, statusFilter, user]);

  const visibleCharts = useMemo(
    () =>
      sortByMode(
        savedCharts.filter(
          (item) =>
            matchesStatus(item, statusFilter) &&
            matchesSearch(item, deferredSearch, (chart) => chart.name, (chart) => chart.query_string)
        ),
        sortMode,
        (item) => item.name
      ),
    [deferredSearch, savedCharts, sortMode, statusFilter]
  );
  const visibleComparisons = useMemo(
    () =>
      sortByMode(
        savedComparisons.filter(
          (item) =>
            matchesStatus(item, statusFilter) &&
            matchesSearch(
              item,
              deferredSearch,
              (comparison) => `${comparison.primary_name} ${comparison.partner_name}`,
              (comparison) => comparison.summary
            )
        ),
        sortMode,
        (item) => `${item.primary_name} ${item.partner_name}`
      ),
    [deferredSearch, savedComparisons, sortMode, statusFilter]
  );

  const updateNoteDraft = (key: string, value: string) => {
    setNotesDrafts((previous) => ({ ...previous, [key]: value }));
    setSaveStates((previous) => ({ ...previous, [key]: "idle" }));
  };

  const saveChartNotes = async (savedChartId: string) => {
    if (!user) return;
    try {
      setSaveStates((previous) => ({ ...previous, [savedChartId]: "saving" }));
      const updated = await updateSavedChartNotes(
        user.user_id,
        savedChartId,
        notesDrafts[savedChartId] ?? ""
      );
      if (!updated) {
        throw new Error("Could not save chart notes.");
      }
      setSavedCharts((previous) =>
        previous.map((item) => (item.saved_chart_id === savedChartId ? updated : item))
      );
      setSaveStates((previous) => ({ ...previous, [savedChartId]: "saved" }));
      pushToast("Chart notes saved.", "success");
    } catch {
      setSaveStates((previous) => ({ ...previous, [savedChartId]: "error" }));
      pushToast("Could not save chart notes.", "error");
    }
  };

  const saveComparisonNotes = async (savedComparisonId: string) => {
    if (!user) return;
    try {
      setSaveStates((previous) => ({ ...previous, [savedComparisonId]: "saving" }));
      const updated = await updateSavedComparisonNotes(
        user.user_id,
        savedComparisonId,
        notesDrafts[savedComparisonId] ?? ""
      );
      if (!updated) {
        throw new Error("Could not save comparison notes.");
      }
      setSavedComparisons((previous) =>
        previous.map((item) => (item.saved_comparison_id === savedComparisonId ? updated : item))
      );
      setSaveStates((previous) => ({ ...previous, [savedComparisonId]: "saved" }));
      pushToast("Comparison notes saved.", "success");
    } catch {
      setSaveStates((previous) => ({ ...previous, [savedComparisonId]: "error" }));
      pushToast("Could not save comparison notes.", "error");
    }
  };

  const toggleChartArchive = async (chart: SavedChartRecord) => {
    if (!user) return;
    try {
      const updated = await toggleSavedChartArchive(
        user.user_id,
        chart.saved_chart_id,
        !chart.archived_at
      );
      if (!updated) {
        throw new Error("Archive update failed.");
      }
      setSavedCharts((previous) =>
        previous.map((item) => (item.saved_chart_id === chart.saved_chart_id ? updated : item))
      );
      pushToast(chart.archived_at ? "Chart restored." : "Chart archived.", "success");
    } catch {
      pushToast("Could not update chart archive state.", "error");
    }
  };

  const toggleComparisonArchive = async (comparison: SavedComparisonRecord) => {
    if (!user) return;
    try {
      const updated = await toggleSavedComparisonArchive(
        user.user_id,
        comparison.saved_comparison_id,
        !comparison.archived_at
      );
      if (!updated) {
        throw new Error("Archive update failed.");
      }
      setSavedComparisons((previous) =>
        previous.map((item) =>
          item.saved_comparison_id === comparison.saved_comparison_id ? updated : item
        )
      );
      pushToast(comparison.archived_at ? "Comparison restored." : "Comparison archived.", "success");
    } catch {
      pushToast("Could not update comparison archive state.", "error");
    }
  };

  const deleteChart = async (chart: SavedChartRecord) => {
    if (!user) return;
    if (!window.confirm(`Delete ${chart.name}'s saved chart permanently?`)) {
      return;
    }
    try {
      const deleted = await deleteSavedChart(user.user_id, chart.saved_chart_id);
      if (!deleted) {
        throw new Error("Delete failed.");
      }
      setSavedCharts((previous) =>
        previous.filter((item) => item.saved_chart_id !== chart.saved_chart_id)
      );
      pushToast("Chart deleted.", "success");
    } catch {
      pushToast("Could not delete chart.", "error");
    }
  };

  const deleteComparison = async (comparison: SavedComparisonRecord) => {
    if (!user) return;
    if (!window.confirm(`Delete the saved report for ${comparison.primary_name} and ${comparison.partner_name}?`)) {
      return;
    }
    try {
      const deleted = await deleteSavedComparison(
        user.user_id,
        comparison.saved_comparison_id
      );
      if (!deleted) {
        throw new Error("Delete failed.");
      }
      setSavedComparisons((previous) =>
        previous.filter((item) => item.saved_comparison_id !== comparison.saved_comparison_id)
      );
      pushToast("Comparison deleted.", "success");
    } catch {
      pushToast("Could not delete comparison.", "error");
    }
  };

  const copyLink = async (path: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      pushToast(successMessage, "success");
    } catch {
      pushToast("Could not copy the link.", "error");
    }
  };

  const shareLink = async (path: string, title: string) => {
    const url = `${window.location.origin}${path}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        pushToast("Share sheet opened.", "info");
        return;
      }
      await navigator.clipboard.writeText(url);
      pushToast("Share is unavailable here, so the link was copied instead.", "success");
    } catch {
      pushToast("Could not share this link.", "error");
    }
  };

  const exportWorkspace = async () => {
    if (!user) return;
    try {
      setIsExporting(true);
      const snapshot = await exportWorkspaceSnapshot(user.user_id);
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
        type: "application/json",
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "astro_workspace.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      pushToast("Workspace export downloaded.", "success");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Export failed.");
      pushToast("Workspace export failed.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="insights-shell">
        <BackButton href="/" />
        <section className="dashboard-shell">
          <p className="kicker">Workspace</p>
          <h1>{t("workspace.loading")}</h1>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="insights-shell">
        <div className="ambient ambient-left" />
        <div className="ambient ambient-right" />
        <BackButton href="/" />
        <section className="dashboard-shell">
          <p className="kicker">Workspace</p>
          <h1>Guest mode has full chart access. Workspace still needs an account.</h1>
          <p className="lead">
            The astrology engine is fully open for guests. Sign in only if you want account-backed saved
            charts, saved compatibility reports, notes, archive controls, delete actions, and export.
          </p>
          <div className="workspace-actions">
            <Link href="/login" className="ghost-link">
              Sign in
            </Link>
            <Link href="/register" className="recalculate-btn">
              Create account
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="insights-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <BackButton href="/" />
      <section className="dashboard-shell">
        <p className="kicker">Workspace</p>
        <h1>{user?.display_name ?? "Your"} astrology workspace</h1>
        <p className="lead">
          Search saved charts, revisit compatibility readings, archive old items, share links, and export account data.
        </p>

        <div className={styles.toolbar}>
          <label className={`${styles.search} input-glow-gold`}>
            Search charts, cities, signs, or notes
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search your workspace"
            />
          </label>
          <div className={styles.toolbarActions}>
            <Link href="/pricing" className="ghost-link">
              Manage plan
            </Link>
            <button type="button" onClick={exportWorkspace} disabled={isExporting}>
              {isExporting ? t("workspace.exportPreparing") : t("workspace.exportButton")}
            </button>
          </div>
        </div>

        <div className={styles.filterBar}>
          <label className={`${styles.inlineFilter} input-glow-aqua`}>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </select>
          </label>
          <label className={`${styles.inlineFilter} input-glow-coral`}>
            Content
            <select value={contentFilter} onChange={(event) => setContentFilter(event.target.value as ContentFilter)}>
              <option value="all">All</option>
              <option value="charts">Charts only</option>
              <option value="comparisons">Comparisons only</option>
            </select>
          </label>
          <label className={`${styles.inlineFilter} input-glow-violet`}>
            Sort
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="alphabetical">Alphabetical</option>
            </select>
          </label>
        </div>

        <div className={styles.summaryGrid}>
          <article className="metric-card">
            <h3>Saved charts</h3>
            <p>{visibleCharts.length}</p>
            <small>Profiles matching the current workspace filters.</small>
          </article>
          <article className="metric-card">
            <h3>Saved comparisons</h3>
            <p>{visibleComparisons.length}</p>
            <small>Relationship reports matching the current workspace filters.</small>
          </article>
          <article className="metric-card">
            <h3>Subscription tier</h3>
            <p>{user?.subscription_tier ?? "guest"}</p>
            <small>Current account label. Chart modules are open regardless of tier.</small>
          </article>
        </div>

        {pageError && <p className="error-note">{pageError}</p>}

        {contentFilter !== "comparisons" && (
          <section className={`rules-panel ${styles.section}`}>
            <div className="rules-header">
              <p className="kicker">Saved Charts</p>
              <h2>Birth profiles</h2>
            </div>

            {visibleCharts.length === 0 ? (
              <p className="section-intro">No saved charts match the current filters yet.</p>
            ) : (
              <div className={styles.cardGrid}>
                {visibleCharts.map((chart) => {
                  const state = saveStates[chart.saved_chart_id] ?? "idle";
                  const chartPath = `/insights?${chart.query_string}`;
                  return (
                    <article key={chart.saved_chart_id} className={styles.card}>
                      <div className={styles.cardHeader}>
                        <div>
                          <h3>{chart.name}</h3>
                          <p>
                            {chart.city || chart.town || t("workspace.unknownCity")} • {chart.ascendant_sign} Lagna
                          </p>
                        </div>
                        <div className={styles.chipRow}>
                          {chart.archived_at && <span className="access-pill access-pill--limited">Archived</span>}
                          <Link href={chartPath} className="ghost-link">
                            Open chart
                          </Link>
                        </div>
                      </div>
                      <p className={styles.cardMeta}>
                        Born {chart.birth_date} at {chart.birth_time || "unknown time"}
                        {chart.time_zone_id ? ` • ${chart.time_zone_id}` : ""}
                      </p>
                      <textarea
                        className={styles.notes}
                        value={notesDrafts[chart.saved_chart_id] ?? ""}
                        onChange={(event) => updateNoteDraft(chart.saved_chart_id, event.target.value)}
                        placeholder="Add notes about this profile"
                      />
                      <div className={styles.cardActions}>
                        <button type="button" onClick={() => saveChartNotes(chart.saved_chart_id)}>
                          {state === "saving" ? t("workspace.saving") : t("workspace.saveNotes")}
                        </button>
                        <button type="button" onClick={() => void copyLink(chartPath, "Chart link copied.")}>
                          Copy link
                        </button>
                        <button type="button" onClick={() => void toggleChartArchive(chart)}>
                          {chart.archived_at ? t("workspace.restore") : t("workspace.archive")}
                        </button>
                        <button type="button" className="danger-btn" onClick={() => void deleteChart(chart)}>
                          Delete
                        </button>
                        <span className={state === "saved" ? styles.saveStateSaved : state === "error" ? styles.saveStateError : styles.saveState}>
                          {state === "saved" && t("workspace.saved")}
                          {state === "error" && t("workspace.saveFailed")}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {contentFilter !== "charts" && (
          <section className={`rules-panel ${styles.section}`}>
            <div className="rules-header">
              <p className="kicker">Saved Comparisons</p>
              <h2>Synastry reports</h2>
            </div>

            {visibleComparisons.length === 0 ? (
              <p className="section-intro">No saved compatibility reports match the current filters yet.</p>
            ) : (
              <div className={styles.cardGrid}>
                {visibleComparisons.map((comparison) => {
                  const state = saveStates[comparison.saved_comparison_id] ?? "idle";
                  const comparisonPath = `/insights/compatibility?${comparison.query_string}`;
                  const isFlipped = !!flippedCards[comparison.saved_comparison_id];
                  return (
                    <FlipCard
                      key={comparison.saved_comparison_id}
                      isFlipped={isFlipped}
                      onFlip={() => toggleCardFlip(comparison.saved_comparison_id)}
                      front={
                        <article className={styles.card}>
                          <div className={styles.cardHeader}>
                            <div>
                              <h3>
                                {comparison.primary_name} + {comparison.partner_name}
                              </h3>
                              <p>{comparison.compatibility_score.toFixed(1)} / 100 compatibility score</p>
                            </div>
                            <div className={styles.chipRow}>
                              {comparison.archived_at && <span className="access-pill access-pill--limited">Archived</span>}
                              <Link href={comparisonPath} className="ghost-link">
                                Open report
                              </Link>
                            </div>
                          </div>
                          <p className={styles.cardMeta}>{comparison.summary}</p>
                          <textarea
                            className={styles.notes}
                            value={notesDrafts[comparison.saved_comparison_id] ?? ""}
                            onChange={(event) =>
                              updateNoteDraft(comparison.saved_comparison_id, event.target.value)
                            }
                            placeholder="Add notes about this comparison"
                          />
                          <div className={styles.cardActions}>
                            <button
                              type="button"
                              onClick={() => saveComparisonNotes(comparison.saved_comparison_id)}
                            >
                              {state === "saving" ? t("workspace.saving") : t("workspace.saveNotes")}
                            </button>
                            <button
                              type="button"
                              onClick={() => void copyLink(comparisonPath, "Compatibility link copied.")}
                            >
                              Copy link
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void shareLink(
                                  comparisonPath,
                                  `${comparison.primary_name} + ${comparison.partner_name}`
                                )
                              }
                            >
                              Share
                            </button>
                            <button type="button" onClick={() => void toggleComparisonArchive(comparison)}>
                              {comparison.archived_at ? t("workspace.restore") : t("workspace.archive")}
                            </button>
                            <button
                              type="button"
                              className="danger-btn"
                              onClick={() => void deleteComparison(comparison)}
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              className={styles.flipBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCardFlip(comparison.saved_comparison_id);
                              }}
                              aria-label="See detailed breakdown"
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                              See Details
                            </button>
                            <span className={state === "saved" ? styles.saveStateSaved : state === "error" ? styles.saveStateError : styles.saveState}>
                              {state === "saved" && t("workspace.saved")}
                              {state === "error" && t("workspace.saveFailed")}
                            </span>
                          </div>
                        </article>
                      }
                      back={
                        <article className={styles.card}>
                          <div className={styles.cardHeader}>
                            <div>
                              <h3>
                                {comparison.primary_name} + {comparison.partner_name}
                              </h3>
                              <p>Detailed Breakdown</p>
                            </div>
                            <div className={styles.chipRow}>
                              <Link href={comparisonPath} className="ghost-link">
                                Open report
                              </Link>
                            </div>
                          </div>

                          <div className={styles.scoreBreakdown}>
                            <div className={styles.scoreRingWrapper}>
                              {isFlipped && (
                                <CompatibilityScoreRing
                                  score={comparison.compatibility_score}
                                  size={110}
                                />
                              )}
                            </div>
                            <div className={styles.categoryScores}>
                              {[
                                { label: "Emotional", factor: 0.92, color: "#C89B3C" },
                                { label: "Intellectual", factor: 0.87, color: "#1A7B6E" },
                                { label: "Physical", factor: 0.95, color: "#C96B2A" },
                                { label: "Spiritual", factor: 0.82, color: "#9B7FD4" },
                              ].map((cat) => (
                                <div key={cat.label} className={styles.categoryRow}>
                                  <span className={styles.categoryLabel}>{cat.label}</span>
                                  <div className={styles.categoryBar}>
                                    <div
                                      className={styles.categoryFill}
                                      style={{
                                        width: `${Math.min(100, Math.max(0, comparison.compatibility_score * cat.factor))}%`,
                                        background: cat.color,
                                      }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <p className={styles.cardMeta}>{comparison.summary}</p>

                          <div className={styles.cardActions}>
                            <button
                              type="button"
                              className={styles.flipBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCardFlip(comparison.saved_comparison_id);
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <path d="M10 2L6 8l4 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Back
                            </button>
                          </div>
                        </article>
                      }
                    />
                  );
                })}
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
