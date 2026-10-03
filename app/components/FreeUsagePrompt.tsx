"use client";

/**
 * An invitation to continue after the guest allowance is used.
 *
 * Raised when a paid reading is refused for want of an account,
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
import { ArrowRight, Check, Orbit, X } from "lucide-react";

import { useTranslation } from "@/lib/i18n-context";
import {
  claimFreeUsagePrompt,
  setFreeUsagePromptMutedForToday,
  subscribeToFreeUsage,
  type PaidFeature,
} from "@/lib/free-usage-store";
import { LLM_ACCOUNT_PER_DAY, LLM_FREE_PER_DAY } from "@/lib/llm-budget-tiers";
import styles from "./FreeUsagePrompt.module.css";

/** Which feature ran out, so the copy names the thing they were doing. */
const FEATURE_KEY: Record<PaidFeature, string> = {
  dashaInterpretation: "freeUsage.featureDasha",
  domainBrief: "freeUsage.featureDomain",
  palmReading: "freeUsage.featurePalm",
  palmQuestions: "freeUsage.featurePalmQuestions",
};

export default function FreeUsagePrompt() {
  const { t } = useTranslation();
  const [feature, setFeature] = useState<PaidFeature | null>(null);
  const [dontShowToday, setDontShowToday] = useState(false);
  const [signInHref, setSignInHref] = useState("/login");
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /* Where focus was when the dialog took it, so it can be handed back. */
  const returnFocusRef = useRef<Element | null>(null);

  useEffect(
    () =>
      subscribeToFreeUsage((next) => {
        if (!claimFreeUsagePrompt()) return;
        returnFocusRef.current = document.activeElement;
        setDontShowToday(false);
        setSignInHref(`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}`);
        setFeature(next);
      }),
    [],
  );

  const dismiss = useCallback(() => {
    setFeature(null);
    const previous = returnFocusRef.current;
    if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
  }, []);

  useEffect(() => {
    if (!feature) return;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [feature]);

  useEffect(() => {
    if (!feature) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
      if (event.key !== "Tab") return;
      const controls = panelRef.current?.querySelectorAll<HTMLElement>("a[href], button, input");
      const first = controls?.[0];
      const last = controls?.[controls.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("popstate", dismiss);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", dismiss);
    };
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
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="free-usage-title"
        aria-describedby="free-usage-detail"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          className={styles.close}
          aria-label={t("freeUsage.close")}
          onClick={dismiss}
        >
          <X aria-hidden="true" />
        </button>
        <div className={styles.emblem} aria-hidden="true"><Orbit /></div>
        <p className={styles.kicker}>{t(FEATURE_KEY[feature])}</p>
        <h2 id="free-usage-title" className={styles.title}>
          {t("freeUsage.title")}
        </h2>
        <p id="free-usage-detail" className={styles.detail}>
          {t("freeUsage.detail")}
        </p>

        <div className={styles.allowance}>
          <div>
            <p className={styles.allowanceValue}>
              <strong>{LLM_FREE_PER_DAY}</strong>
              <span>{t("freeUsage.perDay")}</span>
            </p>
            <p className={styles.allowanceLabel}>{t("freeUsage.guestAllowance")}</p>
          </div>
          <ArrowRight className={styles.allowanceArrow} aria-hidden="true" />
          <div className={styles.accountAllowance}>
            <p className={styles.allowanceValue}>
              <strong>{LLM_ACCOUNT_PER_DAY}</strong>
              <span>{t("freeUsage.perDay")}</span>
            </p>
            <p className={styles.allowanceLabel}>{t("freeUsage.accountAllowance")}</p>
          </div>
        </div>

        <label className={styles.muteOption}>
          <input
            type="checkbox"
            checked={dontShowToday}
            onChange={(event) => {
              setDontShowToday(event.target.checked);
              setFreeUsagePromptMutedForToday(event.target.checked);
            }}
          />
          <span>{t("freeUsage.hideToday")}</span>
        </label>

        <div className={styles.actions}>
          <Link href={signInHref} className={`${styles.button} ${styles.primary}`} onClick={dismiss}>
            {t("freeUsage.register")}
            <ArrowRight aria-hidden="true" />
          </Link>
          <button
            type="button"
            className={`${styles.button} ${styles.secondary}`}
            onClick={dismiss}
          >
            {t("freeUsage.later")}
          </button>
        </div>

        <p className={styles.note}><Check aria-hidden="true" />{t("freeUsage.note")}</p>
      </div>
    </div>
  );
}
