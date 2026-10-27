import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import MobileLanguageProvider from "@/lib/i18n-mobile";
import "./mobile-shell.css";
import styles from "./mobile.module.css";

/*
 * Mobile shell.
 *
 * Sibling of app/(desktop)/layout.tsx, not a child of it. The root layout is
 * bare, so this tree loads mobile-shell.css and nothing else — no globals.css,
 * no navigation, no animated background, no ToastProvider. It declares its
 * own webfonts below.
 *
 * Separate routes mean /m and / can serve the same content at two URLs, so
 * every mobile page declares a canonical pointing at its desktop twin. Without
 * that, search engines treat the pair as duplicates and pick a winner
 * themselves — usually not the one you want.
 *
 * Per-page canonicals are set in each page's generateMetadata, since only the
 * page knows its own path and query.
 */

export const metadata: Metadata = {
  robots: {
    /* The desktop URL is the indexable one; /m exists to serve handsets. */
    index: false,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  /* Deliberately not locking maximumScale — pinch-zoom is an accessibility
   * affordance and disabling it fails WCAG 1.4.4. */
  viewportFit: "cover",
  /* Android Chrome then shrinks the page to the space above the on-screen
     keyboard, so the fixed Continue bar sits on the keyboard instead of
     under it. Safari ignores this; use-keyboard-layout.ts lifts the bar
     there. */
  interactiveWidget: "resizes-content",
  /* The almanac's ink, so the browser chrome around the page matches it. */
  themeColor: "#15130f",
};

/*
 * The desktop's three faces, in the same roles, since 2026-10-26 (the owner
 * asked for the mobile site to match the desktop's change for clarity):
 * - Marcellus for headings, where Newsreader was. Sentence case, as before.
 * - Source Serif 4 for the few serif sentences: the pull quotes, the summary,
 *   the method line and the italic subtitle.
 * - Inter for everything the system sans used to set. Numbers stay on the
 *   system monospace (--font-mono).
 *
 * Marcellus and Inter are on every page, so they are preloaded (63KB). Source
 * Serif is not: only the results pages draw with it, and a face that is not
 * preloaded is fetched only once text on the page needs it, so the intake page
 * and the login never download it, and the italic comes only with a subtitle.
 *
 * Declared at 400 to 700 like the desktop's, for the same reason: a rule
 * asking for 600 gets the real face rather than a synthesized bold. The files
 * are in app/fonts, so the build never fetches them; see the README there.
 * next/font accepts only literals here, hence every entry written out.
 *
 * display:swap so none of them can block first paint.
 */
const marcellus = localFont({
  src: [
    { path: "../fonts/marcellus-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/marcellus-latin-400-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/marcellus-latin-400-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/marcellus-latin-400-normal.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-display-m",
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
  preload: false,
  variable: "--font-prose-m",
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
  variable: "--font-ui-m",
  adjustFontFallback: "Arial",
});

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  /* The desktop tree's <main> landmark lives in its own layout, so the mobile
     tree has to declare one of its own or screen readers get a document with
     no main region. */
  return (
    <MobileLanguageProvider>
      <main id="main-content" className={`${marcellus.variable} ${sourceSerif.variable} ${inter.variable} ${styles.shell}`}>
        {children}
      </main>
    </MobileLanguageProvider>
  );
}
