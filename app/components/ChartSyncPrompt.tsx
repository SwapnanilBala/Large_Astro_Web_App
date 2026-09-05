"use client";

/**
 * The one question this app asks before it keeps anything on a server.
 *
 * Two wordings, one component. The first is the ask; the second is the single
 * follow-up somebody sees if they declined on an earlier visit, and it argues
 * from what they lose rather than warning them. Both offer the same yes and
 * the same no, and neither gates anything: the chart behind this card is
 * rendered, readable and saved in the browser whichever button is pressed.
 * That is what makes the yes worth recording.
 *
 * The text that is rendered is the text sent to the server as evidence, so a
 * `consent_records` row quotes what its owner actually read — including when
 * they read it in a language other than English.
 */

import { useProfile } from "@/lib/profile-context";
import { useTranslation } from "@/lib/i18n-context";
import { useChartSync, type ChartToSync } from "@/lib/use-chart-sync";
import styles from "./ChartSyncPrompt.module.css";

export default function ChartSyncPrompt({ chart }: { chart: ChartToSync | null }) {
  const { t } = useTranslation();
  const { profileId } = useProfile();
  const { phase, grant, decline, dismissNudge } = useChartSync(chart, profileId);

  if (phase === "idle") return null;

  const asking = phase === "asking";

  const question = asking ? t("chartSync.askQuestion") : t("chartSync.nudgeQuestion");
  const detail = asking ? t("chartSync.askDetail") : t("chartSync.nudgeDetail");

  return (
    <section
      className={styles.card}
      aria-labelledby="chart-sync-question"
      /* Not a dialog and not alert-y. It is a region of the page somebody can
         read when they get to it, or ignore. */
      role="region"
    >
      <p className={styles.kicker}>{t("chartSync.kicker")}</p>
      <h2 id="chart-sync-question" className={styles.question}>
        {question}
      </h2>
      <p className={styles.detail}>{detail}</p>

      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.button} ${styles.accept}`}
          /* The rendered question and detail go up as the evidence, because
             that is what was on screen. */
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
