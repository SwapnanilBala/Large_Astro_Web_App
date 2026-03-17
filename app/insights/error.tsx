"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function InsightsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[InsightsError]", error);
  }, [error]);

  return (
    <div className="error-page">
      <div className="error-stars" aria-hidden="true">
        {Array.from({ length: 16 }).map((_, i) => (
          <span
            key={i}
            className="error-star"
            style={{
              left: `${(i * 43 + 7) % 100}%`,
              top: `${(i * 61 + 11) % 100}%`,
              animationDelay: `${(i * 0.6) % 3.5}s`,
              animationDuration: `${2.2 + (i % 3)}s`,
            }}
          />
        ))}
      </div>

      <div className="error-card">
        <div className="error-icon" aria-hidden="true">&#x1F52D;</div>
        <h1 className="error-title">Chart Calculation Disrupted</h1>
        <p className="error-description">
          The planetary computation engine encountered a turbulence in the
          celestial data. This may be due to an invalid birth time, unsupported
          location, or a temporary service interruption.
        </p>

        <details className="error-details">
          <summary>View technical details</summary>
          <pre className="error-message">{error.message}</pre>
          {error.digest && (
            <p className="error-digest">Digest: {error.digest}</p>
          )}
        </details>

        <div className="error-actions">
          <button onClick={reset} className="error-btn error-btn-primary">
            <span aria-hidden="true">&#x21BB;</span> Try Again
          </button>
          <Link href="/" className="error-btn error-btn-secondary">
            Start New Chart
          </Link>
        </div>
      </div>
    </div>
  );
}
