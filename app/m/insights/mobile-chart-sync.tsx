"use client";

/**
 * Chart history and the consent card, for the handset tree.
 *
 * `/m` recorded nothing at all before this — not locally, and so not remotely
 * either. `recordChartVisit` had only ever been called from the desktop tree,
 * which meant a visitor who did everything on their phone had no history to
 * come back to and nothing an account could hold. This is the missing base and
 * the same consent question the desktop asks, in one component so a mobile page
 * pays for one import rather than three.
 *
 * The card is written against the mobile tokens rather than reusing
 * ChartSyncPrompt: that component reaches for globals.css variables the /m
 * tree deliberately does not load, and pulling the desktop stylesheet onto a
 * handset to style one card would undo the split it exists for.
 */

import { useEffect } from "react";

import { useProfile } from "@/lib/profile-context";
import { useTranslation } from "@/lib/i18n-context";
import { recordChartVisit } from "@/lib/chart-history-store";
import { useChartSync, type ChartToSync } from "@/lib/use-chart-sync";
import styles from "./chart-sync.module.css";

type Props = {
  /** The query string this chart is filed and reopened under. */
  historyQs: string;
  name: string;
  city: string;
  birthDate: string;
  ascendantSign: string;
  sunSign: string | null;
  moonSign: string | null;
};

export default function MobileChartSync({
  historyQs,
  name,
  city,
  birthDate,
  ascendantSign,
  sunSign,
  moonSign,
}: Props) {
  const { profileId } = useProfile();
  const { t } = useTranslation();

  useEffect(() => {
    if (!historyQs) return;
    recordChartVisit(profileId, {
      name,
      city,
      birthDate,
      ascendantSign,
      queryString: historyQs,
    });
  }, [ascendantSign, birthDate, city, historyQs, name, profileId]);

  const chart: ChartToSync | null = historyQs
    ? { queryString: historyQs, ascendantSign, sunSign, moonSign }
    : null;

  const { phase, grant, decline, dismissNudge } = useChartSync(chart, profileId);

  if (phase === "idle") return null;

  const asking = phase === "asking";
  const question = asking ? t("chartSync.askQuestion") : t("chartSync.nudgeQuestion");
  const detail = asking ? t("chartSync.askDetail") : t("chartSync.nudgeDetail");

  return (
    <section className={styles.card} aria-labelledby="m-chart-sync-question">
      <h2 id="m-chart-sync-question" className={styles.question}>
        {question}
      </h2>
      <p className={styles.detail}>{detail}</p>

      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.button} ${styles.accept}`}
          /* The rendered wording is what goes up as consent evidence. */
          onClick={() => grant(`${question} ${detail}`, asking ? "intake" : "nudge")}
        >
          {t("chartSync.accept")}
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={asking ? decline : dismissNudge}
        >
          {asking ? t("chartSync.decline") : t("chartSync.nudgeDismiss")}
        </button>
      </div>

      <p className={styles.note}>
        {asking ? t("chartSync.askNote") : t("chartSync.nudgeNote")}
      </p>
    </section>
  );
}
