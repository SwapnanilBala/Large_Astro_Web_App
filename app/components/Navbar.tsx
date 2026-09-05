"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProfile } from "@/lib/profile-context";
import { useAccount } from "@/lib/use-account";
import { useTranslation, LANGUAGE_CODES, LANGUAGE_NAMES, type Language } from "@/lib/i18n-context";
import { readChartHistory } from "@/lib/chart-history-store";

export default function Navbar() {
  const { activeProfile, isLoading, profileId } = useProfile();
  const { account, signOut } = useAccount();
  const { language, setLanguage, t } = useTranslation();
  const pathname = usePathname();
  const [lastChartUrl, setLastChartUrl] = useState<string | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);

  const openDrawer = useCallback(() => {
    setLangOpen(false);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    window.requestAnimationFrame(() => {
      hamburgerRef.current?.focus({ preventScroll: true });
    });
  }, []);

  useEffect(() => {
    // A profile switch must not carry the previous profile's chart link over.
    setLastChartUrl(null);

    if (!profileId) return;

    const entries = readChartHistory(profileId);
    const latest = [...entries].sort(
      (left, right) =>
        Date.parse(right.savedAt || "") - Date.parse(left.savedAt || "")
    )[0];
    const queryString = latest?.queryString?.trim().replace(/^\?/, "");

    setLastChartUrl(queryString ? `/insights?${queryString}` : null);
  }, [pathname, profileId]);

  /* Track scroll position for glass effect */
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    onScroll(); // check initial position
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
    const closeFrame = window.requestAnimationFrame(() => setDrawerOpen(false));
    return () => window.cancelAnimationFrame(closeFrame);
  }, [pathname]);

  /* Keep focus inside the open drawer and prevent the page behind it from scrolling. */
  useEffect(() => {
    if (!drawerOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => drawerCloseRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) return;

      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDrawer, drawerOpen]);

  if (isLoading) return null;

  const handleLangSelect = (lang: Language) => {
    setLanguage(lang);
    setLangOpen(false);
  };

  return (
    <>
      <nav className={`site-navbar${scrolled ? " navbar-scrolled" : ""}`}>
        {/* -- Left side: brand -- */}
        <div className="navbar-left">
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
              aria-expanded={langOpen}
              aria-controls="navbar-language-menu"
            >
              {language.toUpperCase()}
            </button>
            {langOpen && (
              <div id="navbar-language-menu" className="lang-dropdown anim-fade-in">
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

          {/* Desktop profile section - hidden on mobile */}
          <div className="navbar-desktop-auth">
            <div className="user-badge">
              {lastChartUrl && (
                <Link href={lastChartUrl} className="navbar-chart-link">
                  {t("navbar.myChart")}
                </Link>
              )}
              {/* Signed in, the account is the identity on show; the profile
                  switcher stays reachable underneath because profiles are
                  still what charts are filed under. */}
              <Link href="/login" className="navbar-profile-link">
                <strong>
                  {account
                    ? account.displayName ?? account.email
                    : activeProfile?.display_name ?? t("navbar.noProfile")}
                </strong>
                <span className="navbar-profile-switch">{t("navbar.switchProfile")}</span>
              </Link>
              {account && (
                <button
                  type="button"
                  className="navbar-signout"
                  onClick={() => void signOut()}
                >
                  {t("navbar.signOut")}
                </button>
              )}
            </div>
          </div>

          {/* Hamburger button - mobile only */}
          <button
            ref={hamburgerRef}
            className="navbar-hamburger"
            onClick={openDrawer}
            type="button"
            aria-label={drawerOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={drawerOpen}
            aria-controls="mobile-navigation-drawer"
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
        id="mobile-navigation-drawer"
        ref={drawerRef}
        className={`mobile-drawer${drawerOpen ? " mobile-drawer--open" : ""}`}
        role="dialog"
        aria-modal={drawerOpen ? "true" : undefined}
        aria-labelledby="mobile-navigation-title"
        aria-hidden={!drawerOpen}
        inert={!drawerOpen}
      >
        <div className="drawer-header">
          <span id="mobile-navigation-title" className="drawer-title">
            {t("navbar.menu")}
          </span>
          <button
            ref={drawerCloseRef}
            className="drawer-close-btn"
            onClick={closeDrawer}
            type="button"
            aria-label="Close navigation menu"
          >
            {"\u2715"}
          </button>
        </div>

        {/* My Chart is the only link left in here, and it does not exist until
            somebody has cast a chart. Rendering the section regardless left a
            first-time visitor an empty block and a divider under a heading
            with nothing beneath it. */}
        {lastChartUrl && (
          <>
            <nav className="drawer-nav">
              <Link href={lastChartUrl} className="drawer-link" onClick={closeDrawer}>
                {t("navbar.myChart")}
              </Link>
            </nav>

            <div className="drawer-divider" />
          </>
        )}

        <div className="drawer-auth">
          <div className="drawer-user-info">
            <strong className="drawer-username">
              {account
                ? account.displayName ?? account.email
                : activeProfile?.display_name ?? t("navbar.noProfile")}
            </strong>
            {/* The email is worth repeating here even when it is also the name
                above: on a handset this drawer is the only place the account is
                visible at all, and "which Google account is this?" is the
                question it exists to answer. */}
            {account && account.displayName && (
              <span className="drawer-account-email">{account.email}</span>
            )}
          </div>
          <Link
            href="/login"
            className="drawer-link"
            onClick={closeDrawer}
            aria-current={pathname === "/login" ? "page" : undefined}
          >
            {t("navbar.switchProfile")}
          </Link>
          {account && (
            <button
              type="button"
              className="drawer-link drawer-signout"
              onClick={() => {
                closeDrawer();
                void signOut();
              }}
            >
              {t("navbar.signOut")}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
