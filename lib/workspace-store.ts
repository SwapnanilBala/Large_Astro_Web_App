/**
 * Saved charts and comparisons for one local profile.
 *
 * Everything lives in `localStorage` under a profile-scoped key — there is no
 * remote backend. `profileId` comes from `lib/local-profiles`.
 */

import type { SavedChartRecord, SavedComparisonRecord } from "@/lib/astro-types";
import { profileScopedKey } from "@/lib/local-profiles";

type SavedChartInput = Omit<
  SavedChartRecord,
  "saved_chart_id" | "notes" | "saved_at" | "updated_at" | "archived_at"
> & {
  notes?: string;
};

type SavedComparisonInput = Omit<
  SavedComparisonRecord,
  "saved_comparison_id" | "notes" | "saved_at" | "updated_at" | "archived_at"
> & {
  notes?: string;
};

type WorkspaceSnapshot = {
  exported_at: string;
  charts: SavedChartRecord[];
  comparisons: SavedComparisonRecord[];
};

const LOCAL_CHARTS_PREFIX = "astro_workspace_saved_charts";
const LOCAL_COMPARISONS_PREFIX = "astro_workspace_saved_comparisons";

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readLocalCollection<T>(storageKey: string): T[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocalCollection<T>(storageKey: string, value: T[]) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage blocked — the caller still gets the record it
    // built, it just will not survive a reload.
  }
}

function sortByUpdatedAt<T extends { updated_at: string }>(items: T[]) {
  return [...items].sort(
    (left, right) =>
      new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
  );
}

function chartsStorageKey(profileId: string) {
  return profileScopedKey(LOCAL_CHARTS_PREFIX, profileId);
}

function comparisonsStorageKey(profileId: string) {
  return profileScopedKey(LOCAL_COMPARISONS_PREFIX, profileId);
}

function readLocalCharts(profileId: string) {
  return sortByUpdatedAt(readLocalCollection<SavedChartRecord>(chartsStorageKey(profileId)));
}

function writeLocalCharts(profileId: string, charts: SavedChartRecord[]) {
  writeLocalCollection(chartsStorageKey(profileId), sortByUpdatedAt(charts));
}

function readLocalComparisons(profileId: string) {
  return sortByUpdatedAt(
    readLocalCollection<SavedComparisonRecord>(comparisonsStorageKey(profileId))
  );
}

function writeLocalComparisons(profileId: string, comparisons: SavedComparisonRecord[]) {
  writeLocalCollection(comparisonsStorageKey(profileId), sortByUpdatedAt(comparisons));
}

export async function listSavedCharts(profileId: string): Promise<SavedChartRecord[]> {
  return readLocalCharts(profileId);
}

/** Upsert on (name, birth_date, birth_time) so recalculating a chart updates it. */
export async function saveChart(
  profileId: string,
  payload: SavedChartInput
): Promise<SavedChartRecord> {
  const charts = readLocalCharts(profileId);
  const existing = charts.find(
    (chart) =>
      chart.name === payload.name &&
      chart.birth_date === payload.birth_date &&
      chart.birth_time === payload.birth_time
  );
  const timestamp = nowIso();
  const nextRecord: SavedChartRecord = existing
    ? {
        ...existing,
        ...payload,
        notes: payload.notes ?? existing.notes,
        updated_at: timestamp,
      }
    : {
        ...payload,
        saved_chart_id: createId("chart"),
        notes: payload.notes ?? "",
        saved_at: timestamp,
        updated_at: timestamp,
        archived_at: null,
      };

  const nextCharts = existing
    ? charts.map((chart) =>
        chart.saved_chart_id === existing.saved_chart_id ? nextRecord : chart
      )
    : [nextRecord, ...charts];
  writeLocalCharts(profileId, nextCharts);
  return nextRecord;
}

export async function updateSavedChartNotes(
  profileId: string,
  savedChartId: string,
  notes: string
): Promise<SavedChartRecord | null> {
  const charts = readLocalCharts(profileId);
  const updated = charts.map((chart) =>
    chart.saved_chart_id === savedChartId
      ? { ...chart, notes, updated_at: nowIso() }
      : chart
  );
  writeLocalCharts(profileId, updated);
  return updated.find((chart) => chart.saved_chart_id === savedChartId) ?? null;
}

export async function toggleSavedChartArchive(
  profileId: string,
  savedChartId: string,
  archived: boolean
): Promise<SavedChartRecord | null> {
  const archivedAt = archived ? nowIso() : null;
  const charts = readLocalCharts(profileId);
  const updated = charts.map((chart) =>
    chart.saved_chart_id === savedChartId
      ? { ...chart, archived_at: archivedAt, updated_at: nowIso() }
      : chart
  );
  writeLocalCharts(profileId, updated);
  return updated.find((chart) => chart.saved_chart_id === savedChartId) ?? null;
}

export async function deleteSavedChart(
  profileId: string,
  savedChartId: string
): Promise<boolean> {
  const charts = readLocalCharts(profileId);
  const nextCharts = charts.filter((chart) => chart.saved_chart_id !== savedChartId);
  writeLocalCharts(profileId, nextCharts);
  return nextCharts.length !== charts.length;
}

export async function listSavedComparisons(
  profileId: string
): Promise<SavedComparisonRecord[]> {
  return readLocalComparisons(profileId);
}

export async function saveComparison(
  profileId: string,
  payload: SavedComparisonInput
): Promise<SavedComparisonRecord> {
  const comparisons = readLocalComparisons(profileId);
  const timestamp = nowIso();
  const nextRecord: SavedComparisonRecord = {
    ...payload,
    saved_comparison_id: createId("comparison"),
    notes: payload.notes ?? "",
    saved_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };
  writeLocalComparisons(profileId, [nextRecord, ...comparisons]);
  return nextRecord;
}

export async function updateSavedComparisonNotes(
  profileId: string,
  savedComparisonId: string,
  notes: string
): Promise<SavedComparisonRecord | null> {
  const comparisons = readLocalComparisons(profileId);
  const updated = comparisons.map((comparison) =>
    comparison.saved_comparison_id === savedComparisonId
      ? { ...comparison, notes, updated_at: nowIso() }
      : comparison
  );
  writeLocalComparisons(profileId, updated);
  return (
    updated.find(
      (comparison) => comparison.saved_comparison_id === savedComparisonId
    ) ?? null
  );
}

export async function toggleSavedComparisonArchive(
  profileId: string,
  savedComparisonId: string,
  archived: boolean
): Promise<SavedComparisonRecord | null> {
  const archivedAt = archived ? nowIso() : null;
  const comparisons = readLocalComparisons(profileId);
  const updated = comparisons.map((comparison) =>
    comparison.saved_comparison_id === savedComparisonId
      ? { ...comparison, archived_at: archivedAt, updated_at: nowIso() }
      : comparison
  );
  writeLocalComparisons(profileId, updated);
  return (
    updated.find(
      (comparison) => comparison.saved_comparison_id === savedComparisonId
    ) ?? null
  );
}

export async function deleteSavedComparison(
  profileId: string,
  savedComparisonId: string
): Promise<boolean> {
  const comparisons = readLocalComparisons(profileId);
  const nextComparisons = comparisons.filter(
    (comparison) => comparison.saved_comparison_id !== savedComparisonId
  );
  writeLocalComparisons(profileId, nextComparisons);
  return nextComparisons.length !== comparisons.length;
}

export async function exportWorkspaceSnapshot(
  profileId: string
): Promise<WorkspaceSnapshot> {
  const [charts, comparisons] = await Promise.all([
    listSavedCharts(profileId),
    listSavedComparisons(profileId),
  ]);

  return {
    exported_at: nowIso(),
    charts,
    comparisons,
  };
}
