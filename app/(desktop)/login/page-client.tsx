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
import { dailySkyLine, type DailySky } from "@/lib/daily-sky-line";
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
  sky?: DailySky;
  /** False when the server has no Google credentials configured. */
  googleEnabled?: boolean;
  /** Error code the OAuth callback bounced back with, if any. */
  signInError?: string;
};

export default function LoginPageClient({
  returnTo,
  sky,
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
  const checking = status === "loading";

  /*
   * While the session is checked, the panel is laid out in both of its shapes
   * and the CSS shows one: the signed-out shape by default, the signed-in one
   * where this device was signed in last time (app/(desktop)/layout.tsx sets
   * data-account-label before first paint, as it does for the navbar's pill).
   * The panel is centred, so a shape that changes height when the answer
   * comes moves all of it, and the two differ twice over: the signed-in
   * sentence is a line shorter, and its block -- identity and Continue -- is
   * taller than the Google button. Holding the signed-out shape for someone
   * signed in cost 0.08 of layout shift; a note under the button used to make
   * up most of the difference, by coincidence.
   */
  const shaped = (signedOutText: string, signedInText: string) =>
    checking ? (
      <>
        <span className={styles.pendingGuest}>{signedOutText}</span>
        <span className={styles.pendingAccount}>{signedInText}</span>
      </>
    ) : signedIn ? (
      signedInText
    ) : (
      signedOutText
    );

  return (
    <PageTransition>
      <div className="home-shell" style={{ position: "relative" }}>
        <AuthAmbient />
        <ZodiacFloater />
        <BackButton href="/" />
        <section className={`${styles.panel} ${settling ? styles.panelSettling : ""}`}>
          {settling && <span className={styles.shimmerSweep} aria-hidden="true" />}
          <div className={styles.header}>
            {sky && <p className={styles.skyLine}>✦ {dailySkyLine(sky, t)} ✦</p>}
            <p className="kicker">{t("account.kicker")}</p>
            <h1 className={styles.heading}>
              {shaped(t("account.heading"), t("account.headingSignedIn"))}
            </h1>
            {/* The page's one sentence. A note under the Google button and a
                storage note under the panel used to repeat it: three ways of
                saying "everything else stays in this browser" on one screen. */}
            <p className={styles.lead}>
              {shaped(t("account.lead"), t("account.leadSignedIn"))}
            </p>
          </div>

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

          {/* While the session is checked, the block the answer is expected
              to bring is laid out but not shown, and "Checking…" sits over the
              room it takes. This panel is centred on the page, so a block
              arriving late moved everything above it: the one-line "Checking…"
              used to give way to the button and its note, and the heading
              jumped 80px. The panel now has its final height from the first
              paint, signed out or (on a device signed in last time) in. */}
          {(checking || status === "signed-out") && (
            <div className={checking ? styles.signInPending : undefined}>
              <div className={checking ? styles.pendingGuest : undefined}>
                <GoogleSignIn
                  enabled={googleEnabled}
                  errorCode={signInError || undefined}
                  returnTo={returnTo}
                />

                {/* Google is the only way in, so a deployment without
                    credentials has no sign-in at all. GoogleSignIn renders
                    nothing in that state — saying so beats an unexplained gap
                    where the button belongs. */}
                {!googleEnabled && !signInError && (
                  <p className={styles.error}>{t("signIn.error_not_configured")}</p>
                )}
              </div>

              {/* The signed-in block's shape (see `shaped` above), built from
                  its own classes so the two cannot drift apart. */}
              {checking && (
                <div className={styles.pendingAccount} aria-hidden="true">
                  <p className={styles.accountIdentity}>
                    <span className={styles.accountAvatar} />
                    <span className={styles.accountName} />
                    <span className={styles.accountEmail}>&nbsp;</span>
                  </p>
                  <button type="button" className={styles.submitBtn} disabled>
                    {t("account.continue")}
                  </button>
                </div>
              )}

              {checking && (
                <p className={`${styles.switchText} ${styles.checking}`}>{t("account.checking")}</p>
              )}
            </div>
          )}

          {/* Not the same as signed out, and rendering it as such invites
              someone to sign in against a store that cannot answer. */}
          {status === "unavailable" && (
            <p className={styles.error}>{t("account.unavailable")}</p>
          )}

          {/* Last on purpose: the lead says what leaves this browser and what
              stays, and this is the control over the one part that can leave. */}
          <ChartSyncSettings />
        </section>
      </div>
    </PageTransition>
  );
}
