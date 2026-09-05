/**
 * Rendering a birth date as the date somebody typed.
 *
 * `new Date("1992-05-12")` is not the date. A bare YYYY-MM-DD string is parsed
 * as UTC midnight, and `toLocaleDateString` then renders that instant in the
 * reader's own zone — so anyone west of Greenwich reads the day before. On
 * UTC-4 a 12 May birth date displayed as "May 11, 1992".
 *
 * A birth date is a calendar date, not an instant: the whole point of storing
 * the birth time and offset separately is that the date is the one the
 * certificate says, in the place it was issued, and it should not drift with
 * where it happens to be read. Splitting the parts and building a local date
 * keeps it fixed.
 */

const BIRTH_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A YYYY-MM-DD string as a Date at local midnight, or null if it is not one.
 *
 * Local rather than UTC so every downstream formatter — which will use the
 * local zone whether or not it says so — reads back the same day.
 */
export function parseBirthDate(value: string): Date | null {
  const match = BIRTH_DATE_PATTERN.exec(value.trim());
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  /* Rejects 2026-02-31 and friends, which Date silently rolls forward. */
  return date.getMonth() === Number(month) - 1 && date.getDate() === Number(day)
    ? date
    : null;
}

/**
 * "May 12, 1992".
 *
 * Anything unparseable is returned untouched: a birth date is copy somebody
 * supplied, and showing it as given beats showing "Invalid Date".
 */
export function formatBirthDate(
  value: string,
  locale = "en-US",
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" },
): string {
  const date = parseBirthDate(value);
  return date ? date.toLocaleDateString(locale, options) : value;
}
