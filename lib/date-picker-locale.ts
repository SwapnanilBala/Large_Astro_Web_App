import type { Locale, Month } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import type { Language } from "@/lib/i18n-context";
import { birthDateFormatter, clockFormatter } from "@/lib/intake-normalize";

/*
 * What the desktop intake's date picker writes, and in whose words.
 *
 * English is what it always was: "05 Jun 1990" and "7:15 AM", in
 * react-datepicker's own en-US.
 *
 * Every other language writes the field exactly as the read-out under it does
 * (formatBirthDateDisplay, formatClockDisplay in lib/intake-normalize), so
 * the two never disagree about the value between them: "5 juin 1990", "07:15",
 * "7:15 pm". date-fns has words of its own for these, and they are not the
 * same ones. Its Spanish September is "sep" where Intl's is "sept"; its Hindi
 * drops the "॰" that marks an abbreviation and writes AM as "पूर्वाह्न" where
 * Intl writes "am"; its Bengali differs on most month abbreviations and on
 * the comma. So the field's pattern, its month abbreviations and its AM and
 * PM come from the read-out's own formatters, and date-fns supplies the rest
 * of the calendar: its month and weekday names, which day a week starts on,
 * the labels a screen reader hears on each day.
 *
 * No language's date pattern has a numeric month in it, so react-datepicker's
 * own reading of a typed "05/06/1990" is no different from English's: it
 * does not match, and the reading that counts is the normaliser's, on commit.
 */

/** The date field in English, as it has always been shown. */
export const ENGLISH_DATE_FORMAT = "dd MMM yyyy";

/** The time field in English, likewise. */
export const ENGLISH_TIME_FORMAT = "h:mm aa";

export type CalendarLanguage = Exclude<Language, "en">;

/*
 * One chunk per language, of 2.0–2.4KB gzipped, fetched only by a visitor
 * reading in it. Bundled with the picker instead, every one would ride on
 * every visitor, English included -- 7.6KB for the first five. Listed rather
 * than built from a template string, which would have the bundler split out a
 * chunk for every one of date-fns's locales.
 */
const CALENDAR_LOCALES: Record<CalendarLanguage, () => Promise<Locale>> = {
  es: () => import("date-fns/locale/es").then((module) => module.es),
  fr: () => import("date-fns/locale/fr").then((module) => module.fr),
  it: () => import("date-fns/locale/it").then((module) => module.it),
  hi: () => import("date-fns/locale/hi").then((module) => module.hi),
  bn: () => import("date-fns/locale/bn").then((module) => module.bn),
  de: () => import("date-fns/locale/de").then((module) => module.de),
};

/** Fetch the date-fns locale a language's calendar is written in. */
export function loadCalendarLocale(language: CalendarLanguage): Promise<Locale> {
  return CALENDAR_LOCALES[language]();
}

export interface PickerFormats {
  /** For react-datepicker's `locale`. */
  locale: Locale;
  /** The date field's `dateFormat`. */
  dateFormat: string;
  /** The time field's `dateFormat`, and its `timeFormat` too, so the field
      and the list it opens write a time the same way. */
  timeFormat: string;
}

/* Each month once, on a one-digit day, which shows whether the day is padded. */
const MONTH_SAMPLES = Array.from({ length: 12 }, (_, month) => new Date(Date.UTC(2000, month, 5)));
const MORNING = new Date(Date.UTC(2000, 0, 1, 7, 5));
const EVENING = new Date(Date.UTC(2000, 0, 1, 19, 5));
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/* date-fns's letter for each of Intl's hour cycles. */
const HOUR_LETTERS = { h11: "K", h12: "h", h23: "H", h24: "k" } as const;

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

/* Text a date-fns pattern writes as it is. A Latin letter outside quotes is
   read as a token (and an unknown one throws), so letters are quoted; a quote
   is written as two. */
function literal(text: string): string {
  return text.replace(/'/g, "''").replace(/[a-zA-Z]+/g, (letters) => `'${letters}'`);
}

/* A number's token, doubled where Intl wrote the sample with two digits. */
function numberToken(letter: string, sample: string): string {
  return sample.length > 1 ? letter + letter : letter;
}

/*
 * The longest of `words` that `text` begins with, in any case, as a date-fns
 * match result. Longest, so a word that begins another cannot cut it short.
 */
function matchWords<Value>(
  text: string,
  words: ReadonlyArray<readonly [string, Value]>,
): { value: Value; rest: string } | null {
  let best: { value: Value; rest: string } | null = null;
  let bestLength = 0;
  for (const [word, value] of words) {
    if (word.length > bestLength && text.slice(0, word.length).toLowerCase() === word.toLowerCase()) {
      best = { value, rest: text.slice(word.length) };
      bestLength = word.length;
    }
  }
  return best;
}

/**
 * The picker's locale and formats for a language other than English, given
 * its BCP-47 tag (one of LOCALE_TAGS).
 *
 * `calendar` is the language's date-fns locale once it has arrived. Until it
 * does, en-US stands in for the calendar's own words — but the field already
 * reads in the language, since every word in it comes from Intl.
 */
export function pickerFormats(tag: string, calendar: Locale = enUS): PickerFormats {
  const dateFormatter = birthDateFormatter(tag);
  const months = MONTH_SAMPLES.map((moment) =>
    partValue(dateFormatter.formatToParts(moment), "month"),
  );
  const dateFormat = dateFormatter
    .formatToParts(MONTH_SAMPLES[0])
    .map((part) => {
      switch (part.type) {
        case "day":
          return numberToken("d", part.value);
        case "month":
          return "MMM";
        case "year":
          return "y";
        default:
          return literal(part.value);
      }
    })
    .join("");

  const timeFormatter = clockFormatter(tag);
  const hourLetter = HOUR_LETTERS[timeFormatter.resolvedOptions().hourCycle ?? "h23"];
  const morning = timeFormatter.formatToParts(MORNING);
  const timeFormat = morning
    .map((part) => {
      switch (part.type) {
        case "hour":
          return numberToken(hourLetter, part.value);
        case "minute":
          return "mm";
        case "dayPeriod":
          return "a";
        default:
          return literal(part.value);
      }
    })
    .join("");
  /* None on a 24-hour clock, whose pattern has no "a" to fill. */
  const meridiems = {
    am: partValue(morning, "dayPeriod"),
    pm: partValue(timeFormatter.formatToParts(EVENING), "dayPeriod"),
  };

  const monthWords = months.map((word, month) => [word, month as Month] as const);
  const meridiemWords = meridiems.am ? ([[meridiems.am, "am"], [meridiems.pm, "pm"]] as const) : [];

  const { localize, match } = calendar;

  /* The weekday names over the calendar's columns, which were sized for
     English's "Su" and "Mo". date-fns's short names fit them at two
     characters or fewer, as in Spanish "lu" and Hindi "मं"; Italian's run to
     three letters and Bengali's to whole words ("মঙ্গল"), which ran into one
     another. Those take the narrow names, "L" and "ম", as month grids in both
     languages commonly do. */
  const narrowWeekdays = WEEKDAYS.some(
    (day) => [...localize.day(day, { width: "short" })].length > 2,
  );

  /* Otherwise only what the field writes is swapped: "MMM" and "a". Every
     other width, and the standalone forms in the calendar's header and month
     list, stay date-fns's. Reading tries Intl's words first and falls back
     to date-fns's, so its abbreviations still read when typed. */
  const locale: Locale = {
    ...calendar,
    localize: {
      ...localize,
      day: (day, options) =>
        narrowWeekdays && options?.width === "short"
          ? localize.day(day, { ...options, width: "narrow" })
          : localize.day(day, options),
      month: (month, options) =>
        options?.width === "abbreviated" && options.context !== "standalone"
          ? months[month]
          : localize.month(month, options),
      dayPeriod: (period, options) =>
        meridiems.am && options?.width === "abbreviated" && (period === "am" || period === "pm")
          ? meridiems[period]
          : localize.dayPeriod(period, options),
    },
    match: {
      ...match,
      month: (text, options) => matchWords(text, monthWords) ?? match.month(text, options),
      dayPeriod: (text, options) => matchWords(text, meridiemWords) ?? match.dayPeriod(text, options),
    },
  };

  return { locale, dateFormat, timeFormat };
}
