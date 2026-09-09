"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouteMessages } from "@/lib/i18n-context";
import sharedMessages from "@/messages/en.shared.json";

/*
 * Next.js renders a segment's error.tsx inside that segment's layout, so this
 * sits under the DesktopLanguageProvider in app/(desktop)/layout.tsx and can
 * read the catalog. The English copy rides in its own route catalog rather than
 * the provider baseline, because only this page and the insights loaders read
 * the "shared" namespace.
 */

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useRouteMessages(sharedMessages);

  useEffect(() => {
    console.error("[RootError]", error);
  }, [error]);

  return (
    <div className="error-page">
      {/* Decorative star field */}
      <div className="error-stars" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="error-star"
            style={{
              left: `${(i * 41 + 13) % 100}%`,
              top: `${(i * 59 + 5) % 100}%`,
              animationDelay: `${(i * 0.5) % 4}s`,
              animationDuration: `${2 + (i % 4)}s`,
            }}
          />
        ))}
      </div>

      {/* Constellation lines */}
      <svg className="error-constellation" viewBox="0 0 400 200" aria-hidden="true">
        <line x1="50" y1="30" x2="120" y2="80" />
        <line x1="120" y1="80" x2="200" y2="50" />
        <line x1="200" y1="50" x2="280" y2="90" />
        <line x1="280" y1="90" x2="350" y2="60" />
        <circle cx="50" cy="30" r="2.5" />
        <circle cx="120" cy="80" r="3" />
        <circle cx="200" cy="50" r="2" />
        <circle cx="280" cy="90" r="3" />
        <circle cx="350" cy="60" r="2.5" />
      </svg>

      <div className="error-card">
        <div className="error-icon" aria-hidden="true">&#x2604;</div>
        <h1 className="error-title">{t("shared.rootErrorHeading")}</h1>
        <p className="error-description">{t("shared.rootErrorDescription")}</p>

        <details className="error-details">
          <summary>{t("shared.rootErrorDetailsSummary")}</summary>
          <pre className="error-message">{error.message}</pre>
          {error.digest && (
            <p className="error-digest">
              {t("shared.rootErrorDigest", { digest: error.digest })}
            </p>
          )}
        </details>

        <div className="error-actions">
          <button onClick={reset} className="error-btn error-btn-primary">
            <span aria-hidden="true">&#x21BB;</span> {t("shared.rootErrorTryAgain")}
          </button>
          <Link href="/" className="error-btn error-btn-secondary">
            {t("shared.rootErrorReturnHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
