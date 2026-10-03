"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

/**
 * Which drawing the results page shows for the birth chart.
 *
 * A device preference like the language choice, and stored the same way
 * (lib/i18n-context.tsx): the constellation on the server and in the render
 * that hydrates, the stored style from the next render on, so the first client
 * render still matches the server's HTML. A choice made on the page wins.
 *
 * Unscoped (not under lib/local-scope.ts) because it is about how this device
 * draws a chart, not about whose charts are stored on it.
 */
export type ChartStyle = "constellation" | "north-indian";

export const CHART_STYLE_STORAGE_KEY = "astro_chart_style";
const DEFAULT_STYLE: ChartStyle = "constellation";

/* Only this hook writes the key and it keeps its own choice in state, so there
   is nothing to subscribe to; the snapshot just has to be read after hydration. */
const subscribeToNothing = () => () => {};

function readStoredChartStyle(): ChartStyle {
  /* Guarded: this runs during render, where a storage error would take the
     whole results page down instead of one preference. */
  try {
    return window.localStorage.getItem(CHART_STYLE_STORAGE_KEY) === "north-indian"
      ? "north-indian"
      : DEFAULT_STYLE;
  } catch {
    return DEFAULT_STYLE;
  }
}

export function useChartStyle(): [ChartStyle, (next: ChartStyle) => void] {
  const stored = useSyncExternalStore(subscribeToNothing, readStoredChartStyle, () => DEFAULT_STYLE);
  const [chosen, setChosen] = useState<ChartStyle | null>(null);

  const setStyle = useCallback((next: ChartStyle) => {
    setChosen(next);
    try {
      window.localStorage.setItem(CHART_STYLE_STORAGE_KEY, next);
    } catch {
      /* Private mode or a full quota: the choice still holds for this visit. */
    }
  }, []);

  return [chosen ?? stored, setStyle];
}
