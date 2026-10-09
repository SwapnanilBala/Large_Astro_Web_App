import { LOCALE_TAGS, type Language } from "@/lib/i18n-context";
import { dayMs, spanDays, type DashaSpan } from "@/lib/dasha-periods";

/*
 * Dates, lengths and figures for the dasha panel, in the reader's language.
 *
 * A period's dates are days in UTC, as the engine writes them, so they are
 * parsed and formatted in UTC and no time zone can move a boundary by a day.
 */

type Translate = (key: string, params?: Record<string, string>) => string;

const DAY = 86_400_000;

const format = (iso: string, language: Language, options: Intl.DateTimeFormatOptions) => {
  const ms = dayMs(iso);
  return Number.isFinite(ms) ? new Date(ms).toLocaleDateString(LOCALE_TAGS[language], { ...options, timeZone: "UTC" }) : iso;
};

export const formatDay = (iso: string, language: Language) =>
  format(iso, language, { day: "numeric", month: "short", year: "numeric" });

export const formatMonth = (iso: string, language: Language) => format(iso, language, { month: "short", year: "numeric" });

export const formatYear = (iso: string, language: Language) => format(iso, language, { year: "numeric" });

/** A period's dates as finely as its length needs: days for weeks, months for years, years for decades. */
export function formatSpan(span: Pick<DashaSpan, "start" | "end">, language: Language): string {
  const days = spanDays(span);
  const date = days <= 120 ? formatDay : days <= 4 * 365 ? formatMonth : formatYear;
  return `${date(span.start, language)} – ${date(span.end, language)}`;
}

const number = (value: number, language: Language, digits = 0) =>
  new Intl.NumberFormat(LOCALE_TAGS[language], { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

/** How long a period runs: "2.7 years", "5 months", "21 days". */
export function formatLength(days: number, t: Translate, language: Language): string {
  if (days >= 730) return t("dasha.panel.durationYears", { count: number(days / 365.25, language, 1) });
  if (days >= 60) return t("dasha.panel.durationMonths", { count: number(Math.round(days / 30.44), language) });
  return t("dasha.panel.durationDays", { count: number(Math.max(1, days), language) });
}

/** How long is left of a period that is running: "11.4 years left", "3 months left", "9 days left". */
export function formatLeft(days: number, t: Translate, language: Language): string {
  if (days >= 730) return t("dasha.now.yearsLeft", { count: number(days / 365.25, language, 1) });
  if (days >= 60) return t("dasha.now.monthsLeft", { count: number(Math.round(days / 30.44), language) });
  return t("dasha.now.daysLeft", { count: number(Math.max(0, days), language) });
}

export const formatPercent = (fraction: number, language: Language) =>
  new Intl.NumberFormat(LOCALE_TAGS[language], { style: "percent", maximumFractionDigits: 0 }).format(fraction);

/** Today as the dial's centre prints it: "8 Oct". */
export const formatToday = (now: number, language: Language) =>
  new Date(now).toLocaleDateString(LOCALE_TAGS[language], { day: "numeric", month: "short" });

/** Days between two instants, rounded, for figures that do not need a span. */
export const daysBetween = (from: number, to: number) => Math.round((to - from) / DAY);
