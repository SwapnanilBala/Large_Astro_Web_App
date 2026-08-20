"use client";

import type { ReactNode } from "react";
import englishMessages from "@/messages/en.json";
import { LanguageProvider } from "@/lib/i18n-context";

/**
 * LanguageProvider for the desktop tree, carrying the full English baseline.
 *
 * The import lives in a client component so the JSON lands in a client chunk
 * and not also in the RSC payload, which is what would happen if a server
 * layout read the file and passed it down as a prop.
 */
export default function DesktopLanguageProvider({ children }: { children: ReactNode }) {
  return <LanguageProvider baseMessages={englishMessages}>{children}</LanguageProvider>;
}
