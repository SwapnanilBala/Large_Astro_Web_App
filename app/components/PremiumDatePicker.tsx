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
}: PremiumDatePickerProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isFilled, setIsFilled] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const inputId = id ?? `premium-date-picker-${generatedId}`;
  const errorId = `${inputId}-error`;

  useEffect(() => {
    setIsFilled(value !== null);
  }, [value]);

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);
  const handleChange = (date: Date | null) => {
    onChange(date);
    setIsFilled(date !== null);
  };

  const handleRawChange = (
    event?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
  ) => {
    const target = event?.target;
    if (!(target instanceof HTMLInputElement)) return;

    const date = parseLocalIsoDate(target.value);
    if (!date) return;

    event?.preventDefault();
    handleChange(date);
  };

  const isComplete = (completed ?? isFilled) && !error && !disabled;
  const inputClasses = [
    styles.datePickerInput,
    icon ? styles.withIcon : "",
    isComplete ? styles.withSuccess : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`${styles.premiumDatePicker} ${isFocused ? styles.focused : ""} ${error ? styles.error : ""} ${
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
          placeholderText={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          showTimeSelect={showTimeSelect}
          showTimeSelectOnly={showTimeSelectOnly}
          dateFormat={dateFormat}
          required={required}
          ariaRequired={required ? "true" : undefined}
          ariaInvalid={error ? "true" : undefined}
          ariaDescribedBy={error ? errorId : undefined}
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
      {error && (
        <div id={errorId} className={styles.errorMessage} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
