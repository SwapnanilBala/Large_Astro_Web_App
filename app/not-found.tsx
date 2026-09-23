
/*
 * Root 404 — for URLs that match neither tree (/foo), and for anything under
 * /m that 404s.
 *
 * Styled inline rather than with global class names on purpose. The rich
 * constellation version lives at app/(desktop)/not-found.tsx and is styled by
 * globals.css; importing that sheet here would attach 22KB gzipped to *every*
 * route in the app, mobile included, because this file sits in the root
 * segment. That is exactly the coupling the shell split removes.
 *
 * The two differ in dress only. The words are the same in both, so a mistyped
 * URL and a bad chart link say the same thing -- keep them in step.
 */
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Page not found" };

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

export default function NotFound() {
  return (
    /* Outside both trees, so it owns its own landmark (see app/layout.tsx). */
    <main style={page}>
      <p style={{ margin: 0, fontSize: "2.5rem", color: "#D4A574" }} aria-hidden="true">
        ✦
      </p>
      <h1 style={{ margin: 0, fontSize: "1.375rem", fontWeight: 600 }}>
        This chart has no house here
      </h1>
      <p style={{ margin: 0, maxWidth: "32ch", color: "#A8A090", lineHeight: 1.6 }}>
        The page you asked for does not exist.
      </p>
      {/* A plain <a> on purpose. A <Link> prefetches its target once it is on
          screen, and this one points into the desktop tree: every 404 then
          downloaded the home page's stylesheet, fonts and scripts in the
          background, about 250KB -- the coupling described above, by a
          different route. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/"
        style={{
          marginTop: "0.5rem",
          minHeight: 44,
          display: "inline-flex",
          alignItems: "center",
          padding: "0 1.5rem",
          borderRadius: 999,
          border: "1px solid rgba(212, 165, 116, 0.2)",
          background: "rgba(255, 243, 210, 0.03)",
          color: "#D4A574",
          textDecoration: "none",
        }}
      >
        Start a new reading
      </a>
    </main>
  );
}
