// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
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
  ])("gives a whole-country answer for %s: %s", (country, language) => {
    expect(languageForLocation(at(country))).toBe(language);
  });

  it.each(["US", "GB", "AU", "DE", "JP", "NP", "PK", "MA", "AD"])(
    "leaves %s in English",
    (country) => {
      expect(languageForLocation(at(country))).toBe("en");
    },
  );

  it("gives Hindi to the Hindi-speaking states, not to the whole of India", () => {
    for (const state of ["UP", "BR", "MP", "RJ", "HR", "DL", "HP", "JH", "CH"]) {
      expect(languageForLocation(at("IN", state)), state).toBe("hi");
    }
    for (const state of ["TN", "KA", "KL", "AP", "TS", "MH", "GJ", "PB", "AS", "GA"]) {
      expect(languageForLocation(at("IN", state)), state).toBe("en");
    }
  });

  it("reads Uttarakhand and Chhattisgarh under both their old and new codes", () => {
    for (const state of ["UK", "UT", "CG", "CT"]) {
      expect(languageForLocation(at("IN", state)), state).toBe("hi");
    }
  });

  it("gives Bengali to West Bengal and Tripura", () => {
    expect(languageForLocation(at("IN", "WB"))).toBe("bn");
    expect(languageForLocation(at("IN", "TR"))).toBe("bn");
  });

  it("does not guess a region it was not given", () => {
    expect(languageForLocation(at("IN"))).toBe("en");
    expect(languageForLocation(at("CA"))).toBe("en");
  });

  it("splits the bilingual countries by region", () => {
    expect(languageForLocation(at("CA", "QC"))).toBe("fr");
    expect(languageForLocation(at("CA", "ON"))).toBe("en");
    expect(languageForLocation(at("BE", "WAL"))).toBe("fr");
    expect(languageForLocation(at("BE", "BRU"))).toBe("fr");
    expect(languageForLocation(at("BE", "VLG"))).toBe("en");
    expect(languageForLocation(at("CH", "GE"))).toBe("fr");
    expect(languageForLocation(at("CH", "TI"))).toBe("it");
    expect(languageForLocation(at("CH", "ZH"))).toBe("en");
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
  it("writes language and country for a first visit", () => {
    expect(nextLocationLocale(at("IN", "WB"), undefined)).toBe("bn-IN");
    expect(nextLocationLocale(at("US"), undefined)).toBe("en-US");
  });

  it("leaves the cookie alone when the location is unknown", () => {
    expect(nextLocationLocale(null, undefined)).toBeNull();
    expect(nextLocationLocale(null, "hi-IN")).toBeNull();
  });

  it("keeps the first answer within a country, so a wandering address cannot flip it", () => {
    expect(nextLocationLocale(at("IN", "DL"), "bn-IN")).toBeNull();
    expect(nextLocationLocale(at("IN", "TN"), "hi-IN")).toBeNull();
  });

  it("decides again in a different country", () => {
    expect(nextLocationLocale(at("FR"), "hi-IN")).toBe("fr-FR");
    expect(nextLocationLocale(at("IN", "UP"), "en-US")).toBe("hi-IN");
  });

  it("replaces a cookie it cannot read", () => {
    expect(nextLocationLocale(at("ES"), "garbage")).toBe("es-ES");
  });
});

describe("the cookie's shape", () => {
  it("round-trips", () => {
    const locale = { language: "hi", country: "IN" };
    expect(parseLocationLocale(formatLocationLocale(locale))).toEqual(locale);
  });

  it("is null for anything else", () => {
    for (const value of [undefined, null, "", "hi", "HI-in", "hi_IN", "hin-IN", "hi-IND"]) {
      expect(parseLocationLocale(value), String(value)).toBeNull();
    }
  });
});
