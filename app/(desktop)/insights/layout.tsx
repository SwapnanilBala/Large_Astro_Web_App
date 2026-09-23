/*
 * Insights layout.
 *
 * Exists to scope insights-global.css to this subtree. Those ~95KB of panel,
 * dasha and palm rules used to live in globals.css, which the root layout
 * imports on every route — so the intake page, pricing, login and the rest
 * were all paying for styles they could never use.
 *
 * This layout is nested inside the root one, so globals.css still loads
 * first and the cascade order between the two files is preserved.
 *
 * It also mounts the decorative backdrop, for two reasons. Every route in this
 * subtree renders `.insights-shell`, so one mount here is the only way the
 * layer does not blink in and out as you move between the reading and its
 * detail pages. And every page's content is wrapped in <PageTransition>, a
 * framer-motion subtree that animates `opacity` and `scale` and is therefore a
 * stacking context — a backdrop rendered inside one could not be placed under
 * `.dashboard-shell`'s `z-index: 1` from there. Out here it is a plain sibling
 * ahead of it, which is all it needs to be.
 */
import type { Metadata } from "next";
import InsightsBackdrop from "./components/decor/insights-backdrop";
import "./insights-global.css";

/*
 * Kept out of search results, the whole subtree.
 *
 * Every page here is one person's chart, and the URL carries their name,
 * birth date and birthplace -- a link someone posts publicly should not turn
 * into an indexed page about them. The division pages already said this for
 * themselves; saying it here covers the rest, and the /m tree has done the
 * same since it was split out. follow stays on so links out still count.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function InsightsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <InsightsBackdrop />
      {children}
    </>
  );
}
