"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { IntakeFieldResult } from "@/lib/intake-normalize";

interface Suggestion {
  name: string;
  displayName: string;
}

interface AutocompleteInputProps {
  id?: string;
  name?: string;
  ariaLabelledBy?: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
  placeholder?: string;
  suggestType: "country" | "state" | "city";
  required?: boolean;
  contextCountry?: string;
  contextState?: string;
  /**
   * Tidy the typed place name once focus leaves — spacing, and casing where
   * the visitor clearly was not casing at all.
   */
  normalize?: (value: string) => IntakeFieldResult;
  /**
   * Receives the whole normalisation result instead of the component writing
   * it back itself, so the caller decides what to do with it.
   *
   * The cascading fields need this: country and state clear their children on
   * change, and re-casing "india" to "India" must not throw away a state and
   * city the visitor already gave. The mobile tree needs it too, to show what
   * was tidied. Without it the tidied value simply goes back through onChange.
   */
  onNormalized?: (result: IntakeFieldResult) => void;
  /**
   * Class for the input itself, so each tree can apply its own field styling.
   * The dropdown needs no equivalent: globals.css already turns it into a
   * bottom sheet with 48px rows below 768px.
   */
  className?: string;
}

export default function AutocompleteInput({
  id,
  name,
  ariaLabelledBy,
  value,
  onChange,
  onSelect,
  placeholder,
  suggestType,
  required,
  contextCountry,
  contextState,
  normalize,
  onNormalized,
  className,
}: AutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestSeq = useRef(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const inputId = id ?? `autocomplete-${generatedId}`;
  const listboxId = `${inputId}-listbox`;
  const isListboxVisible = isOpen && suggestions.length > 0;

  useEffect(() => {
    const query = value.trim();

    if (timer.current) clearTimeout(timer.current);
    abortRef.current?.abort();

    if (!query || query.length < 2) {
      requestSeq.current += 1;
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    timer.current = setTimeout(async () => {
      const currentRequest = requestSeq.current + 1;
      requestSeq.current = currentRequest;
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const params = new URLSearchParams({ q: query, type: suggestType });
        if (contextCountry) params.set("country", contextCountry);
        if (contextState) params.set("state", contextState);
        const res = await fetch(`/api/suggest?${params.toString()}`, {
          signal: controller.signal,
        });
        const payload = await res.json();
        const data: Suggestion[] = Array.isArray(payload) ? payload : [];

        if (controller.signal.aborted || requestSeq.current !== currentRequest) return;

        setSuggestions(data);
        setIsOpen(data.length > 0);
        setActiveIndex(-1);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (requestSeq.current !== currentRequest) return;

        setSuggestions([]);
        setIsOpen(false);
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    }, 150);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      abortRef.current?.abort();
    };
  }, [value, suggestType, contextCountry, contextState]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (name: string) => {
    onSelect(name);
    setIsOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
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
      setActiveIndex(-1);
    }
  };

  return (
    <div
      className={`autocomplete-wrapper autocomplete-wrapper--${suggestType}${isOpen ? " is-open" : ""}`}
      ref={wrapperRef}
    >
      <input
        id={inputId}
        name={name}
        className={className}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        onBlur={(event) => {
          if (!wrapperRef.current?.contains(event.relatedTarget as Node | null)) {
            setIsOpen(false);
            setActiveIndex(-1);
          }
          if (!normalize) return;
          const result = normalize(value);
          if (onNormalized) {
            onNormalized(result);
            return;
          }
          if (result.value && result.value !== value) onChange(result.value);
        }}
        placeholder={placeholder}
        required={required}
        aria-required={required}
        aria-labelledby={ariaLabelledBy}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isListboxVisible}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-activedescendant={
          isListboxVisible && activeIndex >= 0
            ? `${inputId}-option-${activeIndex}`
            : undefined
        }
      />
      {isListboxVisible && (
        <ul
          id={listboxId}
          className="autocomplete-dropdown"
          role="listbox"
          aria-labelledby={ariaLabelledBy}
          aria-label={ariaLabelledBy ? undefined : placeholder ?? suggestType}
        >
          {suggestions.map((s, i) => (
            <li
              key={`${s.name}-${i}`}
              id={`${inputId}-option-${i}`}
              className={`autocomplete-item ${i === activeIndex ? "active" : ""}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(event) => {
                event.preventDefault();
                handleSelect(s.name);
              }}
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
