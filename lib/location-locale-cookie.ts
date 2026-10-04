/**
 * The cookie proxy.ts leaves for LanguageProvider: the locale a visitor's
 * location suggests, written language-then-country, "hi-IN".
 *
 * Its own module, apart from the location tables in lib/location-language.ts,
 * because both sides need it and the client side is every page: the provider
 * that reads it ships on every route, /m included, and should not carry a
 * table of countries to read two letters out of a cookie.
 *
 * The country rides along so the proxy can tell travel from noise -- see
 * nextLocationLocale. Nothing finer than the country is kept.
 */

export const LOCATION_LOCALE_COOKIE = "astro_location_locale";

const LOCALE_PATTERN = /^([a-z]{2})-([A-Z]{2})$/;

export type LocationLocale = { language: string; country: string };

export function formatLocationLocale(locale: LocationLocale): string {
  return `${locale.language}-${locale.country}`;
}

/** Null for anything not shaped like "hi-IN"; which languages exist is the reader's call. */
export function parseLocationLocale(value: string | null | undefined): LocationLocale | null {
  const match = value ? LOCALE_PATTERN.exec(value) : null;
  return match ? { language: match[1], country: match[2] } : null;
}
