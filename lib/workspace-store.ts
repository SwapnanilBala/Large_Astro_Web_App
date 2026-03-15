import type { SavedChartRecord, SavedComparisonRecord } from "@/lib/astro-types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

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

function scopedStorageKey(prefix: string, userId: string) {
  return `${prefix}:${userId}`;
}

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
  window.localStorage.setItem(storageKey, JSON.stringify(value));
}

function sortByUpdatedAt<T extends { updated_at: string }>(items: T[]) {
  return [...items].sort(
    (left, right) =>
      new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
  );
}

function chartsStorageKey(userId: string) {
  return scopedStorageKey(LOCAL_CHARTS_PREFIX, userId);
}

function comparisonsStorageKey(userId: string) {
  return scopedStorageKey(LOCAL_COMPARISONS_PREFIX, userId);
}

function readLocalCharts(userId: string) {
  return sortByUpdatedAt(readLocalCollection<SavedChartRecord>(chartsStorageKey(userId)));
}

function writeLocalCharts(userId: string, charts: SavedChartRecord[]) {
  writeLocalCollection(chartsStorageKey(userId), sortByUpdatedAt(charts));
}

function readLocalComparisons(userId: string) {
  return sortByUpdatedAt(
    readLocalCollection<SavedComparisonRecord>(comparisonsStorageKey(userId))
  );
}

function writeLocalComparisons(userId: string, comparisons: SavedComparisonRecord[]) {
  writeLocalCollection(comparisonsStorageKey(userId), sortByUpdatedAt(comparisons));
}

function upsertLocalChart(userId: string, payload: SavedChartInput) {
  const charts = readLocalCharts(userId);
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
  writeLocalCharts(userId, nextCharts);
  return nextRecord;
}

function upsertLocalComparison(userId: string, payload: SavedComparisonInput) {
  const comparisons = readLocalComparisons(userId);
  const timestamp = nowIso();
  const nextRecord: SavedComparisonRecord = {
    ...payload,
    saved_comparison_id: createId("comparison"),
    notes: payload.notes ?? "",
    saved_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };
  writeLocalComparisons(userId, [nextRecord, ...comparisons]);
  return nextRecord;
}

export async function listSavedCharts(userId: string): Promise<SavedChartRecord[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return readLocalCharts(userId);
  }

  const { data, error } = await supabase
    .from("saved_charts")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error || !data) {
    return readLocalCharts(userId);
  }

  return data as SavedChartRecord[];
}

export async function saveChart(userId: string, payload: SavedChartInput): Promise<SavedChartRecord> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return upsertLocalChart(userId, payload);
  }

  const { data, error } = await supabase
    .from("saved_charts")
    .upsert(
      {
        user_id: userId,
        ...payload,
        notes: payload.notes ?? "",
      },
      {
        onConflict: "user_id,name,birth_date,birth_time",
      }
    )
    .select("*")
    .single();

  if (error || !data) {
    return upsertLocalChart(userId, payload);
  }

  return data as SavedChartRecord;
}

export async function updateSavedChartNotes(
  userId: string,
  savedChartId: string,
  notes: string
): Promise<SavedChartRecord | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    const charts = readLocalCharts(userId);
    const updated = charts.map((chart) =>
      chart.saved_chart_id === savedChartId
        ? { ...chart, notes, updated_at: nowIso() }
        : chart
    );
    writeLocalCharts(userId, updated);
    return updated.find((chart) => chart.saved_chart_id === savedChartId) ?? null;
  }

  const { data, error } = await supabase
    .from("saved_charts")
    .update({ notes })
    .eq("saved_chart_id", savedChartId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    return null;
  }

  return data as SavedChartRecord;
}

export async function toggleSavedChartArchive(
  userId: string,
  savedChartId: string,
  archived: boolean
): Promise<SavedChartRecord | null> {
  const archivedAt = archived ? nowIso() : null;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    const charts = readLocalCharts(userId);
    const updated = charts.map((chart) =>
      chart.saved_chart_id === savedChartId
        ? { ...chart, archived_at: archivedAt, updated_at: nowIso() }
        : chart
    );
    writeLocalCharts(userId, updated);
    return updated.find((chart) => chart.saved_chart_id === savedChartId) ?? null;
  }

  const { data, error } = await supabase
    .from("saved_charts")
    .update({ archived_at: archivedAt })
    .eq("saved_chart_id", savedChartId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    return null;
  }

  return data as SavedChartRecord;
}

export async function deleteSavedChart(userId: string, savedChartId: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    const charts = readLocalCharts(userId);
    const nextCharts = charts.filter((chart) => chart.saved_chart_id !== savedChartId);
    writeLocalCharts(userId, nextCharts);
    return nextCharts.length !== charts.length;
  }

  const { error } = await supabase
    .from("saved_charts")
    .delete()
    .eq("saved_chart_id", savedChartId)
    .eq("user_id", userId);
  return !error;
}

export async function listSavedComparisons(
  userId: string
): Promise<SavedComparisonRecord[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return readLocalComparisons(userId);
  }

  const { data, error } = await supabase
    .from("saved_comparisons")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error || !data) {
    return readLocalComparisons(userId);
  }

  return data as SavedComparisonRecord[];
}

export async function saveComparison(
  userId: string,
  payload: SavedComparisonInput
): Promise<SavedComparisonRecord> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return upsertLocalComparison(userId, payload);
  }

  const { data, error } = await supabase
    .from("saved_comparisons")
    .insert({
      user_id: userId,
      ...payload,
      notes: payload.notes ?? "",
    })
    .select("*")
    .single();

  if (error || !data) {
    return upsertLocalComparison(userId, payload);
  }

  return data as SavedComparisonRecord;
}

export async function updateSavedComparisonNotes(
  userId: string,
  savedComparisonId: string,
  notes: string
): Promise<SavedComparisonRecord | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    const comparisons = readLocalComparisons(userId);
    const updated = comparisons.map((comparison) =>
      comparison.saved_comparison_id === savedComparisonId
        ? { ...comparison, notes, updated_at: nowIso() }
        : comparison
    );
    writeLocalComparisons(userId, updated);
    return (
      updated.find(
        (comparison) => comparison.saved_comparison_id === savedComparisonId
      ) ?? null
    );
  }

  const { data, error } = await supabase
    .from("saved_comparisons")
    .update({ notes })
    .eq("saved_comparison_id", savedComparisonId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    return null;
  }

  return data as SavedComparisonRecord;
}

export async function toggleSavedComparisonArchive(
  userId: string,
  savedComparisonId: string,
  archived: boolean
): Promise<SavedComparisonRecord | null> {
  const archivedAt = archived ? nowIso() : null;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    const comparisons = readLocalComparisons(userId);
    const updated = comparisons.map((comparison) =>
      comparison.saved_comparison_id === savedComparisonId
        ? { ...comparison, archived_at: archivedAt, updated_at: nowIso() }
        : comparison
    );
    writeLocalComparisons(userId, updated);
    return (
      updated.find(
        (comparison) => comparison.saved_comparison_id === savedComparisonId
      ) ?? null
    );
  }

  const { data, error } = await supabase
    .from("saved_comparisons")
    .update({ archived_at: archivedAt })
    .eq("saved_comparison_id", savedComparisonId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    return null;
  }

  return data as SavedComparisonRecord;
}

export async function deleteSavedComparison(
  userId: string,
  savedComparisonId: string
): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    const comparisons = readLocalComparisons(userId);
    const nextComparisons = comparisons.filter(
      (comparison) => comparison.saved_comparison_id !== savedComparisonId
    );
    writeLocalComparisons(userId, nextComparisons);
    return nextComparisons.length !== comparisons.length;
  }

  const { error } = await supabase
    .from("saved_comparisons")
    .delete()
    .eq("saved_comparison_id", savedComparisonId)
    .eq("user_id", userId);
  return !error;
}

export async function exportWorkspaceSnapshot(
  userId: string
): Promise<WorkspaceSnapshot> {
  const [charts, comparisons] = await Promise.all([
    listSavedCharts(userId),
    listSavedComparisons(userId),
  ]);

  return {
    exported_at: nowIso(),
    charts,
    comparisons,
  };
}
