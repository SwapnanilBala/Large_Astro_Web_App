/**
 * Saturday-anchored week arithmetic and formatting.
 *
 * The weekly-energy panel needs the same week in four places -- the pager
 * label, the chart's x-axis, the peak callout and the server-composed alt text
 * -- so the arithmetic lives here once rather than being re-derived at each
 * site. Four copies of "which Saturday is this" is how a chart ends up plotting
 * one week under another week's labels.
 *
 * Two deliberate choices:
 *
 * 1. Dates are handled as `YYYY-MM-DD` strings anchored to LOCAL NOON, never
 *    as epoch arithmetic. `+ 86400000` drifts by an hour across a DST boundary
 *    and can land the same calendar day twice or skip one; noon has twelve
 *    hours of slack either side of any real-world shift. Same approach as
 *    addDays in future-forecast-panel.tsx.
 *
 * 2. Every formatter takes an explicit `locale`, defaulting to en-US, rather
 *    than passing `undefined` to Intl. `undefined` resolves to the runtime's
 *    locale, which differs between Node and the browser -- so a string built
 *    on the server and re-rendered on the client would not match, and React
 *    discards a mismatched tree rather than patching it. Callers that only
 *    ever run in the browser may pass a real user locale.
 */

/** Days in a week. Named because the chart's geometry depends on it being 7. */
export const WEEK_LENGTH = 7;

/**
 * Saturday. The reference design's axis runs Sat -> Fri, and the API rejects a
 * week_start that is not a Saturday, so the two cannot disagree about which
 * seven days are on screen.
 */
export const WEEK_START_DAY = 6;

export function localDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parse a `YYYY-MM-DD` string at local noon. */
export function parseDateString(dateString: string): Date {
  return new Date(`${dateString}T12:00:00`);
}

export function addDays(dateString: string, offsetDays: number): string {
  const date = parseDateString(dateString);
  date.setDate(date.getDate() + offsetDays);
  return localDateString(date);
}

export function addWeeks(dateString: string, offsetWeeks: number): string {
  return addDays(dateString, offsetWeeks * WEEK_LENGTH);
}

/** True when the string names a Saturday. */
export function isWeekStart(dateString: string): boolean {
  return parseDateString(dateString).getDay() === WEEK_START_DAY;
}

/** The Saturday on or before the given day. */
export function weekStartFor(date: Date = new Date()): string {
  const daysSinceSaturday = (date.getDay() - WEEK_START_DAY + WEEK_LENGTH) % WEEK_LENGTH;
  return addDays(localDateString(date), -daysSinceSaturday);
}

export function currentWeekStart(now: Date = new Date()): string {
  return weekStartFor(now);
}

/** The seven `YYYY-MM-DD` strings of the week, Saturday first. */
export function weekDays(weekStart: string): string[] {
  return Array.from({ length: WEEK_LENGTH }, (_, index) => addDays(weekStart, index));
}

export function weekEnd(weekStart: string): string {
  return addDays(weekStart, WEEK_LENGTH - 1);
}

/**
 * "Jun 22 – Jun 28, 2024", collapsing the year to one mention. When the week
 * straddles a year boundary both years are shown, because "Dec 28 – Jan 3,
 * 2025" would be wrong about the first date.
 */
export function formatWeekRangeLabel(weekStart: string, locale = "en-US"): string {
  const start = parseDateString(weekStart);
  const end = parseDateString(weekEnd(weekStart));
  const monthDay = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  const year = new Intl.DateTimeFormat(locale, { year: "numeric" });

  const startYear = year.format(start);
  const endYear = year.format(end);

  if (startYear !== endYear) {
    return `${monthDay.format(start)}, ${startYear} – ${monthDay.format(end)}, ${endYear}`;
  }
  return `${monthDay.format(start)} – ${monthDay.format(end)}, ${endYear}`;
}

/** Two-line axis label: weekday above, day number below. */
export function formatDayAxis(
  dateString: string,
  locale = "en-US"
): { weekday: string; day: string } {
  const date = parseDateString(dateString);
  return {
    weekday: new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date),
    day: new Intl.DateTimeFormat(locale, { day: "numeric" }).format(date),
  };
}

/** "Wed 26", for the peak callout. */
export function formatDayShort(dateString: string, locale = "en-US"): string {
  const { weekday, day } = formatDayAxis(dateString, locale);
  return `${weekday} ${day}`;
}
