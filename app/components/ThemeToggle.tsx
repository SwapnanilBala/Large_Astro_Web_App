"use client";

import { useTranslation } from "@/lib/i18n-context";
import { useTheme } from "@/lib/use-theme";
import { MoonIcon, SunIcon } from "@/app/components/locale-icons";

/*
 * Light and dark as a switch with both ends in view: the sun and the moon sit
 * at either end of a track, and a gold knob rests under the one in force. The
 * old control was a 44px circle showing only the theme you were not in, which
 * read as a glyph rather than a control.
 *
 * The knob's place comes from html[data-theme] in globals.css, not from React
 * state, so it is right from the first paint: every page is rendered dark and
 * the bootstrap in app/layout.tsx may flip the attribute before this hydrates.
 * The label is the one thing that waits for hydration, and it says what a
 * press will do.
 */
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const label = theme === "dark" ? t("home.switchToLightMode") : t("home.switchToDarkMode");

  return (
    <button type="button" className="theme-toggle-btn" onClick={toggleTheme} aria-label={label} title={label}>
      <span className="theme-toggle-knob" aria-hidden="true" />
      <SunIcon className="theme-toggle-icon theme-toggle-icon--sun" />
      <MoonIcon className="theme-toggle-icon theme-toggle-icon--moon" />
    </button>
  );
}
