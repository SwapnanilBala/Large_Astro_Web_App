"use client";

import { useSyncExternalStore } from "react";

const THEME_STORAGE_KEY = "lagna-theme";
type Theme = "dark" | "light";

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.body.style.background = theme === "light" ? "#fff8f5" : "#07111b";
}

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

function getServerSnapshot(): Theme {
  return "dark";
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, getServerSnapshot);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The visual preference should still work when storage is unavailable.
    }
  };

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="theme-toggle-btn"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to the Ethereal Dawn light theme" : "Switch to the Celestial Luxe dark theme"}
      aria-pressed={!isDark}
      title={isDark ? "Use Ethereal Dawn" : "Use Celestial Luxe"}
    >
      <span aria-hidden="true">{isDark ? "☼" : "☾"}</span>
    </button>
  );
}
