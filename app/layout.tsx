import type { Metadata, Viewport } from "next";
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
