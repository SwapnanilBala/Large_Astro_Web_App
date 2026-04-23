"use client";

import { useCallback, useRef, useEffect } from "react";
import styles from "./FieldStarBurst.module.css";

interface FieldStarBurstProps {
  targetRef: React.RefObject<HTMLElement | null>;
  fieldKey: string;
  isComplete: boolean;
  color?: "gold" | "aqua" | "coral" | "violet" | "rose";
}

const COLOR_MAP = {
  gold: "#C89B3C",
  aqua: "#1A7B6E",
  coral: "#F07068",
  violet: "#8C64DC",
  rose: "#F096AA",
};

export default function FieldStarBurst({ 
  targetRef, 
  fieldKey, 
  isComplete, 
  color = "gold" 
}: FieldStarBurstProps) {
  const burstRef = useRef<HTMLDivElement>(null);
  const hasTriggered = useRef(false);
  const burstColor = COLOR_MAP[color];

  const triggerBurst = useCallback(() => {
    const target = targetRef.current;
    const burst = burstRef.current;
    if (!target || !burst) return;

    const rect = target.getBoundingClientRect();
    const burstRect = burst.getBoundingClientRect();
    
    // Position burst at center of target relative to burst container
    const centerX = rect.left + rect.width / 2 - burstRect.left;
    const centerY = rect.top + rect.height / 2 - burstRect.top;

    // Create star burst particles
    const particleCount = 12;
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement("span");
      particle.className = styles.burstParticle;
      
      const angle = (360 / particleCount) * i + Math.random() * 30;
      const distance = 40 + Math.random() * 30;
      
      particle.style.cssText = `
        position: absolute;
        left: ${centerX}px;
        top: ${centerY}px;
        width: ${4 + Math.random() * 3}px;
        height: ${4 + Math.random() * 3}px;
        background: ${burstColor};
        border-radius: 50%;
        box-shadow: 0 0 ${8 + Math.random() * 6}px ${burstColor};
        pointer-events: none;
        --angle: ${angle}deg;
        --distance: ${distance}px;
      `;
      
      burst.appendChild(particle);
      
      // Trigger animation
      requestAnimationFrame(() => {
        particle.classList.add(styles.particleAnimating);
      });
      
      // Cleanup
      setTimeout(() => {
        particle.remove();
      }, 800);
    }

    // Add ring expansion
    const ring = document.createElement("span");
    ring.className = styles.burstRing;
    ring.style.cssText = `
      position: absolute;
      left: ${centerX}px;
      top: ${centerY}px;
      border: 2px solid ${burstColor};
      box-shadow: 0 0 20px ${burstColor}40;
    `;
    burst.appendChild(ring);
    
    requestAnimationFrame(() => {
      ring.classList.add(styles.ringAnimating);
    });
    
    setTimeout(() => ring.remove(), 600);
  }, [burstColor, targetRef]);

  useEffect(() => {
    if (isComplete && !hasTriggered.current) {
      hasTriggered.current = true;
      // Small delay to let the validation state settle visually
      const timer = setTimeout(triggerBurst, 150);
      return () => clearTimeout(timer);
    } else if (!isComplete) {
      hasTriggered.current = false;
    }
  }, [isComplete, triggerBurst, fieldKey]);

  return (
    <div 
      ref={burstRef}
      className={styles.burstContainer}
      aria-hidden="true"
    />
  );
}

// Hook version for easier usage
export function useFieldStarBurst() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const burstAt = useCallback((x: number, y: number, color: keyof typeof COLOR_MAP = "gold") => {
    const container = containerRef.current;
    if (!container) return;
    
    const burstColor = COLOR_MAP[color];
    const particleCount = 10;
    
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement("span");
      particle.className = styles.burstParticle;
      
      const angle = (360 / particleCount) * i + Math.random() * 20;
      const distance = 30 + Math.random() * 25;
      
      particle.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        width: ${3 + Math.random() * 3}px;
        height: ${3 + Math.random() * 3}px;
        background: ${burstColor};
        border-radius: 50%;
        box-shadow: 0 0 ${6 + Math.random() * 4}px ${burstColor};
        pointer-events: none;
        --angle: ${angle}deg;
        --distance: ${distance}px;
      `;
      
      container.appendChild(particle);
      
      requestAnimationFrame(() => {
        particle.classList.add(styles.particleAnimating);
      });
      
      setTimeout(() => particle.remove(), 700);
    }
  }, []);
  
  const BurstContainer = useCallback(() => (
    <div ref={containerRef} className={styles.burstContainer} aria-hidden="true" />
  ), []);
  
  return { burstAt, BurstContainer, containerRef };
}
