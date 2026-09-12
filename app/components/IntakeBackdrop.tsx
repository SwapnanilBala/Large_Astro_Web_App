import {
  ArcFan,
  DiamondLattice,
  OrbitCluster,
  Ribbon,
  Rosette,
  StarField,
} from "./backdrop-figures";
import styles from "./IntakeBackdrop.module.css";

/**
 * Abstract decorative backdrop for the desktop landing intake.
 *
 * The first viewport used to be a flat plane: `.professionalIntake` paints an
 * opaque background, which covers the layout's <GradientBlobs /> star field
 * entirely, so the only decoration reaching the screen was the one rotated
 * chart-square in `.professionalIntake::before`. Both pseudo-elements on that
 * selector are already spoken for, hence a real element.
 *
 * The figures live in backdrop-figures.tsx, which also carries the rules they are
 * drawn to. This file is placement, and placement is the whole of the
 * difference between this backdrop and the handset one in
 * app/m/mobile-backdrop.tsx — see there for the portrait composition.
 *
 * ── Two rules this composition obeys ───────────────────────────────────────
 *
 * 1. NOTHING ANIMATES. The landing layer's own comment ("keeps all decoration
 *    static so low-end devices do not pay for ambient motion") is a decision,
 *    not an omission — this layer is composed rather than animated, so it costs
 *    one paint and never touches the main thread again.
 *
 * 2. SHAPES ARE ANCHORED, NOT SLICED. One full-bleed SVG with
 *    `preserveAspectRatio="slice"` crops its own corners at the aspect ratios
 *    it was not drawn for, which is exactly where corner decor lives. Each
 *    figure is instead placed by CSS at its own intrinsic ratio, so it stays
 *    undistorted and keeps the edge it was drawn against.
 *
 * Placement follows where the page is actually empty at desktop widths: the
 * band above the form card, the band below it, and the outer gutters. The
 * cards cover the middle, so shapes that cross it are drawn to read from both
 * ends.
 */
export default function IntakeBackdrop() {
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <Rosette className={`${styles.shape} ${styles.rosette} ${styles.violet}`} />
      <StarField className={`${styles.shape} ${styles.stars} ${styles.gold}`} />
      <ArcFan className={`${styles.shape} ${styles.arcsTop} ${styles.teal}`} />
      <Ribbon className={`${styles.shape} ${styles.ribbon} ${styles.teal}`} />
      <OrbitCluster className={`${styles.shape} ${styles.orbits} ${styles.gold}`} />
      <ArcFan className={`${styles.shape} ${styles.arcsBottom} ${styles.coral}`} />
      <DiamondLattice className={`${styles.shape} ${styles.lattice} ${styles.gold}`} />
    </div>
  );
}
