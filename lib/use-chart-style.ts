"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { DEFAULT_CHART_STYLE, isChartStyle, type ChartStyle } from "@/lib/chart-style";
import { useAccount } from "@/lib/use-account";

export type { ChartStyle } from "@/lib/chart-style";

/**
 * Which drawing the results page shows for the birth chart.
 *
 * Remembered in two places. The browser keeps its own copy, read the way the
 * language choice is (lib/i18n-context.tsx): the default on the server and in
 * the render that hydrates, the stored style from the next render on, so the
 * first client render still matches the server's HTML. A signed-in person's
 * choice is also kept on their account (/api/account/preferences), so a
 * second device picks it up.
 *
 * Which one wins, highest first:
 *   1. a choice made on this page;
 *   2. the account's, once it has answered -- and it is copied to this
 *      device, so the next visit starts right;
 *   3. this device's;
 *   4. the constellation.
 * A signed-in account that has never chosen adopts this device's choice, so
 * nobody who picked a style before accounts remembered it has to pick again.
 *
 * Any failure on the account side -- signed out, the store unreachable, the
 * table not yet migrated -- leaves the device's choice in charge, which is
 * exactly how this worked before the account copy existed.
 */
export const CHART_STYLE_STORAGE_KEY = "astro_chart_style";

/* Only this hook writes the key and it keeps its own choice in state, so there
   is nothing to subscribe to; the snapshot just has to be read after hydration. */
const subscribeToNothing = () => () => {};

function readStoredChartStyle(): ChartStyle | null {
  /* Guarded: this runs during render, where a storage error would take the
     whole results page down instead of one preference. */
  try {
    const stored = window.localStorage.getItem(CHART_STYLE_STORAGE_KEY);
    return isChartStyle(stored) ? stored : null;
  } catch {
    return null;
  }
}

function writeStoredChartStyle(style: ChartStyle) {
  try {
    window.localStorage.setItem(CHART_STYLE_STORAGE_KEY, style);
  } catch {
    /* Private mode or a full quota: the choice still holds for this visit. */
  }
}

/**
 * What the account holds: a style, `null` for signed in but never chosen, or
 * `undefined` when there is no usable answer (signed out, or the store is
 * down). One request per page load however many charts ask, forgotten once it
 * settles -- the same shape as the session request in lib/use-account.ts.
 */
let inflight: Promise<ChartStyle | null | undefined> | null = null;

function requestAccountChartStyle(): Promise<ChartStyle | null | undefined> {
  inflight ??= fetch("/api/account/preferences", {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  })
    .then(async (response) => {
      if (!response.ok) return undefined;
      const body = (await response.json()) as {
        signedIn?: boolean;
        preferences?: { chartStyle?: unknown } | null;
      };
      if (!body.signedIn) return undefined;
      const style = body.preferences?.chartStyle;
      return isChartStyle(style) ? style : null;
    })
    .catch(() => undefined)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function saveAccountChartStyle(style: ChartStyle) {
  /* Fire and forget: the device copy is already written, and a failed account
     write only means another device will not follow this one. */
  void fetch("/api/account/preferences", {
    method: "PUT",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ chartStyle: style }),
  }).catch(() => {});
}

export function useChartStyle(): [ChartStyle, (next: ChartStyle) => void] {
  const stored = useSyncExternalStore(subscribeToNothing, readStoredChartStyle, () => null);
  const { status } = useAccount();
  const [chosen, setChosen] = useState<ChartStyle | null>(null);
  const [fromAccount, setFromAccount] = useState<ChartStyle | null>(null);

  useEffect(() => {
    if (status !== "signed-in") return;
    let cancelled = false;

    void requestAccountChartStyle().then((accountStyle) => {
      if (cancelled) return;
      if (accountStyle) {
        setFromAccount(accountStyle);
        writeStoredChartStyle(accountStyle);
      } else if (accountStyle === null) {
        /* Signed in, never chosen anywhere: keep this device's choice, if it
           made one, on the account. */
        const deviceStyle = readStoredChartStyle();
        if (deviceStyle) saveAccountChartStyle(deviceStyle);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [status]);

  const setStyle = useCallback(
    (next: ChartStyle) => {
      setChosen(next);
      writeStoredChartStyle(next);
      if (status === "signed-in") saveAccountChartStyle(next);
    },
    [status],
  );

  return [chosen ?? fromAccount ?? stored ?? DEFAULT_CHART_STYLE, setStyle];
}
