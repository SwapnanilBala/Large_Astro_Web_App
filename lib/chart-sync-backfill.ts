/**
 * Pushing the charts somebody already had when they said yes.
 *
 * Without this, agreeing to save your charts saves exactly one of them — the
 * one on screen at the moment you agreed — and the rest of a history built up
 * over weeks stays local until you happen to reopen each entry by hand. The
 * account plan calls this step 3 and is blunt that it cannot be deferred past
 * hydration, because a visitor who signs in on a second device and finds one
 * chart there has been told their charts follow them and then shown otherwise.
 *
 * Sends what is in this browser, which is what the grant was given over. Data
 * still sitting under the retired per-profile keys is deliberately not swept
 * up: the migration adopts the one profile that was active, and anything it
 * left behind may be another person's birth details on a shared browser —
 * pushing those would be one person's data under the other's grant.
 *
 * Sequential on purpose. Twenty entries is the ceiling
 * (`MAX_ENTRIES` in chart-history-store), it runs once per visitor, and a
 * burst of parallel writes against the same workspace would race on the
 * clients and birth_profiles upserts for no gain anybody can perceive.
 */

import { readChartHistory } from "@/lib/chart-history-store";

export type BackfillConsent = {
  prompt: string;
  captureSource: "intake" | "nudge" | "settings";
};

export type BackfillResult = {
  /** Charts that were candidates, after `alreadyPushed` was subtracted. */
  attempted: number;
  stored: number;
  failed: number;
};

export type BackfillOptions = {
  /** Query strings the caller has already sent, so the on-screen chart is not resent. */
  alreadyPushed?: ReadonlySet<string>;
  /** Aborts between charts; an in-flight request is left to finish. */
  isCancelled?: () => boolean;
};

/**
 * Two consecutive failures stops the run.
 *
 * A single failure is worth stepping over — one unstorable chart in a history
 * should not strand the nineteen behind it. Two in a row is a server or a
 * network that is not going to improve within this loop, and the remaining
 * charts are still safe in localStorage for the next attempt.
 */
const CONSECUTIVE_FAILURE_LIMIT = 2;

export async function backfillCharts(
  consent: BackfillConsent,
  options: BackfillOptions = {},
): Promise<BackfillResult> {
  const empty: BackfillResult = { attempted: 0, stored: 0, failed: 0 };

  const alreadyPushed = options.alreadyPushed ?? new Set<string>();
  const isCancelled = options.isCancelled ?? (() => false);

  const pending = readChartHistory().filter(
    (entry) => entry.queryString && !alreadyPushed.has(entry.queryString),
  );

  if (pending.length === 0) return empty;

  let stored = 0;
  let failed = 0;
  let consecutiveFailures = 0;

  for (const entry of pending) {
    if (isCancelled()) break;

    try {
      const response = await fetch("/api/sync/charts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          queryString: entry.queryString,
          ascendantSign: entry.ascendantSign || null,
          /* History does not keep these two; the chart is identified by its
             query string either way, and the server recomputes from that. */
          sunSign: null,
          moonSign: null,
          consent: { granted: true, ...consent },
        }),
      });

      if (response.ok) {
        stored += 1;
        consecutiveFailures = 0;
        continue;
      }

      failed += 1;

      /* A 4xx is this chart's problem — an incomplete query string from an
         older history entry, say. Step over it and keep going; it says
         nothing about the next one. */
      if (response.status < 500) {
        consecutiveFailures = 0;
        continue;
      }

      consecutiveFailures += 1;
    } catch {
      failed += 1;
      consecutiveFailures += 1;
    }

    if (consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT) break;
  }

  return { attempted: pending.length, stored, failed };
}
