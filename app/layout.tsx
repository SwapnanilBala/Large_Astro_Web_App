import type { Metadata, Viewport } from "next";
import Script from "next/script";
import {
  Cinzel,
  Newsreader,
  Spectral,
  Tiro_Devanagari_Sanskrit,
  IBM_Plex_Mono,
} from "next/font/google";
import "./globals.css";

/* Raw typeface handles only. Each skin binds these to the semantic
 * --font-display / --font-body / --font-sanskrit / --font-mono roles
 * in globals.css, so no component references a typeface by name. */
const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-cinzel",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-newsreader",
});

/* Tāla-patra: Spectral carries Latin text, Tiro Devanagari Sanskrit carries
 * Sanskrit terms, IBM Plex Mono carries degrees and ephemeris figures. */
const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-spectral",
});

const tiroDevanagari = Tiro_Devanagari_Sanskrit({
  subsets: ["devanagari", "latin"],
  weight: ["400"],
  display: "swap",
  variable: "--font-tiro",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-plex-mono",
});

const fontVariables = [
  cinzel.variable,
  newsreader.variable,
  spectral.variable,
  tiroDevanagari.variable,
  plexMono.variable,
].join(" ");
import GradientBlobs from "./components/GradientBlobs";
import Navbar from "./components/Navbar";
import BottomNav from "./components/BottomNav";
import ViewportScaler from "./components/ViewportScaler";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { LanguageProvider } from "@/lib/i18n-context";
import { ToastProvider } from "@/lib/toast-context";

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
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0F1117" },
    { media: "(prefers-color-scheme: light)", color: "#E6DFCC" },
  ],
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <Script id="theme-init" strategy="beforeInteractive">
        {`try{var t=localStorage.getItem('astro_theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t);document.documentElement.style.colorScheme=t}catch(e){document.documentElement.setAttribute('data-theme','dark');document.documentElement.style.colorScheme='dark'}try{var s=localStorage.getItem('astro_skin');document.documentElement.setAttribute('data-skin',s==='leaf'?'leaf':'cosmic')}catch(e){document.documentElement.setAttribute('data-skin','cosmic')}`}
      </Script>
      <body>
        <a href="#main-content" className="skip-nav">
          Skip to main content
        </a>
        <ViewportScaler />
        <GradientBlobs />
        <ThemeProvider>
          <LanguageProvider>
            <ToastProvider>
              <AuthProvider>
                <Navbar />
                <main id="main-content" tabIndex={-1}>
                  {children}
                </main>
                <BottomNav />
              </AuthProvider>
            </ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
        {process.env.NODE_ENV === "production" && (
          <Script id="sw-register" strategy="afterInteractive">
            {`if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{})}`}
          </Script>
        )}
      </body>
    </html>
  );
}
