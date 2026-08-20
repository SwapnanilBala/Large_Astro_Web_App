"use client";

import { useEffect } from "react";
import Link from "next/link";

/*
 * Root error boundary — catches anything the desktop group's own boundary
 * does not, which in practice means errors thrown under /m.
 *
 * Inline styles, no globals.css: see the note in app/not-found.tsx. The rich
 * version is at app/(desktop)/error.tsx.
 */

const page: React.CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "1rem",
  padding: "2rem 1.5rem",
  textAlign: "center",
  background: "#0A0A0F",
  color: "#F5F0E6",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

const control: React.CSSProperties = {
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  padding: "0 1.5rem",
  borderRadius: 999,
  border: "1px solid rgba(212, 165, 116, 0.2)",
  background: "rgba(255, 243, 210, 0.03)",
  color: "#D4A574",
  textDecoration: "none",
  font: "inherit",
  cursor: "pointer",
};

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={page}>
      <p style={{ margin: 0, fontSize: "2.5rem", color: "#D4A574" }} aria-hidden="true">
        ☄
      </p>
      <h1 style={{ margin: 0, fontSize: "1.375rem", fontWeight: 600 }}>
        The stars have momentarily misaligned
      </h1>
      <p style={{ margin: 0, maxWidth: "34ch", color: "#A8A090", lineHeight: 1.6 }}>
        Something went wrong while drawing this page.
      </p>
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
        <button type="button" onClick={reset} style={control}>
          Try again
        </button>
        <Link href="/" style={control}>
          Start over
        </Link>
      </div>
      {error.digest && (
        <p style={{ margin: 0, fontSize: "0.75rem", color: "#6B6560" }}>
          Reference: {error.digest}
        </p>
      )}
    </div>
  );
}
