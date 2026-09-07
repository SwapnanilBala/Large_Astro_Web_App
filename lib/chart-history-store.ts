/**
 * Recently-viewed chart history.
 *
 * This started as a single device-wide `astro_chart_history` key duplicated
 * across five call sites, then became one store keyed per local profile. The
 * profile picker is gone, so it is back to one store per device — but behind
 * `localScopedKey`, which owns the key shape and the migration off the old
 * per-profile keys.
 */

import { ensureLocalScope, localScopedKey } from "@/lib/local-scope";

export type ChartHistoryEntry = {
  name: string;
  city: string;
  birthDate: string;
  ascendantSign: string;
  savedAt: string;
  queryString: string;
};

export const CHART_HISTORY_PREFIX = "astro_chart_history";
export const CHART_HISTORY_CHANGED_EVENT = "astro:chart-history-changed";

const MAX_ENTRIES = 20;

export function chartHistoryKey() {
  return localScopedKey(CHART_HISTORY_PREFIX);
}

function isEntry(value: unknown): value is ChartHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ChartHistoryEntry>;
  return typeof candidate.queryString === "string" && typeof candidate.name === "string";
}

export function readChartHistory(): ChartHistoryEntry[] {
  if (typeof window === "undefined") return [];
  ensureLocalScope();

  try {
    const raw = window.localStorage.getItem(chartHistoryKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

function writeChartHistory(entries: ChartHistoryEntry[]) {
  if (typeof window === "undefined") return;
  ensureLocalScope();

  try {
    window.localStorage.setItem(
      chartHistoryKey(),
      JSON.stringify(entries.slice(0, MAX_ENTRIES))
    );
  } catch {
    return;
  }

  window.dispatchEvent(new CustomEvent(CHART_HISTORY_CHANGED_EVENT));
}

/** Record a viewed chart, replacing any earlier entry for the same person. */
export function recordChartVisit(
  entry: Omit<ChartHistoryEntry, "savedAt"> & { savedAt?: string }
) {
  const existing = readChartHistory();
  const deduped = existing.filter(
    (candidate) => !(candidate.name === entry.name && candidate.birthDate === entry.birthDate)
  );

  writeChartHistory([
    { ...entry, savedAt: entry.savedAt ?? new Date().toISOString() },
    ...deduped,
  ]);
}

/** Subscribe to history changes from this tab and from other tabs. */
export function subscribeToChartHistory(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const scopedKey = chartHistoryKey();
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === scopedKey) {
      listener();
    }
  };

  window.addEventListener(CHART_HISTORY_CHANGED_EVENT, listener);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(CHART_HISTORY_CHANGED_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}
