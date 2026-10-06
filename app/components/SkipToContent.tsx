"use client";

import { useTranslation } from "@/lib/i18n-context";

/**
 * The keyboard user's first stop on every desktop page.
 *
 * A client component inside the language provider rather than a literal in the
 * server layout, so it reads in the visitor's language. It still renders before
 * the navbar, so it stays the first focusable element on the page.
 */
export default function SkipToContent() {
  const { t } = useTranslation();
  return (
    <a href="#main-content" className="skip-nav">
      {t("navbar.skipToContent")}
    </a>
  );
}
