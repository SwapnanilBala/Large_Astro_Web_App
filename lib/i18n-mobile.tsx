"use client";

import type { ReactNode } from "react";
import mobileMessages from "@/messages/en.mobile.json";
import { LanguageProvider } from "@/lib/i18n-context";

/**
 * LanguageProvider for the /m tree.
 *
 * messages/en.mobile.json holds the namespaces the whole tree renders —
 * "home" and "profiles" — rather than the entire English file.
 * lib/__tests__/i18n-mobile-coverage.test.ts fails the build if a mobile page
 * starts using a key no catalog contains, so the saving cannot quietly turn
 * into a raw key string on screen.
 *
 * This baseline rides in the layout, so every mobile page downloads all of it:
 * a namespace added here for one route is paid for by all of them. Copy that
 * belongs to a single route goes in its own catalog and is read through
 * useRouteMessages instead — app/m/engine-select does this, and the 1.5KB
 * gzipped of chart-method copy stays off the intake, which is the route with
 * the least headroom in the tree. Add here only what more than one page reads.
 *
 * Non-English still loads its full message file on demand. There is no language
 * switcher under /m, so that only happens for a visitor who chose a language on
 * desktop, and the full file is a superset of this baseline.
 */
export default function MobileLanguageProvider({ children }: { children: ReactNode }) {
  return <LanguageProvider baseMessages={mobileMessages}>{children}</LanguageProvider>;
}
