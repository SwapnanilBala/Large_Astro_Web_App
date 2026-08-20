"use client";

import type { ReactNode } from "react";
import mobileMessages from "@/messages/en.mobile.json";
import { LanguageProvider } from "@/lib/i18n-context";

/**
 * LanguageProvider for the /m tree.
 *
 * messages/en.mobile.json holds the "home" namespace only, which is every key
 * any page under app/m renders — 2.3KB gzipped against 9.4KB for the full file.
 * lib/__tests__/i18n-mobile-coverage.test.ts fails the build if a mobile page
 * starts using a key this subset does not contain, so the saving cannot quietly
 * turn into a raw key string on screen.
 *
 * Non-English still loads its full message file on demand. There is no language
 * switcher under /m, so that only happens for a visitor who chose a language on
 * desktop, and the full file is a superset of this baseline.
 */
export default function MobileLanguageProvider({ children }: { children: ReactNode }) {
  return <LanguageProvider baseMessages={mobileMessages}>{children}</LanguageProvider>;
}
