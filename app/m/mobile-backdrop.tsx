import { ArcFan, OrbitCluster, Ribbon, Rosette, StarField } from "@/app/components/backdrop-figures";
import styles from "./mobile-backdrop.module.css";

/**
 * Abstract decorative backdrop for the handset landing intake.
 *
 * Sibling of app/components/IntakeBackdrop.tsx and drawn from the same figures
 * in backdrop-figures.tsx, but composed from scratch: the two canvases share no
 * usable geometry. Desktop has a wide top band, two outer gutters and a lower
 * band around a pair of cards. A handset has a single 390-wide column where
 * the fields run edge to edge, no gutters worth the name, and one large empty
 * block between the last field and the fixed action bar. That block is where
 * this composition lives, and everything else is corner work.
 *
 * ── What this one does differently ─────────────────────────────────────────
 *
 * FIVE FIGURES, NOT SEVEN. The lattice and the second arc fan are desktop
 * gutter pieces with nowhere to be here, and at this width a sixth and seventh
 * shape reads as clutter rather than depth.
 *
 * THE LAYER IS FIXED, NOT ABSOLUTE. Desktop anchors to a page that is roughly
 * one viewport tall whatever you type into it. This form changes height as you
 * go — step two swaps in different fields, and ticking "I don't know my exact
 * birth time" removes one outright — so a composition pinned to the document
 * would slide around under the content as the form grew and shrank. Pinned to
 * the viewport it stays composed, and it costs nothing extra: a fixed layer is
 * promoted once and never repainted on scroll.
 *
 * THE HUES ARE DECLARED LOCALLY. The /m tree loads mobile-shell.css and not
 * globals.css, and that sheet defines eleven tokens, one of which is an accent.
 * There is no `--accent-teal` or `--accent-purple` to point at. Rather than
 * push two decorative values into a base sheet whose own header asks callers
 * to keep it small, the module states them and the theme swap in one place.
 *
 * Nothing animates, for the same reason as desktop.
 */
export default function MobileBackdrop() {
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <StarField portrait className={`${styles.shape} ${styles.stars} ${styles.gold}`} />
      <Rosette className={`${styles.shape} ${styles.rosette} ${styles.violet}`} />
      <Ribbon className={`${styles.shape} ${styles.ribbon} ${styles.teal}`} />
      <OrbitCluster className={`${styles.shape} ${styles.orbits} ${styles.gold}`} />
      <ArcFan className={`${styles.shape} ${styles.arcs} ${styles.teal}`} />
    </div>
  );
}
