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
  /** Not usable; `value` is empty and `message` explains why. */
  | "invalid";

export interface IntakeSuggestion {
  /** Canonical value committed when the visitor picks this reading. */
  value: string;
  /** Chip label, written the way a person reads it. */
  label: string;
}

export interface IntakeFieldResult {
  status: IntakeFieldStatus;
  /** Canonical value for the app, or "" when nothing usable came out. */
  value: string;
  /** The canonical value written the way a person reads it. */
  display: string;
  /** What was repaired, what is still ambiguous, or why it was rejected. */
  message?: string;
  /** Other readings, offered as one-tap corrections. */
  suggestions?: IntakeSuggestion[];
}

/* ── Result builders ─────────────────────────────────────────────────────── */

const EMPTY_RESULT: IntakeFieldResult = { status: "empty", value: "", display: "" };

function empty(): IntakeFieldResult {
  return { ...EMPTY_RESULT };
}

function settled(
  value: string,
  display: string,
  notes: string[],
): IntakeFieldResult {
  return notes.length
    ? { status: "corrected", value, display, message: notes.join(" ") }
    : { status: "ok", value, display };
}

function ambiguous(
  value: string,
  display: string,
  message: string,
  suggestions: IntakeSuggestion[],
): IntakeFieldResult {
  return { status: "ambiguous", value, display, message, suggestions };
}

function invalid(message: string): IntakeFieldResult {
  return { status: "invalid", value: "", display: "", message };
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

/** Render "14:30" as "2:30 PM". */
export function formatClockDisplay(value: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return value;

  const hours = Number(match[1]);
  const meridiem = hours < 12 ? "AM" : "PM";
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelve}:${match[2]} ${meridiem}`;
}

function clock(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
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
 * by half the zodiac.
 */
export function normalizeBirthTime(raw: string): IntakeFieldResult {
  const trimmed = raw.trim();
  if (!trimmed) return empty();

  const notes: string[] = [];
  let text = toAsciiDigits(trimmed)
    .toLowerCase()
    .replace(/([ap])\s*\.\s*m\s*\.?/g, "$1m") // a.m. → am
    .replace(/\b(at|around|about|approx\.?|hrs?|hours?|o'?\s*clock)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/^(12\s*)?noon$|^mid[\s-]?day$/.test(text)) {
    return settled("12:00", "12:00 PM", ["Noon is 12:00 PM."]);
  }
  if (/^mid[\s-]?night$/.test(text)) {
    return settled("00:00", "12:00 AM", ["Midnight is 00:00."]);
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
    return invalid("Try a time like 14:30, 2:30 PM, or 1430.");
  }

  /* Any run of non-digits is a separator: ":" "." " " "-" all appear. */
  const body = text.replace(/\D+/g, ":").replace(/^:+|:+$/g, "");
  if (!body) return invalid("Try a time like 14:30, 2:30 PM, or 1430.");

  const separated = body.includes(":");
  let hourToken = "";
  let minuteToken = "";
  let secondToken = "";

  if (separated) {
    const parts = body.split(":");
    if (parts.length > 3) return invalid("Try a time like 14:30, 2:30 PM, or 1430.");
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
        return invalid("Try a time like 14:30, 2:30 PM, or 1430.");
    }
  }

  if (!/^\d{1,2}$/.test(hourToken)) {
    return invalid("Try a time like 14:30, 2:30 PM, or 1430.");
  }
  if (minuteToken && !/^\d{1,2}$/.test(minuteToken)) {
    return invalid("Minutes only run from 00 to 59.");
  }
  if (secondToken && !/^\d{1,2}$/.test(secondToken)) {
    return invalid("Try a time like 14:30, 2:30 PM, or 1430.");
  }

  let hours = Number(hourToken);
  const minutes = minuteToken ? Number(minuteToken) : 0;

  if (minutes > 59) return invalid("Minutes only run from 00 to 59.");
  if (secondToken) notes.push("Seconds are not used, so they were dropped.");
  if (!minuteToken) notes.push("No minutes were given, so :00 was used.");
  else if (minuteToken.length === 1) {
    notes.push(`Minutes read as :${String(minutes).padStart(2, "0")}.`);
  }

  const suggestions: IntakeSuggestion[] = [];
  let ambiguityMessage = "";

  if (meridiem === "pm") {
    if (hours === 0) {
      hours = 12;
      notes.push("0 PM is not a clock time, so it was read as 12 noon.");
    } else if (hours < 12) {
      hours += 12;
    } else if (hours > 12 && hours <= 23) {
      notes.push(`PM was redundant — ${clock(hours, minutes)} is already afternoon.`);
    } else if (hours > 23) {
      return invalid("Hours only run from 1 to 12 with AM or PM.");
    }
  } else if (meridiem === "am") {
    if (hours === 12) {
      hours = 0;
      notes.push("12 AM is midnight, so it was read as 00:00.");
    } else if (hours > 12 && hours <= 23) {
      /* "13:45 AM" contradicts itself. The explicit hour is the more
       * deliberate half of the input, so it wins — but the visitor may equally
       * have meant 1:45 in the morning, so offer that. */
      ambiguityMessage = `${clock(hours, minutes)} already reads as afternoon, so the AM was ignored.`;
      suggestions.push({
        value: clock(hours - 12, minutes),
        label: formatClockDisplay(clock(hours - 12, minutes)),
      });
    } else if (hours > 23) {
      return invalid("Hours only run from 1 to 12 with AM or PM.");
    }
  } else {
    if (hours === 24 && minutes === 0) {
      hours = 0;
      notes.push("24:00 is midnight, so it was read as 00:00.");
    } else if (hours > 23) {
      return invalid("Hours only run from 0 to 23. Add AM or PM for a 12-hour time.");
    }

    /* A bare 1–12 hour is the one case we cannot settle. A leading zero
     * ("07:15") or a compact run ("0715", "1430") signals 24-hour intent, so
     * only the plain forms are treated as two-sided. */
    const writtenAsTwentyFourHour =
      (hourToken.length === 2 && hourToken.startsWith("0")) || !separated;

    if (hours >= 1 && hours <= 12 && !writtenAsTwentyFourHour) {
      const alternate = hours === 12 ? clock(0, minutes) : clock(hours + 12, minutes);
      ambiguityMessage = `${clock(hours, minutes)} could be morning or evening — read as ${formatClockDisplay(clock(hours, minutes))}.`;
      suggestions.push({ value: alternate, label: formatClockDisplay(alternate) });
    }
  }

  const value = clock(hours, minutes);
  const display = formatClockDisplay(value);

  if (suggestions.length) {
    return ambiguous(
      value,
      display,
      [...notes, ambiguityMessage].filter(Boolean).join(" "),
      suggestions,
    );
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

/** Render "1990-05-15" as "15 May 1990". */
export function formatBirthDateDisplay(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${Number(match[3])} ${MONTH_SHORT[Number(match[2]) - 1]} ${match[1]}`;
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
function expandYear(token: string, today: Date): { year: number; note?: string } {
  const raw = Number(token);
  if (token.length === 4) return { year: raw };
  const thisCentury = 2000 + raw;
  const year = thisCentury <= today.getFullYear() ? thisCentury : 1900 + raw;
  return { year, note: `The year "${token}" was read as ${year}.` };
}

interface DateReading {
  year: number;
  month: number;
  day: number;
  note?: string;
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
    readings.push({ year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) });
  } else if (numeric) {
    const { year, note } = expandYear(numeric[3], today);
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    readings.push({ year, month: second, day: first, note });
    readings.push({
      year,
      month: first,
      day: second,
      note: [note, `Read month-first, because ${second} cannot be a day of the month.`]
        .filter(Boolean)
        .join(" "),
    });
  } else if (dayThenName) {
    const month = monthFromName(dayThenName[2]);
    if (month) {
      const { year, note } = expandYear(dayThenName[3], today);
      readings.push({ year, month, day: Number(dayThenName[1]), note });
    }
  } else if (nameThenDay) {
    const month = monthFromName(nameThenDay[1]);
    if (month) {
      const { year, note } = expandYear(nameThenDay[3], today);
      readings.push({ year, month, day: Number(nameThenDay[2]), note });
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
        note: `Read "${digits}" as day, month, year.`,
      };
      const yearFirst: DateReading = {
        year: head,
        month: Number(digits.slice(4, 6)),
        day: Number(digits.slice(6)),
        note: `Read "${digits}" as year, month, day.`,
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
        note: `Read "${digits}" as day, month, year.`,
      });
    }
  }

  if (!readings.length) {
    return invalid("Try a date like 15/05/1990, 1990-05-15, or 15 May 1990.");
  }

  const real = readings
    .map((reading) => ({ reading, date: buildDate(reading.year, reading.month, reading.day) }))
    .filter((entry): entry is { reading: DateReading; date: Date } => entry.date !== null);

  if (!real.length) {
    const first = readings[0];
    if (first.month >= 1 && first.month <= 12) {
      const daysInMonth = new Date(first.year, first.month, 0).getDate();
      if (first.day > daysInMonth) {
        return invalid(
          `${MONTH_NAMES[first.month - 1].replace(/^./, (c) => c.toUpperCase())} ${first.year} only has ${daysInMonth} days.`,
        );
      }
    }
    return invalid("That is not a real calendar date.");
  }

  const inRange = real.filter(
    (entry) => entry.reading.year >= minYear && entry.date <= endOfToday,
  );

  if (!inRange.length) {
    const entry = real[0];
    if (entry.date > endOfToday) return invalid("A birth date cannot be in the future.");
    return invalid(`Dates before ${minYear} are not supported.`);
  }

  const chosen = inRange[0];
  const value = isoDate(chosen.reading.year, chosen.reading.month, chosen.reading.day);
  const display = formatBirthDateDisplay(value);
  const notes = chosen.reading.note ? [chosen.reading.note] : [];

  const alternates = inRange
    .slice(1)
    .map((entry) => isoDate(entry.reading.year, entry.reading.month, entry.reading.day))
    .filter((candidate) => candidate !== value);

  if (alternates.length) {
    return ambiguous(
      value,
      display,
      [...notes, `That could also read as ${formatBirthDateDisplay(alternates[0])}.`].join(" "),
      alternates.map((candidate) => ({
        value: candidate,
        label: formatBirthDateDisplay(candidate),
      })),
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
    return invalid("A name needs at least two letters.");
  }

  const cased = wasTypedWithoutCasing(tidied) ? titleCase(tidied, NAME_PARTICLES) : tidied;

  const notes: string[] = [];
  if (tidied !== raw.trim()) notes.push("Extra spacing was tidied up.");
  if (cased !== tidied) notes.push(`Capitalised as "${cased}".`);

  return settled(cased, cased, notes);
}

/** The same tidy-up for country, state and city names. */
export function normalizePlaceName(raw: string): IntakeFieldResult {
  const tidied = tidyText(toAsciiDigits(raw));
  if (!tidied) return empty();

  const cased = wasTypedWithoutCasing(tidied) ? titleCase(tidied, PLACE_MINOR_WORDS) : tidied;

  const notes: string[] = [];
  if (tidied !== raw.trim()) notes.push("Extra spacing was tidied up.");
  if (cased !== tidied) notes.push(`Capitalised as "${cased}".`);

  return settled(cased, cased, notes);
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

  const notes: string[] = [];
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
    return invalid("Try a coordinate like 40.7128, or 40° 42' 46\" N.");
  }

  const negativeSign = /^[-−–]/.test(text);
  text = text.replace(/[-−–+]/g, " ").trim();

  /* A comma with no space around it is a decimal comma ("40,7128"); a comma
   * with a space is a list separator and belongs to normalizeCoordinatePair. */
  if (/^\d+,\d+$/.test(text)) {
    text = text.replace(",", ".");
    notes.push("The comma was read as a decimal point.");
  }

  const tokens = text.split(/[^\d.]+/).filter(Boolean);
  if (!tokens.length || tokens.some((token) => !/^\d+(\.\d+)?$/.test(token))) {
    return invalid("Try a coordinate like 40.7128, or 40° 42' 46\" N.");
  }

  let magnitude: number;
  if (tokens.length === 1) {
    magnitude = Number(tokens[0]);
  } else if (tokens.length <= 3) {
    const degrees = Number(tokens[0]);
    const minutes = Number(tokens[1]);
    const seconds = tokens.length === 3 ? Number(tokens[2]) : 0;
    if (minutes >= 60 || seconds >= 60) {
      return invalid("Minutes and seconds only run from 0 to 59.");
    }
    magnitude = degrees + minutes / 60 + seconds / 3600;
    notes.push("Degrees, minutes and seconds were converted to decimal degrees.");
  } else {
    return invalid("Try a coordinate like 40.7128, or 40° 42' 46\" N.");
  }

  const isNegative =
    negativeSign || hemisphere === "s" || hemisphere === "w";
  const value = roundCoordinate(isNegative ? -magnitude : magnitude);
  const limit = AXIS_LIMIT[axis];

  if (Math.abs(value) > limit) {
    if (axis === "latitude" && Math.abs(value) <= AXIS_LIMIT.longitude) {
      return invalid("Latitude only runs from -90 to 90 — is this the longitude?");
    }
    return invalid(`${axis === "latitude" ? "Latitude" : "Longitude"} only runs from -${limit} to ${limit}.`);
  }

  if (hemisphere === "s" || hemisphere === "w") {
    notes.push(`${hemisphere.toUpperCase()} was read as a negative value.`);
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

  const notes: string[] = [];
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
    if (minutePart > 59) return invalid("Minutes only run from 00 to 59.");
    minutes = hourPart * 60 + minutePart;
    notes.push(`${clockForm[0]} was read as ${minutes} minutes.`);
  } else if (/^\d+(\.\d+)?$/.test(text)) {
    const numeric = Number(text);
    if (text.includes(".") || numeric <= 14) {
      minutes = Math.round(numeric * 60);
      notes.push(`${text} was read as hours, which is ${minutes} minutes.`);
    } else {
      minutes = Math.round(numeric);
    }
  } else {
    return invalid("Try an offset like 330, +05:30, or 5.5.");
  }

  if (negative) minutes = -minutes;

  if (minutes < OFFSET_MIN || minutes > OFFSET_MAX) {
    return invalid(`A UTC offset runs from ${OFFSET_MIN} to ${OFFSET_MAX} minutes.`);
  }

  return settled(String(minutes), formatUtcOffsetDisplay(minutes), notes);
}
