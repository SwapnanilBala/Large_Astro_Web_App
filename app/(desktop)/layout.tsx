import { Cinzel, Newsreader } from "next/font/google";
import "../globals.css";

import GradientBlobs from "@/app/components/GradientBlobs";
import Navbar from "@/app/components/Navbar";
import BottomNav from "@/app/components/BottomNav";
import FreeUsagePrompt from "@/app/components/FreeUsagePrompt";
import ViewportScaler from "@/app/components/ViewportScaler";
import { ToastProvider } from "@/lib/toast-context";
import DesktopLanguageProvider from "@/lib/i18n-desktop";
import { chartHistoryKey } from "@/lib/chart-history-store";
import { ACCOUNT_LABEL_KEY } from "@/lib/account-label";

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

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-display",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-newsreader",
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
 *   device was signed in (lib/use-account.ts writes it). The account pill
 *   waits for /api/auth/session, and for a signed-in reader it used to open at
 *   the signed-out width and widen by ~250px when the answer came, on every
 *   page (.navbar-pending-account). The label reaches CSS as a string through
 *   JSON.stringify, whose quoting is also valid CSS string syntax.
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
    const label = window.localStorage.getItem(${JSON.stringify(ACCOUNT_LABEL_KEY)});
    if (label) {
      root.dataset.accountLabel = "";
      root.style.setProperty("--account-label", JSON.stringify(label));
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
