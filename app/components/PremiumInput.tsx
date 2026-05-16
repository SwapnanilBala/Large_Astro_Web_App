"use client";

import React, { useState, useRef, useEffect } from "react";
import styles from "./PremiumInput.module.css";

interface PremiumInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ReactNode;
  completed?: boolean;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  required?: boolean;
}

export default function PremiumInput({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  icon,
  completed,
  error,
  disabled = false,
  autoFocus = false,
  required = false,
}: PremiumInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isFilled, setIsFilled] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsFilled(value.length > 0);
  }, [value]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setIsFilled(e.target.value.length > 0);
  };

  const isComplete = (completed ?? isFilled) && !error && !disabled;
  const inputClasses = [
    styles.inputField,
    icon ? styles.withIcon : "",
    isComplete ? styles.withSuccess : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`${styles.premiumInput} ${isFocused ? styles.focused : ""} ${error ? styles.error : ""} ${
        isComplete ? styles.complete : ""
      } ${disabled ? styles.disabled : ""}`}
    >
      <label className={styles.fieldLabel}>
        {label}
        {required && <span className={styles.requiredDot}>*</span>}
      </label>
      <div className={styles.inputWrapper}>
        {icon && (
          <span className={styles.leadingIcon} aria-hidden="true">
            {icon}
          </span>
        )}
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={inputClasses}
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
        <div className={styles.inputBorder} />
        <div className={styles.inputGlow} />
      </div>
      {error && <div className={styles.errorMessage}>{error}</div>}
    </div>
  );
}
