import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  chartParamsToQuery,
  getChartPayload,
  hasAllChartParams,
  readChartParams,
} from "@/lib/chart-params";
import type { ChartApiResponse } from "@/lib/astro-types";
import {
  buildDivisionalChartDetail,
  distanceToDivisionalBoundary,
  getKeyDivisionalChartFocus,
} from "@/lib/divisional-chart-detail";
import { IMPORTANT_DIVISIONAL_CHARTS } from "@/lib/divisional-chart-guide";
import divisionalMessages from "@/messages/en.divisional.json";
import DivisionDetailView, { DivisionDetailNotice } from "./division-detail-view";

export const maxDuration = 60;

/* The English catalog, read as data rather than through the i18n hook, which
   needs a client component. Only generateMetadata below wants this; everything
   this page renders resolves its own copy. Reading the catalog rather than
   keeping a second English copy in the lib module means the tab title and the
   page heading cannot drift into naming the same varga differently. */
const ENGLISH_GUIDE = divisionalMessages.divisional.guide as Record<
  string,
  { name: string; focus: string }
>;

type DivisionalChartDetailPageProps = {
  params: Promise<{ division: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parseKeyDivision(rawDivision: string): number | null {
  if (!/^\d+$/.test(rawDivision)) return null;
  const division = Number(rawDivision);
  return IMPORTANT_DIVISIONAL_CHARTS.some((item) => item.division === division)
    ? division
    : null;
}

function requireKeyDivision(rawDivision: string): number {
  const division = parseKeyDivision(rawDivision);
  if (division === null) notFound();
  return division;
}

function withQuery(path: string, query: string): string {
  return query ? `${path}?${query}` : path;
}

function insightHref(query: string): string {
  return query ? `/insights?${query}#divisional-charts` : "/insights#divisional-charts";
}

function validTimingLord(value?: string): string | null {
  const name = value?.trim();
  return name && name !== "Unknown" ? name : null;
}

/*
 * Formatted here rather than in the view because Intl resolves against the
 * runtime's time zone: doing it in a client component would format once on the
 * server and again on hydration, and a date near a month boundary could
 * disagree between the two. An empty string means nothing could be formatted,
 * which the view renders as translated copy.
 */
function formatDateRange(start?: string, end?: string): string {
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    year: "numeric",
  };
  const format = (value?: string) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat("en", options).format(date);
  };
  const formattedStart = format(start);
  const formattedEnd = format(end);
  return [formattedStart, formattedEnd].filter(Boolean).join(" – ");
}

export async function generateMetadata({
  params,
}: DivisionalChartDetailPageProps): Promise<Metadata> {
  const { division: rawDivision } = await params;
  const division = requireKeyDivision(rawDivision);
  const focus = getKeyDivisionalChartFocus(division);
  if (!focus) notFound();
  const guide = ENGLISH_GUIDE[`d${division}`];

  /* Not translated: generateMetadata runs on the server, where the client
     i18n hook cannot be called, and the language lives in localStorage rather
     than in the URL, so there is nothing here to select a catalog with. */
  return {
    title: `${focus.label} ${guide.name} Divisional Chart`,
    description: `${focus.label} ${guide.name} detail for ${guide.focus.toLowerCase()}, with whole-sign placements, reliability, and calculation context.`,
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
  };
}

export default async function DivisionalChartDetailPage({
  params,
  searchParams,
}: DivisionalChartDetailPageProps) {
  const { division: rawDivision } = await params;
  const division = requireKeyDivision(rawDivision);
  const focus = getKeyDivisionalChartFocus(division);
  if (!focus) notFound();

  const chartParams = readChartParams(await searchParams);
  const historyQuery = chartParamsToQuery(chartParams);
  const atlasHref = withQuery("/insights/divisional-charts", historyQuery);

  if (!hasAllChartParams(chartParams)) {
    return (
      <DivisionDetailNotice
        variant="missing-input"
        label={focus.label}
        division={division}
        atlasHref={atlasHref}
      />
    );
  }

  let payload: ChartApiResponse | null = null;
  let calculationError = "";
  try {
    payload = getChartPayload(chartParams);
  } catch (cause) {
    calculationError = cause instanceof Error ? cause.message : "Chart calculation failed";
  }

  const chart = payload?.chart.divisional_charts?.[division];
  const detail = chart ? buildDivisionalChartDetail(chart) : null;
  if (!payload || !chart || !detail) {
    return (
      <DivisionDetailNotice
        variant="unavailable"
        label={focus.label}
        division={division}
        error={calculationError}
        atlasHref={atlasHref}
        readingHref={insightHref(historyQuery)}
      />
    );
  }

  const sourcePositions = new Map<string, { sign: string; degree: number }>([
    [
      "Ascendant",
      {
        sign: payload.chart.ascendant.sign,
        degree: payload.chart.ascendant.degree_in_sign,
      },
    ],
    ...payload.chart.planets.map(
      (planet) => [
        planet.name,
        { sign: planet.sign, degree: planet.degree_in_sign },
      ] as [string, { sign: string; degree: number }],
    ),
  ]);

  const positionRows = detail.positions.map((position) => {
    const source = sourcePositions.get(position.name);
    return {
      position,
      boundary: source
        ? distanceToDivisionalBoundary(division, source.sign, source.degree)
        : null,
    };
  });

  const strengthRatios = Object.fromEntries(
    (payload.chart.shadbala ?? []).map((strength) => [
      strength.planet,
      strength.strengthRatio,
    ]),
  );

  const currentMahadasha = validTimingLord(payload.chart.dasha?.current_dasha);
  const currentAntardasha = validTimingLord(payload.chart.dasha?.current_antardasha);

  const timingPlacements = [
    currentMahadasha
      ? {
          kind: "mahadasha" as const,
          planet: currentMahadasha,
          range: formatDateRange(
            payload.chart.dasha?.current_dasha_start,
            payload.chart.dasha?.current_dasha_end,
          ),
        }
      : null,
    currentAntardasha
      ? {
          kind: "antardasha" as const,
          planet: currentAntardasha,
          range: formatDateRange(
            payload.chart.dasha?.current_antardasha_start,
            payload.chart.dasha?.current_antardasha_end,
          ),
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <DivisionDetailView
      detail={detail}
      positionRows={positionRows}
      strengthRatios={strengthRatios}
      currentMahadasha={currentMahadasha}
      currentAntardasha={currentAntardasha}
      timingPlacements={timingPlacements}
      engine={{
        engineLabel: payload.engine.engine_label,
        ephemerisProvider: payload.engine.ephemeris_provider,
        ayanamsha: payload.engine.ayanamsha,
        houseSystem: payload.engine.house_system,
      }}
      availableDivisions={Object.keys(payload.chart.divisional_charts ?? {}).map(
        Number,
      )}
      historyQuery={historyQuery}
      atlasHref={atlasHref}
      readingHref={insightHref(historyQuery)}
      birthTimeAccuracy={chartParams.birthTimeAccuracy || "unknown"}
      birthTimeFallback={chartParams.birthTimeFallback === "true"}
    />
  );
}
