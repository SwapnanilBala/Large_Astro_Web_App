"use client";

import React, { useEffect, useRef } from "react";
import styles from "./CosmicBackground.module.css";

export default function CosmicBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId = 0;
    let isVisible = document.visibilityState === "visible";
    let logicalWidth = window.innerWidth;
    let logicalHeight = window.innerHeight;
    let driftT = Math.random() * Math.PI * 2;
    let particles: Array<{
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;
      twinkle: number;
    }> = [];

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      logicalWidth = window.innerWidth;
      logicalHeight = window.innerHeight;
      canvas.width = Math.floor(logicalWidth * dpr);
      canvas.height = Math.floor(logicalHeight * dpr);
      canvas.style.width = `${logicalWidth}px`;
      canvas.style.height = `${logicalHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles();
    };

    const initParticles = () => {
      particles = [];
      const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const areaDivisor = isCoarsePointer ? 26000 : 12000;
      const maxParticles = isCoarsePointer ? 60 : 140;
      const particleCount = Math.min(maxParticles, Math.floor((logicalWidth * logicalHeight) / areaDivisor));

      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * logicalWidth,
          y: Math.random() * logicalHeight,
          size: Math.random() * 2 + 0.5,
          speedX: (Math.random() - 0.5) * 0.2,
          speedY: (Math.random() - 0.5) * 0.2,
          opacity: Math.random() * 0.5 + 0.3,
          twinkle: Math.random() * Math.PI * 2,
        });
      }
    };

    const animate = () => {
      if (!isVisible) return;

      ctx.clearRect(0, 0, logicalWidth, logicalHeight);

      // Slow autonomous drift so the background stays alive even without
      // mouse/touch input (e.g. on mobile, where there's no hover).
      driftT += 0.0018;
      const driftX = logicalWidth * (0.5 + 0.3 * Math.cos(driftT));
      const driftY = logicalHeight * (0.5 + 0.24 * Math.sin(driftT * 0.85));

      const driftGlow = ctx.createRadialGradient(
        driftX, driftY, 0,
        driftX, driftY, Math.max(logicalWidth, logicalHeight) * 0.7
      );
      driftGlow.addColorStop(0, "rgba(108, 225, 212, 0.07)");
      driftGlow.addColorStop(0.5, "rgba(123, 107, 168, 0.04)");
      driftGlow.addColorStop(1, "rgba(42, 139, 126, 0)");
      ctx.fillStyle = driftGlow;
      ctx.fillRect(0, 0, logicalWidth, logicalHeight);

      // Draw gradient background (follows pointer/touch on top of the drift)
      const pointer = pointerRef.current;
      const gradient = ctx.createRadialGradient(
        pointer.x, pointer.y, 0,
        pointer.x, pointer.y, Math.max(logicalWidth, logicalHeight)
      );
      gradient.addColorStop(0, "rgba(212, 165, 116, 0.07)");
      gradient.addColorStop(0.5, "rgba(123, 107, 168, 0.04)");
      gradient.addColorStop(1, "rgba(42, 139, 126, 0.02)");

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, logicalWidth, logicalHeight);

      // Draw constellation lines
      ctx.strokeStyle = "rgba(212, 165, 116, 0.09)";
      ctx.lineWidth = 0.5;
      
      const CONNECT_DIST = 150;
      const grid: Map<string, number[]> = new Map();
      for (let i = 0; i < particles.length; i++) {
        const cx = Math.floor(particles[i].x / CONNECT_DIST);
        const cy = Math.floor(particles[i].y / CONNECT_DIST);
        const key = cx + ',' + cy;
        const bucket = grid.get(key);
        if (bucket) bucket.push(i); else grid.set(key, [i]);
      }
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        const cx = Math.floor(p1.x / CONNECT_DIST);
        const cy = Math.floor(p1.y / CONNECT_DIST);

        // Connect nearby particles (only check this cell and its 8 neighbors)
        for (let ncx = cx - 1; ncx <= cx + 1; ncx++) {
          for (let ncy = cy - 1; ncy <= cy + 1; ncy++) {
            const bucket = grid.get(ncx + ',' + ncy);
            if (!bucket) continue;
            for (const j of bucket) {
              if (j <= i) continue;
              const p2 = particles[j];
              const dx = p1.x - p2.x;
              const dy = p1.y - p2.y;
              const distance = Math.sqrt(dx * dx + dy * dy);

              if (distance < CONNECT_DIST) {
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.globalAlpha = (1 - distance / CONNECT_DIST) * 0.3;
                ctx.stroke();
              }
            }
          }
        }
      }

      // Draw particles
      ctx.globalAlpha = 1;
      
      particles.forEach((p) => {
        // Update position
        p.x += p.speedX;
        p.y += p.speedY;
        
        // Wrap around edges
        if (p.x < 0) p.x = logicalWidth;
        if (p.x > logicalWidth) p.x = 0;
        if (p.y < 0) p.y = logicalHeight;
        if (p.y > logicalHeight) p.y = 0;
        
        // Twinkle effect
        p.twinkle += 0.02;
        const twinkleOpacity = p.opacity + Math.sin(p.twinkle) * 0.2;
        
        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212, 165, 116, ${Math.max(0, twinkleOpacity)})`;
        ctx.fill();
        
        // Draw glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212, 165, 116, ${Math.max(0, twinkleOpacity * 0.1)})`;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      pointerRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleVisibilityChange = () => {
      isVisible = document.visibilityState === "visible";
      if (isVisible) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        cancelAnimationFrame(animationFrameId);
      }
    };

    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    resizeCanvas();
    pointerRef.current = { x: logicalWidth / 2, y: logicalHeight / 2 };
    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={styles.cosmicBackground}
      aria-hidden="true"
    />
  );
}
