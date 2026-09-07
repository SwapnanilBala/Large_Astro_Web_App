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

function Ornament() {
  return (
    <svg className={styles.ornament} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="mobile-orbit-gold" x1="18" y1="16" x2="82" y2="86" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E8C89A" />
          <stop offset="1" stopColor="#C89B3C" />
        </linearGradient>
        <linearGradient id="mobile-orbit-teal" x1="26" y1="22" x2="74" y2="78" gradientUnits="userSpaceOnUse">
          <stop stopColor="#46B6A7" />
          <stop offset="1" stopColor="#1A7B6E" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="45" fill="#11111A" stroke="url(#mobile-orbit-gold)" strokeWidth="1" opacity="0.96" />
      <circle cx="50" cy="50" r="32" fill="none" stroke="url(#mobile-orbit-teal)" strokeWidth="0.9" opacity="0.5" />
      <path
        d="M50 12 L54 42 L84 50 L54 58 L50 88 L46 58 L16 50 L46 42 Z"
        fill="url(#mobile-orbit-gold)"
        opacity="0.96"
      />
      <circle cx="50" cy="50" r="4" fill="url(#mobile-orbit-teal)" />
      <circle cx="50" cy="5" r="1.8" fill="#D4A574" />
      <circle cx="95" cy="50" r="1.6" fill="#2DA89A" />
      <circle cx="50" cy="95" r="1.8" fill="#D4A574" />
      <circle cx="5" cy="50" r="1.6" fill="#2DA89A" />
    </svg>
  );
}

function AmbientWheel() {
  return (
    <svg className={styles.ambientWheel} viewBox="0 0 600 600" aria-hidden="true" focusable="false">
      <circle cx="300" cy="300" r="284" />
      <circle cx="300" cy="300" r="224" />
      <circle cx="300" cy="300" r="108" />
      <path d="M300 16V584 M16 300H584 M99 99L501 501 M501 99L99 501 M54 158L546 442 M158 54L442 546 M442 54L158 546 M546 158L54 442" />
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
        <AmbientWheel />
        <div className={styles.loadingCard} role="status">
          <Ornament />
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
      <AmbientWheel />
      <div className={styles.rail}>
        <header className={styles.topBar}>
          <Link href="/" className={styles.back}>
            <Glyph d={ICON.chevron} size={18} />
            {t("home.back")}
          </Link>
          <span className={styles.wordmark}>Lagna Atelier</span>
          <span className={styles.topBarSpacer} aria-hidden="true" />
        </header>

        <div className={styles.mainLayout}>
          <section className={styles.hero} aria-labelledby="mobile-account-heading">
            {skyLine && <span className={styles.sky}>{skyLine}</span>}
            <div className={styles.markHalo}>
              <Ornament />
            </div>
            <p className={styles.eyebrow}>{t("account.kicker")}</p>
            <h1 id="mobile-account-heading" className={`${styles.heading} mGold`}>
              {signedIn ? t("account.headingSignedIn") : t("account.heading")}
            </h1>
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
                <>
                  <button
                    type="button"
                    className={`${styles.primaryAction} ${styles.wideAction}`}
                    onClick={() => void start()}
                    disabled={busy}
                  >
                    <GoogleMark />
                    <span>{busy ? t("signIn.googleBusy") : t("signIn.google")}</span>
                  </button>
                  <p className={styles.footNote}>{t("signIn.note")}</p>
                </>
              ) : (
                /* Google is the only way in, so a deployment without
                   credentials has no sign-in at all. Say so rather than
                   leaving a gap where the button belongs. */
                !message && <p className={styles.error}>{t("signIn.error_not_configured")}</p>
              )}
            </section>

            <p className={styles.fine}>{t("account.storageNote")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
