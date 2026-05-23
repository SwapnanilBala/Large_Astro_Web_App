import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 414, 640, 768, 1024, 1280, 1536],
    imageSizes: [24, 32, 48, 64, 96, 128, 240, 384, 512],
  },
};

export default nextConfig;
