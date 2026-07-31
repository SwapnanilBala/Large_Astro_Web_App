"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import styles from "./PremiumDatePicker.module.css";

export function parseLocalIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

const MONTH_NAMES = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

/* Build a local date only if the components survive the round-trip, which
 * rejects things like 31 February that Date would otherwise roll forward. */
function buildDate(year: number, month: number, day: number): Date | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

/**
 * Parse a typed birth date leniently.
 *
 * react-datepicker only accepts text matching its own `dateFormat`, so
 * "15/05/1990" parsed to null and was discarded on blur without a word to
 * the user. Everything below is a format a person plausibly types:
 *
 *   1990-05-15   ISO
 *   15/05/1990   day-first with / - or .
 *   15 May 1990  day then month name
 *   May 15 1990  month name then day
 *
 * Numeric input is read day-first, matching the `dd MMM yyyy` display format
 * and the app's primary audience. Where day-first is impossible but
 * month-first works — "05/22/1990" — we fall back rather than reject, since
 * that ordering is unambiguous. Years must be four digits: a two-digit birth
 * year cannot be disambiguated safely, so it is rejected rather than guessed.
 */
export function parseFlexibleDate(value: string): Date | null {
  const raw = value.trim();
  if (!raw) return null;

  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(raw);
  if (iso) return buildDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const numeric = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(raw);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const year = Number(numeric[3]);
    return buildDate(year, second, first) ?? buildDate(year, first, second);
  }

  const named = /^(\d{1,2})[\s-]*([a-z]+)[\s,-]*(\d{4})$/i.exec(raw);
  if (named) {
    const month = MONTH_NAMES.indexOf(named[2].slice(0, 3).toLowerCase());
    if (month >= 0) return buildDate(Number(named[3]), month + 1, Number(named[1]));
  }

  const namedFirst = /^([a-z]+)[\s-]*(\d{1,2})[\s,-]*(\d{4})$/i.exec(raw);
  if (namedFirst) {
    const month = MONTH_NAMES.indexOf(namedFirst[1].slice(0, 3).toLowerCase());
    if (month >= 0) return buildDate(Number(namedFirst[3]), month + 1, Number(namedFirst[2]));
  }

  return null;
}

/**
 * Parse a typed birth time leniently, returning today's date carrying the
 * parsed clock time — the shape react-datepicker's time mode expects.
 *
 *   14:30   2:30pm   2:30 PM   1430   14.30
 *
 * Minute precision matters here: the ascendant advances about one degree
 * every four minutes, so rounding a birth time to the picker's dropdown
 * steps is a real loss of accuracy, not a convenience trade.
 */
export function parseFlexibleTime(value: string): Date | null {
  const raw = value.trim().toLowerCase();
  if (!raw) return null;

  const match = /^(\d{1,2})[:.\s]?(\d{2})?\s*(am|pm)?$/.exec(raw);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = match[2] === undefined ? 0 : Number(match[2]);
  const meridiem = match[3];

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (minutes > 59) return null;

  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === "pm" && hours !== 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;
  } else if (hours > 23) {
    /* Bare four-digit input such as "1430". */
    const compact = /^(\d{2})(\d{2})$/.exec(raw);
    if (!compact) return null;
    const ch = Number(compact[1]);
    const cm = Number(compact[2]);
    if (ch > 23 || cm > 59) return null;
    const bare = new Date();
    bare.setHours(ch, cm, 0, 0);
    return bare;
  }

  if (hours > 23) return null;

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

interface PremiumDatePickerProps {
  id?: string;
  name?: string;
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  completed?: boolean;
  error?: string;
  disabled?: boolean;
  showTimeSelect?: boolean;
  showTimeSelectOnly?: boolean;
  dateFormat?: string;
  required?: boolean;
  maxDate?: Date;
  timeIntervals?: number;
  timeCaption?: string;
  showYearDropdown?: boolean;
  showMonthDropdown?: boolean;
  yearDropdownItemNumber?: number;
  minDate?: Date;
  autoComplete?: string;
  /** Message shown when typed text cannot be parsed. Defaults per field type. */
  formatHint?: string;
}

export default function PremiumDatePicker({
  id,
  name,
  label,
  value,
  onChange,
  placeholder = "",
  icon,
  completed,
  error,
  disabled = false,
  showTimeSelect = false,
  showTimeSelectOnly = false,
  dateFormat = "MMMM d, yyyy",
  required = false,
  maxDate,
  timeIntervals = 15,
  timeCaption = "Time",
  showYearDropdown = false,
  showMonthDropdown = false,
  yearDropdownItemNumber = 100,
  minDate,
  autoComplete,
  formatHint,
}: PremiumDatePickerProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isFilled, setIsFilled] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const typedTextRef = useRef("");
  const calendarRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const inputId = id ?? `premium-date-picker-${generatedId}`;
  const errorId = `${inputId}-error`;

  const parseTyped = (text: string) =>
    showTimeSelectOnly ? parseFlexibleTime(text) : parseFlexibleDate(text);

  const defaultHint = showTimeSelectOnly
    ? "Enter a time like 14:30 or 2:30 PM."
    : "Enter a date like 15/05/1990, 1990-05-15, or 15 May 1990.";

  useEffect(() => {
    setIsFilled(value !== null);
    if (value !== null) {
      typedTextRef.current = "";
      setParseError(null);
    }
  }, [value]);

  const handleFocus = () => setIsFocused(true);

  /* Commit and validate once the user is done, not per keystroke.
   *
   * Two reasons this is deferred rather than immediate. react-datepicker owns
   * the input's value while it is focused, so setting `selected` mid-typing
   * makes it render the formatted date *alongside* the characters still in its
   * own buffer ("15 May 199015/05/1990"). And a half-typed date should not be
   * reported as invalid while the user is still typing it. */
  const commitTypedText = () => {
    const text = typedTextRef.current.trim();
    if (!text) {
      setParseError(null);
      return;
    }
    const parsed = parseTyped(text);
    if (parsed) {
      setParseError(null);
      handleChange(parsed);
    } else {
      setParseError(formatHint ?? defaultHint);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    commitTypedText();
  };

  const handleCalendarClose = () => {
    commitTypedText();
  };

  /* react-datepicker 9 gates its onBlur forwarding on the calendar being
   * closed:
   *
   *     if (!this.state.open || withPortal || showTimeInput) props.onBlur?.(e)
   *
   * Typing holds the calendar open, so the blur that actually matters is
   * never forwarded — and onCalendarClose does not fire either when focus
   * moves away programmatically. Rather than depend on which of its
   * callbacks happens to fire, listen for the DOM blur on the input itself.
   *
   * This reads typedTextRef rather than input.value, so it does not race
   * react-datepicker's own habit of clearing the field on an unparseable
   * blur — by then our copy of what the user typed is already recorded. */
  const commitRef = useRef(commitTypedText);

  useEffect(() => {
    commitRef.current = commitTypedText;
  });

  useEffect(() => {
    const input = calendarRef.current?.querySelector("input");
    if (!input) return;
    const onNativeBlur = () => commitRef.current();
    input.addEventListener("blur", onNativeBlur);
    return () => input.removeEventListener("blur", onNativeBlur);
  }, []);

  const handleChange = (date: Date | null) => {
    onChange(date);
    setIsFilled(date !== null);
    if (date) {
      typedTextRef.current = "";
      setParseError(null);
    }
  };

  const handleRawChange = (
    event?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
  ) => {
    const target = event?.target;
    if (!(target instanceof HTMLInputElement)) return;

    /* Record only. The commit happens in commitTypedText. */
    typedTextRef.current = target.value;
    if (!target.value.trim()) setParseError(null);
  };

  const visibleError = error ?? parseError ?? undefined;
  const isComplete = (completed ?? isFilled) && !visibleError && !disabled;
  const inputClasses = [
    styles.datePickerInput,
    icon ? styles.withIcon : "",
    isComplete ? styles.withSuccess : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`${styles.premiumDatePicker} ${isFocused ? styles.focused : ""} ${visibleError ? styles.error : ""} ${
        isComplete ? styles.complete : ""
      } ${disabled ? styles.disabled : ""}`}
    >
      <label className={styles.fieldLabel} htmlFor={inputId}>
        {label}
        {required && <span className={styles.requiredDot} aria-hidden="true">*</span>}
      </label>
      <div className={styles.datePickerWrapper} ref={calendarRef}>
        {icon && (
          <span className={styles.leadingIcon} aria-hidden="true">
            {icon}
          </span>
        )}
        <DatePicker
          id={inputId}
          name={name}
          selected={value}
          onChange={handleChange}
          onChangeRaw={handleRawChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onCalendarClose={handleCalendarClose}
          placeholderText={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          showTimeSelect={showTimeSelect}
          showTimeSelectOnly={showTimeSelectOnly}
          dateFormat={dateFormat}
          required={required}
          ariaRequired={required ? "true" : undefined}
          ariaInvalid={visibleError ? "true" : undefined}
          ariaDescribedBy={visibleError ? errorId : undefined}
          maxDate={maxDate}
          minDate={minDate}
          timeIntervals={timeIntervals}
          timeCaption={timeCaption}
          showYearDropdown={showYearDropdown}
          showMonthDropdown={showMonthDropdown}
          yearDropdownItemNumber={yearDropdownItemNumber}
          className={inputClasses}
          calendarClassName={styles.calendarPopup}
          popperClassName={styles.popper}
          wrapperClassName={styles.datePickerWrapperInner}
        />
        <span
          className={styles.successBadge}
          aria-hidden={!isComplete}
          aria-label={isComplete ? `${label} complete` : undefined}
          role={isComplete ? "status" : undefined}
        >
          <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
            <path d="M6.7 11.3 3.4 8l1.2-1.2 2.1 2.1 4.7-4.7L12.6 5z" />
          </svg>
        </span>
        <div className={styles.datePickerBorder} />
        <div className={styles.datePickerGlow} />
      </div>
      {visibleError && (
        <div id={errorId} className={styles.errorMessage} role="alert">
          {visibleError}
        </div>
      )}
    </div>
  );
}
