/**
 * A default interface language from where a visitor is.
 *
 * Only a default. A language the visitor picks is stored by LanguageProvider
 * and always wins over this; what this supplies is the first guess for someone
 * who has not chosen. Before it, every visitor started in English -- including
 * the Hindi and Bengali readers the catalogs were written for, who had to find
 * the switcher first.
 *
 * The location is the hosting platform's reading of the request's IP address
 * (Vercel's x-vercel-ip-* headers), not the browser's Geolocation API: the
 * Permissions-Policy in next.config.ts turns that API off on purpose, and a
 * permission prompt is a poor price for a language. Nothing is asked of the
 * visitor and no position is kept -- only the derived locale, in a cookie
 * (lib/location-locale-cookie.ts).
 *
 * A forged header changes nothing but the language of the forger's own page,
 * so unlike the client IP (lib/rate-limiter.ts) this is not a trust boundary.
 *
 * Read by proxy.ts only. Its one runtime import is the cookie format; the
 * client i18n module is imported for its types alone, so the proxy does not
 * bundle it.
 */

import type { Language } from "@/lib/i18n-context";
import {
  formatLocationLocale,
  parseLocationLocale,
} from "@/lib/location-locale-cookie";

/**
 * Which edition of the tables below decided a cookie. Within a country the
 * first answer otherwise stands (see nextLocationLocale), so an edit here
 * reaches only new visitors and travellers unless this goes up with it; a
 * cookie from an older edition is decided once more, then stands again.
 *
 *   1  India by state: Hindi in the Hindi-speaking states, English elsewhere.
 *   2  Hindi for all of India but West Bengal and Tripura.
 */
export const LOCATION_TABLE_VERSION = 2;

/*
 * Countries with one answer among the six languages. Anything missing gets
 * English, which is also what a visitor gets when the location is unknown.
 *
 * A wrong guess puts a page in a language the visitor may not read, which is
 * worse than English, so outside India a country is listed only where the
 * language is what people there read day to day. That leaves out places where
 * it is one official language among several in practice (Andorra) or a second
 * language beside Arabic (the Maghreb).
 *
 * India is the exception by choice: Hindi for the whole country, the south,
 * the west and the north-east included, with West Bengal and Tripura in
 * Bengali (the overrides below). Anyone it does not suit has the switcher,
 * and their pick outranks this from then on.
 */
const COUNTRY_LANGUAGE: Readonly<Record<string, Language>> = {
  IN: "hi",

  /* Spain, Spanish-speaking America, Puerto Rico and Equatorial Guinea. */
  ES: "es", MX: "es", GT: "es", HN: "es", SV: "es", NI: "es", CR: "es", PA: "es",
  CU: "es", DO: "es", PR: "es", CO: "es", VE: "es", EC: "es", PE: "es", BO: "es",
  PY: "es", CL: "es", AR: "es", UY: "es", GQ: "es",

  /* France, its overseas departments and territories (which have codes of
     their own), Monaco and Luxembourg, Haiti, and the countries where French
     is the language of school and government. */
  FR: "fr", GF: "fr", GP: "fr", MQ: "fr", RE: "fr", YT: "fr", PF: "fr", NC: "fr",
  PM: "fr", WF: "fr", BL: "fr", MF: "fr", MC: "fr", LU: "fr", HT: "fr",
  SN: "fr", CI: "fr", ML: "fr", BF: "fr", NE: "fr", GN: "fr", BJ: "fr", TG: "fr",
  CM: "fr", GA: "fr", CG: "fr", CD: "fr", CF: "fr", TD: "fr", MG: "fr", DJ: "fr",
  KM: "fr", BI: "fr",

  IT: "it", SM: "it", VA: "it",

  BD: "bn",
};

/*
 * Regions whose language differs from their country's answer above. A region
 * not listed, or not known, takes the country's answer.
 *
 * Region codes are the second half of ISO 3166-2 (the "WB" of "IN-WB"), which
 * is what x-vercel-ip-country-region carries.
 */
const REGION_OVERRIDES: Readonly<Record<string, Readonly<Record<string, Language>>>> = {
  /* West Bengal and Tripura read Bengali, as Bangladesh does. */
  IN: { WB: "bn", TR: "bn" },
  /* Quebec. */
  CA: { QC: "fr" },
  /* Wallonia and Brussels; Flanders reads Dutch, which is not offered. */
  BE: { WAL: "fr", BRU: "fr" },
  /* The French-speaking cantons, counting bilingual Fribourg and Valais by
     their majority, and Italian-speaking Ticino. */
  CH: { GE: "fr", VD: "fr", NE: "fr", JU: "fr", FR: "fr", VS: "fr", TI: "it" },
};

const COUNTRY_CODE = /^[A-Z]{2}$/;
const REGION_CODE = /^[A-Z0-9]{1,3}$/;

export type VisitorLocation = { country: string; region: string | null };

/* Own keys only, so no lookup can land on the object prototype. */
function own<T>(table: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}

/** The language this location suggests; English when nothing more specific is known. */
export function languageForLocation(location: VisitorLocation): Language {
  const regions = own(REGION_OVERRIDES, location.country);
  const regional = regions && location.region ? own(regions, location.region) : undefined;
  return regional ?? own(COUNTRY_LANGUAGE, location.country) ?? "en";
}

/**
 * The visitor's location as the platform reports it, or null when it reports
 * none -- local development, another host, an address the database cannot
 * place. Null is "unknown", which is different from "somewhere English".
 */
export function locationFromHeaders(headers: Headers): VisitorLocation | null {
  const country = headers.get("x-vercel-ip-country")?.trim().toUpperCase();
  if (!country || !COUNTRY_CODE.test(country)) return null;
  const region = headers.get("x-vercel-ip-country-region")?.trim().toUpperCase();
  return { country, region: region && REGION_CODE.test(region) ? region : null };
}

/**
 * The cookie value to write for this request, or null to leave the cookie as
 * it is.
 *
 * Within one country the first answer stands. IP addresses are placed in a
 * region far less reliably than in a country -- a phone's carrier address can
 * read as Jharkhand one day and West Bengal the next -- and re-deciding on
 * every visit would turn that noise into a page that changes language between
 * visits. A different country is travel, and gets a fresh answer; so does a
 * cookie from an older edition of the tables.
 */
export function nextLocationLocale(
  location: VisitorLocation | null,
  current: string | null | undefined,
): string | null {
  if (!location) return null;
  const remembered = parseLocationLocale(current);
  if (
    remembered &&
    remembered.country === location.country &&
    remembered.version === LOCATION_TABLE_VERSION
  ) {
    return null;
  }
  return formatLocationLocale({
    language: languageForLocation(location),
    country: location.country,
    version: LOCATION_TABLE_VERSION,
  });
}
