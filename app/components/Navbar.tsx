"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "@/lib/use-account";
import { accountLabel } from "@/lib/account-label";
import { useTranslation, LANGUAGE_CODES, LANGUAGE_NAMES, type Language } from "@/lib/i18n-context";
import { useLatestChartQuery } from "@/lib/use-latest-chart-query";
import { useHydrated } from "@/lib/use-hydrated";
import ThemeToggle from "@/app/components/ThemeToggle";
import { ChevronDownIcon, GlobeIcon } from "@/app/components/locale-icons";

export default function Navbar() {
  const { account, status, signOut } = useAccount();
  const { language, setLanguage, t } = useTranslation();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const lastChartQuery = useLatestChartQuery();
  const lastChartUrl = lastChartQuery ? `/insights?${lastChartQuery}` : null;
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

  /* The navbar used to be withheld until the local profiles hydrated. Nothing
     in it waits on storage now — only the account badge does, and that gates
     itself — so it renders on the first paint. */

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
          <ThemeToggle />

          {/* Language Selector - always visible.

              A globe and the language's own name, so someone who does not
              read the current language still recognises their own on the
              button: "हिन्दी" says more to a Hindi reader than "HI" did. The
              name gives way to the code where the bar is narrow. Its
              accessible name is "Language: <name>", the visible words plus
              what the globe stands for. */}
          <div className="lang-selector" ref={langRef}>
            <button
              className="lang-toggle"
              onClick={() => setLangOpen((prev) => !prev)}
              type="button"
              aria-expanded={langOpen}
              aria-controls="navbar-language-menu"
            >
              <GlobeIcon className="lang-toggle-icon" />
              <span className="lang-toggle-prefix">{t("home.languageLabel")}: </span>
              <span className="lang-toggle-name">{LANGUAGE_NAMES[language]}</span>
              <span className="lang-toggle-code">{language.toUpperCase()}</span>
              <ChevronDownIcon className="lang-toggle-chevron" />
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
              {/* The history is only readable after hydration, so until then
                  an invisible copy holds the link's place -- but only where the
                  inline script in app/(desktop)/layout.tsx found a saved chart
                  before first paint; everywhere else CSS removes it. Gone once
                  hydrated either way, so a stale mark cannot leave a gap. */}
              {lastChartUrl ? (
                <Link href={lastChartUrl} className="navbar-chart-link">
                  {t("navbar.myChart")}
                </Link>
              ) : (
                !hydrated && (
                  <span className="navbar-chart-link navbar-chart-link--pending" aria-hidden="true">
                    {t("navbar.myChart")}
                  </span>
                )
              )}
              {/* The link waits for the session. "loading" and "signed out"
                  look identical here, so showing the signed-out state while the
                  answer is still in flight flashes "Sign in" at someone who is
                  already signed in, on every page load.

                  What stands in meanwhile is an invisible copy of the pill,
                  sized for the likely answer. With nothing in its place the
                  badge was an empty 18px ring: the bar grew by 30px when the
                  answer landed, which moved the brand and both toggles down,
                  and the pill's width pushed the toggles left. The copy carries
                  both shapes: the signed-out pill, and the signed-in one (this
                  device's last account label, an "Account" kicker and a Sign
                  out button). CSS shows the second only where the inline script
                  in app/(desktop)/layout.tsx found that label before first
                  paint. Sign out is a real, disabled button so that it takes
                  the global button rules' box, as the live one does. */}
              {status === "loading" ? (
                <>
                  <span className="navbar-profile-link navbar-profile-link--pending" aria-hidden="true">
                    <strong className="navbar-pending-guest">{t("navbar.signIn")}</strong>
                    <strong className="navbar-pending-account navbar-pending-label" />
                    <span className="navbar-profile-switch navbar-pending-account">
                      {t("navbar.account")}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="navbar-signout navbar-signout--pending navbar-pending-account"
                    aria-hidden="true"
                    tabIndex={-1}
                    disabled
                  >
                    {t("navbar.signOut")}
                  </button>
                </>
              ) : (
                <Link href="/login" className="navbar-profile-link">
                  <strong>
                    {account ? accountLabel(account) : t("navbar.signIn")}
                  </strong>
                  {account && (
                    <span className="navbar-profile-switch">{t("navbar.account")}</span>
                  )}
                </Link>
              )}
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
            aria-label={drawerOpen ? t("navbar.closeMenu") : t("navbar.openMenu")}
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
            aria-label={t("navbar.closeMenu")}
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
              {account ? accountLabel(account) : t("navbar.signIn")}
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
            {account ? t("navbar.account") : t("navbar.signIn")}
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
