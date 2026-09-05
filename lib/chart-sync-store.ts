/**
 * What this browser has been told about saving charts to the server.
 *
 * Device-wide rather than profile-scoped, on purpose. The question is whether
 * charts from this browser reach the account behind it, and the account is a
 * property of the device or the sign-in — not of which of the five local
 * profiles happens to be selected. Scoping it per profile would ask the same
 * person the same question five times.
 *
 * This is not the consent record. The record of record lives in Postgres in
 * `consent_records`, written by the server with the wording the visitor saw.
 * This is only the browser remembering what it already asked, so it does not
 * ask again.
 */

const STORAGE_KEY = "astro_chart_sync_consent";

/** Fired on `window` when the decision changes, for other components on screen. */
export const CHART_SYNC_CHANGED_EVENT = "astro:chart-sync-changed";

export type SyncDecision = "granted" | "declined";

export type ChartSyncState = {
  decision: SyncDecision | null;
  /** When they answered. Used to keep the nudge out of the same page view. */
  decidedAt: string | null;
  /** When the post-decline nudge was shown. Non-null means never again. */
  nudgeShownAt: string | null;
};

const EMPTY: ChartSyncState = {
  decision: null,
  decidedAt: null,
  nudgeShownAt: null,
};

function isDecision(value: unknown): value is SyncDecision {
  return value === "granted" || value === "declined";
}

function isoOrNull(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

export function readChartSyncState(): ChartSyncState {
  if (typeof window === "undefined") return EMPTY;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;

    const parsed = JSON.parse(raw) as Partial<ChartSyncState>;

    return {
      decision: isDecision(parsed.decision) ? parsed.decision : null,
      decidedAt: isoOrNull(parsed.decidedAt),
      nudgeShownAt: isoOrNull(parsed.nudgeShownAt),
    };
  } catch {
    return EMPTY;
  }
}

function write(state: ChartSyncState) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Storage full or blocked. The decision is then re-asked on the next
       visit, which is the safe direction to fail: asking again is a nuisance,
       assuming a yes is not. */
    return;
  }

  window.dispatchEvent(new CustomEvent(CHART_SYNC_CHANGED_EVENT));
}

export function recordDecision(decision: SyncDecision) {
  const previous = readChartSyncState();

  write({
    decision,
    decidedAt: new Date().toISOString(),
    /* Granting clears the nudge state: if they ever decline again, the case
       for saying yes is worth making once more, because by then the reason
       will have changed. */
    nudgeShownAt: decision === "granted" ? null : previous.nudgeShownAt,
  });
}

/**
 * A deliberate withdrawal from settings, as opposed to declining the first ask.
 *
 * Spends the nudge in the same write, and that is the whole reason this is not
 * just `recordDecision("declined")`. Somebody who has gone to /login and
 * pressed a button that deletes their data has decided; meeting them on the
 * next chart with "saving it is what makes it come back" would be arguing with
 * an informed choice, which is precisely the behaviour the one-shot rule
 * exists to rule out. The nudge is for a first no, not for a withdrawal.
 */
export function recordWithdrawal() {
  const now = new Date().toISOString();
  write({ decision: "declined", decidedAt: now, nudgeShownAt: now });
}

/** Mark the one-shot post-decline prompt as spent. */
export function markNudgeShown() {
  write({ ...readChartSyncState(), nudgeShownAt: new Date().toISOString() });
}

export function subscribeToChartSync(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) listener();
  };

  window.addEventListener(CHART_SYNC_CHANGED_EVENT, listener);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(CHART_SYNC_CHANGED_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}
