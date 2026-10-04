/**
 * The cookie proxy.ts leaves for LanguageProvider: the locale a visitor's
 * location suggests, written language-then-country, then the edition of the
 * table that decided it: "hi-IN.2".
 *
 * Its own module, apart from the location tables in lib/location-language.ts,
 * because both sides need it and the client side is every page: the provider
 * that reads it ships on every route, /m included, and should not carry a
 * table of countries to read two letters out of a cookie.
 *
 * The country rides along so the proxy can tell travel from noise, and the
 * edition so a change to the table can reach someone who already has an
 * answer -- see nextLocationLocale. Nothing finer than the country is kept.
 */

export const LOCATION_LOCALE_COOKIE = "astro_location_locale";

/* The edition is optional because the first cookies were written without one. */
const LOCALE_PATTERN = /^([a-z]{2})-([A-Z]{2})(?:\.(\d{1,3}))?$/;

export type LocationLocale = { language: string; country: string; version: number };

export function formatLocationLocale(locale: LocationLocale): string {
  return `${locale.language}-${locale.country}.${locale.version}`;
}

/**
 * Null for anything not shaped like "hi-IN.2"; which languages exist is the
 * reader's call. A cookie with no edition predates editions, which makes it
 * the first.
 */
export function parseLocationLocale(value: string | null | undefined): LocationLocale | null {
  const match = value ? LOCALE_PATTERN.exec(value) : null;
  if (!match) return null;
  return { language: match[1], country: match[2], version: match[3] ? Number(match[3]) : 1 };
}
