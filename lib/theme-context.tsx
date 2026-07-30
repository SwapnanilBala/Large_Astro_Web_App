"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

type Theme = "dark" | "light";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", theme === "light" ? "#E6DFCC" : "#0F1117"));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  /* Hydrate from localStorage on mount — auto-detect system preference if no stored value */
  useEffect(() => {
    const stored = localStorage.getItem("astro_theme") as Theme | null;
    const preloaded = document.documentElement.getAttribute("data-theme") as Theme | null;
    let resolved: Theme;
    if (stored === "light" || stored === "dark") {
      resolved = stored;
    } else if (preloaded === "light" || preloaded === "dark") {
      resolved = preloaded;
    } else {
      // Auto-detect system color scheme on first visit
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      resolved = prefersDark ? "dark" : "light";
    }
    applyTheme(resolved);
    const themeFrame = window.requestAnimationFrame(() => setTheme(resolved));
    return () => window.cancelAnimationFrame(themeFrame);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("astro_theme", next);
      applyTheme(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
