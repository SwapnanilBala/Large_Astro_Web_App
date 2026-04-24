"use client";

import React, { useState, useRef, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import styles from "./PremiumDatePicker.module.css";

interface PremiumDatePickerProps {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  icon?: React.ReactNode;
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
}

export default function PremiumDatePicker({
  label,
  value,
  onChange,
  placeholder = "",
  icon,
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
}: PremiumDatePickerProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isFilled, setIsFilled] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsFilled(value !== null);
  }, [value]);

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);
  const handleChange = (date: Date | null) => {
    onChange(date);
    setIsFilled(date !== null);
  };

  return (
    <div className={`${styles.premiumDatePicker} ${isFocused ? styles.focused : ""} ${error ? styles.error : ""}`}>
      <label className={styles.fieldLabel}>
        {label}
        {required && <span className={styles.requiredDot}>*</span>}
      </label>
      <div className={styles.datePickerWrapper} ref={calendarRef}>
        <DatePicker
          selected={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderText={placeholder}
          disabled={disabled}
          showTimeSelect={showTimeSelect}
          showTimeSelectOnly={showTimeSelectOnly}
          dateFormat={dateFormat}
          required={required}
          maxDate={maxDate}
          minDate={minDate}
          timeIntervals={timeIntervals}
          timeCaption={timeCaption}
          showYearDropdown={showYearDropdown}
          showMonthDropdown={showMonthDropdown}
          yearDropdownItemNumber={yearDropdownItemNumber}
          className={styles.datePickerInput}
          calendarClassName={styles.calendarPopup}
          popperClassName={styles.popper}
          wrapperClassName={styles.datePickerWrapperInner}
        />
        <div className={styles.datePickerBorder} />
        <div className={styles.datePickerGlow} />
      </div>
      {error && <div className={styles.errorMessage}>{error}</div>}
    </div>
  );
}
