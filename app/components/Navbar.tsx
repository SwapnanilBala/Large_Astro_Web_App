"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useTranslation, LANGUAGE_CODES, LANGUAGE_NAMES, type Language } from "@/lib/i18n-context";
import type { ChartHistoryEntry } from "@/app/insights/components/chart-history-saver";

const ASTRO_API =
  process.env.NEXT_PUBLIC_ASTRO_API_BASE_URL ?? "http://127.0.0.1:8000";

type SavedChartApiEntry = {
  query_string: string;
};

export default function Navbar() {
  const { user, token, isAuthenticated, isLoading, isPremium, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useTranslation();
  const [lastChartUrl, setLastChartUrl] = useState<string | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const setLastChartFromLocal = () => {
      try {
        const raw = localStorage.getItem("astro_chart_history");
        if (!raw) return;
        const entries: ChartHistoryEntry[] = JSON.parse(raw);
        if (entries.length > 0) {
          setLastChartUrl(`/insights?${entries[0].queryString}`);
        }
      } catch {
        /* ignore */
      }
    };

    setLastChartFromLocal();

    if (!token) return;

    let isCancelled = false;

    const loadSavedCharts = async () => {
      try {
        const res = await fetch(`${ASTRO_API}/api/v1/saved-charts`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) return;

        const data: SavedChartApiEntry[] = await res.json();
        if (isCancelled || data.length === 0) return;

        setLastChartUrl(`/insights?${data[0].query_string}`);
      } catch {
        /* ignore and keep local fallback */
      }
    };

    void loadSavedCharts();

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, token]);

  /* Close language dropdown on outside click */
  useEffect(() => {
    if (!langOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [langOpen]);

  if (isLoading) return null;

  const handleLangSelect = (lang: Language) => {
    setLanguage(lang);
    setLangOpen(false);
  };

  return (
    <nav className="site-navbar">
      {/* ── Left side: theme toggle + brand ── */}
      <div className="navbar-left">
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          type="button"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? "\u2600" : "\u263D"}
        </button>
        <Link href="/" className="navbar-brand">
          {t("navbar.brand")}
        </Link>
      </div>

      {/* ── Right side: lang selector + auth ── */}
      <div className="navbar-right">
        {/* Language Selector */}
        <div className="lang-selector" ref={langRef}>
          <button
            className="lang-toggle"
            onClick={() => setLangOpen((prev) => !prev)}
            type="button"
            aria-label="Select language"
          >
            {language.toUpperCase()}
          </button>
          {langOpen && (
            <div className="lang-dropdown anim-fade-in">
              {LANGUAGE_CODES.map((code) => (
                <button
                  key={code}
                  className={`lang-option${code === language ? " lang-option--active" : ""}`}
                  onClick={() => handleLangSelect(code)}
                  type="button"
                >
                  <span className="lang-option-code">{code.toUpperCase()}</span>
                  <span className="lang-option-name">{LANGUAGE_NAMES[code]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Auth section */}
        {isAuthenticated && user ? (
          <div className="user-badge">
            <Link href="/pricing" className="navbar-chart-link">
              Pricing
            </Link>
            <Link href="/workspace" className="navbar-chart-link">
              Workspace
            </Link>
            {lastChartUrl && (
              <Link href={lastChartUrl} className="navbar-chart-link">
                {t("navbar.myChart")}
              </Link>
            )}
            <strong>{user.display_name}</strong>
            <span className={`navbar-tier ${isPremium ? "navbar-tier--premium" : "navbar-tier--core"}`}>
              {user.subscription_tier}
            </span>
            <button className="logout-btn" onClick={logout} type="button">
              {t("navbar.signOut")}
            </button>
          </div>
        ) : (
          <>
            <Link href="/pricing" className="navbar-chart-link">
              Pricing
            </Link>
            <Link href="/login" className="navbar-signin-link">
              {t("navbar.signInPrompt")} <span>{t("navbar.signIn")}</span>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
