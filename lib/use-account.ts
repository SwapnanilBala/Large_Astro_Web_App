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

export type Account = {
  email: string;
  displayName: string | null;
};

export type AccountStatus = "loading" | "signed-in" | "signed-out" | "unavailable";

type SessionResponse = { user: Account | null };

type SessionResult = { status: Exclude<AccountStatus, "loading">; account: Account | null };

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
      return { status: user ? "signed-in" : "signed-out", account: user };
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
