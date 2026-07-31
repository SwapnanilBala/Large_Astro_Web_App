import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 414, 640, 768, 1024, 1280, 1536],
    imageSizes: [24, 32, 48, 64, 96, 128, 240, 384, 512],
  },
  async headers() {
    return [
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
