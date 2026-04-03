"use client";

import { useMemo, type ReactNode, type CSSProperties, type ElementType } from "react";
import { useParallax } from "./ParallaxContainer";

interface ParallaxLayerProps {
  /** 0 = no movement, 1 = maximum movement */
  depth?: number;
  /** max translation in px (default 15) */
  maxTranslate?: number;
  /** max rotation in degrees (default 2) */
  maxRotate?: number;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: ElementType;
}

export default function ParallaxLayer({
  depth = 0,
  maxTranslate = 15,
  maxRotate = 2,
  children,
  className,
  style,
  as: Tag = "div",
}: ParallaxLayerProps) {
  const { x, y } = useParallax();

  const transform = useMemo(() => {
    const tx = x * depth * maxTranslate;
    const ty = y * depth * maxTranslate;
    const rx = -y * depth * maxRotate; // tilt opposite to mouse for natural feel
    const ry = x * depth * maxRotate;
    return `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
  }, [x, y, depth, maxTranslate, maxRotate]);

  const mergedStyle: CSSProperties = {
    willChange: depth > 0 ? "transform" : undefined,
    transform: depth > 0 ? transform : undefined,
    ...style,
  };

  return (
    <Tag className={className} style={mergedStyle}>
      {children}
    </Tag>
  );
}
