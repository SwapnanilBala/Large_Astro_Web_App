/**
 * Recently-viewed chart history, scoped to a local profile.
 *
 * This used to be a single device-wide `astro_chart_history` key duplicated
 * across five call sites. It is now one store keyed per profile, so two people
 * sharing a browser do not see each other's charts in the home carousel.
 */

import { profileScopedKey } from "@/lib/local-profiles";

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

export function chartHistoryKey(profileId: string) {
  return profileScopedKey(CHART_HISTORY_PREFIX, profileId);
}

function isEntry(value: unknown): value is ChartHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ChartHistoryEntry>;
  return typeof candidate.queryString === "string" && typeof candidate.name === "string";
}

export function readChartHistory(profileId: string | null): ChartHistoryEntry[] {
  if (typeof window === "undefined" || !profileId) return [];

  try {
    const raw = window.localStorage.getItem(chartHistoryKey(profileId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

function writeChartHistory(profileId: string, entries: ChartHistoryEntry[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      chartHistoryKey(profileId),
      JSON.stringify(entries.slice(0, MAX_ENTRIES))
    );
  } catch {
    return;
  }

  window.dispatchEvent(new CustomEvent(CHART_HISTORY_CHANGED_EVENT));
}

/** Record a viewed chart, replacing any earlier entry for the same person. */
export function recordChartVisit(
  profileId: string | null,
  entry: Omit<ChartHistoryEntry, "savedAt"> & { savedAt?: string }
) {
  if (!profileId) return;

  const existing = readChartHistory(profileId);
  const deduped = existing.filter(
    (candidate) => !(candidate.name === entry.name && candidate.birthDate === entry.birthDate)
  );

  writeChartHistory(profileId, [
    { ...entry, savedAt: entry.savedAt ?? new Date().toISOString() },
    ...deduped,
  ]);
}

/** Subscribe to history changes from this tab and from other tabs. */
export function subscribeToChartHistory(
  profileId: string | null,
  listener: () => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const scopedKey = profileId ? chartHistoryKey(profileId) : null;
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
