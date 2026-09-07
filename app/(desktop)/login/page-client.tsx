"use client";

/**
 * The account page.
 *
 * This was the local profile picker — up to five named slots on the device,
 * each with its own charts. That is gone: a Google account is the only identity
 * the app has now, and everything kept on the device sits in one scope shared
 * by whoever is using this browser.
 *
 * The page still carries the storage note and `ChartSyncSettings` underneath.
 * Signing in is about reaching your charts from a second device; it is not what
 * decides whether they leave the browser at all, and those two answers being
 * separate is the thing this page has to keep making obvious.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n-context";
import { useAccount } from "@/lib/use-account";
import { resolveLandingDestination } from "@/lib/landing-redirect";
import PageTransition from "@/app/components/PageTransition";
import ChartSyncSettings from "@/app/components/ChartSyncSettings";
import BackButton from "@/app/components/BackButton";
import AuthAmbient from "./AuthAmbient";
import GoogleSignIn from "./GoogleSignIn";
import ZodiacFloater from "./ZodiacFloater";
import styles from "./login.module.css";

type LoginPageClientProps = {
  returnTo?: string;
  skyLine?: string;
  /** False when the server has no Google credentials configured. */
  googleEnabled?: boolean;
  /** Error code the OAuth callback bounced back with, if any. */
  signInError?: string;
};

export default function LoginPageClient({
  returnTo,
  skyLine,
  googleEnabled = false,
  signInError,
}: LoginPageClientProps) {
  const { t } = useTranslation();
  const { account, status } = useAccount();
  const router = useRouter();

  const [settling, setSettling] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const destination = returnTo ?? "/";

  const goOn = async () => {
    setSettling(true);
    const resolved = resolveLandingDestination(destination);
    // Brief shimmer choreography before navigating away
    await new Promise((resolve) => setTimeout(resolve, 500));
    setRedirecting(true);
    router.push(resolved);
  };

  if (redirecting) {
    return (
      <PageTransition>
        <div className="home-shell" style={{ position: "relative" }}>
          <AuthAmbient />
          <section className={styles.panel} style={{ textAlign: "center" }}>
            <p className="kicker">{t("account.opening")}</p>
          </section>
        </div>
      </PageTransition>
    );
  }

  const signedIn = status === "signed-in" && account;

  return (
    <PageTransition>
      <div className="home-shell" style={{ position: "relative" }}>
        <AuthAmbient />
        <ZodiacFloater />
        <BackButton href="/" />
        <section className={`${styles.panel} ${settling ? styles.panelSettling : ""}`}>
          {settling && <span className={styles.shimmerSweep} aria-hidden="true" />}
          <div className={styles.header}>
            {skyLine && <p className={styles.skyLine}>✦ {skyLine} ✦</p>}
            <p className="kicker">{t("account.kicker")}</p>
            <h1 className={styles.heading}>
              {signedIn ? t("account.headingSignedIn") : t("account.heading")}
            </h1>
            <p className={styles.lead}>
              {signedIn ? t("account.leadSignedIn") : t("account.lead")}
            </p>
          </div>

          {status === "loading" && <p className={styles.switchText}>{t("account.checking")}</p>}

          {signedIn && (
            <>
              <p className={styles.accountIdentity}>
                <span className={styles.accountAvatar} aria-hidden="true">
                  {(account.displayName ?? account.email).slice(0, 1).toUpperCase()}
                </span>
                <span className={styles.accountName}>
                  {account.displayName ?? account.email}
                </span>
                {account.displayName && (
                  <span className={styles.accountEmail}>{account.email}</span>
                )}
              </p>

              <button type="button" className={styles.submitBtn} onClick={() => void goOn()}>
                {t("account.continue")}
              </button>
            </>
          )}

          {status === "signed-out" && (
            <GoogleSignIn
              enabled={googleEnabled}
              errorCode={signInError || undefined}
              returnTo={returnTo}
            />
          )}

          {/* Google is the only way in, so a deployment without credentials has
              no sign-in at all. GoogleSignIn renders nothing in that state —
              saying so beats an unexplained gap where the button belongs. */}
          {status === "signed-out" && !googleEnabled && !signInError && (
            <p className={styles.error}>{t("signIn.error_not_configured")}</p>
          )}

          {/* Not the same as signed out, and rendering it as such invites
              someone to sign in against a store that cannot answer. */}
          {status === "unavailable" && (
            <p className={styles.error}>{t("account.unavailable")}</p>
          )}

          <p className={styles.switchText}>{t("account.storageNote")}</p>

          {/* Sits under the storage note on purpose: that paragraph explains
              where data lives, and this is the control over the one part of it
              that can leave the browser. */}
          <ChartSyncSettings />
        </section>
      </div>
    </PageTransition>
  );
}
