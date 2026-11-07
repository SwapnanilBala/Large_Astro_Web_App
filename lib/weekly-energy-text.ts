/**
 * The weekly-energy panel's words, in the reader's language.
 *
 * computeWeeklyEnergy (lib/engines/weekly-energy-engine.ts) sends finished
 * English -- card titles and advice, the week's headline, the peak label and
 * the chart's text alternative -- and that English stays as it is. It also
 * sends what those strings are made of: each card's intent, quality and best
 * day; the headline's noun family, shape and guidance family; each day's date,
 * score and band. This module says the same things through the catalog, under
 * `shared.weeklyEnergyCopy`, with weekday and month names from Intl in the
 * reader's locale and numbers as they are.
 *
 * When a piece is missing -- a response cached before the headline carried its
 * parts -- the English is what prints.
 *
 * Browser-safe: imported by the panel. lib/__tests__/weekly-energy-text.test.ts
 * holds the English catalog to the engine's copy tables and the rebuilt English
 * to the engine's own strings.
 */
import type { WeeklyEnergyCard, WeeklyEnergyWeek } from "@/lib/astro-types";
import { formatDayShort, formatWeekRangeLabel } from "@/lib/format-week";

type Translate = (key: string, params?: Record<string, string>) => string;

const COPY = "shared.weeklyEnergyCopy";

function lookup(tr: Translate, key: string, params?: Record<string, string>): string | null {
  const text = tr(key, params);
  return text === key ? null : text;
}

/** A forecast card's title and advice. */
export function weeklyCardText(
  card: WeeklyEnergyCard,
  tr: Translate,
  locale: string,
): { title: string; body: string } {
  const title = lookup(tr, `${COPY}.cards.${card.intent}.title`);
  const body = lookup(tr, `${COPY}.cards.${card.intent}.${card.quality}`, {
    day: formatDayShort(card.best_day, locale),
  });
  return { title: title ?? card.title, body: body ?? card.body };
}

/** The week's headline: its title and the two sentences under it. */
export function weeklyHeadlineText(
  headline: WeeklyEnergyWeek["headline"],
  tr: Translate,
): { title: string; paragraph: string } {
  const { noun_kind: kind, shape, guidance_key: guidance } = headline;
  if (!kind || !shape || !guidance) return { title: headline.title, paragraph: headline.paragraph };
  const title = lookup(tr, `${COPY}.titles.${kind}.${shape}`);
  const opener = lookup(tr, `${COPY}.openers.${kind}.${shape}`);
  const advice = lookup(tr, `${COPY}.guidance.${guidance}.${shape}`);
  return {
    title: title ?? headline.title,
    paragraph: opener !== null && advice !== null ? `${opener} ${advice}` : headline.paragraph,
  };
}

/** The chart's callout under the peak day: "Peak Clarity", or the engine's label. */
export function weeklyPeakLabel(week: Pick<WeeklyEnergyWeek, "peak" | "headline">, tr: Translate): string {
  const kind = week.headline.noun_kind;
  if (!week.peak.is_significant) return lookup(tr, "shared.weeklyEnergySteadyWeek") ?? week.peak.label;
  return (kind && lookup(tr, `${COPY}.peak.${kind}`)) || week.peak.label;
}

/** The chart's text alternative: every day's score and band, then the average. */
export function weeklyChartAltText(
  week: Pick<WeeklyEnergyWeek, "week" | "days" | "average_score" | "chart_alt_text">,
  tr: Translate,
  locale: string,
): string {
  const days = week.days.map((day) => {
    const band = lookup(tr, `${COPY}.altBands.${day.band}`);
    return band === null
      ? null
      : lookup(tr, `${COPY}.altDay`, {
          day: formatDayShort(day.date, locale),
          score: String(day.score),
          band,
        });
  });
  if (days.some((day) => day === null)) return week.chart_alt_text;
  return (
    lookup(tr, `${COPY}.alt`, {
      week: formatWeekRangeLabel(week.week.start_date, locale),
      days: days.join(", "),
      average: String(week.average_score),
    }) ?? week.chart_alt_text
  );
}
