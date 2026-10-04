"use client";

import { useCallback, useSyncExternalStore } from "react";

/*
 * Light or dark, for both trees.
 *
 * The theme lives on <html data-theme>, set before first paint by the
 * bootstrap in app/layout.tsx from this storage key. This hook reads it back
 * and flips it the same way the bootstrap sets it, so the desktop navbar's
 * switch and the mobile intake's button leave a page in exactly the state a
 * fresh load in that theme would.
 */

export const THEME_STORAGE_KEY = "lagna-theme";

export type Theme = "dark" | "light";

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.body.style.background = theme === "light" ? "#fff8f5" : "#07111b";
}

/* The attribute, and the key from another tab. */
function subscribe(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  window.addEventListener("storage", onStoreChange);

  return () => {
    observer.disconnect();
    window.removeEventListener("storage", onStoreChange);
  };
}

/* Every page is rendered dark; the bootstrap corrects it before paint. */
function getServerSnapshot(): Theme {
  return "dark";
}

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const theme = useSyncExternalStore(subscribe, readTheme, getServerSnapshot);

  const toggleTheme = useCallback(() => {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* The theme still changes for this page when storage is unavailable. */
    }
  }, []);

  return { theme, toggleTheme };
}
