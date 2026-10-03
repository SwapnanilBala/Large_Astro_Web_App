import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import {
  applyPlaceSuggestion,
  formatBirthDateDisplay,
  formatClockDisplay,
  formatIntakeMessages,
  formatIntakeText,
  normalizeBirthDate,
  normalizeBirthTime,
  normalizeCoordinate,
  normalizeCoordinatePair,
  normalizePersonName,
  normalizePlaceName,
  normalizeUtcOffsetMinutes,
  suggestionTaken,
  toAsciiDigits,
  type IntakeFieldResult,
} from "../intake-normalize";

/* A fixed "today" so year expansion and the future-date guard are not tied to
 * the day the suite happens to run. */
const TODAY = new Date(2026, 7, 17);
const dateOptions = { today: TODAY };

/* The English catalog, filled in the way the provider's `t` fills it, so the
 * assertions below read the sentence a visitor reads. A key the catalog lacks
 * comes back as the raw key and fails them. */
const HOME = enMessages.home as Record<string, string>;

function t(key: string, params: Record<string, string> = {}): string {
  const text = key.startsWith("home.") ? HOME[key.slice("home.".length)] ?? key : key;
  return Object.entries(params).reduce(
    (filled, [name, value]) => filled.split(`{${name}}`).join(value),
    text,
  );
}

/** The note a form shows under the field, in English. */
function english(result: IntakeFieldResult): string {
  return formatIntakeMessages(result.messages ?? [], t, "en-US");
}

/** The chips a form offers, as [value committed, label shown]. */
function chips(result: IntakeFieldResult): Array<[string, string]> | undefined {
  return result.suggestions?.map((suggestion) => [
    suggestion.value,
    formatIntakeText(suggestion.label, "en-US"),
  ]);
}

describe("toAsciiDigits", () => {
  it("folds other numeral systems down to ASCII", () => {
    expect(toAsciiDigits("१४:३०")).toBe("14:30");
    expect(toAsciiDigits("১৪:৩০")).toBe("14:30");
    expect(toAsciiDigits("１４:３０")).toBe("14:30");
  });

  it("leaves ASCII and letters untouched", () => {
    expect(toAsciiDigits("2:30 PM")).toBe("2:30 PM");
  });
});

describe("normalizeBirthTime", () => {
  it("reads 24-hour input exactly as written", () => {
    expect(normalizeBirthTime("14:30")).toMatchObject({ status: "ok", value: "14:30" });
    expect(normalizeBirthTime("00:00")).toMatchObject({ status: "ok", value: "00:00" });
    expect(normalizeBirthTime("23:59")).toMatchObject({ status: "ok", value: "23:59" });
  });

  it("reads 12-hour input in every spelling people use", () => {
    expect(normalizeBirthTime("2:30 PM").value).toBe("14:30");
    expect(normalizeBirthTime("2:30pm").value).toBe("14:30");
    expect(normalizeBirthTime("2:30 p.m.").value).toBe("14:30");
    expect(normalizeBirthTime("2:30 p").value).toBe("14:30");
    expect(normalizeBirthTime("230pm").value).toBe("14:30");
    expect(normalizeBirthTime("2 30 pm").value).toBe("14:30");
    expect(normalizeBirthTime("2:30 am").value).toBe("02:30");
  });

  it("accepts the separators that turn up instead of a colon", () => {
    expect(normalizeBirthTime("14.30").value).toBe("14:30");
    expect(normalizeBirthTime("14 30").value).toBe("14:30");
    expect(normalizeBirthTime("14h30").value).toBe("14:30");
    expect(normalizeBirthTime("1430").value).toBe("14:30");
    expect(normalizeBirthTime("930").value).toBe("09:30");
  });

  it("keeps exact minutes rather than snapping to picker steps", () => {
    /* The ascendant advances about a degree every four minutes, so 14:37 has
     * to survive as 14:37. */
    expect(normalizeBirthTime("14:37").value).toBe("14:37");
    expect(normalizeBirthTime("2:37 PM").value).toBe("14:37");
  });

  it("handles the midnight and noon boundaries", () => {
    expect(normalizeBirthTime("12:00 AM").value).toBe("00:00");
    expect(normalizeBirthTime("12:00 PM").value).toBe("12:00");
    expect(normalizeBirthTime("noon").value).toBe("12:00");
    expect(normalizeBirthTime("midnight").value).toBe("00:00");
    expect(english(normalizeBirthTime("noon"))).toBe("Noon is 12:00 PM.");
    expect(english(normalizeBirthTime("midnight"))).toBe("Midnight is 00:00.");
  });

  it("repairs a redundant PM instead of rejecting the whole entry", () => {
    const result = normalizeBirthTime("13:00 PM");

    expect(result.status).toBe("corrected");
    expect(result.value).toBe("13:00");
    expect(english(result)).toBe("PM was redundant — 13:00 is already afternoon.");
  });

  it("keeps the explicit hour when AM contradicts it, and offers the morning reading", () => {
    const result = normalizeBirthTime("13:45 AM");

    expect(result.status).toBe("ambiguous");
    expect(result.value).toBe("13:45");
    expect(english(result)).toBe("13:45 already reads as afternoon, so the AM was ignored.");
    expect(chips(result)).toEqual([["01:45", "1:45 AM"]]);
  });

  it("reads 24:00 as midnight", () => {
    const result = normalizeBirthTime("24:00");

    expect(result.status).toBe("corrected");
    expect(result.value).toBe("00:00");
  });

  it("pads a single minute digit and fills in missing minutes", () => {
    expect(normalizeBirthTime("2:5 pm")).toMatchObject({ status: "corrected", value: "14:05" });
    expect(normalizeBirthTime("9 pm")).toMatchObject({ status: "corrected", value: "21:00" });
    expect(english(normalizeBirthTime("2:5 pm"))).toBe("Minutes read as :05.");
    expect(english(normalizeBirthTime("9 pm"))).toBe("No minutes were given, so :00 was used.");
  });

  it("drops seconds", () => {
    const result = normalizeBirthTime("14:30:45");

    expect(result.value).toBe("14:30");
    expect(english(result)).toMatch(/seconds/i);
  });

  it("offers both readings when a bare 1-12 hour could be either half of the day", () => {
    const result = normalizeBirthTime("7:15");

    expect(result.status).toBe("ambiguous");
    expect(result.value).toBe("07:15");
    /* Quoted as typed, against the reading it was given. */
    expect(english(result)).toBe("7:15 could be morning or evening — read as 7:15 AM.");
    expect(chips(result)).toEqual([["19:15", "7:15 PM"]]);
  });

  it("offers midnight as the other reading of a bare 12", () => {
    expect(chips(normalizeBirthTime("12:30"))).toEqual([["00:30", "12:30 AM"]]);
  });

  it("keeps a typed 10:30 two-sided", () => {
    /* Typed into the desktop picker, or into the text box a browser without
     * native time support falls back to, "10:30" really could be either. */
    const result = normalizeBirthTime("10:30");

    expect(result).toMatchObject({ status: "ambiguous", value: "10:30" });
    expect(chips(result)).toEqual([["22:30", "10:30 PM"]]);
  });

  describe("with clock24, for a native time input's value", () => {
    it("reads 10:00-12:59 as the 24-hour time it is", () => {
      /* 10:30 AM picked from the OS wheel arrives as "10:30", and was offered
       * back as possibly 10:30 PM — one tap from a chart twelve hours out. */
      const morning = normalizeBirthTime("10:30", { clock24: true });
      const lunchtime = normalizeBirthTime("12:30", { clock24: true });

      expect(morning).toEqual({ status: "ok", value: "10:30", display: { kind: "time", value: "10:30" } });
      expect(lunchtime).toEqual({ status: "ok", value: "12:30", display: { kind: "time", value: "12:30" } });
      expect(formatIntakeText(morning.display, "en-US")).toBe("10:30 AM");
      expect(formatIntakeText(lunchtime.display, "en-US")).toBe("12:30 PM");
    });

    it("settles every minute of the day exactly as written", () => {
      const unsettled: string[] = [];
      for (let minute = 0; minute < 24 * 60; minute += 1) {
        const value = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
        const result = normalizeBirthTime(value, { clock24: true });
        if (result.status !== "ok" || result.value !== value) unsettled.push(value);
      }

      expect(unsettled).toEqual([]);
    });

    it("changes what is said about a time, never the time itself", () => {
      /* The mobile intake re-reads its whole draft on submit and keeps only
       * the value, so the flag must not be able to move a time on its own. */
      for (const text of ["10:30", "12:30", "7:15", "2:30 pm", "13:45 AM", "930", "24:00", "14:30:45"]) {
        expect(normalizeBirthTime(text, { clock24: true }).value).toBe(normalizeBirthTime(text).value);
      }
    });

    it("still honours an AM or PM that is actually there", () => {
      expect(normalizeBirthTime("2:30 pm", { clock24: true }).value).toBe("14:30");
      expect(normalizeBirthTime("13:45 AM", { clock24: true }).status).toBe("ambiguous");
    });
  });

  it("treats a leading zero or a compact run as settled 24-hour intent", () => {
    expect(normalizeBirthTime("07:15").status).toBe("ok");
    expect(normalizeBirthTime("0715")).toMatchObject({ status: "ok", value: "07:15" });
    expect(normalizeBirthTime("0715").suggestions).toBeUndefined();
    expect(normalizeBirthTime("1430").suggestions).toBeUndefined();
  });

  it("rejects clock values that cannot be repaired", () => {
    expect(normalizeBirthTime("25:00").status).toBe("invalid");
    expect(normalizeBirthTime("14:75").status).toBe("invalid");
    expect(normalizeBirthTime("hello").status).toBe("invalid");
    expect(normalizeBirthTime("25:00").value).toBe("");
    expect(english(normalizeBirthTime("14:75"))).toBe("Minutes only run from 00 to 59.");
  });

  it("reports nothing for an empty field", () => {
    expect(normalizeBirthTime("")).toMatchObject({ status: "empty", value: "" });
    expect(normalizeBirthTime("   ")).toMatchObject({ status: "empty" });
  });

  it("reads times typed on a non-Latin keyboard", () => {
    expect(normalizeBirthTime("१४:३०").value).toBe("14:30");
  });
});

describe("normalizeBirthDate", () => {
  it("accepts the formats a person actually types", () => {
    expect(normalizeBirthDate("1990-05-15", dateOptions).value).toBe("1990-05-15");
    expect(normalizeBirthDate("15/05/1990", dateOptions).value).toBe("1990-05-15");
    expect(normalizeBirthDate("15-05-1990", dateOptions).value).toBe("1990-05-15");
    expect(normalizeBirthDate("15.05.1990", dateOptions).value).toBe("1990-05-15");
    expect(normalizeBirthDate("15 May 1990", dateOptions).value).toBe("1990-05-15");
    expect(normalizeBirthDate("15 May, 1990", dateOptions).value).toBe("1990-05-15");
    expect(normalizeBirthDate("May 15 1990", dateOptions).value).toBe("1990-05-15");
    expect(normalizeBirthDate("15 September 1990", dateOptions).value).toBe("1990-09-15");
    expect(normalizeBirthDate("May 15th, 1990", dateOptions).value).toBe("1990-05-15");
  });

  it("reads compact digit runs from whichever end carries the year", () => {
    expect(normalizeBirthDate("15051990", dateOptions).value).toBe("1990-05-15");
    expect(normalizeBirthDate("19900515", dateOptions).value).toBe("1990-05-15");
    expect(english(normalizeBirthDate("19900515", dateOptions))).toBe(
      'Read "19900515" as year, month, day.',
    );
  });

  it("expands a two-digit year to the reading that has already happened", () => {
    const ninety = normalizeBirthDate("15/05/90", dateOptions);
    expect(ninety.value).toBe("1990-05-15");
    expect(english(ninety)).toBe('The year "90" was read as 1990.');

    expect(normalizeBirthDate("15/05/05", dateOptions).value).toBe("2005-05-15");
    expect(normalizeBirthDate("15/05/27", dateOptions).value).toBe("1927-05-15");
  });

  it("commits day-first but offers the month-first reading when both are real", () => {
    const result = normalizeBirthDate("05/06/1990", dateOptions);

    expect(result.status).toBe("ambiguous");
    expect(result.value).toBe("1990-06-05");
    expect(english(result)).toBe("That could also read as 6 May 1990.");
    expect(chips(result)).toEqual([["1990-05-06", "6 May 1990"]]);
  });

  it("falls back to month-first only when day-first is impossible", () => {
    const result = normalizeBirthDate("05/22/1990", dateOptions);

    expect(result.value).toBe("1990-05-22");
    expect(result.status).toBe("corrected");
    expect(result.suggestions).toBeUndefined();
    expect(english(result)).toBe("Read month-first, because 22 cannot be a month.");
  });

  it("says so when month-first won because the day-first date is still to come", () => {
    /* 8 September 2026 has not happened by 17 August, but 9 August has. */
    const result = normalizeBirthDate("08/09/2026", dateOptions);

    expect(result).toMatchObject({ status: "corrected", value: "2026-08-09" });
    expect(english(result)).toBe("Read month-first, because 8 Sep 2026 is in the future.");
  });

  it("tolerates surrounding whitespace and mixed case month names", () => {
    expect(normalizeBirthDate("  15 mAy 1990  ", dateOptions).value).toBe("1990-05-15");
  });

  it("explains an impossible date rather than rolling it forward", () => {
    const result = normalizeBirthDate("31/02/1990", dateOptions);

    expect(result.status).toBe("invalid");
    expect(english(result)).toBe("February 1990 only has 28 days.");
    expect(normalizeBirthDate("1990-02-30", dateOptions).status).toBe("invalid");
    expect(english(normalizeBirthDate("1990-13-45", dateOptions))).toBe(
      "That is not a real calendar date.",
    );
  });

  it("rejects dates outside the supported range", () => {
    expect(english(normalizeBirthDate("15/05/2030", dateOptions))).toMatch(/future/i);
    expect(english(normalizeBirthDate("15/05/1850", dateOptions))).toBe(
      "Dates before 1900 are not supported.",
    );
  });

  it("rejects text that is not a date", () => {
    expect(normalizeBirthDate("hello", dateOptions).status).toBe("invalid");
    expect(normalizeBirthDate("15 Smarch 1990", dateOptions).status).toBe("invalid");
    expect(normalizeBirthDate("", dateOptions).status).toBe("empty");
  });
});

describe("normalizePersonName", () => {
  it("tidies spacing without commenting on it twice", () => {
    const result = normalizePersonName("  Ada   Lovelace ");

    expect(result.value).toBe("Ada Lovelace");
    expect(english(result)).toBe("Extra spacing was tidied up.");
  });

  it("re-cases input that arrived entirely in one case", () => {
    expect(normalizePersonName("ada lovelace").value).toBe("Ada Lovelace");
    expect(normalizePersonName("ADA LOVELACE").value).toBe("Ada Lovelace");
    expect(normalizePersonName("jean-luc picard").value).toBe("Jean-Luc Picard");
    expect(normalizePersonName("mary o'brien").value).toBe("Mary O'Brien");
    expect(normalizePersonName("vincent van gogh").value).toBe("Vincent van Gogh");
    expect(english(normalizePersonName("ada lovelace"))).toBe('Capitalised as "Ada Lovelace".');
  });

  it("says everything it repaired, one sentence after another", () => {
    expect(english(normalizePersonName("  ada   lovelace "))).toBe(
      'Extra spacing was tidied up. Capitalised as "Ada Lovelace".',
    );
  });

  it("leaves deliberate mixed casing exactly as typed", () => {
    expect(normalizePersonName("Ronald McDonald")).toMatchObject({
      status: "ok",
      value: "Ronald McDonald",
    });
  });

  it("rejects a name with fewer than two letters, matching the API", () => {
    expect(normalizePersonName("A").status).toBe("invalid");
    expect(normalizePersonName("42").status).toBe("invalid");
    expect(english(normalizePersonName("A"))).toBe("A name needs at least two letters.");
  });
});

describe("normalizePlaceName", () => {
  it("re-cases and tidies place names", () => {
    expect(normalizePlaceName("  new   delhi ").value).toBe("New Delhi");
    expect(normalizePlaceName("STRATFORD UPON AVON").value).toBe("Stratford upon Avon");
  });

  it("leaves mixed casing alone", () => {
    expect(normalizePlaceName("DeKalb").value).toBe("DeKalb");
  });
});

describe("normalizeCoordinate", () => {
  it("passes plain decimal degrees straight through", () => {
    expect(normalizeCoordinate("40.7128", "latitude")).toMatchObject({
      status: "ok",
      value: "40.7128",
    });
    expect(normalizeCoordinate("-74.006", "longitude").value).toBe("-74.006");
  });

  it("reads a decimal comma", () => {
    expect(normalizeCoordinate("40,7128", "latitude").value).toBe("40.7128");
  });

  it("reads hemisphere letters as the sign", () => {
    expect(normalizeCoordinate("74.006 W", "longitude").value).toBe("-74.006");
    expect(normalizeCoordinate("W 74.006", "longitude").value).toBe("-74.006");
    expect(normalizeCoordinate("40.7128 N", "latitude").value).toBe("40.7128");
    expect(normalizeCoordinate("22.5726 south", "latitude").value).toBe("-22.5726");
    expect(english(normalizeCoordinate("74.006 W", "longitude"))).toBe(
      "W was read as a negative value.",
    );
  });

  it("converts degrees, minutes and seconds", () => {
    expect(normalizeCoordinate("40° 42' 46\" N", "latitude").value).toBe("40.712778");
    expect(normalizeCoordinate("40 42 46 N", "latitude").value).toBe("40.712778");
    expect(normalizeCoordinate("40 42 N", "latitude").value).toBe("40.7");
  });

  it("names the likely mix-up when a latitude is out of range", () => {
    const result = normalizeCoordinate("120.5", "latitude");

    expect(result.status).toBe("invalid");
    expect(english(result)).toMatch(/longitude/i);
  });

  it("rejects values no axis could hold", () => {
    expect(normalizeCoordinate("200", "longitude").status).toBe("invalid");
    expect(normalizeCoordinate("40 75 N", "latitude").status).toBe("invalid");
    expect(normalizeCoordinate("somewhere", "latitude").status).toBe("invalid");
    expect(english(normalizeCoordinate("200", "longitude"))).toBe(
      "Longitude only runs from -180 to 180.",
    );
  });
});

describe("normalizeCoordinatePair", () => {
  it("splits a pair pasted out of a map app", () => {
    const pair = normalizeCoordinatePair("12.9716, 77.5946");

    expect(pair?.latitude.value).toBe("12.9716");
    expect(pair?.longitude.value).toBe("77.5946");
  });

  it("handles hemisphere letters and other separators", () => {
    expect(normalizeCoordinatePair("40.7128 N / 74.0060 W")?.longitude.value).toBe("-74.006");
  });

  it("leaves a single degrees-and-minutes reading alone", () => {
    expect(normalizeCoordinatePair("40 42")).toBeNull();
  });

  it("returns null when either half is not a coordinate", () => {
    expect(normalizeCoordinatePair("12.9716, somewhere")).toBeNull();
    expect(normalizeCoordinatePair("12.9716")).toBeNull();
  });
});

describe("normalizeUtcOffsetMinutes", () => {
  it("keeps a value already given in minutes", () => {
    expect(normalizeUtcOffsetMinutes("330")).toMatchObject({ status: "ok", value: "330" });
    expect(normalizeUtcOffsetMinutes("-480").value).toBe("-480");
  });

  it("reads hour-and-minute forms", () => {
    expect(normalizeUtcOffsetMinutes("+05:30").value).toBe("330");
    expect(normalizeUtcOffsetMinutes("UTC+05:30").value).toBe("330");
    expect(normalizeUtcOffsetMinutes("-08:00").value).toBe("-480");
    expect(english(normalizeUtcOffsetMinutes("+05:30"))).toBe("05:30 was read as 330 minutes.");
  });

  it("reads a small bare number as hours", () => {
    expect(normalizeUtcOffsetMinutes("5.5").value).toBe("330");
    expect(normalizeUtcOffsetMinutes("-8").value).toBe("-480");
    expect(english(normalizeUtcOffsetMinutes("5.5"))).toBe(
      "5.5 was read as hours, which is 330 minutes.",
    );
  });

  it("rejects an offset no time zone uses", () => {
    expect(normalizeUtcOffsetMinutes("900").status).toBe("invalid");
    expect(normalizeUtcOffsetMinutes("nonsense").status).toBe("invalid");
    expect(english(normalizeUtcOffsetMinutes("900"))).toBe(
      "A UTC offset runs from -720 to 840 minutes.",
    );
  });
});

describe("unreadable input", () => {
  /* The forms show their own format hint in place of a generic example, so
   * the flag has to tell "no date in this at all" from "a date that cannot
   * be". */
  it("is flagged when nothing in the text could be read", () => {
    const unreadable = [
      normalizeBirthTime("hello"),
      normalizeBirthTime("1:2:3:4"),
      normalizeBirthDate("hello", dateOptions),
      normalizeBirthDate("15 Smarch 1990", dateOptions),
      normalizeCoordinate("somewhere", "latitude"),
      normalizeUtcOffsetMinutes("nonsense"),
    ];
    for (const result of unreadable) {
      expect(result).toMatchObject({ status: "invalid", unreadable: true });
    }
  });

  it("gives the field's format example as the note", () => {
    expect(english(normalizeBirthTime("hello"))).toBe("Enter a time like 14:30 or 2:30 PM.");
    expect(english(normalizeBirthDate("hello", dateOptions))).toBe(
      "Enter a date like 15/05/1990, 1990-05-15, or 15 May 1990.",
    );
    expect(english(normalizeCoordinate("somewhere", "latitude"))).toBe(
      "Try a coordinate like 40.7128, or 40° 42' 46\" N.",
    );
    expect(english(normalizeUtcOffsetMinutes("nonsense"))).toBe(
      "Try an offset like 330, +05:30, or 5.5.",
    );
  });

  it("is not flagged when the value was read and is impossible", () => {
    const impossible = [
      normalizeBirthTime("25:00"),
      normalizeBirthTime("14:75"),
      normalizeBirthDate("31/02/1990", dateOptions),
      normalizeBirthDate("15/05/2030", dateOptions),
      normalizeCoordinate("120.5", "latitude"),
      normalizeUtcOffsetMinutes("900"),
      normalizePersonName("A"),
    ];
    for (const result of impossible) {
      expect(result.status).toBe("invalid");
      expect(result.unreadable).toBeUndefined();
    }
  });
});

describe("suggestionTaken", () => {
  it("commits the reading and says what the field was set to", () => {
    const [evening] = normalizeBirthTime("7:15").suggestions ?? [];
    const result = suggestionTaken(evening);

    expect(result).toMatchObject({ status: "corrected", value: "19:15" });
    expect(english(result)).toBe("Set to 7:15 PM.");
  });
});

describe("formatBirthDateDisplay", () => {
  it("writes an ISO date the way the picker shows it", () => {
    expect(formatBirthDateDisplay("1990-05-15", "en-US")).toBe("15 May 1990");
    expect(formatBirthDateDisplay("1990-09-05", "en-US")).toBe("5 Sep 1990");
  });

  it("writes it in the visitor's language, day first and in Latin digits", () => {
    expect(formatBirthDateDisplay("1990-05-15", "es-ES")).toMatch(/^15 may\.? 1990$/);
    expect(formatBirthDateDisplay("1990-05-15", "fr-FR")).toMatch(/^15 mai 1990$/);
    expect(formatBirthDateDisplay("1990-05-15", "it-IT")).toMatch(/^15 mag\.? 1990$/);
    expect(formatBirthDateDisplay("1990-05-15", "hi-IN")).toMatch(/^15 मई 1990$/);
    /* Bengali would default to Bengali digits; the fields and every number a
     * note quotes are Latin, so the date is too. */
    expect(formatBirthDateDisplay("1990-05-15", "bn-IN")).toMatch(/^15 মে,? 1990$/);
  });

  it("returns anything that is not a real ISO date untouched", () => {
    expect(formatBirthDateDisplay("15/05/1990", "fr-FR")).toBe("15/05/1990");
    expect(formatBirthDateDisplay("1990-02-30", "en-US")).toBe("1990-02-30");
    expect(formatBirthDateDisplay("1990-13-01", "es-ES")).toBe("1990-13-01");
  });
});

describe("formatClockDisplay", () => {
  it("writes a 24-hour value the way a person reads it", () => {
    expect(formatClockDisplay("14:30", "en-US")).toBe("2:30 PM");
    expect(formatClockDisplay("00:05", "en-US")).toBe("12:05 AM");
    expect(formatClockDisplay("12:00", "en-US")).toBe("12:00 PM");
  });

  it("uses a 24-hour clock with a two-digit hour where the language does", () => {
    for (const locale of ["es-ES", "it-IT", "fr-FR"]) {
      expect(formatClockDisplay("14:30", locale)).toBe("14:30");
      expect(formatClockDisplay("02:30", locale)).toBe("02:30");
      expect(formatClockDisplay("00:05", locale)).toBe("00:05");
    }
  });

  it("keeps the twelve-hour clock, in the language's own words, where it is the norm", () => {
    expect(formatClockDisplay("14:30", "hi-IN")).toMatch(/^2:30\s?pm$/i);
    expect(formatClockDisplay("14:30", "bn-IN")).toMatch(/^2:30\s?pm$/i);
    expect(formatClockDisplay("02:30", "hi-IN")).toMatch(/^2:30\s?am$/i);
  });

  it("returns anything that is not a clock time untouched", () => {
    expect(formatClockDisplay("2:30 pm", "es-ES")).toBe("2:30 pm");
    expect(formatClockDisplay("25:00", "en-US")).toBe("25:00");
  });
});

describe("formatIntakeText", () => {
  it("shows plain text as it is and writes tagged values out", () => {
    expect(formatIntakeText("Ada Lovelace", "fr-FR")).toBe("Ada Lovelace");
    expect(formatIntakeText({ kind: "date", value: "1990-05-06" }, "en-US")).toBe("6 May 1990");
    expect(formatIntakeText({ kind: "time", value: "19:15" }, "fr-FR")).toBe("19:15");
    expect(formatIntakeText({ kind: "month", value: "1990-02" }, "en-US")).toBe("February 1990");
    expect(formatIntakeText({ kind: "month", value: "1990-02" }, "es-ES")).toMatch(/febrero/);
  });
});

describe("formatIntakeMessages", () => {
  it("fills each key's blanks with the values written out for the locale", () => {
    const result = normalizeBirthDate("05/06/1990", dateOptions);
    const seen: Array<[string, Record<string, string> | undefined]> = [];
    const spy = (key: string, params?: Record<string, string>) => {
      seen.push([key, params]);
      return key;
    };

    formatIntakeMessages(result.messages ?? [], spy, "fr-FR");

    expect(seen).toEqual([["home.fieldNoteDateAmbiguous", { date: "6 mai 1990" }]]);
  });
});

describe("applyPlaceSuggestion", () => {
  const blank = { city: "", state: "", country: "" };

  it("answers the state and the country from the chosen city", () => {
    expect(
      applyPlaceSuggestion(blank, { name: "Pune", state: "Maharashtra", country: "India" }),
    ).toEqual({ city: "Pune", state: "Maharashtra", country: "India" });
  });

  it("replaces what a previously chosen city left behind", () => {
    /* The case this rule exists for. /api/geocode joins the three into one
       query, so a stale "Maharashtra" would have it search for Singapore in
       the wrong half of the world. */
    const afterPune = { city: "Pune", state: "Maharashtra", country: "India" };
    expect(
      applyPlaceSuggestion(afterPune, { name: "Singapore", country: "Singapore" }),
    ).toEqual({ city: "Singapore", state: "", country: "Singapore" });
  });

  it("overwrites a country the visitor had guessed at", () => {
    const guessed = { city: "", state: "", country: "India" };
    expect(
      applyPlaceSuggestion(guessed, { name: "Brooklyn", state: "New York", country: "United States" }),
    ).toEqual({ city: "Brooklyn", state: "New York", country: "United States" });
  });

  it("keeps the city when the suggestion carries no name", () => {
    const typed = { city: "Pune", state: "", country: "" };
    expect(applyPlaceSuggestion(typed, { name: "   ", country: "India" })).toEqual({
      city: "Pune",
      state: "",
      country: "India",
    });
  });

  it("trims what it is handed", () => {
    expect(
      applyPlaceSuggestion(blank, { name: " Pune ", state: " Maharashtra ", country: " India " }),
    ).toEqual({ city: "Pune", state: "Maharashtra", country: "India" });
  });
});
