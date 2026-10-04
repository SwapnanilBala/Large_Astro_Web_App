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
 * Read by proxy.ts only. Kept free of runtime imports so the proxy bundles it
 * without pulling the client i18n module along.
 */

import type { Language } from "@/lib/i18n-context";
import {
  formatLocationLocale,
  parseLocationLocale,
} from "@/lib/location-locale-cookie";

/*
 * Countries with one clear answer among the six languages. Anything missing
 * from this table and the next gets English, which is also what a visitor gets
 * when the location is unknown.
 *
 * Deliberately conservative: a wrong guess puts a page in a language the
 * visitor may not read, which is worse than English, so a country is listed
 * only where the language is what people there read day to day. That leaves
 * out places where it is one official language among several in practice
 * (Andorra) or a second language beside Arabic (the Maghreb).
 */
const COUNTRY_LANGUAGE: Readonly<Record<string, Language>> = {
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
 * Countries where the answer depends on the region. These get English unless
 * the region is listed, so an unknown region falls back to English rather
 * than to a guess.
 *
 * India is the one that matters most. Hindi is the language of the states
 * listed, not of the country: a Hindi default in Chennai or Bengaluru would be
 * presumptuous, so the south, the west and the north-east get English.
 * Bengali is the language of West Bengal and Tripura, as of Bangladesh above.
 * Two of these codes changed in ISO 3166-2 -- Uttarakhand UT to UK,
 * Chhattisgarh CT to CG -- and IP databases do not all move at once, so both
 * spellings are here.
 *
 * Region codes are the second half of ISO 3166-2 (the "UP" of "IN-UP"), which
 * is what x-vercel-ip-country-region carries.
 */
const REGION_LANGUAGE: Readonly<Record<string, Readonly<Record<string, Language>>>> = {
  IN: {
    UP: "hi", BR: "hi", MP: "hi", RJ: "hi", HR: "hi", DL: "hi", HP: "hi", JH: "hi",
    CH: "hi", UK: "hi", UT: "hi", CG: "hi", CT: "hi",
    WB: "bn", TR: "bn",
  },
  /* Quebec. */
  CA: { QC: "fr" },
  /* Wallonia and Brussels; Flanders reads Dutch, which is not offered. */
  BE: { WAL: "fr", BRU: "fr" },
  /* The French-speaking cantons, counting bilingual Fribourg and Valais by
     their majority, and Italian-speaking Ticino. */
  CH: { GE: "fr", VD: "fr", NE: "fr", JU: "fr", FR: "fr", VS: "fr", TI: "it" },
};

/*
 * Codes are checked against these before any table is consulted, which is
 * also what keeps a lookup off the object prototype: no inherited key is two
 * or three upper-case characters.
 */
const COUNTRY_CODE = /^[A-Z]{2}$/;
const REGION_CODE = /^[A-Z0-9]{1,3}$/;

export type VisitorLocation = { country: string; region: string | null };

/** The language this location suggests; English when nothing more specific is known. */
export function languageForLocation(location: VisitorLocation): Language {
  const regions = REGION_LANGUAGE[location.country];
  if (regions) return (location.region && regions[location.region]) || "en";
  return COUNTRY_LANGUAGE[location.country] ?? "en";
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
 * read as Delhi one day and West Bengal the next -- and re-deciding on every
 * visit would turn that noise into a page that changes language between
 * visits. A different country is travel, and gets a fresh answer.
 */
export function nextLocationLocale(
  location: VisitorLocation | null,
  current: string | null | undefined,
): string | null {
  if (!location) return null;
  const remembered = parseLocationLocale(current);
  if (remembered && remembered.country === location.country) return null;
  return formatLocationLocale({
    language: languageForLocation(location),
    country: location.country,
  });
}
