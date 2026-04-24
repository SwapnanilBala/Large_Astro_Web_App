"use client";

import React, { useState, useRef, useEffect, ChangeEvent } from "react";
import styles from "./PremiumInput.module.css";

interface PremiumInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ReactNode;
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

  return (
    <div className={`${styles.premiumInput} ${isFocused ? styles.focused : ""} ${error ? styles.error : ""}`}>
      <label className={styles.fieldLabel}>
        {label}
        {required && <span className={styles.requiredDot}>*</span>}
      </label>
      <div className={styles.inputWrapper}>
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={styles.inputField}
        />
        <div className={styles.inputBorder} />
        <div className={styles.inputGlow} />
      </div>
      {error && <div className={styles.errorMessage}>{error}</div>}
    </div>
  );
}
