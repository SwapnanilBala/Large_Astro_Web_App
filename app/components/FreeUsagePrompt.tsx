"use client";

/**
 * "That was your last free reading."
 *
 * Raised when one of the three paid panels is refused for want of an account,
 * and only then: the daily route ceiling and the per-account ceiling are both
 * refusals that signing in would not lift, so offering an account as the remedy
 * for those would be a lie. lib/free-usage-store.ts makes that distinction and
 * this component trusts it.
 *
 * A real dialog, unlike ChartSyncPrompt next door, and for the opposite reason:
 * that card asks permission for something optional while the chart is already
 * on screen, whereas this one reports that a thing the visitor just asked for
 * did not happen. It has to be noticed. It is still dismissible without signing
 * in, because everything else on the page keeps working -- the deterministic
 * dasha sentence, the chart, the rest of the panels -- and trapping someone
 * behind a registration wall to read what they already have would be a worse
 * trade than the one this prompt is making.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { useTranslation } from "@/lib/i18n-context";
import { subscribeToFreeUsage, type PaidFeature } from "@/lib/free-usage-store";
import styles from "./FreeUsagePrompt.module.css";

/** Which feature ran out, so the copy names the thing they were doing. */
const FEATURE_KEY: Record<PaidFeature, string> = {
  dashaInterpretation: "freeUsage.featureDasha",
  domainBrief: "freeUsage.featureDomain",
  palmReading: "freeUsage.featurePalm",
};

export default function FreeUsagePrompt() {
  const { t } = useTranslation();
  const [feature, setFeature] = useState<PaidFeature | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  /* Where focus was when the dialog took it, so it can be handed back. */
  const returnFocusRef = useRef<Element | null>(null);

  useEffect(
    () =>
      subscribeToFreeUsage((next) => {
        returnFocusRef.current = document.activeElement;
        setFeature(next);
      }),
    [],
  );

  const dismiss = useCallback(() => {
    setFeature(null);
    const previous = returnFocusRef.current;
    if (previous instanceof HTMLElement) previous.focus();
  }, []);

  useEffect(() => {
    if (!feature) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [feature, dismiss]);

  if (!feature) return null;

  return (
    <div
      className={styles.backdrop}
      /* Clicks on the backdrop dismiss; clicks inside must not bubble out to
         it, which is what the stopPropagation on the panel is for. */
      onClick={dismiss}
    >
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="free-usage-title"
        aria-describedby="free-usage-detail"
        onClick={(event) => event.stopPropagation()}
      >
        <p className={styles.kicker}>{t(FEATURE_KEY[feature])}</p>
        <h2 id="free-usage-title" className={styles.title}>
          {t("freeUsage.title")}
        </h2>
        <p id="free-usage-detail" className={styles.detail}>
          {t("freeUsage.detail")}
        </p>

        <div className={styles.actions}>
          <Link href="/login" className={`${styles.button} ${styles.primary}`} onClick={dismiss}>
            {t("freeUsage.register")}
          </Link>
          <button
            ref={closeRef}
            type="button"
            className={`${styles.button} ${styles.secondary}`}
            onClick={dismiss}
          >
            {t("freeUsage.later")}
          </button>
        </div>

        <p className={styles.note}>{t("freeUsage.note")}</p>
      </div>
    </div>
  );
}
