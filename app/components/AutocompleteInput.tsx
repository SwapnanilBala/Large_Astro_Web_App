"use client";

import { useEffect, useRef, useState } from "react";

interface Suggestion {
  name: string;
  displayName: string;
}

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
  placeholder?: string;
  suggestType: "country" | "state" | "city";
  required?: boolean;
  contextCountry?: string;
  contextState?: string;
}

export default function AutocompleteInput({
  value,
  onChange,
  onSelect,
  placeholder,
  suggestType,
  required,
  contextCountry,
  contextState,
}: AutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value || value.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    if (timer.current) clearTimeout(timer.current);

    timer.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: value, type: suggestType });
        if (contextCountry) params.set("country", contextCountry);
        if (contextState) params.set("state", contextState);
        const res = await fetch(`/api/suggest?${params.toString()}`);
        const data: Suggestion[] = await res.json();
        setSuggestions(data);
        setIsOpen(data.length > 0);
        setActiveIndex(-1);
      } catch {
        setSuggestions([]);
        setIsOpen(false);
      }
    }, 400);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, suggestType, contextCountry, contextState]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (name: string) => {
    onSelect(name);
    setIsOpen(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex].name);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div
      className={`autocomplete-wrapper autocomplete-wrapper--${suggestType}${isOpen ? " is-open" : ""}`}
      ref={wrapperRef}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        aria-autocomplete="list"
      />
      {isOpen && suggestions.length > 0 && (
        <ul className="autocomplete-dropdown">
          {suggestions.map((s, i) => (
            <li
              key={`${s.name}-${i}`}
              className={`autocomplete-item ${i === activeIndex ? "active" : ""}`}
              onMouseDown={() => handleSelect(s.name)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <span className="autocomplete-item-name">{s.name}</span>
              <span className="autocomplete-item-detail">{s.displayName}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
