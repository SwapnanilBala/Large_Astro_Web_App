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

export function useAccount() {
  const [account, setAccount] = useState<Account | null>(null);
  const [status, setStatus] = useState<AccountStatus>("loading");

  useEffect(() => {
    /* The component can unmount mid-flight on a route change; without this the
       state setter fires against a dead component. */
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          headers: { Accept: "application/json" },
          /* The session cookie is httpOnly and same-origin; this is explicit so
             a future move to a different origin does not silently sign
             everyone out. */
          credentials: "same-origin",
        });

        if (cancelled) return;

        if (!response.ok) {
          /* 503 means the account store is down, which is not the same as being
             signed out. Keep the navbar quiet rather than claiming either. */
          setStatus("unavailable");
          return;
        }

        const { user } = (await response.json()) as SessionResponse;
        if (cancelled) return;

        setAccount(user);
        setStatus(user ? "signed-in" : "signed-out");
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    };

    void load();

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
    window.location.assign("/");
  }, []);

  return { account, status, signOut };
}
