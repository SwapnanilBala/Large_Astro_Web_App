"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
/* No message file is imported here on purpose.
 *
 * This module is pulled into every tree, so a top-level import of en.json
 * would put all 9.4KB gzipped of it on every route -- including /m, which uses
 * the "home" namespace and nothing else. The baseline set is injected instead
 * by a thin per-tree wrapper (lib/i18n-desktop.tsx, lib/i18n-mobile.tsx) so
 * each bundle carries only the strings its routes can render.
 *
 * Wrappers, not a prop on a server layout: passing the object down from a
 * server component would serialise it into the RSC payload as well as the
 * client chunk, paying for it twice. */

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

export type MessageTree = Record<string, unknown>;

/* ── Context type ── */

type I18nContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

/* ── Provider ── */

export function LanguageProvider({
  children,
  baseMessages,
}: {
  children: ReactNode;
  /** The English baseline for this tree. See the note at the top of the file. */
  baseMessages: MessageTree;
}) {
  const [language, setLanguageState] = useState<Language>("en");
  /* Flattening walks the whole tree, so do it once per mount rather than on
     every render. baseMessages is a module-level JSON import in both wrappers,
     so its identity is stable. */
  const englishRef = useRef<Record<string, string> | null>(null);
  if (englishRef.current === null) {
    englishRef.current = flattenMessages(baseMessages);
  }
  const ENGLISH_MESSAGES = englishRef.current;
  const [messages, setMessages] =
    useState<Record<string, string>>(ENGLISH_MESSAGES);
  const loadRequestRef = useRef(0);

  /* Load translation file for a given language */
  const loadMessages = useCallback(async (lang: Language) => {
    const requestId = ++loadRequestRef.current;

    if (lang === "en") {
      setMessages(ENGLISH_MESSAGES);
      return;
    }

    // English remains the synchronous baseline while the selected language loads.
    setMessages(ENGLISH_MESSAGES);

    try {
      const mod = await import(`@/messages/${lang}.json`);
      const flat = flattenMessages(mod.default ?? mod);

      if (requestId === loadRequestRef.current) {
        setMessages({ ...ENGLISH_MESSAGES, ...flat });
      }
    } catch (err) {
      console.error(`Failed to load translations for ${lang}:`, err);

      if (requestId === loadRequestRef.current) {
        setMessages(ENGLISH_MESSAGES);
      }
    }
  }, [ENGLISH_MESSAGES]);

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
      let text = messages[key] ?? ENGLISH_MESSAGES[key] ?? key;
      if (params) {
        for (const [placeholder, value] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{${placeholder}\\}`, "g"), value);
        }
      }
      return text;
    },
    [messages, ENGLISH_MESSAGES]
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
