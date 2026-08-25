"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useId } from "react";
import DatePicker from "react-datepicker";
import { shift, size } from "@floating-ui/react";
import "react-datepicker/dist/react-datepicker.css";
import {
  normalizeBirthDate,
  normalizeBirthTime,
  type IntakeFieldResult,
  type IntakeSuggestion,
} from "@/lib/intake-normalize";
import styles from "./PremiumDatePicker.module.css";

/*
 * Keep the calendar on screen.
 *
 * react-datepicker installs [flip, offset, arrow] and nothing else, so a
 * placement that does not fit is flipped but never nudged back or resized. The
 * calendar is 409px tall and the field it hangs off sits mid-page, so on a
 * 700px-tall window it flipped above the input and rendered at top:-70 — the
 * month and year controls off the top of the screen with no way to reach them.
 *
 * `shift` pushes it back inside the viewport; `size` then caps its height to
 * whatever room is actually left, published as a custom property that
 * .calendarPopup turns into a max-height. The 220px floor is there so a very
 * short window gets a scrollable calendar rather than a sliver.
 *
 * Appended after the library's own middleware, which is the order Floating UI
 * wants: flip decides, shift corrects, size measures what is left. It lands
 * after `arrow` too, which would matter if an arrow were rendered — this
 * component does not pass showArrow.
 *
 * Declared once at module scope: these are recreated on every render if
 * inlined, and a new middleware array each render restarts the position
 * calculation.
 */
/*
 * Opens upward, over the form's own content, because the step's primary action
 * sits directly below the field.
 *
 * react-datepicker defaults to bottom-start and only flips when that does not
 * fit, so on a roomy window the calendar had 499px of space above it, took the
 * 421px below instead, and landed on the Continue button — a 280x74 overlap.
 * Ranking the button above it, which is what I did first, only decides which
 * one wins the pixels; both are still there, and the button reads as punched
 * through the calendar. Above the field there is nothing but the question
 * heading, which the calendar is welcome to cover while it is open.
 *
 * `flip` still sends it back down if there is genuinely no room above, and
 * `size` shrinks it either way, so this is a preference rather than a lock.
 */
/*
 * Fixed rather than absolute, so overflow detection is against the viewport.
 *
 * .professionalIntake on the intake route sets `overflow: clip visible`. With
 * overflow-y visible that ancestor does not clip vertically, so Floating UI's
 * clipping rect ran past the top of the screen: with the field scrolled to
 * y=0 it still reported 506px of room above, `flip` saw no reason to flip and
 * `size` no reason to shrink, and the calendar rendered at top:-390 — wholly
 * off screen. Positioning fixed makes the containing block the viewport, which
 * is the boundary the measurements should have been using all along.
 *
 * autoUpdate is already wired up by react-datepicker's whileElementsMounted,
 * so the popup still tracks the field on scroll.
 */
const POPPER_PROPS = { strategy: "fixed" } as const;

/* react-datepicker's own offset(10) between the field and the popup. */
const POPUP_OFFSET = 10;

/*
 * Stand-in height for the room check below, used only when the popup cannot be
 * measured yet. onCalendarOpen fires before the popup has been laid out often
 * enough to matter — it happened on the first open at 420px and not at 600px,
 * which is the kind of difference that should not decide whether a fix works.
 * Measuring is still preferred; this is the floor under it, and it only has to
 * be close: asking for slightly too much room costs a few pixels of scroll.
 */
const POPUP_FALLBACK_HEIGHT = 372;

const POPPER_MODIFIERS = [
  /*
   * Horizontal only, which is `shift`'s default for a top/bottom placement.
   * crossAxis:true was tried and reverted: it does keep the calendar out of
   * the viewport edge, but it does so by sliding it along the axis that points
   * at the primary action, so the calendar ended up over the Continue button
   * with the button punching back through it. The vertical fit is `size`'s job
   * below — shrink the calendar to the room available rather than move it
   * somewhere there is more.
   */
  shift({ padding: 8 }),
  size({
    padding: 8,
    apply({ availableHeight, elements }) {
      elements.floating.style.setProperty(
        "--dp-available-height",
        `${Math.max(Math.round(availableHeight), 220)}px`
      );
    },
  }),
];

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

/** Turn a canonical "HH:MM" into today's date carrying that clock time. */
export function parseLocalClockTime(value: string): Date | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date;
}

/**
 * Parse a typed birth date leniently.
 *
 * react-datepicker only accepts text matching its own `dateFormat`, so
 * "15/05/1990" parsed to null and was discarded on blur without a word to the
 * user. The reading rules — and the repairs applied along the way — live in
 * lib/intake-normalize so the mobile intake and the compatibility form apply
 * exactly the same ones.
 */
export function parseFlexibleDate(value: string): Date | null {
  const result = normalizeBirthDate(value);
  return result.value ? parseLocalIsoDate(result.value) : null;
}

/**
 * Parse a typed birth time leniently, returning today's date carrying the
 * parsed clock time — the shape react-datepicker's time mode expects.
 *
 * Minute precision matters here: the ascendant advances about one degree every
 * four minutes, so rounding a birth time to the picker's dropdown steps is a
 * real loss of accuracy, not a convenience trade.
 */
export function parseFlexibleTime(value: string): Date | null {
  const result = normalizeBirthTime(value);
  return result.value ? parseLocalClockTime(result.value) : null;
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
  /**
   * Keep the calendar shut when the field merely receives focus.
   *
   * Needed wherever focus is moved programmatically: an open picker treats
   * Enter as "accept the highlighted option", and with an empty field that
   * option is the current date and time — so a stray Enter silently writes
   * "now" as the birth moment. Clicking the field still opens it.
   */
  preventOpenOnFocus?: boolean;
}

/* What the assist line is reporting.
 *
 * "live" is a read-out of half-typed text, updated on every keystroke and
 * never phrased as a complaint. "committed" is the note that survives after
 * the value is written: what got repaired, or which other reading is on
 * offer.
 *
 * `forTime` stamps the value the note describes, so a value that arrives from
 * anywhere else — a restored draft, a click in the calendar — retires the note
 * during render instead of through an effect that fires a beat later. */
type AssistState = {
  kind: "live" | "committed";
  result: IntakeFieldResult;
  forTime: number | null;
};

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
  preventOpenOnFocus = false,
}: PremiumDatePickerProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [storedAssist, setAssist] = useState<AssistState | null>(null);
  const typedTextRef = useRef("");
  const calendarRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const inputId = id ?? `premium-date-picker-${generatedId}`;
  const errorId = `${inputId}-error`;
  const assistId = `${inputId}-assist`;

  const isFilled = value !== null;
  const valueTime = value ? value.getTime() : null;
  /* A committed note describes one particular value, so it retires as soon as
   * a different one arrives. A live note describes the text in the box and is
   * rewritten on the next keystroke either way — including while
   * react-datepicker is pushing its own reading of half-typed text upstream. */
  const assist =
    storedAssist && (storedAssist.kind === "live" || storedAssist.forTime === valueTime)
      ? storedAssist
      : null;

  const defaultHint = showTimeSelectOnly
    ? "Enter a time like 14:30 or 2:30 PM."
    : "Enter a date like 15/05/1990, 1990-05-15, or 15 May 1990.";

  const minYear = minDate?.getFullYear();
  const maxTime = maxDate?.getTime();

  const readTyped = useCallback(
    (text: string): IntakeFieldResult =>
      showTimeSelectOnly
        ? normalizeBirthTime(text)
        : normalizeBirthDate(text, {
            today: maxTime === undefined ? undefined : new Date(maxTime),
            minYear,
          }),
    [maxTime, minYear, showTimeSelectOnly],
  );

  const toDate = useCallback(
    (canonical: string): Date | null =>
      showTimeSelectOnly ? parseLocalClockTime(canonical) : parseLocalIsoDate(canonical),
    [showTimeSelectOnly],
  );

  const applyValue = useCallback(
    (date: Date | null, note: IntakeFieldResult | null) => {
      typedTextRef.current = "";
      setAssist(
        note ? { kind: "committed", result: note, forTime: date ? date.getTime() : null } : null,
      );
      onChange(date);
    },
    [onChange],
  );

  const handleFocus = () => setIsFocused(true);

  /* Commit and validate once the user is done, not per keystroke.
   *
   * Two reasons this is deferred rather than immediate. react-datepicker owns
   * the input's value while it is focused, so setting `selected` mid-typing
   * makes it render the formatted date *alongside* the characters still in its
   * own buffer ("15 May 199015/05/1990"). And a half-typed date should not be
   * reported as invalid while the user is still typing it. */
  const commitTypedText = useCallback(() => {
    const text = typedTextRef.current.trim();
    /* Nothing typed since the last commit — leave whatever note is showing
     * alone, including one just applied from a suggestion chip. */
    if (!text) return;

    const result = readTyped(text);
    if (result.status === "empty") {
      setAssist(null);
      return;
    }
    if (result.status === "invalid") {
      setAssist({
        kind: "committed",
        result: { ...result, message: result.message ?? formatHint ?? defaultHint },
        forTime: valueTime,
      });
      return;
    }

    const parsed = toDate(result.value);
    if (!parsed) {
      setAssist({
        kind: "committed",
        result: { status: "invalid", value: "", display: "", message: formatHint ?? defaultHint },
        forTime: valueTime,
      });
      return;
    }

    applyValue(parsed, result.status === "ok" ? null : result);
  }, [applyValue, defaultHint, formatHint, readTyped, toDate, valueTime]);

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
  /*
   * Scroll the field down far enough that the calendar can open above it.
   *
   * top-start keeps the calendar clear of the step's Continue button, which
   * always sits below the field — but only while there is room above. Scrolled
   * to where the field is near the top of a short window there is not, `flip`
   * sends the calendar down, and it lands on the button again: the exact
   * collision this placement exists to avoid.
   *
   * So make the room instead of hoping for it. Scrolling the page up moves the
   * field down the viewport, which is free here because the shortfall only
   * happens when the page is already scrolled. Capped at scrollY so it never
   * asks for more than exists, and by the minimum needed so a field that
   * already has room is left alone.
   *
   * The height is measured off the calendar where possible, falling back to a
   * constant when this fires before the popup is laid out.
   */
  const ensureRoomAbove = useCallback(() => {
    if (typeof window === "undefined") return;
    const input = calendarRef.current?.querySelector("input");
    const popup = calendarRef.current?.querySelector<HTMLElement>(".react-datepicker");
    if (!input) return;
    const measured = popup?.offsetHeight ?? 0;
    const needed = (measured > 0 ? measured : POPUP_FALLBACK_HEIGHT) + POPUP_OFFSET;
    const rect = input.getBoundingClientRect();

    /* Never push the field past the bottom of the screen chasing room above it.
       The browser scrolls a focused element back into view, so asking for more
       than this starts a tug of war it wins — which is what happened at 420px
       tall, where the popup and the field together are taller than the window
       and no amount of scrolling can seat both. Take what is available. */
    const highestUseful = Math.max(0, window.innerHeight - rect.height - POPUP_OFFSET);
    const target = Math.min(needed, highestUseful);

    const shortfall = target - rect.top;
    if (shortfall <= 0) return;
    window.scrollBy({ top: -Math.min(shortfall, window.scrollY), behavior: "auto" });
  }, []);

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

  /* react-datepicker parses the input itself as it is typed, and its fallback
   * is `new Date(text)` — which reads "05/06/1990" month-first, the opposite of
   * the rule this app documents. Let its reading through so the field stays
   * responsive, but leave the read-out alone: the authoritative reading, and
   * the note explaining it, are applied on commit. */
  const handleChange = (date: Date | null) => {
    if (typedTextRef.current.trim()) {
      onChange(date);
      return;
    }
    applyValue(date, null);
  };

  const handleRawChange = (
    event?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
  ) => {
    const target = event?.target;
    if (!(target instanceof HTMLInputElement)) return;

    /* Record only — the commit happens in commitTypedText. What is shown back
     * meanwhile is a read-out, never a verdict: half of "15/05/1990" is not a
     * mistake, it is someone still typing. */
    typedTextRef.current = target.value;
    const text = target.value.trim();
    if (!text) {
      setAssist(null);
      return;
    }

    const result = readTyped(text);
    setAssist(
      result.status === "invalid" || result.status === "empty"
        ? null
        : { kind: "live", result, forTime: valueTime },
    );
  };

  /* Taking a suggestion must not depend on the click surviving a blur, so the
   * work happens on mousedown-prevented default: focus never leaves the input,
   * then we blur it deliberately so react-datepicker reformats from the new
   * value instead of the stale text still in its buffer. */
  const applySuggestion = (suggestion: IntakeSuggestion) => {
    const parsed = toDate(suggestion.value);
    if (!parsed) return;

    applyValue(parsed, {
      status: "corrected",
      value: suggestion.value,
      display: suggestion.label,
      message: `Set to ${suggestion.label}.`,
    });
    calendarRef.current?.querySelector("input")?.blur();
  };

  const assistError =
    assist?.result.status === "invalid" ? assist.result.message ?? defaultHint : undefined;
  const visibleError = error ?? assistError;

  const assistNote = useMemo(() => {
    if (visibleError || !assist || assist.result.status === "invalid") return null;
    if (assist.kind === "live") return `Reads as ${assist.result.display}`;
    return assist.result.message ?? `Read as ${assist.result.display}`;
  }, [assist, visibleError]);

  const suggestions =
    !visibleError && assist?.kind === "committed" ? assist.result.suggestions ?? [] : [];

  const isComplete = (completed ?? isFilled) && !visibleError && !disabled;
  const inputClasses = [
    styles.datePickerInput,
    icon ? styles.withIcon : "",
    isComplete ? styles.withSuccess : "",
  ]
    .filter(Boolean)
    .join(" ");

  const describedBy = visibleError ? errorId : assistNote ? assistId : undefined;

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
          onCalendarOpen={ensureRoomAbove}
          onCalendarClose={handleCalendarClose}
          placeholderText={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          preventOpenOnFocus={preventOpenOnFocus}
          showTimeSelect={showTimeSelect}
          showTimeSelectOnly={showTimeSelectOnly}
          dateFormat={dateFormat}
          required={required}
          ariaRequired={required ? "true" : undefined}
          ariaInvalid={visibleError ? "true" : undefined}
          ariaDescribedBy={describedBy}
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
          popperPlacement="top-start"
          popperProps={POPPER_PROPS}
          popperModifiers={POPPER_MODIFIERS}
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
      {assistNote && (
        <p
          id={assistId}
          className={`${styles.assistMessage} ${assist?.kind === "live" ? styles.assistLive : ""}`}
          aria-live="polite"
        >
          {assistNote}
        </p>
      )}
      {suggestions.length > 0 && (
        <div className={styles.assistSuggestions}>
          <span className={styles.assistSuggestionsLabel}>Did you mean</span>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.value}
              type="button"
              className={styles.assistChip}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applySuggestion(suggestion)}
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
