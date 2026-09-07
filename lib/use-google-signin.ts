"use client";

/**
 * Starting the Google handshake, for whichever tree is asking.
 *
 * The desktop and handset sign-in buttons look nothing alike and share no CSS,
 * but the call underneath is identical — and it is the part with the security
 * properties, so having two copies of it is how they drift. The button stays
 * per-tree; this does not.
 *
 * Reaches the API rather than linking straight to Google: the server has to
 * mint the state, PKCE verifier and nonce and set them as httpOnly cookies
 * first. A plain `<a href>` to accounts.google.com would skip all three and
 * there would be nothing to validate on the way back.
 */

import { useCallback, useState } from "react";

/** Matches the `signIn.error_*` message keys. */
export type SignInFailure = "not_configured" | "signin_failed";

export function useGoogleSignIn(returnTo?: string) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<SignInFailure | null>(null);

  const start = useCallback(async () => {
    setBusy(true);
    setFailure(null);

    try {
      const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
      const response = await fetch(`/api/auth/google/start${query}`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        setFailure("not_configured");
        setBusy(false);
        return;
      }

      const { authorizeUrl } = (await response.json()) as { authorizeUrl?: string };
      if (!authorizeUrl) {
        setFailure("signin_failed");
        setBusy(false);
        return;
      }

      /* replace, not assign: leaving this page in history means Back lands on a
         stale handshake whose cookies have already been spent. */
      window.location.replace(authorizeUrl);
    } catch {
      setFailure("signin_failed");
      setBusy(false);
    }
  }, [returnTo]);

  return { busy, failure, start };
}
