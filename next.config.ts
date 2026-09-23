import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/*
 * The Content-Security-Policy, one directive per line.
 *
 * Every origin below is here because something in the browser loads from it,
 * and nothing else is. The palm camera's MediaPipe is the only third party:
 * its WASM loader script and binary come from jsDelivr (the version is pinned
 * in lib/palm-readings/mediapipe.ts) and its hand model from Google Storage.
 * Everything else -- fonts, images, the PDF engine, every API call -- is
 * same-origin. Sign-in fetches its Google URL and then navigates the whole
 * page there, which CSP does not govern, so Google needs no entry.
 *
 * 'unsafe-inline' on scripts is the concession. Next inlines its RSC payload
 * and the theme script in app/layout.tsx runs before paint; the alternative is
 * a per-request nonce, which forces every page dynamic, the static home page
 * included. The policy still does the work that matters here: no framing, no
 * plugins, no <base> rewrites, no posting forms or data anywhere else.
 * 'wasm-unsafe-eval' lets MediaPipe and the PDF engine's layout WASM compile;
 * it does not allow eval(). Dev adds 'unsafe-eval' for React's dev tooling.
 *
 * connect-src allows data: for one reason: the PDF engine's layout WASM ships
 * as a base64 data: URL that Emscripten fetch()es first. Refused, it decodes
 * the same bytes by hand, so the PDF was identical -- but every download filed
 * a violation, which buries a real one. A data: URL is inline content, so
 * allowing it to be fetched sends nothing anywhere.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""} https://cdn.jsdelivr.net`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' data: https://cdn.jsdelivr.net https://storage.googleapis.com",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/* Policies about the document: they mean nothing on a script or a font, so the
   hashed assets under /_next/static do not carry them (645 bytes on every
   file otherwise, which HTTP/1.1 sends uncompressed each time). */
const documentHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  /* The older spelling of frame-ancestors 'none', for browsers that predate it. */
  { key: "X-Frame-Options", value: "DENY" },
  /* Chart URLs carry a name, a birth date and a birthplace in the query string,
     so another origin gets the origin and nothing after it. */
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  /* The palm reading needs the camera, on this origin only; nothing needs the
     rest. */
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  },
  /* Ignored over plain HTTP, so it is inert locally. No includeSubDomains or
     preload: those commit every subdomain, which is a decision for the domain's
     owner rather than a default for this app. */
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
];

/* Everything, assets included: nosniff is what stops a script or stylesheet
   response being reinterpreted as another type. */
const everyResponseHeaders = [{ key: "X-Content-Type-Options", value: "nosniff" }];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /* Advertising the framework and its version helps nobody but a scanner. */
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 414, 640, 768, 1024, 1280, 1536],
    imageSizes: [24, 32, 48, 64, 96, 128, 240, 384, 512],
  },
  async headers() {
    return [
      { source: "/:path*", headers: everyResponseHeaders },
      { source: "/((?!_next/static/).*)", headers: documentHeaders },
      {
        /* "/" and "/insights" answer differently depending on the User-Agent:
         * a handset gets a 307 to the /m tree, everyone else gets the page.
         * A shared cache that stored the desktop 200 could therefore serve it
         * to a phone and skip the redirect entirely.
         *
         * Vary is the natural fix but Next owns that header on RSC-capable
         * routes and overwrites whatever middleware or this config sets — it
         * survives on the 307 responses and is replaced on the 200s. So the
         * defence here is to keep those two responses out of shared caches
         * instead. Browsers may still cache per-user, which is safe because a
         * single browser keeps one User-Agent.
         *
         * Everything else, including all static assets, is untouched. */
        source: "/:path(|insights)",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Vary", value: "User-Agent, Cookie" },
        ],
      },
    ];
  },
};

export default nextConfig;
