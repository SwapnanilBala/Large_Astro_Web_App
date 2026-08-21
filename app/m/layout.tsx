import type { Metadata, Viewport } from "next";
import { Cinzel } from "next/font/google";
import MobileLanguageProvider from "@/lib/i18n-mobile";
import "./mobile-shell.css";
import styles from "./mobile.module.css";

/*
 * Mobile shell.
 *
 * Sibling of app/(desktop)/layout.tsx, not a child of it. The root layout is
 * bare, so this tree loads mobile-shell.css and nothing else — no globals.css,
 * no webfonts, no navigation, no animated background, no ToastProvider.
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
  themeColor: "#0F1117",
};

/*
 * One weight, one subset, headings only — 14.8KB against a font budget that
 * was sitting at zero.
 *
 * The whole /m tree ran on system-ui, which is why it read like a settings
 * panel rather than this product: Cinzel's serif capitals are the identity on
 * desktop, and dropping them was over-correction, not a cost the budget
 * required. Body copy and data stay on the system stack — this face is for
 * titles and section labels, where its character does the work and its
 * legibility at small sizes never has to.
 *
 * display:swap so it can never block first paint.
 */
const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["600"],
  display: "swap",
  variable: "--font-display-m",
});

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  /* The desktop tree's <main> landmark lives in its own layout, so the mobile
     tree has to declare one of its own or screen readers get a document with
     no main region. */
  return (
    <MobileLanguageProvider>
      <main id="main-content" className={`${cinzel.variable} ${styles.shell}`}>
        {children}
      </main>
    </MobileLanguageProvider>
  );
}
