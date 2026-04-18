import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter, Cormorant_Garamond, Newsreader } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import GradientBlobs from "./components/GradientBlobs";
import Navbar from "./components/Navbar";
import BottomNav from "./components/BottomNav";
import ViewportScaler from "./components/ViewportScaler";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { LanguageProvider } from "@/lib/i18n-context";
import { ToastProvider } from "@/lib/toast-context";

const displayFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
  display: "swap",
  preload: true,
});

const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
  display: "swap",
  preload: true,
});

const accentFont = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-accent",
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

const newsreaderFont = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});

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
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable} ${accentFont.variable} ${newsreaderFont.variable}`}>
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
                <main id="main-content">
                  {children}
                </main>
                <BottomNav />
              </AuthProvider>
            </ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
        <Script id="sw-register" strategy="afterInteractive">
          {`if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{})}`}
        </Script>
      </body>
    </html>
  );
}
