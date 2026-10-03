/**
 * Forgiving normalisation for everything a visitor types into the intake.
 *
 * A birth chart is only as good as the birth moment, and the birth moment
 * arrives as free text from someone who is not thinking about formats. They
 * type "230pm", "14.30", "13:00 PM", "15/05/90", "40°42'46\"N". Rejecting that
 * with "invalid" pushes the work back onto them; worse, silently discarding it
 * loses an answer they believe they gave.
 *
 * So every field gets the same treatment: read the input the way a person
 * meant it, repair what can be repaired, say plainly what was repaired, and
 * where two readings are genuinely possible offer both rather than guess in
 * silence.
 *
 * Everything here is pure and framework-free so the desktop intake, the mobile
 * intake and the compatibility form share one set of rules — and so the rules
 * can be tested directly rather than through a form.
 *
 * None of it is written in any one language. What was repaired comes back as
 * catalog keys with parameters, and dates and times come back canonical and
 * tagged with what they are (IntakeText); each form writes both out at render
 * time, through its `t` and the visitor's locale (formatIntakeMessages,
 * formatIntakeText). A note therefore reads in the interface language, and
 * follows it if the visitor switches.
 *
 * Callers always write back `result.value`; `status` only decides what, if
 * anything, to say about it.
 */

export type IntakeFieldStatus =
  /** Nothing typed yet. */
  | "empty"
  /** Understood exactly as typed. */
  | "ok"
  /** Understood, but something was repaired — say so. */
  | "corrected"
  /** Understood, but another reading is equally plausible — offer it. */
  | "ambiguous"
  /** Not usable; `value` is empty and `messages` explains why. */
  | "invalid";

/**
 * Something the intake shows the visitor, in a form that can still be written
 * out in their language.
 *
 * A plain string is shown as it is: a name, a place, a fragment of what was
 * typed. The tagged forms carry a canonical value — an ISO date, a 24-hour
 * clock, a year and month — which formatIntakeText writes out for a locale.
 */
export type IntakeText =
  | string
  | { kind: "date"; value: string }
  | { kind: "time"; value: string }
  | { kind: "month"; value: string };

export interface IntakeSuggestion {
  /** Canonical value committed when the visitor picks this reading. */
  value: string;
  /** Chip label: the same reading, written out the way a person reads it. */
  label: IntakeText;
}

/**
 * Every catalog key this module can hand back, all of them in `home`.
 *
 * Listed because nothing else would notice one going missing: the forms pass
 * these to `t` as variables, which the scan of `t("...")` literals in
 * lib/__tests__/i18n-mobile-coverage.test.ts cannot see, and a miss renders the
 * raw key on screen. The normaliser tests hold each one against both English
 * catalogs instead.
 */
export const INTAKE_MESSAGE_KEYS = [
  /* Birth time. The format example is the hint the desktop intake already
     shows under the field, so all three forms say the same thing. */
  "home.birthTimeFormatHint",
  "home.fieldNoteNoon",
  "home.fieldNoteMidnight",
  "home.fieldNoteMinutesRange",
  "home.fieldNoteSecondsDropped",
  "home.fieldNoteMinutesAssumed",
  "home.fieldNoteMinutesPadded",
  "home.fieldNoteZeroPm",
  "home.fieldNotePmRedundant",
  "home.fieldNoteHoursRange12",
  "home.fieldNoteTwelveAm",
  "home.fieldNoteAmIgnored",
  "home.fieldNoteTwentyFour",
  "home.fieldNoteHoursRange24",
  "home.fieldNoteTimeAmbiguous",
  /* Birth date, likewise. */
  "home.birthDateFormatHint",
  "home.fieldNoteYearExpanded",
  "home.fieldNoteMonthFirst",
  "home.fieldNoteMonthFirstFuture",
  "home.fieldNoteDigitsDayFirst",
  "home.fieldNoteDigitsYearFirst",
  "home.fieldNoteMonthLength",
  "home.fieldNoteNotADate",
  "home.fieldNoteFutureDate",
  "home.fieldNoteDateTooEarly",
  "home.fieldNoteDateAmbiguous",
  /* Names and places. */
  "home.fieldNoteNameTooShort",
  "home.fieldNoteSpacing",
  "home.fieldNoteCapitalised",
  /* Coordinates. */
  "home.fieldNoteCoordinateHint",
  "home.fieldNoteDecimalComma",
  "home.fieldNoteDmsRange",
  "home.fieldNoteDmsConverted",
  "home.fieldNoteLatitudeSwapped",
  "home.fieldNoteLatitudeRange",
  "home.fieldNoteLongitudeRange",
  "home.fieldNoteHemisphereNegative",
  /* UTC offset. */
  "home.fieldNoteOffsetHint",
  "home.fieldNoteOffsetClock",
  "home.fieldNoteOffsetHours",
  "home.fieldNoteOffsetRange",
  /* A reading the visitor picked from the chips. */
  "home.fieldNoteSetTo",
] as const;

export type IntakeMessageKey = (typeof INTAKE_MESSAGE_KEYS)[number];

/** One thing to say about a field: a catalog key and what fills its blanks. */
export interface IntakeMessage {
  key: IntakeMessageKey;
  params?: Record<string, IntakeText>;
}

export interface IntakeFieldResult {
  status: IntakeFieldStatus;
  /** Canonical value for the app, or "" when nothing usable came out. */
  value: string;
  /** The canonical value, ready to be written the way a person reads it. */
  display: IntakeText;
  /** What was repaired, what is still ambiguous, or why it was rejected. */
  messages?: IntakeMessage[];
  /**
   * Only on an invalid result: nothing in the text could be read at all, so
   * `messages` is no more than an example of the format, and a form with its
   * own hint for the field may show that instead. A value that was read and
   * turned out impossible — 31 February, a date still to come — is not
   * unreadable; its message says exactly what is wrong.
   */
  unreadable?: boolean;
  /** Other readings, offered as one-tap corrections. */
  suggestions?: IntakeSuggestion[];
}

/** The shape of `t` from lib/i18n-context, which this module must not import. */
export type IntakeTranslate = (key: string, params?: Record<string, string>) => string;

/* ── Result builders ─────────────────────────────────────────────────────── */

const EMPTY_RESULT: IntakeFieldResult = { status: "empty", value: "", display: "" };

function empty(): IntakeFieldResult {
  return { ...EMPTY_RESULT };
}

function message(key: IntakeMessageKey, params?: Record<string, IntakeText>): IntakeMessage {
  return params ? { key, params } : { key };
}

function asDate(value: string): IntakeText {
  return { kind: "date", value };
}

function asTime(value: string): IntakeText {
  return { kind: "time", value };
}

function settled(
  value: string,
  display: IntakeText,
  notes: IntakeMessage[],
): IntakeFieldResult {
  return notes.length
    ? { status: "corrected", value, display, messages: notes }
    : { status: "ok", value, display };
}

function ambiguous(
  value: string,
  display: IntakeText,
  messages: IntakeMessage[],
  suggestions: IntakeSuggestion[],
): IntakeFieldResult {
  return { status: "ambiguous", value, display, messages, suggestions };
}

function invalid(key: IntakeMessageKey, params?: Record<string, IntakeText>): IntakeFieldResult {
  return { status: "invalid", value: "", display: "", messages: [message(key, params)] };
}

/* Invalid because nothing in it could be read, as against read and found
 * impossible; the key is the field's format example. */
function unreadable(key: IntakeMessageKey): IntakeFieldResult {
  return { ...invalid(key), unreadable: true };
}

/**
 * The note for a field once the visitor takes one of the readings offered.
 *
 * Built here rather than in each form so that all of them say it in the same
 * words, from a key this module answers for.
 */
export function suggestionTaken(suggestion: IntakeSuggestion): IntakeFieldResult {
  return {
    status: "corrected",
    value: suggestion.value,
    display: suggestion.label,
    messages: [message("home.fieldNoteSetTo", { value: suggestion.label })],
  };
}

/* ── Digits ──────────────────────────────────────────────────────────────── */

/* The app is translated into Hindi and Bengali, and phone keyboards follow the
 * interface language, so a birth time can arrive in Devanagari or Bengali
 * digits. Fold every numeral system we plausibly see down to ASCII before
 * anything tries to parse it. */
const DIGIT_BLOCK_STARTS = [
  0x0660, // Arabic-Indic
  0x06f0, // Extended Arabic-Indic
  0x0966, // Devanagari
  0x09e6, // Bengali
  0x0a66, // Gurmukhi
  0x0ae6, // Gujarati
  0x0b66, // Oriya
  0x0be6, // Tamil
  0x0c66, // Telugu
  0x0ce6, // Kannada
  0x0d66, // Malayalam
  0x0e50, // Thai
  0xff10, // Fullwidth
];

export function toAsciiDigits(input: string): string {
  return input.replace(/\p{Nd}/gu, (character) => {
    const code = character.codePointAt(0);
    if (code === undefined) return character;
    for (const start of DIGIT_BLOCK_STARTS) {
      if (code >= start && code <= start + 9) return String(code - start);
    }
    return character;
  });
}

/* ── Birth time ──────────────────────────────────────────────────────────── */

function clock(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export interface BirthTimeOptions {
  /**
   * The text came off a 24-hour clock, so an hour with no AM or PM is that
   * hour and never one of two.
   *
   * For the value of a working native time input, which is always "HH:mm"
   * whatever its picker showed — the AM/PM wheel included. Not for anything a
   * person typed: a browser without native time support turns the input into
   * a text box (its `type` then reads "text"), and that text is as two-sided
   * as any other.
   */
  clock24?: boolean;
}

/**
 * Read a typed birth time in whatever clock the visitor thinks in.
 *
 * Accepts 24-hour and 12-hour forms, compact digits, and the separators people
 * actually reach for:
 *
 *   14:30   14.30   14 30   14h30   1430   2:30 PM   2:30pm   230p   noon
 *
 * Repairs rather than rejects wherever the intent survives the mistake:
 * "13:00 PM" keeps the 24-hour hour and drops the redundant tag, "24:00"
 * becomes midnight, "2:5" pads to 2:05, seconds are dropped.
 *
 * Where the input is genuinely two-sided — a bare 1–12 hour with no AM/PM —
 * it commits the literal reading and returns the other one as a suggestion.
 * Guessing here is not a small error: a twelve-hour slip moves the ascendant
 * by half the zodiac. Which is also why `clock24` exists: offering "10:30 PM"
 * beside a native input's "10:30" invites exactly that slip.
 */
export function normalizeBirthTime(
  raw: string,
  options: BirthTimeOptions = {},
): IntakeFieldResult {
  const trimmed = raw.trim();
  if (!trimmed) return empty();

  const notes: IntakeMessage[] = [];
  let text = toAsciiDigits(trimmed)
    .toLowerCase()
    .replace(/([ap])\s*\.\s*m\s*\.?/g, "$1m") // a.m. → am
    .replace(/\b(at|around|about|approx\.?|hrs?|hours?|o'?\s*clock)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/^(12\s*)?noon$|^mid[\s-]?day$/.test(text)) {
    return settled("12:00", asTime("12:00"), [
      message("home.fieldNoteNoon", { time: asTime("12:00") }),
    ]);
  }
  if (/^mid[\s-]?night$/.test(text)) {
    return settled("00:00", asTime("00:00"), [message("home.fieldNoteMidnight")]);
  }

  let meridiem: "am" | "pm" | null = null;
  const trailingMeridiem = /^(.*?)\s*(am|pm|a|p)\.?$/.exec(text);
  const leadingMeridiem = /^(am|pm)\.?\s*(.+)$/.exec(text);
  if (trailingMeridiem && /\d/.test(trailingMeridiem[1])) {
    meridiem = trailingMeridiem[2].startsWith("a") ? "am" : "pm";
    text = trailingMeridiem[1].trim();
  } else if (leadingMeridiem && /\d/.test(leadingMeridiem[2])) {
    meridiem = leadingMeridiem[1] as "am" | "pm";
    text = leadingMeridiem[2].trim();
  }

  /* "14h30" is how a good part of Europe writes a time. Fold the h into a
   * separator before the guard below, which rejects any letters left over. */
  text = text.replace(/(\d)\s*h\s*(?=\d|$)/g, "$1:").replace(/:$/, "");

  if (/[a-z]/.test(text)) {
    return unreadable("home.birthTimeFormatHint");
  }

  /* Any run of non-digits is a separator: ":" "." " " "-" all appear. */
  const body = text.replace(/\D+/g, ":").replace(/^:+|:+$/g, "");
  if (!body) return unreadable("home.birthTimeFormatHint");

  const separated = body.includes(":");
  let hourToken = "";
  let minuteToken = "";
  let secondToken = "";

  if (separated) {
    const parts = body.split(":");
    if (parts.length > 3) return unreadable("home.birthTimeFormatHint");
    hourToken = parts[0];
    minuteToken = parts[1] ?? "";
    secondToken = parts[2] ?? "";
  } else {
    /* Compact digit runs: 9 → 9:00, 930 → 9:30, 1430 → 14:30, 143045 with
     * seconds. Read from the right so the minutes are always the last pair. */
    switch (body.length) {
      case 1:
      case 2:
        hourToken = body;
        break;
      case 3:
        hourToken = body.slice(0, 1);
        minuteToken = body.slice(1);
        break;
      case 4:
        hourToken = body.slice(0, 2);
        minuteToken = body.slice(2);
        break;
      case 5:
        hourToken = body.slice(0, 1);
        minuteToken = body.slice(1, 3);
        secondToken = body.slice(3);
        break;
      case 6:
        hourToken = body.slice(0, 2);
        minuteToken = body.slice(2, 4);
        secondToken = body.slice(4);
        break;
      default:
        return unreadable("home.birthTimeFormatHint");
    }
  }

  if (!/^\d{1,2}$/.test(hourToken)) {
    return unreadable("home.birthTimeFormatHint");
  }
  if (minuteToken && !/^\d{1,2}$/.test(minuteToken)) {
    return invalid("home.fieldNoteMinutesRange");
  }
  if (secondToken && !/^\d{1,2}$/.test(secondToken)) {
    return unreadable("home.birthTimeFormatHint");
  }

  let hours = Number(hourToken);
  const minutes = minuteToken ? Number(minuteToken) : 0;

  if (minutes > 59) return invalid("home.fieldNoteMinutesRange");
  if (secondToken) notes.push(message("home.fieldNoteSecondsDropped"));
  if (!minuteToken) notes.push(message("home.fieldNoteMinutesAssumed"));
  else if (minuteToken.length === 1) {
    notes.push(message("home.fieldNoteMinutesPadded", { minutes: String(minutes).padStart(2, "0") }));
  }

  const suggestions: IntakeSuggestion[] = [];
  let ambiguity: IntakeMessage | null = null;

  if (meridiem === "pm") {
    if (hours === 0) {
      hours = 12;
      notes.push(message("home.fieldNoteZeroPm"));
    } else if (hours < 12) {
      hours += 12;
    } else if (hours > 12 && hours <= 23) {
      notes.push(message("home.fieldNotePmRedundant", { time: clock(hours, minutes) }));
    } else if (hours > 23) {
      return invalid("home.fieldNoteHoursRange12");
    }
  } else if (meridiem === "am") {
    if (hours === 12) {
      hours = 0;
      notes.push(message("home.fieldNoteTwelveAm"));
    } else if (hours > 12 && hours <= 23) {
      /* "13:45 AM" contradicts itself. The explicit hour is the more
       * deliberate half of the input, so it wins — but the visitor may equally
       * have meant 1:45 in the morning, so offer that. */
      const morning = clock(hours - 12, minutes);
      ambiguity = message("home.fieldNoteAmIgnored", { time: clock(hours, minutes) });
      suggestions.push({ value: morning, label: asTime(morning) });
    } else if (hours > 23) {
      return invalid("home.fieldNoteHoursRange12");
    }
  } else {
    if (hours === 24 && minutes === 0) {
      hours = 0;
      notes.push(message("home.fieldNoteTwentyFour"));
    } else if (hours > 23) {
      return invalid("home.fieldNoteHoursRange24");
    }

    /* A bare 1–12 hour is the one case we cannot settle — unless it came off
     * a 24-hour clock. A leading zero ("07:15") or a compact run ("0715",
     * "1430") signals 24-hour intent too, so only the plain forms are treated
     * as two-sided. */
    const writtenAsTwentyFourHour =
      options.clock24 ||
      (hourToken.length === 2 && hourToken.startsWith("0")) ||
      !separated;

    if (hours >= 1 && hours <= 12 && !writtenAsTwentyFourHour) {
      const alternate = hours === 12 ? clock(0, minutes) : clock(hours + 12, minutes);
      /* The time is quoted back as it was typed, give or take a padded
       * minute — "7:15", not the canonical "07:15" — so that in a language
       * whose clock runs to 24 hours it still reads differently from the
       * reading it was given, which comes out as "07:15" there. */
      ambiguity = message("home.fieldNoteTimeAmbiguous", {
        time: `${hours}:${String(minutes).padStart(2, "0")}`,
        reading: asTime(clock(hours, minutes)),
      });
      suggestions.push({ value: alternate, label: asTime(alternate) });
    }
  }

  const value = clock(hours, minutes);
  const display = asTime(value);

  if (suggestions.length) {
    return ambiguous(value, display, ambiguity ? [...notes, ambiguity] : notes, suggestions);
  }
  return settled(value, display, notes);
}

/* ── Birth date ──────────────────────────────────────────────────────────── */

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function monthFromName(token: string): number | null {
  const needle = token.toLowerCase();
  if (needle.length < 3) return null;
  const index = MONTH_NAMES.findIndex((month) => month.startsWith(needle));
  return index >= 0 ? index + 1 : null;
}

/* Build a local date only if the components survive the round-trip, which
 * rejects things like 31 February that Date would otherwise roll forward. */
function buildDate(year: number, month: number, day: number): Date | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1) return null;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

function isoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export interface BirthDateOptions {
  /** Upper bound; defaults to now. A birth date cannot be in the future. */
  today?: Date;
  /** Lower bound year; defaults to 1900, matching the picker. */
  minYear?: number;
}

/* A two-digit year has no safe reading on its own, but a *birth* year does:
 * the 20xx reading is only possible if it has already happened. */
function expandYear(token: string, today: Date): { year: number; notes: IntakeMessage[] } {
  const raw = Number(token);
  if (token.length === 4) return { year: raw, notes: [] };
  const thisCentury = 2000 + raw;
  const year = thisCentury <= today.getFullYear() ? thisCentury : 1900 + raw;
  return {
    year,
    notes: [message("home.fieldNoteYearExpanded", { typed: token, year: String(year) })],
  };
}

interface DateReading {
  year: number;
  month: number;
  day: number;
  notes: IntakeMessage[];
  /** The fallback reading of a numeric date, which has to say why it won. */
  monthFirst?: boolean;
}

/**
 * Read a typed birth date in whatever order the visitor writes dates.
 *
 *   1990-05-15   15/05/1990   15.05.1990   15 May 1990   May 15th, 1990
 *   15/05/90     15051990     19900515
 *
 * Numeric input is read day-first, matching the `dd MMM yyyy` display format
 * and the app's primary audience. Where day-first is impossible but
 * month-first works — "05/22/1990" — it falls back and says so. Where both
 * readings are real dates — "05/06/1990" — it commits day-first and offers the
 * other, because a silent guess here is a chart for the wrong day.
 */
export function normalizeBirthDate(
  raw: string,
  options: BirthDateOptions = {},
): IntakeFieldResult {
  const trimmed = raw.trim();
  if (!trimmed) return empty();

  const today = options.today ?? new Date();
  const minYear = options.minYear ?? 1900;
  const endOfToday = new Date(
    today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999,
  );

  const text = toAsciiDigits(trimmed)
    .toLowerCase()
    .replace(/^(born\s+on|born|dob)\b:?\s*/, "")
    .replace(/(\d)\s*(st|nd|rd|th)\b/g, "$1")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const readings: DateReading[] = [];

  const iso = /^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})$/.exec(text);
  const numeric = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4}|\d{2})$/.exec(text);
  const dayThenName = /^(\d{1,2})[-/. ]*([a-z]+)[-/. ]*(\d{4}|\d{2})$/.exec(text);
  const nameThenDay = /^([a-z]+)[-/. ]*(\d{1,2})[-/. ]*(\d{4}|\d{2})$/.exec(text);
  const digitsOnly = /^(\d{6}|\d{8})$/.exec(text);

  if (iso) {
    readings.push({ year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]), notes: [] });
  } else if (numeric) {
    const { year, notes } = expandYear(numeric[3], today);
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    readings.push({ year, month: second, day: first, notes });
    readings.push({ year, month: first, day: second, notes, monthFirst: true });
  } else if (dayThenName) {
    const month = monthFromName(dayThenName[2]);
    if (month) {
      const { year, notes } = expandYear(dayThenName[3], today);
      readings.push({ year, month, day: Number(dayThenName[1]), notes });
    }
  } else if (nameThenDay) {
    const month = monthFromName(nameThenDay[1]);
    if (month) {
      const { year, notes } = expandYear(nameThenDay[3], today);
      readings.push({ year, month, day: Number(nameThenDay[2]), notes });
    }
  } else if (digitsOnly) {
    const digits = digitsOnly[1];
    if (digits.length === 8) {
      const tail = Number(digits.slice(4));
      const head = Number(digits.slice(0, 4));
      const dayFirst: DateReading = {
        year: tail,
        month: Number(digits.slice(2, 4)),
        day: Number(digits.slice(0, 2)),
        notes: [message("home.fieldNoteDigitsDayFirst", { digits })],
      };
      const yearFirst: DateReading = {
        year: head,
        month: Number(digits.slice(4, 6)),
        day: Number(digits.slice(6)),
        notes: [message("home.fieldNoteDigitsYearFirst", { digits })],
      };
      /* Whichever end carries a plausible birth year is the year end. */
      if (tail >= minYear && tail <= today.getFullYear()) readings.push(dayFirst, yearFirst);
      else readings.push(yearFirst, dayFirst);
    } else {
      const { year } = expandYear(digits.slice(4), today);
      readings.push({
        year,
        month: Number(digits.slice(2, 4)),
        day: Number(digits.slice(0, 2)),
        notes: [message("home.fieldNoteDigitsDayFirst", { digits })],
      });
    }
  }

  if (!readings.length) {
    return unreadable("home.birthDateFormatHint");
  }

  const real = readings
    .map((reading) => ({ reading, date: buildDate(reading.year, reading.month, reading.day) }))
    .filter((entry): entry is { reading: DateReading; date: Date } => entry.date !== null);

  if (!real.length) {
    const first = readings[0];
    if (first.month >= 1 && first.month <= 12) {
      const daysInMonth = new Date(first.year, first.month, 0).getDate();
      if (first.day > daysInMonth) {
        return invalid("home.fieldNoteMonthLength", {
          month: {
            kind: "month",
            value: `${String(first.year).padStart(4, "0")}-${String(first.month).padStart(2, "0")}`,
          },
          days: String(daysInMonth),
        });
      }
    }
    return invalid("home.fieldNoteNotADate");
  }

  const inRange = real.filter(
    (entry) => entry.reading.year >= minYear && entry.date <= endOfToday,
  );

  if (!inRange.length) {
    const entry = real[0];
    if (entry.date > endOfToday) return invalid("home.fieldNoteFutureDate");
    return invalid("home.fieldNoteDateTooEarly", { year: String(minYear) });
  }

  const chosen = inRange[0];
  const value = isoDate(chosen.reading.year, chosen.reading.month, chosen.reading.day);
  const display = asDate(value);
  const notes = [...chosen.reading.notes];

  if (chosen.reading.monthFirst) {
    /* Day-first is the rule, so say why it gave way. Either the day-first
     * reading is a real date that has not happened yet — 08/09 typed in
     * August — or it is no date at all, which only happens when the second
     * number is past 12 and so cannot be its month. */
    const dayFirst = real.find((entry) => !entry.reading.monthFirst);
    notes.push(
      dayFirst
        ? message("home.fieldNoteMonthFirstFuture", {
            date: asDate(isoDate(dayFirst.reading.year, dayFirst.reading.month, dayFirst.reading.day)),
          })
        : message("home.fieldNoteMonthFirst", { number: String(chosen.reading.day) }),
    );
  }

  const alternates = inRange
    .slice(1)
    .map((entry) => isoDate(entry.reading.year, entry.reading.month, entry.reading.day))
    .filter((candidate) => candidate !== value);

  if (alternates.length) {
    return ambiguous(
      value,
      display,
      [...notes, message("home.fieldNoteDateAmbiguous", { date: asDate(alternates[0]) })],
      alternates.map((candidate) => ({ value: candidate, label: asDate(candidate) })),
    );
  }

  return settled(value, display, notes);
}

/* ── Names and places ────────────────────────────────────────────────────── */

/* Lower-cased in the middle of a name when we are re-casing it ourselves.
 * Only ever applied to input that arrived entirely in one case, so nobody's
 * deliberate spelling is overwritten. */
const NAME_PARTICLES = new Set([
  "de", "del", "della", "der", "den", "di", "du", "da", "das", "dos",
  "van", "von", "la", "le", "los", "las", "bin", "ibn", "al", "e", "y",
]);

const PLACE_MINOR_WORDS = new Set([
  ...NAME_PARTICLES,
  "of", "on", "upon", "the", "and", "in", "at", "a",
]);

function capitalizeSegment(segment: string): string {
  if (!segment) return segment;
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

/* Capitalise across hyphens and apostrophes too, so "jean-luc" and "o'brien"
 * come out right without any guessing about the rest of the word. */
function capitalizeWord(word: string): string {
  return word
    .split(/([-'’])/)
    .map((part) => (/^[-'’]$/.test(part) ? part : capitalizeSegment(part)))
    .join("");
}

function titleCase(input: string, minorWords: Set<string>): string {
  const words = input.split(" ");
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && minorWords.has(lower)) return lower;
      return capitalizeWord(lower);
    })
    .join(" ");
}

/* Re-case only when the visitor clearly was not casing at all — all lower or
 * all upper. Mixed case is a decision (McDonald, van der Berg, LaSalle) and is
 * left exactly as typed. */
function wasTypedWithoutCasing(value: string): boolean {
  if (!/\p{L}/u.test(value)) return false;
  return value === value.toLowerCase() || value === value.toUpperCase();
}

function tidyText(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/^[\s,;.]+/, "")
    .replace(/[\s,;]+$/, "")
    .trim();
}

/** Trim, collapse runaway spacing, and fix all-caps / all-lower names. */
export function normalizePersonName(raw: string): IntakeFieldResult {
  const tidied = tidyText(toAsciiDigits(raw));
  if (!tidied) return empty();

  const letters = tidied.replace(/[^\p{L}]/gu, "");
  if (letters.length < 2) {
    return invalid("home.fieldNoteNameTooShort");
  }

  const cased = wasTypedWithoutCasing(tidied) ? titleCase(tidied, NAME_PARTICLES) : tidied;

  const notes: IntakeMessage[] = [];
  if (tidied !== raw.trim()) notes.push(message("home.fieldNoteSpacing"));
  if (cased !== tidied) notes.push(message("home.fieldNoteCapitalised", { value: cased }));

  return settled(cased, cased, notes);
}

/** The same tidy-up for country, state and city names. */
export function normalizePlaceName(raw: string): IntakeFieldResult {
  const tidied = tidyText(toAsciiDigits(raw));
  if (!tidied) return empty();

  const cased = wasTypedWithoutCasing(tidied) ? titleCase(tidied, PLACE_MINOR_WORDS) : tidied;

  const notes: IntakeMessage[] = [];
  if (tidied !== raw.trim()) notes.push(message("home.fieldNoteSpacing"));
  if (cased !== tidied) notes.push(message("home.fieldNoteCapitalised", { value: cased }));

  return settled(cased, cased, notes);
}

/* ── A chosen place answers all three boxes ──────────────────────────────── */

/** The three boxes every intake form keeps for what is really one fact. */
export interface PlaceFields {
  city: string;
  state: string;
  country: string;
}

/** A chosen suggestion, and as much of the place around it as Nominatim knew. */
export interface PlaceSuggestion {
  name: string;
  state?: string;
  country?: string;
}

/**
 * Fold a chosen city back into the city, state and country boxes.
 *
 * The forms ask three questions to learn one fact, and someone who knows the
 * city often has to go and look up which state it is in to get past the other
 * two. They never had to: the suggestion the city was picked from carries its
 * own state and country, so choosing it answers all three at once.
 *
 * The suggestion is taken as the whole truth about the place, including where
 * a box already has something in it and where the suggestion is silent. That
 * is deliberate, and it is the more destructive of the two readings, so:
 * /api/geocode looks the place up as "city, state, country" joined into one
 * string, which means a state left behind by a previously chosen city does not
 * sit there harmlessly — it is fed to the geocoder as though it described this
 * one. Picking Singapore after Pune would otherwise search "Singapore,
 * Maharashtra, Singapore". Keeping the stale value is the likelier mistake and
 * the one with the worse ending, so an empty answer is allowed to empty the
 * box; the visitor can still type into it, and a blank required field asks to
 * be filled where a wrong one does not.
 */
export function applyPlaceSuggestion(
  current: PlaceFields,
  suggestion: PlaceSuggestion,
): PlaceFields {
  return {
    /* The one exception: the city is the thing that was actually clicked, so
       a nameless suggestion leaves it alone rather than blanking it. */
    city: suggestion.name.trim() || current.city,
    state: (suggestion.state ?? "").trim(),
    country: (suggestion.country ?? "").trim(),
  };
}

/* ── Coordinates ─────────────────────────────────────────────────────────── */

export type CoordinateAxis = "latitude" | "longitude";

const AXIS_LIMIT: Record<CoordinateAxis, number> = { latitude: 90, longitude: 180 };

function formatCoordinateDisplay(value: number, axis: CoordinateAxis): string {
  const hemisphere =
    axis === "latitude" ? (value < 0 ? "S" : "N") : value < 0 ? "W" : "E";
  return `${Math.abs(value).toFixed(4)}° ${hemisphere}`;
}

function roundCoordinate(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Read a coordinate however it was copied out of a map or an atlas.
 *
 *   40.7128   40,7128   -74.006   74.006 W   40° 42' 46" N   40 42 46 N
 *
 * The degrees/minutes/seconds forms matter because that is what printed
 * gazetteers and older birth records use, and pasting one into a plain number
 * field used to leave the field empty with no explanation.
 */
export function normalizeCoordinate(raw: string, axis: CoordinateAxis): IntakeFieldResult {
  const trimmed = raw.trim();
  if (!trimmed) return empty();

  const notes: IntakeMessage[] = [];
  let text = toAsciiDigits(trimmed)
    .toLowerCase()
    .replace(/\bnorth\b/g, "n")
    .replace(/\bsouth\b/g, "s")
    .replace(/\beast\b/g, "e")
    .replace(/\bwest\b/g, "w")
    .trim();

  let hemisphere: string | null = null;
  const trailing = /([nsew])\s*$/.exec(text);
  const leading = /^([nsew])\s*/.exec(text);
  if (trailing) {
    hemisphere = trailing[1];
    text = text.slice(0, trailing.index).trim();
  } else if (leading) {
    hemisphere = leading[1];
    text = text.slice(leading[0].length).trim();
  }

  if (/[a-z]/.test(text)) {
    return unreadable("home.fieldNoteCoordinateHint");
  }

  const negativeSign = /^[-−–]/.test(text);
  text = text.replace(/[-−–+]/g, " ").trim();

  /* A comma with no space around it is a decimal comma ("40,7128"); a comma
   * with a space is a list separator and belongs to normalizeCoordinatePair. */
  if (/^\d+,\d+$/.test(text)) {
    text = text.replace(",", ".");
    notes.push(message("home.fieldNoteDecimalComma"));
  }

  const tokens = text.split(/[^\d.]+/).filter(Boolean);
  if (!tokens.length || tokens.some((token) => !/^\d+(\.\d+)?$/.test(token))) {
    return unreadable("home.fieldNoteCoordinateHint");
  }

  let magnitude: number;
  if (tokens.length === 1) {
    magnitude = Number(tokens[0]);
  } else if (tokens.length <= 3) {
    const degrees = Number(tokens[0]);
    const minutes = Number(tokens[1]);
    const seconds = tokens.length === 3 ? Number(tokens[2]) : 0;
    if (minutes >= 60 || seconds >= 60) {
      return invalid("home.fieldNoteDmsRange");
    }
    magnitude = degrees + minutes / 60 + seconds / 3600;
    notes.push(message("home.fieldNoteDmsConverted"));
  } else {
    return unreadable("home.fieldNoteCoordinateHint");
  }

  const isNegative =
    negativeSign || hemisphere === "s" || hemisphere === "w";
  const value = roundCoordinate(isNegative ? -magnitude : magnitude);
  const limit = AXIS_LIMIT[axis];

  if (Math.abs(value) > limit) {
    if (axis === "latitude" && Math.abs(value) <= AXIS_LIMIT.longitude) {
      return invalid("home.fieldNoteLatitudeSwapped");
    }
    return invalid(
      axis === "latitude" ? "home.fieldNoteLatitudeRange" : "home.fieldNoteLongitudeRange",
      { limit: String(limit) },
    );
  }

  if (hemisphere === "s" || hemisphere === "w") {
    notes.push(message("home.fieldNoteHemisphereNegative", { letter: hemisphere.toUpperCase() }));
  }

  return settled(String(value), formatCoordinateDisplay(value, axis), notes);
}

/**
 * Recognise a whole coordinate pair pasted into one field.
 *
 * "12.9716, 77.5946" is what every map app puts on the clipboard, and it lands
 * in whichever box the visitor clicked first. Splitting it here fills both.
 * Returns null unless both halves parse and at least one carries a decimal
 * point or a hemisphere letter — "40 42" is degrees and minutes, not a pair.
 */
export function normalizeCoordinatePair(
  raw: string,
): { latitude: IntakeFieldResult; longitude: IntakeFieldResult } | null {
  const text = toAsciiDigits(raw).trim();
  if (!text) return null;

  const parts = text.includes(",")
    ? text.split(",")
    : text.includes(";")
      ? text.split(";")
      : text.includes("/")
        ? text.split("/")
        : text.split(/\s+/);

  if (parts.length !== 2) return null;

  const halves = parts.map((part) => part.trim()).filter(Boolean);
  if (halves.length !== 2) return null;
  if (!halves.some((half) => half.includes(".") || /[nsewNSEW]/.test(half))) return null;

  const latitude = normalizeCoordinate(halves[0], "latitude");
  const longitude = normalizeCoordinate(halves[1], "longitude");
  if (latitude.status === "invalid" || longitude.status === "invalid") return null;
  if (!latitude.value || !longitude.value) return null;

  return { latitude, longitude };
}

/* ── UTC offset ──────────────────────────────────────────────────────────── */

const OFFSET_MIN = -720;
const OFFSET_MAX = 840;

/** Render 330 as "UTC+05:30". */
export function formatUtcOffsetDisplay(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const absolute = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}

/**
 * Read a UTC offset written as hours, as hours and minutes, or as minutes.
 *
 *   330   +05:30   5:30   5.5   -8   UTC+5:30
 *
 * The field stores minutes, but half the world thinks in hours and India's
 * offset is not even a whole hour — so a bare number small enough to be an
 * hour count is read as hours and the conversion is reported.
 */
export function normalizeUtcOffsetMinutes(raw: string): IntakeFieldResult {
  const trimmed = raw.trim();
  if (!trimmed) return empty();

  const notes: IntakeMessage[] = [];
  let text = toAsciiDigits(trimmed)
    .toLowerCase()
    .replace(/\b(utc|gmt)\b/g, "")
    .replace(/\s+/g, "")
    .trim();

  const negative = /^[-−–]/.test(text);
  text = text.replace(/^[+\-−–]/, "");

  let minutes: number;

  const clockForm = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (clockForm) {
    const hourPart = Number(clockForm[1]);
    const minutePart = Number(clockForm[2]);
    if (minutePart > 59) return invalid("home.fieldNoteMinutesRange");
    minutes = hourPart * 60 + minutePart;
    notes.push(message("home.fieldNoteOffsetClock", { typed: clockForm[0], minutes: String(minutes) }));
  } else if (/^\d+(\.\d+)?$/.test(text)) {
    const numeric = Number(text);
    if (text.includes(".") || numeric <= 14) {
      minutes = Math.round(numeric * 60);
      notes.push(message("home.fieldNoteOffsetHours", { typed: text, minutes: String(minutes) }));
    } else {
      minutes = Math.round(numeric);
    }
  } else {
    return unreadable("home.fieldNoteOffsetHint");
  }

  if (negative) minutes = -minutes;

  if (minutes < OFFSET_MIN || minutes > OFFSET_MAX) {
    return invalid("home.fieldNoteOffsetRange", {
      min: String(OFFSET_MIN),
      max: String(OFFSET_MAX),
    });
  }

  return settled(String(minutes), formatUtcOffsetDisplay(minutes), notes);
}

/* ── Writing it out ──────────────────────────────────────────────────────── */

/*
 * English is written out by hand, every other language by Intl.
 *
 * Not for want of Intl's English. The intake writes a date day-first — "15
 * May 1990", the order the desktop picker shows and the order numeric input
 * is read in — where the interface's English locale, en-US, puts the month
 * first. And English is the one language these are ever rendered in on the
 * server (the provider holds every visitor at "en" until hydration is over),
 * so it is the one output that must come out identically in Node and in every
 * browser; built by hand, it cannot drift with the ICU version underneath.
 */
function isEnglish(locale: string): boolean {
  return /^en(-|$)/i.test(locale);
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/*
 * One formatter per locale and shape, since constructing an
 * Intl.DateTimeFormat is the expensive half of formatting with one.
 *
 * Latin digits in every language: the fields hold them, and so does every
 * number a note quotes back — a typed year, a count of minutes — so a Bengali
 * date in Bengali digits would switch numeral systems mid-sentence. UTC on
 * both sides, so no reader's own zone can move a calendar date.
 */
function formatter(
  locale: string,
  shape: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const id = `${locale}|${shape}`;
  let cached = formatters.get(id);
  if (!cached) {
    cached = new Intl.DateTimeFormat(locale, {
      ...options,
      numberingSystem: "latn",
      timeZone: "UTC",
    });
    formatters.set(id, cached);
  }
  return cached;
}

/* A UTC instant for a wall-clock moment, exact for any year (Date.UTC alone
 * reads 0–99 as 1900–1999). Null when the parts do not survive the round
 * trip — month 13, 31 February — rather than a date rolled forward. */
function utcMoment(year: number, month: number, day: number, hours = 0, minutes = 0): Date | null {
  const date = new Date(Date.UTC(2000, month - 1, day, hours, minutes));
  date.setUTCFullYear(year);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}

/** Render "1990-05-15" as "15 May 1990", or as the locale writes it: "15 mai 1990". */
export function formatBirthDateDisplay(value: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = utcMoment(year, month, day);
  if (!date) return value;

  if (isEnglish(locale)) return `${day} ${MONTH_SHORT[month - 1]} ${match[1]}`;
  return formatter(locale, "date", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

/**
 * Render "14:30" as "2:30 PM", or as the locale writes the time.
 *
 * That is a 24-hour clock in Spanish, Italian and French, and those get a
 * two-digit hour: "02:30" there is plainly the small hours, where "2:30"
 * could be read either way — and saying which half of the day a time means is
 * most of what this read-out is for.
 */
export function formatClockDisplay(value: string, locale: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return value;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return value;

  if (isEnglish(locale)) {
    const meridiem = hours < 12 ? "AM" : "PM";
    const twelve = hours % 12 === 0 ? 12 : hours % 12;
    return `${twelve}:${match[2]} ${meridiem}`;
  }

  const moment = utcMoment(2000, 1, 1, hours, minutes);
  if (!moment) return value;
  const twelveHour = formatter(locale, "hour", { hour: "numeric" }).resolvedOptions().hour12;
  const shape = twelveHour
    ? formatter(locale, "time12", { hour: "numeric", minute: "2-digit" })
    : formatter(locale, "time24", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return shape.format(moment);
}

/* Render "1990-02" as "February 1990", for a note about the month itself. */
function formatMonthDisplay(value: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = utcMoment(year, month, 1);
  if (!date) return value;

  if (isEnglish(locale)) return `${capitalizeSegment(MONTH_NAMES[month - 1])} ${year}`;
  return formatter(locale, "month", { month: "long", year: "numeric" }).format(date);
}

/** Write any IntakeText out for a BCP-47 locale — one of LOCALE_TAGS. */
export function formatIntakeText(text: IntakeText, locale: string): string {
  if (typeof text === "string") return text;
  switch (text.kind) {
    case "date":
      return formatBirthDateDisplay(text.value, locale);
    case "time":
      return formatClockDisplay(text.value, locale);
    case "month":
      return formatMonthDisplay(text.value, locale);
  }
}

/**
 * A result's messages as the sentences a form shows: each key through `t`,
 * each parameter written out for the locale, one sentence after another.
 */
export function formatIntakeMessages(
  messages: readonly IntakeMessage[],
  t: IntakeTranslate,
  locale: string,
): string {
  return messages
    .map(({ key, params }) =>
      t(
        key,
        params &&
          Object.fromEntries(
            Object.entries(params).map(([name, text]) => [name, formatIntakeText(text, locale)]),
          ),
      ),
    )
    .join(" ");
}
