"use client";

import React, { useState, useRef, useEffect } from "react";
import styles from "./PremiumDropdown.module.css";

interface Option {
  value: string;
  label: string;
}

interface PremiumDropdownProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  icon?: React.ReactNode;
  error?: string;
  disabled?: boolean;
  searchable?: boolean;
}

export default function PremiumDropdown({
  label,
  value,
  onChange,
  options,
  placeholder = "Select an option",
  icon,
  error,
  disabled = false,
  searchable = false,
}: PremiumDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isFilled, setIsFilled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsFilled(value.length > 0);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm("");
  };

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className={`${styles.premiumDropdown} ${isFocused ? styles.focused : ""} ${error ? styles.error : ""}`} ref={dropdownRef}>
      <div className={styles.dropdownWrapper}>
        {icon && <div className={styles.dropdownIcon}>{icon}</div>}
        <div
          className={styles.dropdownTrigger}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          tabIndex={0}
        >
          <div className={styles.selectedValue}>
            {selectedOption ? selectedOption.label : placeholder}
          </div>
          <div className={`${styles.dropdownArrow} ${isOpen ? styles.open : ""}`}>
            ▼
          </div>
        </div>
        <label className={`${styles.floatingLabel} ${isFocused || isFilled ? styles.floating : ""}`}>
          {label}
        </label>
        <div className={styles.dropdownBorder} />
        <div className={styles.dropdownGlow} />
      </div>

      {isOpen && (
        <div className={styles.dropdownMenu}>
          {searchable && (
            <div className={styles.searchInput}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className={styles.searchField}
                autoFocus
              />
            </div>
          )}
          <div className={styles.optionsList}>
            {filteredOptions.length === 0 ? (
              <div className={styles.noResults}>No results found</div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={`${styles.option} ${option.value === value ? styles.selected : ""}`}
                  onClick={() => handleSelect(option.value)}
                >
                  {option.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {error && <div className={styles.errorMessage}>{error}</div>}
    </div>
  );
}
