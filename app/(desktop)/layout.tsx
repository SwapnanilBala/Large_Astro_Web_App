import { Cinzel, Newsreader } from "next/font/google";
import "../globals.css";

import GradientBlobs from "@/app/components/GradientBlobs";
import Navbar from "@/app/components/Navbar";
import BottomNav from "@/app/components/BottomNav";
import ViewportScaler from "@/app/components/ViewportScaler";
import { ToastProvider } from "@/lib/toast-context";

/*
 * Desktop shell.
 *
 * This is a route group, so it adds no path segment — app/(desktop)/page.tsx is
 * still "/" and app/(desktop)/insights is still "/insights". What it buys is a
 * boundary: everything imported here is downloaded only by the routes inside
 * the group, and the /m tree stops paying for it.
 *
 * Moved down from the root layout: globals.css (22KB gzipped), Cinzel and
 * Newsreader (145KB of preloaded woff2), the navigation, the animated
 * background, the viewport scaler and ToastProvider. Nothing under /m
 * referenced any of it.
 *
 * The font variables land on a wrapper <div> rather than <html>, because only
 * the root layout may render <html>. Custom properties inherit, so every
 * var(--font-display) below this point resolves exactly as before.
 */

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-display",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-newsreader",
});

export default function DesktopLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${cinzel.variable} ${newsreader.variable}`}>
      <a href="#main-content" className="skip-nav">
        Skip to main content
      </a>
      <ViewportScaler />
      <GradientBlobs />
      <ToastProvider>
        <Navbar />
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <BottomNav />
      </ToastProvider>
    </div>
  );
}
