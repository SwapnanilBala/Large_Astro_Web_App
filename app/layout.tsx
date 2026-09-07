import type { Metadata, Viewport } from "next";
import Script from "next/script";

/*
 * Root shell — deliberately almost empty.
 *
 * Everything a page can be rendered without lives in a per-tree layout instead:
 * the desktop chrome, fonts and globals.css in app/(desktop)/layout.tsx, the
 * handset shell in app/m/layout.tsx. /m used to inherit all of it because this
 * file was the only layout, which is why a phone downloaded 145KB of display
 * webfonts and 22KB gzipped of desktop CSS it never referenced.
 *
 * One thing is shared, and it is load-bearing on every route: the service
 * worker registration, which is device-independent. ToastProvider is NOT here
 * — nothing under /m uses it — and neither is LanguageProvider, which each tree
 * supplies with its own English baseline so /m does not ship strings only
 * desktop can render.
 *
 * No <main> and no skip link here either — each tree owns its own landmark so
 * the mobile one is not forced into the desktop page structure.
 */

/**
 * Absolute base for Open Graph, Twitter and canonical URLs.
 *
 * The concrete effect today is on the four `/m` pages, which each declare an
 * `alternates.canonical` pointing at their desktop twin. Without a base those
 * emit relative — `<link rel="canonical" href="/login">` — and a canonical is
 * meant to name one absolute URL, which is the whole point of pointing a
 * handset page at its desktop equivalent. With a base they resolve to
 * `https://…/login`. It is also what any `openGraph.images` added later will
 * resolve against, and Next does warn about a missing base in that case.
 *
 * `APP_ORIGIN` is reused rather than given a sibling variable because it is
 * already defined as the canonical origin this app is reached on — the same
 * value the OAuth redirect URI is built from. One variable means the two cannot
 * drift into disagreeing about what this site is called.
 *
 * `VERCEL_URL` is the per-deployment fallback so a preview build describes
 * itself rather than production; it arrives without a scheme. A malformed value
 * falls back rather than throwing: this is cosmetic metadata, and it should not
 * be able to take every route down when a canonical URL would merely be wrong.
 */
function resolveMetadataBase(): URL {
  const configured =
    process.env.APP_ORIGIN ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  try {
    return new URL((configured || "http://localhost:7001").replace(/\/+$/, ""));
  } catch {
    return new URL("http://localhost:7001");
  }
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: "Lagna Atelier",
  description: "Swiss Ephemeris astrology intelligence workspace",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lagna Atelier",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0F1117",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" style={{ colorScheme: "dark" }}>
      {/* The background is repeated here rather than left to a stylesheet so
          the first paint is dark on both trees. globals.css only loads on the
          desktop tree now, and the mobile sheet is a route chunk, so without
          this a handset flashes white before either arrives. */}
      <body style={{ background: "#0A0A0F" }}>
        {children}
        {process.env.NODE_ENV === "production" && (
          <Script id="sw-register" strategy="afterInteractive">
            {`if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{})}`}
          </Script>
        )}
      </body>
    </html>
  );
}
