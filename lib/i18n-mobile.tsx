"use client";

import type { ReactNode } from "react";
import mobileMessages from "@/messages/en.mobile.json";
import { LanguageProvider } from "@/lib/i18n-context";

/**
 * LanguageProvider for the /m tree.
 *
 * messages/en.mobile.json holds the namespaces the /m tree renders — "home",
 * "profiles" and "engineSelect" — rather than the whole English file.
 * lib/__tests__/i18n-mobile-coverage.test.ts fails the build if a mobile page
 * starts using a key this subset does not contain, so the saving cannot quietly
 * turn into a raw key string on screen.
 *
 * Note that the subset rides in the layout, so it is carried by every mobile
 * page: a namespace added here for one route is paid for on all of them.
 * "engineSelect" costs 1.66KB gzipped on that basis. Worth watching if this
 * grows — /m is the route with the least headroom in the tree.
 *
 * Non-English still loads its full message file on demand. There is no language
 * switcher under /m, so that only happens for a visitor who chose a language on
 * desktop, and the full file is a superset of this baseline.
 */
export default function MobileLanguageProvider({ children }: { children: ReactNode }) {
  return <LanguageProvider baseMessages={mobileMessages}>{children}</LanguageProvider>;
}
