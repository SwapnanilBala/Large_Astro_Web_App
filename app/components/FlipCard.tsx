"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import styles from "./FlipCard.module.css";

interface FlipCardProps {
  front: ReactNode;
  back: ReactNode;
  isFlipped: boolean;
  onFlip: () => void;
}

export default function FlipCard({ front, back, isFlipped, onFlip }: FlipCardProps) {
  const [flipping, setFlipping] = useState(false);
  const prevFlipped = useRef(isFlipped);

  useEffect(() => {
    if (prevFlipped.current !== isFlipped) {
      prevFlipped.current = isFlipped;
      setFlipping(true);
      const timer = setTimeout(() => setFlipping(false), 600);
      return () => clearTimeout(timer);
    }
  }, [isFlipped]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onFlip();
      }
    },
    [onFlip]
  );

  const cardClasses = [
    styles.card,
    isFlipped ? styles.flipped : "",
    flipping ? styles.flipping : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.scene}>
      <div
        className={cardClasses}
        role="button"
        tabIndex={0}
        aria-label={isFlipped ? "Flip card to front" : "Flip card to see details"}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.front}>{front}</div>
        <div className={styles.back}>{back}</div>
      </div>
    </div>
  );
}
