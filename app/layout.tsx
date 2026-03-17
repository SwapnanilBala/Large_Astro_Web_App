import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Sora } from "next/font/google";
import "./globals.css";
import StarField from "./components/StarField";
import Navbar from "./components/Navbar";
import BottomNav from "./components/BottomNav";
import ViewportScaler from "./components/ViewportScaler";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { LanguageProvider } from "@/lib/i18n-context";
import { ToastProvider } from "@/lib/toast-context";

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"]
});

const bodyFont = Sora({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "Lagna Atelier",
  description: "Swiss Ephemeris astrology intelligence workspace"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#041420",
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>
        <a href="#main-content" className="skip-nav">
          Skip to main content
        </a>
        <ViewportScaler />
        <StarField />
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
      </body>
    </html>
  );
}
