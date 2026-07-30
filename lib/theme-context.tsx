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

/* A skin is a whole visual identity (palette + type + motion); a theme is
 * light/dark within it. "cosmic" is the original; "leaf" is Tāla-patra. */
type Skin = "cosmic" | "leaf";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
  skin: Skin;
  toggleSkin: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_COLOR: Record<Skin, Record<Theme, string>> = {
  cosmic: { light: "#E6DFCC", dark: "#0F1117" },
  leaf: { light: "#D9C49A", dark: "#1E1710" },
};

function currentSkin(): Skin {
  return document.documentElement.getAttribute("data-skin") === "leaf" ? "leaf" : "cosmic";
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
  const color = THEME_COLOR[currentSkin()][theme];
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", color));
}

function applySkin(skin: Skin, theme: Theme) {
  document.documentElement.setAttribute("data-skin", skin);
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", THEME_COLOR[skin][theme]));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [skin, setSkin] = useState<Skin>("cosmic");

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
    const resolvedSkin: Skin = localStorage.getItem("astro_skin") === "leaf" ? "leaf" : "cosmic";
    applySkin(resolvedSkin, resolved);
    applyTheme(resolved);
    const themeFrame = window.requestAnimationFrame(() => {
      setTheme(resolved);
      setSkin(resolvedSkin);
    });
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

  const toggleSkin = useCallback(() => {
    setSkin((prev) => {
      const next: Skin = prev === "cosmic" ? "leaf" : "cosmic";
      localStorage.setItem("astro_skin", next);
      applySkin(next, document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, skin, toggleSkin }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
