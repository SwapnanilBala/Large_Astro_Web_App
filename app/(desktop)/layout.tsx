import localFont from "next/font/local";
import "../globals.css";

import GradientBlobs from "@/app/components/GradientBlobs";
import Navbar from "@/app/components/Navbar";
import BottomNav from "@/app/components/BottomNav";
import FreeUsagePrompt from "@/app/components/FreeUsagePrompt";
import ViewportScaler from "@/app/components/ViewportScaler";
import SkipToContent from "@/app/components/SkipToContent";
import { ToastProvider } from "@/lib/toast-context";
import DesktopLanguageProvider from "@/lib/i18n-desktop";
import { DesktopOnboardingProvider } from "@/app/components/onboarding/DesktopOnboarding";
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
 * Moved down from the root layout: globals.css (22KB gzipped), the three
 * webfonts (about 215KB of woff2), the navigation, the animated background,
 * the viewport scaler and ToastProvider. Nothing under /m referenced any of
 * it.
 *
 * The font variables land on a wrapper <div> rather than <html>, because only
 * the root layout may render <html>. Custom properties inherit, so every
 * var(--font-display) below this point resolves from here. The UI face is set
 * on the same <div> (.desktop-shell in globals.css), since --font-ui exists
 * only from this element down.
 */

/*
 * The three faces come from app/fonts rather than from Google at build time;
 * see the README there. Turbopack's Google loader broke on Google's own font
 * URLs and failed every route with it, and a build that needs the network to
 * finish can fail for reasons that have nothing to do with the code.
 *
 * Chosen by the owner on 2026-10-26 for clarity, replacing Cinzel (all small
 * caps) and Newsreader, with the UI moving off the platform font:
 * - Marcellus for titles: the same carved, classical feel as Cinzel, but with
 *   a real lowercase, so a long heading reads as words.
 * - Source Serif 4 for prose, a text face built for long reading at screen
 *   sizes.
 * - Inter for labels, buttons and numbers, where Segoe UI or San Francisco
 *   used to stand in.
 *
 * Marcellus has one weight. It is declared at 400 to 700 so that a heading
 * asking for 600 gets the real face, since globals.css turns off synthesized
 * bold. The two variable faces are declared the same way, at the weights
 * Google declared, rather than as a range: rules asking for 650 or 750 then
 * resolve to the 700 face instead of a weight nothing here was designed with.
 * They are written out in full because next/font reads these arguments at
 * build time and accepts only literals.
 */
const marcellus = localFont({
  src: [
    { path: "../fonts/marcellus-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/marcellus-latin-400-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/marcellus-latin-400-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/marcellus-latin-400-normal.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-display",
  adjustFontFallback: "Times New Roman",
});

const sourceSerif = localFont({
  src: [
    { path: "../fonts/source-serif-4-latin-wght-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/source-serif-4-latin-wght-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/source-serif-4-latin-wght-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/source-serif-4-latin-wght-normal.woff2", weight: "700", style: "normal" },
    { path: "../fonts/source-serif-4-latin-wght-italic.woff2", weight: "400", style: "italic" },
    { path: "../fonts/source-serif-4-latin-wght-italic.woff2", weight: "500", style: "italic" },
    { path: "../fonts/source-serif-4-latin-wght-italic.woff2", weight: "600", style: "italic" },
    { path: "../fonts/source-serif-4-latin-wght-italic.woff2", weight: "700", style: "italic" },
  ],
  display: "swap",
  variable: "--font-prose",
  adjustFontFallback: "Times New Roman",
});

const inter = localFont({
  src: [
    { path: "../fonts/inter-latin-wght-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/inter-latin-wght-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/inter-latin-wght-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/inter-latin-wght-normal.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-ui",
  adjustFontFallback: "Arial",
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
    <div className={`desktop-shell ${marcellus.variable} ${sourceSerif.variable} ${inter.variable}`}>
      <script dangerouslySetInnerHTML={{ __html: NAVBAR_MARKS }} />
      <ViewportScaler />
      <GradientBlobs />
      <DesktopLanguageProvider>
        <SkipToContent />
        <ToastProvider>
          <DesktopOnboardingProvider>
            <Navbar />
            <main id="main-content" tabIndex={-1}>
              {children}
            </main>
            <BottomNav />
            {/* Mounted once for the whole shell rather than per panel: the three
                features that can raise it sit on two different routes, and one
                of them is a lazily-imported child several levels down. */}
            <FreeUsagePrompt />
          </DesktopOnboardingProvider>
        </ToastProvider>
      </DesktopLanguageProvider>
    </div>
  );
}
