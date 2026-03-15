"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { SavedChartRecord, SavedComparisonRecord } from "@/lib/astro-types";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";

const ASTRO_API =
  process.env.NEXT_PUBLIC_ASTRO_API_BASE_URL ?? "http://127.0.0.1:8000";

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

export default function WorkspacePageClient() {
  const { isAuthenticated, isLoading, token, user } = useAuth();
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

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setSavedCharts([]);
      setSavedComparisons([]);
      return;
    }

    const controller = new AbortController();
    const q = deferredSearch.trim();
    const chartUrl = new URL("/api/v1/saved-charts", ASTRO_API);
    const comparisonUrl = new URL("/api/v1/saved-comparisons", ASTRO_API);

    chartUrl.searchParams.set("status", statusFilter);
    comparisonUrl.searchParams.set("status", statusFilter);
    if (q) {
      chartUrl.searchParams.set("q", q);
      comparisonUrl.searchParams.set("q", q);
    }

    const loadWorkspace = async () => {
      try {
        setPageError("");
        const headers = { Authorization: `Bearer ${token}` };
        const [chartsResponse, comparisonsResponse] = await Promise.all([
          fetch(chartUrl.toString(), { headers, signal: controller.signal }),
          fetch(comparisonUrl.toString(), { headers, signal: controller.signal }),
        ]);

        if (!chartsResponse.ok || !comparisonsResponse.ok) {
          throw new Error("Workspace data could not be loaded.");
        }

        const [charts, comparisons] = await Promise.all([
          chartsResponse.json() as Promise<SavedChartRecord[]>,
          comparisonsResponse.json() as Promise<SavedComparisonRecord[]>,
        ]);

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
        if (controller.signal.aborted) {
          return;
        }
        setPageError(error instanceof Error ? error.message : "Workspace request failed.");
      }
    };

    void loadWorkspace();

    return () => controller.abort();
  }, [deferredSearch, isAuthenticated, statusFilter, token]);

  const visibleCharts = useMemo(
    () =>
      sortByMode(
        savedCharts.filter((item) => matchesStatus(item, statusFilter)),
        sortMode,
        (item) => item.name
      ),
    [savedCharts, sortMode, statusFilter]
  );
  const visibleComparisons = useMemo(
    () =>
      sortByMode(
        savedComparisons.filter((item) => matchesStatus(item, statusFilter)),
        sortMode,
        (item) => `${item.primary_name} ${item.partner_name}`
      ),
    [savedComparisons, sortMode, statusFilter]
  );

  const updateNoteDraft = (key: string, value: string) => {
    setNotesDrafts((previous) => ({ ...previous, [key]: value }));
    setSaveStates((previous) => ({ ...previous, [key]: "idle" }));
  };

  const saveChartNotes = async (savedChartId: string) => {
    if (!token) return;
    try {
      setSaveStates((previous) => ({ ...previous, [savedChartId]: "saving" }));
      const response = await fetch(`${ASTRO_API}/api/v1/saved-charts/${savedChartId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notes: notesDrafts[savedChartId] ?? "" }),
      });
      if (!response.ok) {
        throw new Error("Could not save chart notes.");
      }
      const updated = (await response.json()) as SavedChartRecord;
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
    if (!token) return;
    try {
      setSaveStates((previous) => ({ ...previous, [savedComparisonId]: "saving" }));
      const response = await fetch(`${ASTRO_API}/api/v1/saved-comparisons/${savedComparisonId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notes: notesDrafts[savedComparisonId] ?? "" }),
      });
      if (!response.ok) {
        throw new Error("Could not save comparison notes.");
      }
      const updated = (await response.json()) as SavedComparisonRecord;
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
    if (!token) return;
    try {
      const response = await fetch(`${ASTRO_API}/api/v1/saved-charts/${chart.saved_chart_id}/archive`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ archived: !chart.archived_at }),
      });
      if (!response.ok) {
        throw new Error("Archive update failed.");
      }
      const updated = (await response.json()) as SavedChartRecord;
      setSavedCharts((previous) =>
        previous.map((item) => (item.saved_chart_id === chart.saved_chart_id ? updated : item))
      );
      pushToast(chart.archived_at ? "Chart restored." : "Chart archived.", "success");
    } catch {
      pushToast("Could not update chart archive state.", "error");
    }
  };

  const toggleComparisonArchive = async (comparison: SavedComparisonRecord) => {
    if (!token) return;
    try {
      const response = await fetch(
        `${ASTRO_API}/api/v1/saved-comparisons/${comparison.saved_comparison_id}/archive`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ archived: !comparison.archived_at }),
        }
      );
      if (!response.ok) {
        throw new Error("Archive update failed.");
      }
      const updated = (await response.json()) as SavedComparisonRecord;
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
    if (!token) return;
    if (!window.confirm(`Delete ${chart.name}'s saved chart permanently?`)) {
      return;
    }
    try {
      const response = await fetch(`${ASTRO_API}/api/v1/saved-charts/${chart.saved_chart_id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
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
    if (!token) return;
    if (!window.confirm(`Delete the saved report for ${comparison.primary_name} and ${comparison.partner_name}?`)) {
      return;
    }
    try {
      const response = await fetch(
        `${ASTRO_API}/api/v1/saved-comparisons/${comparison.saved_comparison_id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
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
    if (!token) return;
    try {
      setIsExporting(true);
      const response = await fetch(`${ASTRO_API}/api/v1/export/excel`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Export failed.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "astro_workspace.xlsx";
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
        <section className="dashboard-shell">
          <p className="kicker">Workspace</p>
          <h1>Loading your saved astrology workspace...</h1>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="insights-shell">
        <div className="ambient ambient-left" />
        <div className="ambient ambient-right" />
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
      <section className="dashboard-shell">
        <p className="kicker">Workspace</p>
        <h1>{user?.display_name ?? "Your"} astrology workspace</h1>
        <p className="lead">
          Search saved charts, revisit compatibility readings, archive old items, share links, and export account data.
        </p>

        <div className="workspace-toolbar">
          <label className="workspace-search input-glow-gold">
            Search charts, cities, signs, or notes
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search your workspace"
            />
          </label>
          <div className="workspace-toolbar-actions">
            <Link href="/pricing" className="ghost-link">
              Manage plan
            </Link>
            <button type="button" onClick={exportWorkspace} disabled={isExporting}>
              {isExporting ? "Preparing export..." : "Export workspace"}
            </button>
          </div>
        </div>

        <div className="workspace-filter-bar">
          <label className="workspace-inline-filter input-glow-aqua">
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </select>
          </label>
          <label className="workspace-inline-filter input-glow-coral">
            Content
            <select value={contentFilter} onChange={(event) => setContentFilter(event.target.value as ContentFilter)}>
              <option value="all">All</option>
              <option value="charts">Charts only</option>
              <option value="comparisons">Comparisons only</option>
            </select>
          </label>
          <label className="workspace-inline-filter input-glow-violet">
            Sort
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="alphabetical">Alphabetical</option>
            </select>
          </label>
        </div>

        <div className="workspace-summary-grid">
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
          <section className="rules-panel workspace-section">
            <div className="rules-header">
              <p className="kicker">Saved Charts</p>
              <h2>Birth profiles</h2>
            </div>

            {visibleCharts.length === 0 ? (
              <p className="section-intro">No saved charts match the current filters yet.</p>
            ) : (
              <div className="workspace-card-grid">
                {visibleCharts.map((chart) => {
                  const state = saveStates[chart.saved_chart_id] ?? "idle";
                  const chartPath = `/insights?${chart.query_string}`;
                  return (
                    <article key={chart.saved_chart_id} className="workspace-card">
                      <div className="workspace-card-header">
                        <div>
                          <h3>{chart.name}</h3>
                          <p>
                            {chart.city || chart.town || "Unknown city"} • {chart.ascendant_sign} Lagna
                          </p>
                        </div>
                        <div className="workspace-chip-row">
                          {chart.archived_at && <span className="access-pill access-pill--limited">Archived</span>}
                          <Link href={chartPath} className="ghost-link">
                            Open chart
                          </Link>
                        </div>
                      </div>
                      <p className="workspace-card-meta">
                        Born {chart.birth_date} at {chart.birth_time || "unknown time"}
                        {chart.time_zone_id ? ` • ${chart.time_zone_id}` : ""}
                      </p>
                      <textarea
                        className="workspace-notes"
                        value={notesDrafts[chart.saved_chart_id] ?? ""}
                        onChange={(event) => updateNoteDraft(chart.saved_chart_id, event.target.value)}
                        placeholder="Add notes about this profile"
                      />
                      <div className="workspace-card-actions">
                        <button type="button" onClick={() => saveChartNotes(chart.saved_chart_id)}>
                          {state === "saving" ? "Saving..." : "Save notes"}
                        </button>
                        <button type="button" onClick={() => void copyLink(chartPath, "Chart link copied.")}>
                          Copy link
                        </button>
                        <button type="button" onClick={() => void toggleChartArchive(chart)}>
                          {chart.archived_at ? "Restore" : "Archive"}
                        </button>
                        <button type="button" className="danger-btn" onClick={() => void deleteChart(chart)}>
                          Delete
                        </button>
                        <span className={`workspace-save-state workspace-save-state--${state}`}>
                          {state === "saved" && "Saved"}
                          {state === "error" && "Save failed"}
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
          <section className="rules-panel workspace-section">
            <div className="rules-header">
              <p className="kicker">Saved Comparisons</p>
              <h2>Synastry reports</h2>
            </div>

            {visibleComparisons.length === 0 ? (
              <p className="section-intro">No saved compatibility reports match the current filters yet.</p>
            ) : (
              <div className="workspace-card-grid">
                {visibleComparisons.map((comparison) => {
                  const state = saveStates[comparison.saved_comparison_id] ?? "idle";
                  const comparisonPath = `/insights/compatibility?${comparison.query_string}`;
                  return (
                    <article key={comparison.saved_comparison_id} className="workspace-card">
                      <div className="workspace-card-header">
                        <div>
                          <h3>
                            {comparison.primary_name} + {comparison.partner_name}
                          </h3>
                          <p>{comparison.compatibility_score.toFixed(1)} / 100 compatibility score</p>
                        </div>
                        <div className="workspace-chip-row">
                          {comparison.archived_at && <span className="access-pill access-pill--limited">Archived</span>}
                          <Link href={comparisonPath} className="ghost-link">
                            Open report
                          </Link>
                        </div>
                      </div>
                      <p className="workspace-card-meta">{comparison.summary}</p>
                      <textarea
                        className="workspace-notes"
                        value={notesDrafts[comparison.saved_comparison_id] ?? ""}
                        onChange={(event) =>
                          updateNoteDraft(comparison.saved_comparison_id, event.target.value)
                        }
                        placeholder="Add notes about this comparison"
                      />
                      <div className="workspace-card-actions">
                        <button
                          type="button"
                          onClick={() => saveComparisonNotes(comparison.saved_comparison_id)}
                        >
                          {state === "saving" ? "Saving..." : "Save notes"}
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
                          {comparison.archived_at ? "Restore" : "Archive"}
                        </button>
                        <button
                          type="button"
                          className="danger-btn"
                          onClick={() => void deleteComparison(comparison)}
                        >
                          Delete
                        </button>
                        <span className={`workspace-save-state workspace-save-state--${state}`}>
                          {state === "saved" && "Saved"}
                          {state === "error" && "Save failed"}
                        </span>
                      </div>
                    </article>
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
