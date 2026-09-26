"use client";

import { useSyncExternalStore } from "react";

const subscribeToNothing = () => () => {};

/**
 * False on the server and in the render that hydrates; true from the next
 * render on.
 *
 * The hydration-safe way to render something only the browser can know. The
 * pattern it replaces -- `useEffect(() => setMounted(true), [])` -- lands one
 * commit later, and sets state synchronously in an effect body to do it,
 * which react-hooks/set-state-in-effect reports.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}
