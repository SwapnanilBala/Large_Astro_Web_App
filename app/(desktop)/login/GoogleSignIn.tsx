"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n-context";
import styles from "./login.module.css";

/**
 * The Google sign-in button.
 *
 * Reaches the API rather than linking straight to Google, because the server
 * has to mint the state, PKCE verifier and nonce and set them as httpOnly
 * cookies first. A plain `<a href>` to accounts.google.com would skip all
 * three and there would be nothing to validate on the way back.
 *
 * A form POST, so it also works with JavaScript disabled up to the point where
 * the redirect happens, and so the request cannot be triggered by a third-party
 * page embedding an image.
 */

/** Google's mark, per their branding requirements for sign-in buttons. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

type GoogleSignInProps = {
  /** False when the server has no Google credentials; the button is hidden. */
  enabled: boolean;
  /** Error code the callback redirected back with, if any. */
  errorCode?: string;
  /** Path to land on after signing in. */
  returnTo?: string;
};

const KNOWN_ERRORS = new Set([
  "not_configured",
  "declined",
  "expired",
  "state_mismatch",
  "exchange_failed",
  "email_unverified",
  "signin_failed",
]);

export default function GoogleSignIn({ enabled, errorCode, returnTo }: GoogleSignInProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const message = errorCode
    ? t(`signIn.error_${KNOWN_ERRORS.has(errorCode) ? errorCode : "unknown"}`)
    : failure;

  const start = async () => {
    setBusy(true);
    setFailure(null);

    try {
      const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
      const response = await fetch(`/api/auth/google/start${query}`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        setFailure(t("signIn.error_not_configured"));
        setBusy(false);
        return;
      }

      const { authorizeUrl } = (await response.json()) as { authorizeUrl?: string };
      if (!authorizeUrl) {
        setFailure(t("signIn.error_signin_failed"));
        setBusy(false);
        return;
      }

      /* replace, not assign: leaving this page in history means Back lands on
         a stale handshake whose cookies have already been spent. */
      window.location.replace(authorizeUrl);
    } catch {
      setFailure(t("signIn.error_signin_failed"));
      setBusy(false);
    }
  };

  if (!enabled && !message) return null;

  return (
    <>
      {message && (
        <p className={styles.error} role="alert">
          <strong>{t("signIn.errorHeading")}</strong> {message}
        </p>
      )}

      {enabled && (
        <>
          <button
            type="button"
            className={styles.googleBtn}
            onClick={() => void start()}
            disabled={busy}
          >
            <GoogleMark />
            <span>{busy ? t("signIn.googleBusy") : t("signIn.google")}</span>
          </button>

          <p className={styles.googleNote}>{t("signIn.note")}</p>

          <div className={styles.divider}>
            <span className={styles.dividerLine} />
            <span className={styles.dividerText}>{t("signIn.divider")}</span>
            <span className={styles.dividerLine} />
          </div>
        </>
      )}
    </>
  );
}
