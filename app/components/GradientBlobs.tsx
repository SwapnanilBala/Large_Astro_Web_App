"use client";

import { useEffect, useState } from "react";

const BLOBS = [
  {
    color: "rgba(62, 205, 165, 0.15)",
    colorLight: "rgba(91, 47, 160, 0.12)",
    size: 700,
    left: "5%",
    top: "10%",
  },
  {
    color: "rgba(240, 183, 84, 0.12)",
    colorLight: "rgba(196, 127, 10, 0.10)",
    size: 600,
    left: "60%",
    top: "5%",
  },
  {
    color: "rgba(140, 100, 220, 0.10)",
    colorLight: "rgba(123, 69, 192, 0.10)",
    size: 550,
    left: "35%",
    top: "60%",
  },
  {
    color: "rgba(240, 112, 104, 0.08)",
    colorLight: "rgba(184, 64, 58, 0.08)",
    size: 500,
    left: "70%",
    top: "65%",
  },
];

/* Lightweight gradient blobs — pure CSS, no Framer Motion, no animation.
   Static positioning eliminates GPU thrashing on mobile. */
export default function GradientBlobs() {
  const [isLight, setIsLight] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);

    const checkTheme = () => {
      setIsLight(document.documentElement.getAttribute("data-theme") === "light");
    };
    checkTheme();
    const obs = new MutationObserver(checkTheme);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => obs.disconnect();
  }, []);

  /* On mobile: only render 2 blobs with smaller size and less blur */
  const visibleBlobs = isMobile ? BLOBS.slice(0, 2) : BLOBS;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {visibleBlobs.map((blob, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: isMobile ? blob.size * 0.6 : blob.size,
            height: isMobile ? blob.size * 0.6 : blob.size,
            left: blob.left,
            top: blob.top,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${isLight ? blob.colorLight : blob.color} 0%, transparent 70%)`,
            filter: isMobile ? "blur(60px)" : "blur(100px)",
            transform: "translateZ(0)",
          }}
        />
      ))}
    </div>
  );
}
