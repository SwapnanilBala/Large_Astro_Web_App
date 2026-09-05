"use client";

/**
 * Changing your mind about saving charts.
 *
 * The consent card on /insights promises "you can change your mind at any
 * time". This is where that is true. Without it the promise was decoration:
 * `DELETE /api/sync/charts` existed and worked from the day it was written,
 * and nothing in the app called it.
 *
 * It lives on /login rather than behind a settings icon because that page is
 * already the one that explains where data lives, and it is the page the copy
 * about this browser is written on. Somebody worried about what is stored goes
 * there.
 *
 * Withdrawing deletes. The server marks the grant revoked and removes the
 * birth profiles it was permitting, which cascades to the calculations over
 * them; the local charts are untouched, because they were never the thing
 * consent was about.
 */

import { useEffect, useState } from "react";

import { useTranslation } from "@/lib/i18n-context";
import {
  readChartSyncState,
  recordDecision,
  recordWithdrawal,
  subscribeToChartSync,
  type ChartSyncState,
} from "@/lib/chart-sync-store";
import styles from "./ChartSyncSettings.module.css";

type Result = { tone: "ok" | "error"; message: string } | null;

export default function ChartSyncSettings() {
  const { t } = useTranslation();
  const [state, setState] = useState<ChartSyncState | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);

  /*
   * Read after mount, not during render. The stored decision is in
   * localStorage, which the server cannot see, so rendering it directly would
   * make the server and the client disagree on the first paint.
   */
  useEffect(() => {
    setState(readChartSyncState());
    return subscribeToChartSync(() => setState(readChartSyncState()));
  }, []);

  if (!state) return null;

  const saving = state.decision === "granted";

  const withdraw = async () => {
    setBusy(true);
    setResult(null);

    try {
      const response = await fetch("/api/sync/charts", {
        method: "DELETE",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });

      if (!response.ok) {
        setResult({ tone: "error", message: t("chartSync.withdrawFailed") });
        return;
      }

      const { remaining } = (await response.json()) as { remaining: number };

      /* Only record the decision once the server has actually deleted. A local
         "declined" over data still sitting in Postgres is the exact failure
         this control exists to prevent. */
      if (remaining > 0) {
        setResult({ tone: "error", message: t("chartSync.withdrawFailed") });
        return;
      }

      /* Not recordDecision: a withdrawal must not re-arm the nudge, or the
         next chart argues with somebody who just deleted their data. */
      recordWithdrawal();
      setResult({ tone: "ok", message: t("chartSync.withdrawDone") });
    } catch {
      setResult({ tone: "error", message: t("chartSync.withdrawFailed") });
    } finally {
      setBusy(false);
    }
  };

  const resume = () => {
    recordDecision("granted");
    setResult({ tone: "ok", message: t("chartSync.resumeDone") });
  };

  return (
    <section className={styles.panel} aria-labelledby="chart-sync-settings-heading">
      <h2 id="chart-sync-settings-heading" className={styles.heading}>
        {t("chartSync.settingsHeading")}
      </h2>

      <p className={styles.status}>
        {saving ? t("chartSync.statusSaving") : t("chartSync.statusLocal")}
      </p>
      <p className={styles.detail}>
        {saving ? t("chartSync.detailSaving") : t("chartSync.detailLocal")}
      </p>

      <div className={styles.actions}>
        {saving ? (
          <button
            type="button"
            className={`${styles.button} ${styles.withdraw}`}
            onClick={() => void withdraw()}
            disabled={busy}
          >
            {busy ? t("chartSync.withdrawing") : t("chartSync.withdraw")}
          </button>
        ) : (
          <button type="button" className={styles.button} onClick={resume} disabled={busy}>
            {t("chartSync.resume")}
          </button>
        )}
      </div>

      {result && (
        <p
          className={`${styles.result} ${result.tone === "error" ? styles.error : ""}`}
          role="status"
        >
          {result.message}
        </p>
      )}
    </section>
  );
}
