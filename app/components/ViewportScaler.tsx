"use client";

import { useEffect } from "react";

function detectMobilePlatform() {
  if (typeof navigator === "undefined") {
    return "desktop";
  }

  const userAgent = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return "ios";
  }
  if (/Android/i.test(userAgent)) {
    return "android";
  }
  return "desktop";
}

export default function ViewportScaler() {
  useEffect(() => {
    const root = document.documentElement;

    const updateViewportMetrics = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      root.style.setProperty("--app-viewport-width", `${width}px`);
      root.style.setProperty("--app-viewport-height", `${height}px`);
      root.style.setProperty("--app-viewport-scale", "1");
      root.dataset.mobilePlatform = detectMobilePlatform();
    };

    updateViewportMetrics();

    /* Debounce resize to prevent constant reflows on mobile
       (address bar show/hide, keyboard open/close) */
    let resizeTimer: ReturnType<typeof setTimeout>;
    const debouncedUpdate = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateViewportMetrics, 150);
    };

    window.addEventListener("resize", debouncedUpdate);
    window.addEventListener("orientationchange", updateViewportMetrics);

    /* Do NOT listen to visualViewport resize/scroll — it fires on every
       pixel of address bar animation on mobile, causing constant reflows. */

    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", debouncedUpdate);
      window.removeEventListener("orientationchange", updateViewportMetrics);
    };
  }, []);

  return null;
}
