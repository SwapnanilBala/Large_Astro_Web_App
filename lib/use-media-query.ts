"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A media query's current answer, kept current as it changes.
 *
 * `serverValue` is what the server renders and what hydration assumes; the
 * browser's answer arrives on the next render. Read through
 * useSyncExternalStore rather than matched in an effect, so there is no
 * commit in which the component has subscribed but still shows the default.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** `prefers-reduced-motion: reduce`; motion is assumed until the browser says otherwise. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
