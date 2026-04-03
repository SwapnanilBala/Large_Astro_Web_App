"use client";

import ParallaxLayer from "./ParallaxLayer";
import styles from "./CosmicOrbs.module.css";

/**
 * Three small gradient orbs that float with parallax on the insights page.
 * Purely decorative — hidden from screen readers and disabled on mobile
 * via the ParallaxLayer (depth collapses to 0 on mobile).
 */
export default function CosmicOrbs() {
  return (
    <div aria-hidden="true" className={styles.container}>
      {/* Gold orb — top-right region */}
      <ParallaxLayer depth={0.15} maxTranslate={20} maxRotate={0}>
        <div className={`${styles.orb} ${styles.orbGold}`} />
      </ParallaxLayer>

      {/* Aqua orb — bottom-left region */}
      <ParallaxLayer depth={0.2} maxTranslate={18} maxRotate={0}>
        <div className={`${styles.orb} ${styles.orbAqua}`} />
      </ParallaxLayer>

      {/* Coral orb — mid-right region */}
      <ParallaxLayer depth={0.12} maxTranslate={14} maxRotate={0}>
        <div className={`${styles.orb} ${styles.orbCoral}`} />
      </ParallaxLayer>
    </div>
  );
}
