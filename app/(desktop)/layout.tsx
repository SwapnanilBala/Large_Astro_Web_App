import localFont from "next/font/local";
import "../globals.css";

import GradientBlobs from "@/app/components/GradientBlobs";
import Navbar from "@/app/components/Navbar";
import BottomNav from "@/app/components/BottomNav";
import FreeUsagePrompt from "@/app/components/FreeUsagePrompt";
import ViewportScaler from "@/app/components/ViewportScaler";
import { ToastProvider } from "@/lib/toast-context";
import DesktopLanguageProvider from "@/lib/i18n-desktop";
import { chartHistoryKey } from "@/lib/chart-history-store";
import { ACCOUNT_LABEL_KEY, ACCOUNT_LABEL_MAX_AGE_MS } from "@/lib/account-label";

/*
 * Desktop shell.
 *
 * This is a route group, so it adds no path segment — app/(desktop)/page.tsx is
 * still "/" and app/(desktop)/insights is still "/insights". What it buys is a
 * boundary: everything imported here is downloaded only by the routes inside
 * the group, and the /m tree stops paying for it.
 *
 * Moved down from the root layout: globals.css (22KB gzipped), Cinzel and
 * Newsreader (145KB of preloaded woff2), the navigation, the animated
 * background, the viewport scaler and ToastProvider. Nothing under /m
 * referenced any of it.
 *
 * The font variables land on a wrapper <div> rather than <html>, because only
 * the root layout may render <html>. Custom properties inherit, so every
 * var(--font-display) below this point resolves exactly as before.
 */

/*
 * Both faces come from app/fonts rather than from Google at build time; see
 * the README there. Turbopack's Google loader broke on Google's own font URLs
 * and failed every route with it, and a build that needs the network to
 * finish can fail for reasons that have nothing to do with the code.
 *
 * The files are the variable fonts Google served for these exact requests, so
 * the text renders as it did. Each one is declared at 400, 500, 600 and 700,
 * as Google declared it, rather than as a weight range: rules asking for 650
 * or 750 then still resolve to the 700 face instead of rendering a weight
 * nothing here was designed with.
 */
const cinzel = localFont({
  src: [
    { path: "../fonts/cinzel-latin-wght-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/cinzel-latin-wght-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/cinzel-latin-wght-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/cinzel-latin-wght-normal.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-display",
  adjustFontFallback: "Times New Roman",
});

const newsreader = localFont({
  src: [
    { path: "../fonts/newsreader-latin-wght-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/newsreader-latin-wght-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/newsreader-latin-wght-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/newsreader-latin-wght-normal.woff2", weight: "700", style: "normal" },
    { path: "../fonts/newsreader-latin-wght-italic.woff2", weight: "400", style: "italic" },
    { path: "../fonts/newsreader-latin-wght-italic.woff2", weight: "500", style: "italic" },
    { path: "../fonts/newsreader-latin-wght-italic.woff2", weight: "600", style: "italic" },
    { path: "../fonts/newsreader-latin-wght-italic.woff2", weight: "700", style: "italic" },
  ],
  display: "swap",
  variable: "--font-newsreader",
  adjustFontFallback: "Times New Roman",
});

/*
 * Marks <html> with what the navbar will show once it can read this device's
 * storage, so the navbar can hold that width from the first paint.
 *
 * - data-chart-history when a saved chart exists: the "My Chart" link comes
 *   from localStorage, so the server renders without it, and it used to arrive
 *   after hydration and push the theme and language toggles 145px left on every
 *   page load, for anyone who had ever cast a chart
 *   (.navbar-chart-link--pending).
 * - data-account-label and --account-label when the last session on this
 *   device was signed in and is recent enough to still be live
 *   (lib/use-account.ts writes it, lib/account-label.ts says how recent). The
 *   account pill waits for /api/auth/session, and for a signed-in reader it
 *   used to open at the signed-out width and widen by ~250px when the answer
 *   came, on every page (.navbar-pending-account). The intake page's welcome
 *   panel holds its room off the same mark (WelcomePanelStandIn). The label
 *   reaches CSS as a string through JSON.stringify, whose quoting is also
 *   valid CSS string syntax.
 *
 * A plain inline script, run by the parser before the navbar's markup exists,
 * rather than a next/script like the root layout's theme bootstrap: in the App
 * Router beforeInteractive is queued on self.__next_s and run once the runtime's
 * chunks load, which races the first paint (measured locally: a first paint at
 * 32ms, the queued theme switch at 69ms). CSP permits it; 'unsafe-inline' is the
 * concession next.config.ts already documents. What it adds to <html> is
 * covered by the suppressHydrationWarning the root layout already sets there.
 */
const NAVBAR_MARKS = `(() => {
  const root = document.documentElement;
  try {
    const saved = JSON.parse(window.localStorage.getItem(${JSON.stringify(chartHistoryKey())}) || "[]");
    if (Array.isArray(saved) && saved.some((entry) => entry && typeof entry.name === "string" && typeof entry.queryString === "string" && entry.queryString.trim())) {
      root.dataset.chartHistory = "";
    }
  } catch {}
  try {
    const stored = JSON.parse(window.localStorage.getItem(${JSON.stringify(ACCOUNT_LABEL_KEY)}) || "null");
    if (stored && typeof stored.label === "string" && stored.label && typeof stored.at === "number" && Date.now() - stored.at < ${ACCOUNT_LABEL_MAX_AGE_MS}) {
      root.dataset.accountLabel = "";
      root.style.setProperty("--account-label", JSON.stringify(stored.label));
    }
  } catch {}
})();`;

export default function DesktopLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${cinzel.variable} ${newsreader.variable}`}>
      <script dangerouslySetInnerHTML={{ __html: NAVBAR_MARKS }} />
      <a href="#main-content" className="skip-nav">
        Skip to main content
      </a>
      <ViewportScaler />
      <GradientBlobs />
      <DesktopLanguageProvider>
        <ToastProvider>
          <Navbar />
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
          <BottomNav />
          {/* Mounted once for the whole shell rather than per panel: the three
              features that can raise it sit on two different routes, and one
              of them is a lazily-imported child several levels down. */}
          <FreeUsagePrompt />
        </ToastProvider>
      </DesktopLanguageProvider>
    </div>
  );
}
