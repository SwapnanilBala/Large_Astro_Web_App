/**
 * The ways the results page can draw a birth chart.
 *
 * Shared by the browser hook (lib/use-chart-style.ts), the account route and
 * its storage (lib/sync/preferences.ts). It carries no "use client" directive
 * on purpose: server code importing a constant from a client module receives a
 * client reference rather than the value.
 */
export const CHART_STYLES = ["constellation", "north-indian"] as const;

export type ChartStyle = (typeof CHART_STYLES)[number];

export const DEFAULT_CHART_STYLE: ChartStyle = "constellation";

export function isChartStyle(value: unknown): value is ChartStyle {
  return typeof value === "string" && (CHART_STYLES as readonly string[]).includes(value);
}
