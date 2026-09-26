"use client";

/**
 * The signed-in account, as far as the browser is allowed to know it.
 *
 * Deliberately separate from `useProfile`. Profiles are device-local, exist
 * without an account and are what charts are filed under; an account is a
 * person who can arrive from a second device. Conflating them would make
 * signing out look like losing your charts, which it is not.
 *
 * A distinct `status` rather than `account === null`, because "not signed in"
 * and "we have not asked yet" must render differently — collapsing them flashes
 * the signed-out navbar on every page load for someone who is signed in.
 */

import { useCallback, useEffect, useState } from "react";
import { ACCOUNT_LABEL_KEY, accountLabel, type StoredAccountLabel } from "@/lib/account-label";

export type Account = {
  email: string;
  displayName: string | null;
};

export type AccountStatus = "loading" | "signed-in" | "signed-out" | "unavailable";

type SessionResponse = { user: Account | null };

type SessionResult = { status: Exclude<AccountStatus, "loading">; account: Account | null };

/*
 * The last signed-in account's label, kept on this device so the next page
 * load can hold the navbar's account pill at its signed-in width before the
 * session answers (read before first paint in app/(desktop)/layout.tsx; the
 * pill in Navbar.tsx). Without it every page load for a signed-in reader
 * opened on the signed-out pill and widened by ~250px when the answer came,
 * pushing the theme and language toggles along the bar.
 *
 * It is only ever the label the navbar already puts on screen, with the time
 * it was confirmed. It is rewritten on every check that says signed in, and
 * removed when one says signed out or the reader signs out. The pre-paint
 * script also ignores it once it is older than a session could be
 * (ACCOUNT_LABEL_MAX_AGE_MS), so a stale guess costs at most one shift, and
 * only when a session is revoked early. It is left alone when the check fails
 * (503), since that answers neither way.
 */
function rememberAccountLabel(result: SessionResult) {
  try {
    if (result.status === "signed-in" && result.account) {
      const stored: StoredAccountLabel = { label: accountLabel(result.account), at: Date.now() };
      window.localStorage.setItem(ACCOUNT_LABEL_KEY, JSON.stringify(stored));
    } else if (result.status === "signed-out") {
      window.localStorage.removeItem(ACCOUNT_LABEL_KEY);
    }
  } catch {
    /* Storage blocked: the pill keeps opening at the signed-out width. */
  }
}

/*
 * One /api/auth/session request per page load, however many components ask.
 *
 * The navbar asks on every page, and the home and sign-in pages ask as well,
 * so those two made the same request twice on every load. Components that
 * mount together now share one in-flight request. It is forgotten as soon as
 * it settles, so anything mounting later -- after a navigation, or a sign-in
 * that has not reloaded -- still asks afresh rather than reading a stale
 * answer. Nothing aborts it: a shared request outlives any one caller, and a
 * caller that leaves just ignores the result.
 */
let inflight: Promise<SessionResult> | null = null;

function requestSession(): Promise<SessionResult> {
  inflight ??= fetch("/api/auth/session", {
    headers: { Accept: "application/json" },
    /* The session cookie is httpOnly and same-origin; this is explicit so a
       future move to a different origin does not silently sign everyone out. */
    credentials: "same-origin",
  })
    .then(async (response): Promise<SessionResult> => {
      /* 503 means the account store is down, which is not the same as being
         signed out. Keep the navbar quiet rather than claiming either. */
      if (!response.ok) return { status: "unavailable", account: null };
      const { user } = (await response.json()) as SessionResponse;
      const result: SessionResult = { status: user ? "signed-in" : "signed-out", account: user };
      rememberAccountLabel(result);
      return result;
    })
    .catch((): SessionResult => ({ status: "unavailable", account: null }))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useAccount() {
  const [account, setAccount] = useState<Account | null>(null);
  const [status, setStatus] = useState<AccountStatus>("loading");

  useEffect(() => {
    /* The component can unmount mid-flight on a route change; without this the
       state setter fires against a dead component. */
    let cancelled = false;

    void requestSession().then((result) => {
      if (cancelled) return;
      setAccount(result.account);
      setStatus(result.status);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
    } catch {
      /* Ignored on purpose. The cookie is httpOnly, so the browser cannot clear
         it here and there is nothing local to undo; a reload re-asks the server,
         which is the honest answer either way. */
    }

    rememberAccountLabel({ status: "signed-out", account: null });
    setAccount(null);
    setStatus("signed-out");

    /* A full reload rather than a client transition: server-rendered pages may
       have been produced for the signed-in visitor, and this is the one moment
       where paying for a reload buys certainty that none of them linger. */
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- the reload is the point; see above
    window.location.assign("/");
  }, []);

  return { account, status, signOut };
}
