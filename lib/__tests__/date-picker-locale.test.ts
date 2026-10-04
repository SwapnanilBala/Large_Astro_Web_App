import { describe, expect, it } from "vitest";
import { format, parse } from "date-fns";
import { LANGUAGE_CODES, LOCALE_TAGS } from "@/lib/i18n-context";
import {
  formatBirthDateDisplay,
  formatClockDisplay,
  normalizeBirthDate,
  normalizeBirthTime,
} from "@/lib/intake-normalize";
import {
  ENGLISH_DATE_FORMAT,
  ENGLISH_TIME_FORMAT,
  loadCalendarLocale,
  pickerFormats,
  type CalendarLanguage,
} from "../date-picker-locale";

/*
 * What the desktop picker writes in each language, held against the read-out
 * under the field, which it must never contradict, and against both readers
 * of what it writes: react-datepicker's own (date-fns `parse`, as the visitor
 * types) and the normaliser (on commit).
 */

const LANGUAGES = LANGUAGE_CODES.filter(
  (language): language is CalendarLanguage => language !== "en",
);

/* Every month, on one- and two-digit days, from the picker's first year to a
   recent one; never the future, which the normaliser rightly refuses. */
const DATES = [1900, 1990, 2020].flatMap((year) =>
  Array.from({ length: 12 }, (_, month) =>
    [1, 9, 10, 28].map((day) => new Date(year, month, day)),
  ).flat(),
);

/* Every five minutes of a day, the picker's own step. */
const TIMES = Array.from(
  { length: 24 * 12 },
  (_, step) => new Date(2000, 0, 1, Math.floor(step / 12), (step % 12) * 5),
);

const pad = (value: number) => String(value).padStart(2, "0");
const isoDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const clock = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

describe("the English picker", () => {
  it("keeps the formats the desktop intake has always shown", () => {
    expect(format(new Date(1990, 5, 5), ENGLISH_DATE_FORMAT)).toBe("05 Jun 1990");
    expect(format(new Date(2000, 0, 1, 7, 15), ENGLISH_TIME_FORMAT)).toBe("7:15 AM");
  });
});

describe.each(LANGUAGES)("pickerFormats in %s", (language) => {
  const tag = LOCALE_TAGS[language];

  /* Before the language's calendar has arrived, and after. */
  const beforeAndAfter = async () => [
    pickerFormats(tag),
    pickerFormats(tag, await loadCalendarLocale(language)),
  ];

  it("writes a date exactly as the read-out under the field does", async () => {
    for (const { locale, dateFormat } of await beforeAndAfter()) {
      for (const date of DATES) {
        expect(format(date, dateFormat, { locale })).toBe(
          formatBirthDateDisplay(isoDate(date), tag),
        );
      }
    }
  });

  it("writes a time the same way, in the field and in the list it opens", async () => {
    for (const { locale, timeFormat } of await beforeAndAfter()) {
      for (const time of TIMES) {
        expect(format(time, timeFormat, { locale })).toBe(formatClockDisplay(clock(time), tag));
      }
    }
  });

  it("reads back what it writes, as it is typed and on commit", async () => {
    const { locale, dateFormat, timeFormat } = pickerFormats(
      tag,
      await loadCalendarLocale(language),
    );
    for (const date of DATES) {
      const shown = format(date, dateFormat, { locale });
      expect(parse(shown, dateFormat, new Date(), { locale })).toEqual(date);
      expect(normalizeBirthDate(shown, { locale: tag }).value).toBe(isoDate(date));
    }
    for (const time of TIMES) {
      const shown = format(time, timeFormat, { locale });
      expect(parse(shown, timeFormat, time, { locale })).toEqual(time);
      expect(normalizeBirthTime(shown, { locale: tag }).value).toBe(clock(time));
    }
  });

  it("leaves a numeric date to the normaliser, as English does", () => {
    /* No pattern has a numeric month in it, so react-datepicker's own reading
       of "05/06/1990" fails here as it does in English, and the day-first
       reading committed on blur is the one that counts. */
    const { locale, dateFormat } = pickerFormats(tag);
    expect(parse("05/06/1990", dateFormat, new Date(), { locale }).getTime()).toBeNaN();
  });

  it("leaves the calendar's own words to the language's date-fns locale", async () => {
    const calendar = await loadCalendarLocale(language);
    const { locale } = pickerFormats(tag, calendar);
    const may = new Date(1990, 4, 15);

    /* The calendar's heading, its month list, and the weekday names a
       screen reader hears. */
    for (const pattern of ["LLLL yyyy", "LLLL", "EEEE"]) {
      expect(format(may, pattern, { locale })).toBe(format(may, pattern, { locale: calendar }));
    }
    expect(format(may, "LLLL yyyy", { locale })).not.toBe("May 1990");
    expect(locale.options?.weekStartsOn).toBe(calendar.options?.weekStartsOn);
  });

  it("heads the calendar's columns with names short enough to fit them", async () => {
    const calendar = await loadCalendarLocale(language);
    const { locale } = pickerFormats(tag, calendar);
    /* A week of days, Sunday 7 January 2024 onward. */
    const week = Array.from({ length: 7 }, (_, offset) => new Date(2024, 0, 7 + offset));

    for (const day of week) {
      /* react-datepicker heads each column with "EEEEEE". */
      const name = format(day, "EEEEEE", { locale });
      expect([...name].length).toBeLessThanOrEqual(2);
      expect([
        format(day, "EEEEEE", { locale: calendar }),
        format(day, "EEEEE", { locale: calendar }),
      ]).toContain(name);
    }
  });
});
