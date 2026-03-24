"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const BLOBS = [
  {
    color: "rgba(62, 205, 165, 0.15)",
    colorLight: "rgba(62, 205, 165, 0.25)",
    size: 700,
    x: ["5%", "15%", "8%"],
    y: ["10%", "30%", "15%"],
    duration: 25,
  },
  {
    color: "rgba(240, 183, 84, 0.12)",
    colorLight: "rgba(240, 183, 84, 0.20)",
    size: 600,
    x: ["70%", "60%", "75%"],
    y: ["5%", "20%", "10%"],
    duration: 30,
  },
  {
    color: "rgba(140, 100, 220, 0.10)",
    colorLight: "rgba(180, 150, 240, 0.18)",
    size: 550,
    x: ["40%", "50%", "35%"],
    y: ["60%", "75%", "65%"],
    duration: 22,
  },
  {
    color: "rgba(240, 112, 104, 0.08)",
    colorLight: "rgba(240, 150, 140, 0.15)",
    size: 500,
    x: ["80%", "70%", "85%"],
    y: ["70%", "55%", "75%"],
    duration: 28,
  },
];

export default function GradientBlobs() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);

    const checkTheme = () => {
      setIsLight(document.documentElement.getAttribute("data-theme") === "light");
    };
    checkTheme();
    const obs = new MutationObserver(checkTheme);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      mq.removeEventListener("change", handler);
      obs.disconnect();
    };
  }, []);

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
      {BLOBS.map((blob, i) => (
        <motion.div
          key={i}
          initial={{ x: blob.x[0], y: blob.y[0] }}
          animate={
            reducedMotion
              ? {}
              : {
                  x: blob.x,
                  y: blob.y,
                }
          }
          transition={{
            duration: blob.duration,
            repeat: Infinity,
            repeatType: "mirror",
            ease: "easeInOut",
          }}
          style={{
            position: "absolute",
            width: blob.size,
            height: blob.size,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${isLight ? blob.colorLight : blob.color} 0%, transparent 70%)`,
            filter: "blur(100px)",
            willChange: "transform",
          }}
        />
      ))}
    </div>
  );
}
