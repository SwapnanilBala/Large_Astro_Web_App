"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import type { IntakeFieldResult, IntakeSuggestion } from "@/lib/intake-normalize";
import styles from "./PremiumInput.module.css";

interface PremiumInputProps {
  id?: string;
  name?: string;
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
  autoComplete?: string;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
  /**
   * Tidy the typed value once the visitor moves on.
   *
   * Runs on blur rather than per keystroke — a name half-typed is not a name
   * miscased, and rewriting text under a moving cursor is hostile. Whatever it
   * returns is written back, and anything it repaired or could not read is
   * reported under the field.
   */
  normalize?: (value: string) => IntakeFieldResult;
}

export default function PremiumInput({
  id,
  name,
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
  autoComplete,
  inputMode,
  normalize,
}: PremiumInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isFilled, setIsFilled] = useState(false);
  const [assist, setAssist] = useState<IntakeFieldResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const inputId = id ?? `premium-input-${generatedId}`;
  const errorId = `${inputId}-error`;
  const assistId = `${inputId}-assist`;

  useEffect(() => {
    setIsFilled(value.length > 0);
  }, [value]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleFocus = () => setIsFocused(true);

  const handleBlur = () => {
    setIsFocused(false);
    if (!normalize) return;

    const result = normalize(value);
    if (result.status === "empty") {
      setAssist(null);
      return;
    }
    setAssist(result.status === "ok" ? null : result);
    if (result.value && result.value !== value) onChange(result.value);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setIsFilled(e.target.value.length > 0);
    /* A note about the previous value stops being true the moment the text
     * changes; the next blur will produce a fresh one. */
    if (assist) setAssist(null);
  };

  /* Prevented default on mousedown so the chip is still mounted when the click
   * lands — otherwise the blur that reformats the field unmounts it first. */
  const applySuggestion = (suggestion: IntakeSuggestion) => {
    onChange(suggestion.value);
    setAssist({
      status: "corrected",
      value: suggestion.value,
      display: suggestion.label,
      message: `Set to ${suggestion.label}.`,
    });
  };

  const assistError = assist?.status === "invalid" ? assist.message : undefined;
  const visibleError = error ?? assistError;
  const assistNote =
    !visibleError && assist && assist.status !== "invalid"
      ? assist.message ?? `Read as ${assist.display}`
      : null;
  const suggestions = visibleError ? [] : assist?.suggestions ?? [];

  const isComplete = (completed ?? isFilled) && !visibleError && !disabled;
  const inputClasses = [
    styles.inputField,
    icon ? styles.withIcon : "",
    isComplete ? styles.withSuccess : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`${styles.premiumInput} ${isFocused ? styles.focused : ""} ${visibleError ? styles.error : ""} ${
        isComplete ? styles.complete : ""
      } ${disabled ? styles.disabled : ""}`}
    >
      <label className={styles.fieldLabel} htmlFor={inputId}>
        {label}
        {required && <span className={styles.requiredDot} aria-hidden="true">*</span>}
      </label>
      <div className={styles.inputWrapper}>
        {icon && (
          <span className={styles.leadingIcon} aria-hidden="true">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          name={name}
          ref={inputRef}
          type={type}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-required={required}
          aria-invalid={Boolean(visibleError)}
          aria-describedby={visibleError ? errorId : assistNote ? assistId : undefined}
          autoComplete={autoComplete}
          inputMode={inputMode}
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
      {visibleError && (
        <div id={errorId} className={styles.errorMessage} role="alert">
          {visibleError}
        </div>
      )}
      {assistNote && (
        <p id={assistId} className={styles.assistMessage} aria-live="polite">
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
