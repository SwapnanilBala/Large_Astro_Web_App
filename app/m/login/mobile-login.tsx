"use client";

/**
 * The account page, handset rendering.
 *
 * This was the local profile picker — five named slots, a manage sheet, rename
 * and delete. All of it is gone: a Google account is the only identity the app
 * has now, and this tree had no sign-in button at all, so a phone could not
 * reach one. The handshake is `useGoogleSignIn`, shared with the desktop
 * button; only the chrome below is per-tree.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n-context";
import { useAccount } from "@/lib/use-account";
import { useGoogleSignIn } from "@/lib/use-google-signin";
import { resolveLandingDestination } from "@/lib/landing-redirect";
import styles from "./login.module.css";

type Props = {
  returnTo?: string;
  skyLine?: string;
  /** False when the server has no Google credentials configured. */
  googleEnabled?: boolean;
  /** Error code the OAuth callback bounced back with, if any. */
  signInError?: string;
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

function Glyph({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const ICON = {
  chevron: "m15 18-6-6 6-6",
};

export default function MobileLogin({
  returnTo,
  skyLine,
  googleEnabled = false,
  signInError,
}: Props) {
  const { t } = useTranslation();
  const { account, status } = useAccount();
  const { busy, failure, start } = useGoogleSignIn(returnTo);
  const router = useRouter();

  const [leaving, setLeaving] = useState(false);

  const destination = returnTo ?? "/";

  /* An error bounced back from the callback outranks one raised here: it
     describes a handshake that actually reached Google. */
  const message = signInError
    ? t(`signIn.error_${KNOWN_ERRORS.has(signInError) ? signInError : "unknown"}`)
    : failure
      ? t(`signIn.error_${failure}`)
      : null;

  const goOn = async () => {
    setLeaving(true);
    router.push(resolveLandingDestination(destination));
  };

  if (status === "loading" || leaving) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingCard} role="status">
          <p className={styles.loading}>
            {leaving ? t("account.opening") : t("account.checking")}
          </p>
        </div>
      </div>
    );
  }

  const signedIn = status === "signed-in" && account;

  return (
    <div className={styles.page}>
      <div className={styles.rail}>
        <header className={styles.topBar}>
          <Link href="/" className={styles.back}>
            <Glyph d={ICON.chevron} size={18} />
            {t("home.back")}
          </Link>
          <span className={styles.wordmark}>Lagna Atelier</span>
        </header>

        <div className={styles.mainLayout}>
          <section className={styles.hero} aria-labelledby="mobile-account-heading">
            {skyLine && <span className={styles.sky}>{skyLine}</span>}
            <p className={styles.eyebrow}>{t("account.kicker")}</p>
            <h1 id="mobile-account-heading" className={styles.heading}>
              {signedIn ? t("account.headingSignedIn") : t("account.heading")}
            </h1>
            {/* The page's one sentence. A note under the Google button and a
                storage note under the panel used to repeat it: three ways of
                saying "everything else stays in this browser" on one screen. */}
            <p className={styles.lead}>
              {signedIn ? t("account.leadSignedIn") : t("account.lead")}
            </p>
          </section>

          <div className={styles.profileArea}>
            <section className={styles.profilePanel} aria-label={t("account.kicker")}>
              {message && (
                <p className={styles.error} role="alert">
                  {message}
                </p>
              )}

              {signedIn ? (
                <>
                  <p className={styles.identity}>
                    <span className={styles.avatar} aria-hidden="true">
                      {(account.displayName ?? account.email).slice(0, 1).toUpperCase()}
                    </span>
                    <span className={styles.name}>
                      {account.displayName ?? account.email}
                    </span>
                  </p>
                  <button
                    type="button"
                    className={`${styles.primaryAction} ${styles.wideAction}`}
                    onClick={() => void goOn()}
                  >
                    {t("account.continue")}
                  </button>
                </>
              ) : status === "unavailable" ? (
                /* Not the same as signed out, and offering the button here
                   invites a sign-in against a store that cannot answer. */
                <p className={styles.error}>{t("account.unavailable")}</p>
              ) : googleEnabled ? (
                <button
                  type="button"
                  className={`${styles.googleAction} ${styles.wideAction}`}
                  onClick={() => void start()}
                  disabled={busy}
                >
                  <GoogleMark />
                  <span>{busy ? t("signIn.googleBusy") : t("signIn.google")}</span>
                </button>
              ) : (
                /* Google is the only way in, so a deployment without
                   credentials has no sign-in at all. Say so rather than
                   leaving a gap where the button belongs. */
                !message && <p className={styles.error}>{t("signIn.error_not_configured")}</p>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
