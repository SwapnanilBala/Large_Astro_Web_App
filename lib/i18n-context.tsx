"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { LOCATION_LOCALE_COOKIE, parseLocationLocale } from "@/lib/location-locale-cookie";
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

export type Language = "en" | "es" | "bn" | "hi" | "it" | "fr" | "de";

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  es: "Español",
  bn: "বাংলা",
  hi: "हिन्दी",
  it: "Italiano",
  fr: "Français",
  de: "Deutsch",
};

export const LANGUAGE_CODES: Language[] = ["en", "es", "bn", "hi", "it", "fr", "de"];

/*
 * The interface language as a BCP-47 tag, for Intl formatters.
 *
 * `Intl` needs a region to pick a date order from: the bare subtag would work
 * for most of these, but going through a table keeps the choice written down
 * rather than left to ICU's default-region data.
 *
 * Passing one of these is not the same as passing nothing. `undefined` means
 * whatever locale the runtime happens to have, and the server's need not match
 * the browser's -- Node rendered "Feb 11, 2030" where the browser rendered
 * "11 Feb 2030", which React counts as a text mismatch and repairs by throwing
 * the server tree away. Deriving the tag from `language` instead makes the
 * output a function of app state, and safe to render on both sides: the
 * provider starts every visitor at "en" and only adopts a stored choice, or
 * the one their location suggests, once hydration is over, so the first
 * client render always agrees with the server's.
 */
export const LOCALE_TAGS: Record<Language, string> = {
  en: "en-US",
  es: "es-ES",
  bn: "bn-IN",
  hi: "hi-IN",
  it: "it-IT",
  fr: "fr-FR",
  de: "de-DE",
};

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

/* ── The stored choice ── */

const LANGUAGE_STORAGE_KEY = "astro_language";

/* Nothing but this provider writes the key, and it holds its own choice in
   state, so there is nothing to subscribe to: the snapshot only has to be
   read once hydration is over. */
const subscribeToNothing = () => () => {};

function isLanguage(value: string | null | undefined): value is Language {
  return !!value && (LANGUAGE_CODES as string[]).includes(value);
}

/** The visitor's own choice, or null when they have never made one. */
function readStoredLanguage(): Language | null {
  /* Guarded: this runs during render, where a storage error would take the
     whole tree down instead of one effect. */
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(stored) ? stored : null;
  } catch {
    return null;
  }
}

/* ── The location's suggestion ── */

/** What the visitor's location suggests, as proxy.ts left it (lib/location-language.ts). */
function readLocationLanguage(): Language | null {
  try {
    const prefix = `${LOCATION_LOCALE_COOKIE}=`;
    const entry = document.cookie.split(/;\s*/).find((pair) => pair.startsWith(prefix));
    const language = parseLocationLocale(entry?.slice(prefix.length))?.language;
    return isLanguage(language) ? language : null;
  } catch {
    return null;
  }
}

/* The first read, kept: the proxy may rewrite the cookie on any later request
   -- a client navigation included -- and a page should not change language
   under someone halfway through a form because their address moved. */
function readOnce<T>(read: () => T): () => T {
  let done = false;
  let value: T;
  return () => {
    if (!done) {
      value = read();
      done = true;
    }
    return value;
  };
}

/* ── Provider ── */

export function LanguageProvider({
  children,
  baseMessages,
}: {
  children: ReactNode;
  /** The English baseline for this tree. See the note at the top of the file. */
  baseMessages: MessageTree;
}) {
  /* Which language, most deliberate first: a choice made on this page, a
     choice made on an earlier visit, then what the visitor's location
     suggests, then English.

     Both reads are null on the server and in the render that hydrates, and
     only answer from the next render on, so the first client render still
     agrees with the server's. The location is read once per mount; see
     readOnce. */
  const storedLanguage = useSyncExternalStore(subscribeToNothing, readStoredLanguage, () => null);
  const [readLocationOnce] = useState(() => readOnce(readLocationLanguage));
  const locationLanguage = useSyncExternalStore(subscribeToNothing, readLocationOnce, () => null);
  const [chosenLanguage, setChosenLanguage] = useState<Language | null>(null);
  const language = chosenLanguage ?? storedLanguage ?? locationLanguage ?? "en";

  /* Flattening walks the whole tree, so do it once per mount rather than on
     every render. baseMessages is a module-level JSON import in both wrappers,
     so its identity is stable. */
  const [ENGLISH_MESSAGES] = useState(() => flattenMessages(baseMessages));
  /* The last translation file to arrive, and which language it is. English
     stands in until the file for the current language is here, and if it
     never arrives. */
  const [loaded, setLoaded] = useState<{
    language: Language;
    messages: Record<string, string>;
  } | null>(null);
  const messages =
    language !== "en" && loaded?.language === language ? loaded.messages : ENGLISH_MESSAGES;

  /* Load the translation file for the current language */
  useEffect(() => {
    if (language === "en") return;
    /* Only the latest language's file lands; one still in flight from an
       earlier choice is dropped. */
    let current = true;

    import(`@/messages/${language}.json`)
      .then((mod) => {
        if (current) {
          setLoaded({ language, messages: { ...ENGLISH_MESSAGES, ...flattenMessages(mod.default ?? mod) } });
        }
      })
      .catch((err) => {
        console.error(`Failed to load translations for ${language}:`, err);
      });

    return () => {
      current = false;
    };
  }, [language, ENGLISH_MESSAGES]);

  /*
   * Keep <html lang> in step with the selected language.
   *
   * app/layout.tsx hard-codes lang="en" and nothing ever moved it, so a Hindi
   * or Bengali page was still announced with English pronunciation rules --
   * and lang also drives hyphenation and the font fallback a browser reaches
   * for on Devanagari and Bengali text. Done here rather than in a switcher
   * so it follows the language adopted after hydration -- a stored choice or
   * the location's suggestion -- as well as a change made in the desktop
   * navbar or the mobile intake's select.
   */
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  /* Change language */
  const setLanguage = useCallback((lang: Language) => {
    setChosenLanguage(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  }, []);

  /* Translation function with placeholder interpolation */
  const t = useCallback(
    (key: string, params?: Record<string, string>): string => {
      let text = messages[key] ?? ENGLISH_MESSAGES[key] ?? key;
      if (params) {
        for (const [placeholder, value] of Object.entries(params)) {
          /* A function rather than the string, so the value goes in as it
             is: a replacement string reads "$&" or "$'" inside it as
             patterns, and a value can be text the visitor typed -- the name
             the intake re-cased, quoted back to them. */
          text = text.replace(new RegExp(`\\{${placeholder}\\}`, "g"), () => value);
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

/* ── Hooks ── */

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation must be used within LanguageProvider");
  return ctx;
}

/**
 * A translator backed by a catalog that ships with one route.
 *
 * The provider's English baseline is loaded by the layout, so every namespace
 * in it is downloaded by every page under that layout — fine for strings the
 * whole tree renders, wasteful for a namespace only one route does. A route
 * with its own body of copy passes it here instead and pays for it alone.
 *
 * Resolution order is context first, this catalog second, which is what makes
 * it correct rather than a hack: a visitor on a non-English language has the
 * complete translation file loaded by the provider, so `t` already answers and
 * this catalog is never consulted. It answers for English, where the baseline
 * deliberately does not carry these keys — and for any language whose file has
 * not finished loading, or is missing a key, which would otherwise render the
 * raw key on screen.
 *
 * Keys still have to exist somewhere: lib/__tests__/i18n-mobile-coverage.test.ts
 * checks every key a mobile page reads against the baseline plus the route
 * catalog covering that directory.
 */
export function useRouteMessages(
  routeMessages: MessageTree
): (key: string, params?: Record<string, string>) => string {
  const { t } = useTranslation();

  /* Flattened once per mount, like the provider's own baseline — callers pass
     a module-level JSON import, so the identity is stable. */
  const [routeFallback] = useState(() => flattenMessages(routeMessages));

  return useCallback(
    (key: string, params?: Record<string, string>): string => {
      const translated = t(key, params);
      /* `t` returns the key itself when it cannot resolve it. */
      if (translated !== key) return translated;

      let text = routeFallback[key];
      if (text === undefined) return key;
      if (params) {
        for (const [placeholder, value] of Object.entries(params)) {
          /* Literally, for the reason given in the provider's `t`. */
          text = text.replace(new RegExp(`\\{${placeholder}\\}`, "g"), () => value);
        }
      }
      return text;
    },
    [routeFallback, t]
  );
}
