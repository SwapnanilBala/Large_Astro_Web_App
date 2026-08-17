import { describe, expect, it } from "vitest";
import {
  formatBirthDateDisplay,
  formatClockDisplay,
  normalizeBirthDate,
  normalizeBirthTime,
  normalizeCoordinate,
  normalizeCoordinatePair,
  normalizePersonName,
  normalizePlaceName,
  normalizeUtcOffsetMinutes,
  toAsciiDigits,
} from "../intake-normalize";

/* A fixed "today" so year expansion and the future-date guard are not tied to
 * the day the suite happens to run. */
const TODAY = new Date(2026, 7, 17);
const dateOptions = { today: TODAY };

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
  });

  it("repairs a redundant PM instead of rejecting the whole entry", () => {
    const result = normalizeBirthTime("13:00 PM");

    expect(result.status).toBe("corrected");
    expect(result.value).toBe("13:00");
    expect(result.message).toMatch(/redundant/i);
  });

  it("keeps the explicit hour when AM contradicts it, and offers the morning reading", () => {
    const result = normalizeBirthTime("13:45 AM");

    expect(result.status).toBe("ambiguous");
    expect(result.value).toBe("13:45");
    expect(result.suggestions).toEqual([{ value: "01:45", label: "1:45 AM" }]);
  });

  it("reads 24:00 as midnight", () => {
    const result = normalizeBirthTime("24:00");

    expect(result.status).toBe("corrected");
    expect(result.value).toBe("00:00");
  });

  it("pads a single minute digit and fills in missing minutes", () => {
    expect(normalizeBirthTime("2:5 pm")).toMatchObject({ status: "corrected", value: "14:05" });
    expect(normalizeBirthTime("9 pm")).toMatchObject({ status: "corrected", value: "21:00" });
  });

  it("drops seconds", () => {
    const result = normalizeBirthTime("14:30:45");

    expect(result.value).toBe("14:30");
    expect(result.message).toMatch(/seconds/i);
  });

  it("offers both readings when a bare 1-12 hour could be either half of the day", () => {
    const result = normalizeBirthTime("7:15");

    expect(result.status).toBe("ambiguous");
    expect(result.value).toBe("07:15");
    expect(result.suggestions).toEqual([{ value: "19:15", label: "7:15 PM" }]);
  });

  it("offers midnight as the other reading of a bare 12", () => {
    expect(normalizeBirthTime("12:30").suggestions).toEqual([
      { value: "00:30", label: "12:30 AM" },
    ]);
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
  });

  it("reports nothing for an empty field", () => {
    expect(normalizeBirthTime("")).toMatchObject({ status: "empty", value: "" });
    expect(normalizeBirthTime("   ")).toMatchObject({ status: "empty" });
  });

  it("reads times typed on a non-Latin keyboard", () => {
    expect(normalizeBirthTime("१४:३०").value).toBe("14:30");
  });
});

describe("formatClockDisplay", () => {
  it("writes a 24-hour value the way a person reads it", () => {
    expect(formatClockDisplay("14:30")).toBe("2:30 PM");
    expect(formatClockDisplay("00:05")).toBe("12:05 AM");
    expect(formatClockDisplay("12:00")).toBe("12:00 PM");
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
  });

  it("expands a two-digit year to the reading that has already happened", () => {
    const ninety = normalizeBirthDate("15/05/90", dateOptions);
    expect(ninety.value).toBe("1990-05-15");
    expect(ninety.message).toMatch(/1990/);

    expect(normalizeBirthDate("15/05/05", dateOptions).value).toBe("2005-05-15");
    expect(normalizeBirthDate("15/05/27", dateOptions).value).toBe("1927-05-15");
  });

  it("commits day-first but offers the month-first reading when both are real", () => {
    const result = normalizeBirthDate("05/06/1990", dateOptions);

    expect(result.status).toBe("ambiguous");
    expect(result.value).toBe("1990-06-05");
    expect(result.suggestions).toEqual([{ value: "1990-05-06", label: "6 May 1990" }]);
  });

  it("falls back to month-first only when day-first is impossible", () => {
    const result = normalizeBirthDate("05/22/1990", dateOptions);

    expect(result.value).toBe("1990-05-22");
    expect(result.status).toBe("corrected");
    expect(result.suggestions).toBeUndefined();
  });

  it("tolerates surrounding whitespace and mixed case month names", () => {
    expect(normalizeBirthDate("  15 mAy 1990  ", dateOptions).value).toBe("1990-05-15");
  });

  it("explains an impossible date rather than rolling it forward", () => {
    const result = normalizeBirthDate("31/02/1990", dateOptions);

    expect(result.status).toBe("invalid");
    expect(result.message).toMatch(/28 days/);
    expect(normalizeBirthDate("1990-02-30", dateOptions).status).toBe("invalid");
  });

  it("rejects dates outside the supported range", () => {
    expect(normalizeBirthDate("15/05/2030", dateOptions).message).toMatch(/future/i);
    expect(normalizeBirthDate("15/05/1850", dateOptions).message).toMatch(/1900/);
  });

  it("rejects text that is not a date", () => {
    expect(normalizeBirthDate("hello", dateOptions).status).toBe("invalid");
    expect(normalizeBirthDate("15 Smarch 1990", dateOptions).status).toBe("invalid");
    expect(normalizeBirthDate("", dateOptions).status).toBe("empty");
  });
});

describe("formatBirthDateDisplay", () => {
  it("writes an ISO date the way the picker shows it", () => {
    expect(formatBirthDateDisplay("1990-05-15")).toBe("15 May 1990");
    expect(formatBirthDateDisplay("1990-09-05")).toBe("5 Sep 1990");
  });
});

describe("normalizePersonName", () => {
  it("tidies spacing without commenting on it twice", () => {
    expect(normalizePersonName("  Ada   Lovelace ").value).toBe("Ada Lovelace");
  });

  it("re-cases input that arrived entirely in one case", () => {
    expect(normalizePersonName("ada lovelace").value).toBe("Ada Lovelace");
    expect(normalizePersonName("ADA LOVELACE").value).toBe("Ada Lovelace");
    expect(normalizePersonName("jean-luc picard").value).toBe("Jean-Luc Picard");
    expect(normalizePersonName("mary o'brien").value).toBe("Mary O'Brien");
    expect(normalizePersonName("vincent van gogh").value).toBe("Vincent van Gogh");
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
  });

  it("converts degrees, minutes and seconds", () => {
    expect(normalizeCoordinate("40° 42' 46\" N", "latitude").value).toBe("40.712778");
    expect(normalizeCoordinate("40 42 46 N", "latitude").value).toBe("40.712778");
    expect(normalizeCoordinate("40 42 N", "latitude").value).toBe("40.7");
  });

  it("names the likely mix-up when a latitude is out of range", () => {
    const result = normalizeCoordinate("120.5", "latitude");

    expect(result.status).toBe("invalid");
    expect(result.message).toMatch(/longitude/i);
  });

  it("rejects values no axis could hold", () => {
    expect(normalizeCoordinate("200", "longitude").status).toBe("invalid");
    expect(normalizeCoordinate("40 75 N", "latitude").status).toBe("invalid");
    expect(normalizeCoordinate("somewhere", "latitude").status).toBe("invalid");
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
  });

  it("reads a small bare number as hours", () => {
    expect(normalizeUtcOffsetMinutes("5.5").value).toBe("330");
    expect(normalizeUtcOffsetMinutes("-8").value).toBe("-480");
  });

  it("rejects an offset no time zone uses", () => {
    expect(normalizeUtcOffsetMinutes("900").status).toBe("invalid");
    expect(normalizeUtcOffsetMinutes("nonsense").status).toBe("invalid");
  });
});
