import type { Metadata } from "next";
import { readChartParams } from "@/lib/chart-params-url";

type ChartPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The tab title for a chart page: "<name> -- <section>", which the root
 * layout's title template finishes as "... · Lagna Atelier".
 *
 * The same shape house support, life areas and life shifts already wrote by
 * hand; before this, the results page, timing, the full reading, the atlas,
 * compatibility and the advanced reading were all just "Lagna Atelier", so a
 * reader with three of them open could not tell the tabs apart, and neither
 * could their history or bookmarks.
 */
export function chartPageMetadata(section: string) {
  return async function generateMetadata({ searchParams }: ChartPageProps): Promise<Metadata> {
    const name = readChartParams(await searchParams).name.trim();
    return { title: name ? `${name} — ${section}` : section };
  };
}
