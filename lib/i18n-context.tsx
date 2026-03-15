"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

/* ── Supported languages ── */

export type Language = "en" | "es" | "bn" | "hi" | "it" | "fr";

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  es: "Español",
  bn: "বাংলা",
  hi: "हिन्दी",
  it: "Italiano",
  fr: "Français",
};

export const LANGUAGE_CODES: Language[] = ["en", "es", "bn", "hi", "it", "fr"];

/* ── Flatten nested JSON into dot-notation keys ── */

function flattenMessages(
  obj: Record<string, unknown>,
  prefix = ""
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (typeof value === "string") {
      result[fullKey] = value;
    } else if (typeof value === "object" && value !== null) {
      Object.assign(result, flattenMessages(value as Record<string, unknown>, fullKey));
    }
  }
  return result;
}

/* ── Context type ── */

type I18nContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

/* ── Provider ── */

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [messages, setMessages] = useState<Record<string, string>>({});

  /* Load translation file for a given language */
  const loadMessages = useCallback(async (lang: Language) => {
    try {
      const mod = await import(`@/messages/${lang}.json`);
      const flat = flattenMessages(mod.default ?? mod);
      setMessages(flat);
    } catch (err) {
      console.error(`Failed to load translations for ${lang}:`, err);
      // Fallback to English
      if (lang !== "en") {
        try {
          const fallback = await import("@/messages/en.json");
          setMessages(flattenMessages(fallback.default ?? fallback));
        } catch { /* empty */ }
      }
    }
  }, []);

  /* Hydrate from localStorage on mount */
  useEffect(() => {
    const stored = localStorage.getItem("astro_language") as Language | null;
    if (stored && LANGUAGE_CODES.includes(stored)) {
      setLanguageState(stored);
      loadMessages(stored);
    } else {
      loadMessages("en");
    }
  }, [loadMessages]);

  /* Change language */
  const setLanguage = useCallback(
    (lang: Language) => {
      setLanguageState(lang);
      localStorage.setItem("astro_language", lang);
      loadMessages(lang);
    },
    [loadMessages]
  );

  /* Translation function with placeholder interpolation */
  const t = useCallback(
    (key: string, params?: Record<string, string>): string => {
      let text = messages[key] ?? key;
      if (params) {
        for (const [placeholder, value] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{${placeholder}\\}`, "g"), value);
        }
      }
      return text;
    },
    [messages]
  );

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

/* ── Hook ── */

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation must be used within LanguageProvider");
  return ctx;
}
