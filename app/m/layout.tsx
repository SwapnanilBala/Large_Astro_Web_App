import type { Metadata, Viewport } from "next";
import styles from "./mobile.module.css";

/*
 * Mobile shell.
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

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.shell}>{children}</div>;
}
