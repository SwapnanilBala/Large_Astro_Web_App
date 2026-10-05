// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  LOCATION_TABLE_VERSION,
  languageForLocation,
  locationFromHeaders,
  nextLocationLocale,
} from "../location-language";
import { formatLocationLocale, parseLocationLocale } from "../location-locale-cookie";
import { LANGUAGE_CODES } from "../i18n-context";

const at = (country: string, region: string | null = null) => ({ country, region });

describe("languageForLocation", () => {
  it.each([
    ["ES", "es"],
    ["MX", "es"],
    ["AR", "es"],
    ["PR", "es"],
    ["FR", "fr"],
    ["RE", "fr"],
    ["SN", "fr"],
    ["IT", "it"],
    ["SM", "it"],
    ["BD", "bn"],
    ["DE", "de"],
    ["AT", "de"],
    ["LI", "de"],
    ["CH", "de"],
    ["LU", "fr"],
  ])("gives a whole-country answer for %s: %s", (country, language) => {
    expect(languageForLocation(at(country))).toBe(language);
  });

  it.each(["US", "GB", "AU", "NL", "JP", "NP", "PK", "MA", "AD"])(
    "leaves %s in English",
    (country) => {
      expect(languageForLocation(at(country))).toBe("en");
    },
  );

  it("gives Hindi to the whole of India, the south, west and north-east included", () => {
    const states = ["UP", "BR", "DL", "MP", "TN", "KA", "KL", "AP", "TS", "MH", "GJ", "PB", "AS", "GA", "OD"];
    for (const state of states) {
      expect(languageForLocation(at("IN", state)), state).toBe("hi");
    }
  });

  it("gives Bengali to West Bengal and Tripura", () => {
    expect(languageForLocation(at("IN", "WB"))).toBe("bn");
    expect(languageForLocation(at("IN", "TR"))).toBe("bn");
  });

  it("falls back to the country's answer when the region is unknown", () => {
    expect(languageForLocation(at("IN"))).toBe("hi");
    expect(languageForLocation(at("IN", "ZZ"))).toBe("hi");
    expect(languageForLocation(at("CA"))).toBe("en");
  });

  it("never answers from the object prototype", () => {
    expect(languageForLocation(at("constructor"))).toBe("en");
    expect(languageForLocation(at("IN", "toString"))).toBe("hi");
  });

  it("splits the bilingual countries by region", () => {
    expect(languageForLocation(at("CA", "QC"))).toBe("fr");
    expect(languageForLocation(at("CA", "ON"))).toBe("en");
    expect(languageForLocation(at("BE", "WAL"))).toBe("fr");
    expect(languageForLocation(at("BE", "BRU"))).toBe("fr");
    expect(languageForLocation(at("BE", "VLG"))).toBe("en");
    expect(languageForLocation(at("CH", "GE"))).toBe("fr");
    expect(languageForLocation(at("CH", "VS"))).toBe("fr");
    expect(languageForLocation(at("CH", "TI"))).toBe("it");
    expect(languageForLocation(at("CH", "ZH"))).toBe("de");
    expect(languageForLocation(at("CH", "BE"))).toBe("de");
    /* East Belgium and South Tyrol keep their region's language. */
    expect(languageForLocation(at("BE", "WAL"))).toBe("fr");
    expect(languageForLocation(at("IT", "32"))).toBe("it");
  });

  it("only ever answers with a language the app offers", () => {
    const sample = [at("ES"), at("IN", "WB"), at("CH", "TI"), at("ZZ"), at("IN", "ZZ")];
    for (const location of sample) {
      expect(LANGUAGE_CODES).toContain(languageForLocation(location));
    }
  });
});

describe("locationFromHeaders", () => {
  const headers = (entries: Record<string, string>) => new Headers(entries);

  it("reads the country and region the platform sends", () => {
    expect(
      locationFromHeaders(headers({ "x-vercel-ip-country": "IN", "x-vercel-ip-country-region": "WB" })),
    ).toEqual({ country: "IN", region: "WB" });
  });

  it("is null without a country, which is 'unknown' rather than 'English'", () => {
    expect(locationFromHeaders(headers({}))).toBeNull();
    expect(locationFromHeaders(headers({ "x-vercel-ip-country-region": "WB" }))).toBeNull();
  });

  it("refuses anything that is not a country code", () => {
    for (const value of ["", "India", "I", "1N", "constructor"]) {
      expect(locationFromHeaders(headers({ "x-vercel-ip-country": value })), value).toBeNull();
    }
  });

  it("tidies case and drops a region it cannot read", () => {
    expect(
      locationFromHeaders(headers({ "x-vercel-ip-country": " in ", "x-vercel-ip-country-region": "up" })),
    ).toEqual({ country: "IN", region: "UP" });
    expect(
      locationFromHeaders(headers({ "x-vercel-ip-country": "IN", "x-vercel-ip-country-region": "UTTAR" })),
    ).toEqual({ country: "IN", region: null });
  });
});

describe("nextLocationLocale", () => {
  const v = LOCATION_TABLE_VERSION;

  it("writes language, country and the table's edition for a first visit", () => {
    expect(nextLocationLocale(at("IN", "WB"), undefined)).toBe(`bn-IN.${v}`);
    expect(nextLocationLocale(at("US"), undefined)).toBe(`en-US.${v}`);
  });

  it("leaves the cookie alone when the location is unknown", () => {
    expect(nextLocationLocale(null, undefined)).toBeNull();
    expect(nextLocationLocale(null, `hi-IN.${v}`)).toBeNull();
  });

  it("keeps the first answer within a country, so a wandering address cannot flip it", () => {
    expect(nextLocationLocale(at("IN", "JH"), `bn-IN.${v}`)).toBeNull();
    expect(nextLocationLocale(at("IN", "WB"), `hi-IN.${v}`)).toBeNull();
  });

  it("decides again in a different country", () => {
    expect(nextLocationLocale(at("FR"), `hi-IN.${v}`)).toBe(`fr-FR.${v}`);
    expect(nextLocationLocale(at("IN", "UP"), `en-US.${v}`)).toBe(`hi-IN.${v}`);
  });

  it("decides once more for a cookie from an older edition of the table", () => {
    /* Chennai was English under edition 1; India is Hindi now. */
    expect(nextLocationLocale(at("IN", "TN"), "en-IN")).toBe(`hi-IN.${v}`);
    expect(nextLocationLocale(at("IN", "TN"), "en-IN.1")).toBe(`hi-IN.${v}`);
    /* Kolkata was already Bengali; the cookie is still brought up to date. */
    expect(nextLocationLocale(at("IN", "WB"), "bn-IN")).toBe(`bn-IN.${v}`);
  });

  it("replaces a cookie it cannot read", () => {
    expect(nextLocationLocale(at("ES"), "garbage")).toBe(`es-ES.${v}`);
  });
});

describe("the cookie's shape", () => {
  it("round-trips", () => {
    const locale = { language: "hi", country: "IN", version: 2 };
    expect(parseLocationLocale(formatLocationLocale(locale))).toEqual(locale);
  });

  it("reads a cookie written before editions existed as the first edition", () => {
    expect(parseLocationLocale("hi-IN")).toEqual({ language: "hi", country: "IN", version: 1 });
  });

  it("is null for anything else", () => {
    for (const value of [undefined, null, "", "hi", "HI-in", "hi_IN", "hin-IN", "hi-IND", "hi-IN.", "hi-IN.x"]) {
      expect(parseLocationLocale(value), String(value)).toBeNull();
    }
  });
});
