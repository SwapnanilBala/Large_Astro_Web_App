import type { Metadata, Viewport } from "next";
import { siteOrigin } from "@/lib/site-url";
import Script from "next/script";

const THEME_BOOTSTRAP = `(() => {
  try {
    const theme = window.localStorage.getItem("lagna-theme") === "light" ? "light" : "dark";
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    document.body.style.background = theme === "light" ? "#fff8f5" : "#07111b";
  } catch {}
})();`;

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


export const metadata: Metadata = {
  metadataBase: siteOrigin(),
  /* Pages give only their own part ("Test Reader — Timing"); the template adds
     the brand, so it is written once and cannot drift between pages. */
  title: {
    default: "Lagna Atelier — your Vedic birth chart, read clearly",
    template: "%s · Lagna Atelier",
  },
  description:
    "Create your Vedic birth chart and get a clear, personal reading: your rising sign, the areas of your life, and the timing of the chapters ahead.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lagna Atelier",
  },
  icons: {
    /* The ICO is for whatever asks for /favicon.ico by name; browsers that read
       the link tags take the SVG. */
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    /* A PNG: iOS does not read SVG here, and fell back to a screenshot. */
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  /* What a shared link shows. Deliberately the site's own title rather than a
     page's: a chart page's title carries the reader's name, and a link pasted
     into a chat should not print it on the card. The image is
     app/opengraph-image.tsx. */
  openGraph: {
    type: "website",
    siteName: "Lagna Atelier",
    title: "Lagna Atelier — your Vedic birth chart, read clearly",
    description: "Create your Vedic birth chart and get a clear, personal reading: your rising sign, the areas of your life, and the timing of the chapters ahead.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lagna Atelier — your Vedic birth chart, read clearly",
    description: "Create your Vedic birth chart and get a clear, personal reading: your rising sign, the areas of your life, and the timing of the chapters ahead.",
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
    /* suppressHydrationWarning on both elements, and it silences a warning
       rather than fixing a bug -- worth stating plainly, because the attribute
       looks like it is papering over something.

       THEME_BOOTSTRAP above runs beforeInteractive and rewrites exactly the
       three attributes below from localStorage. For anyone whose stored theme
       is "light", the DOM React hydrates into therefore disagrees with this
       JSX, and React logs a mismatch on <html> and <body>.

       Nothing breaks. Measured over twelve runs, light and dark, with and
       without this attribute: every page rendered, byte-identical, effects and
       event handlers ran, and React kept the bootstrap's value rather than
       reverting it -- which for attributes is what "won't be patched up"
       means, and is the behaviour we want. ThemeToggle reads the same value
       through useSyncExternalStore with a "dark" server snapshot, so app state
       agrees with the DOM.

       What it costs unsuppressed is a permanent "1 Issue" badge in the dev
       overlay for every light-theme session -- the same channel a real
       hydration bug would use, so a standing false positive there teaches
       people to ignore it. The attribute covers only these two elements' own
       attributes, one level deep, so it cannot hide a mismatch anywhere else
       in the tree. */
    <html
      lang="en"
      data-theme="dark"
      style={{ colorScheme: "dark" }}
      suppressHydrationWarning
    >
      {/* The background is repeated here rather than left to a stylesheet so
          the first paint is dark on both trees. globals.css only loads on the
          desktop tree now, and the mobile sheet is a route chunk, so without
          this a handset flashes white before either arrives. */}
      <body style={{ background: "#07111B" }} suppressHydrationWarning>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {THEME_BOOTSTRAP}
        </Script>
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
