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
 */
import "./insights-global.css";

export default function InsightsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
