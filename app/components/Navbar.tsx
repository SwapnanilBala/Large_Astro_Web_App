"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useTranslation, LANGUAGE_CODES, LANGUAGE_NAMES, type Language } from "@/lib/i18n-context";
import { listSavedCharts } from "@/lib/workspace-store";
import type { ChartHistoryEntry } from "@/app/insights/components/chart-history-saver";

export default function Navbar() {
  const { user, isAuthenticated, isLoading, isPremium, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useTranslation();
  const pathname = usePathname();
  const [lastChartUrl, setLastChartUrl] = useState<string | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
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

    let isCancelled = false;

    const loadSavedCharts = async () => {
      try {
        if (!user) return;
        const data = await listSavedCharts(user.user_id);
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
  }, [isAuthenticated, user]);

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

  /* Close drawer on route change */
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  if (isLoading) return null;

  const handleLangSelect = (lang: Language) => {
    setLanguage(lang);
    setLangOpen(false);
  };

  return (
    <>
      <nav className="site-navbar">
        {/* -- Left side: theme toggle + brand -- */}
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

        {/* -- Right side: lang selector + auth (desktop) + hamburger (mobile) -- */}
        <div className="navbar-right">
          {/* Language Selector - always visible */}
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

          {/* Desktop auth section - hidden on mobile */}
          <div className="navbar-desktop-auth">
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
                  Access
                </Link>
                <span className="navbar-tier navbar-tier--core">guest</span>
                <Link href="/login" className="navbar-signin-link">
                  {t("navbar.signInPrompt")} <span>{t("navbar.signIn")}</span>
                </Link>
              </>
            )}
          </div>

          {/* Hamburger button - mobile only */}
          <button
            className="navbar-hamburger"
            onClick={() => setDrawerOpen(true)}
            type="button"
            aria-label="Open navigation menu"
          >
            <span className="hamburger-bar" />
            <span className="hamburger-bar" />
            <span className="hamburger-bar" />
          </button>
        </div>
      </nav>

      {/* Mobile drawer overlay */}
      <div
        className={`drawer-backdrop${drawerOpen ? " drawer-backdrop--open" : ""}`}
        onClick={closeDrawer}
        aria-hidden="true"
      />

      {/* Mobile drawer */}
      <aside
        className={`mobile-drawer${drawerOpen ? " mobile-drawer--open" : ""}`}
        aria-label="Mobile navigation"
      >
        <div className="drawer-header">
          <span className="drawer-title">Menu</span>
          <button
            className="drawer-close-btn"
            onClick={closeDrawer}
            type="button"
            aria-label="Close navigation menu"
          >
            {"\u2715"}
          </button>
        </div>

        <nav className="drawer-nav">
          <Link href="/pricing" className="drawer-link" onClick={closeDrawer}>
            Pricing
          </Link>
          <Link href="/workspace" className="drawer-link" onClick={closeDrawer}>
            Workspace
          </Link>
          {lastChartUrl && (
            <Link href={lastChartUrl} className="drawer-link" onClick={closeDrawer}>
              {t("navbar.myChart")}
            </Link>
          )}
        </nav>

        <div className="drawer-divider" />

        {isAuthenticated && user ? (
          <div className="drawer-auth">
            <div className="drawer-user-info">
              <strong className="drawer-username">{user.display_name}</strong>
              <span className={`navbar-tier ${isPremium ? "navbar-tier--premium" : "navbar-tier--core"}`}>
                {user.subscription_tier}
              </span>
            </div>
            <button
              className="drawer-signout-btn"
              onClick={() => {
                logout();
                closeDrawer();
              }}
              type="button"
            >
              {t("navbar.signOut")}
            </button>
          </div>
        ) : (
          <div className="drawer-auth">
            <Link href="/login" className="drawer-link" onClick={closeDrawer}>
              {t("navbar.signIn")}
            </Link>
            <Link href="/register" className="drawer-link" onClick={closeDrawer}>
              Register
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
