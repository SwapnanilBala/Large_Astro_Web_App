import { describe, expect, it } from "vitest";
import { LOCALE_TAGS } from "@/lib/i18n-context";
import { formatBirthDateDisplay } from "@/lib/intake-normalize";
import { parseSmartFill } from "../smart-fill";

/* Every language the interface speaks that Intl writes dates for. */
const OTHER_LOCALES = Object.values(LOCALE_TAGS).filter((locale) => locale !== "en-US");

describe("parseSmartFill", () => {
  it("reads the line the paste box's examples show", () => {
    expect(parseSmartFill("Aarya Patel, 14 Mar 1995, 3:45 PM, Mumbai, Maharashtra, India")).toEqual({
      name: "Aarya Patel",
      birthDate: "1995-03-14",
      birthTime: "15:45",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
    });
  });

  it("reads a date written in the interface language", () => {
    /* Read in English alone, "8 juin 2001" was no date, and became the city. */
    expect(parseSmartFill("Maya, 8 juin 2001, 8:15, Paris, Ile-de-France, France", "fr-FR")).toEqual({
      name: "Maya",
      birthDate: "2001-06-08",
      birthTime: "08:15",
      city: "Paris",
      state: "Ile-de-France",
      country: "France",
    });
  });

  it("keeps a date's own comma with the date", () => {
    /* Bengali writes a date this way, and so does American English. Split at
       the comma, "15 মে" was read as the time 15:00 and "May 15" as the city. */
    expect(parseSmartFill("Rina, 15 মে, 1990, 7:15 PM, Kolkata, West Bengal, India", "bn-IN")).toEqual({
      name: "Rina",
      birthDate: "1990-05-15",
      birthTime: "19:15",
      city: "Kolkata",
      state: "West Bengal",
      country: "India",
    });
    expect(
      parseSmartFill("Jordan Lee, May 15, 1990, 11:20 AM, Brooklyn, New York, United States"),
    ).toEqual({
      name: "Jordan Lee",
      birthDate: "1990-05-15",
      birthTime: "11:20",
      city: "Brooklyn",
      state: "New York",
      country: "United States",
    });
  });

  it("reads a date the way the read-out writes it, in every language", () => {
    for (const locale of OTHER_LOCALES) {
      const date = formatBirthDateDisplay("1990-09-05", locale);
      expect(parseSmartFill(`Ada, ${date}, 7:15 AM, Pune, Maharashtra, India`, locale)).toMatchObject({
        birthDate: "1990-09-05",
        birthTime: "07:15",
        city: "Pune",
      });
    }
  });

  it("leaves a line with too few parts alone", () => {
    expect(parseSmartFill("Ada, 15 May 1990")).toBeNull();
  });
});
