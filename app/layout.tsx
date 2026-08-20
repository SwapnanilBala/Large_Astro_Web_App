import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { ProfileProvider } from "@/lib/profile-context";

/*
 * Root shell — deliberately almost empty.
 *
 * Everything a page can be rendered without lives in a per-tree layout instead:
 * the desktop chrome, fonts and globals.css in app/(desktop)/layout.tsx, the
 * handset shell in app/m/layout.tsx. /m used to inherit all of it because this
 * file was the only layout, which is why a phone downloaded 145KB of display
 * webfonts and 22KB gzipped of desktop CSS it never referenced.
 *
 * Only two things are shared, and both are load-bearing on every route:
 *
 * - ProfileProvider. app/m/mobile-intake.tsx calls useProfile, so one instance
 *   here serves both trees. ToastProvider is NOT here — nothing under /m uses
 *   it — and neither is LanguageProvider, which each tree now supplies with its
 *   own English baseline so /m does not ship strings only desktop can render.
 * - The service worker registration, which is device-independent.
 *
 * No <main> and no skip link here either — each tree owns its own landmark so
 * the mobile one is not forced into the desktop page structure.
 */

export const metadata: Metadata = {
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
        <ProfileProvider>{children}</ProfileProvider>
        {process.env.NODE_ENV === "production" && (
          <Script id="sw-register" strategy="afterInteractive">
            {`if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{})}`}
          </Script>
        )}
      </body>
    </html>
  );
}
