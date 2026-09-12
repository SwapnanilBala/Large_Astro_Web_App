import { ArcFan, OrbitCluster, Ribbon, Rosette } from "@/app/components/backdrop-figures";
import styles from "./insights-backdrop.module.css";

/**
 * Abstract decorative backdrop for the reading, mounted once in the insights
 * layout so it is the same on /insights and on every page hanging off it.
 *
 * Third composition of the figures in app/components/backdrop-figures.tsx,
 * after the desktop landing page and the handset one. The canvas here is
 * unlike either.
 *
 * ── What is actually visible on this route ─────────────────────────────────
 *
 * Almost nothing is uncovered. `.dashboard-shell` is `width: min(--shell-max,
 * 100%)` inside a shell padded by `max(1rem, safe-area)`, so at 1440 the card
 * is 1408 wide and the side gutters are 16px each. The only bare ground is the
 * strip above the card that holds the back button, and the padding below it.
 *
 * What makes a backdrop worth having anyway is that the card is barely there:
 * `background: var(--surface-strong)` is `rgba(255, 248, 232, 0.065)` in dark
 * and `rgba(120, 75, 97, 0.075)` in light, over `backdrop-filter: blur(20px)`.
 * Ninety-three per cent of whatever sits behind it comes through, blurred. So
 * this layer is not decoration around the content — it is the texture seen
 * through the glass, and it is composed for that:
 *
 * BIGGER, FEWER, FAINTER. Figures run to 46rem rather than the landing page's
 * 36rem, because a 20px blur eats detail and leaves only gross form; and their
 * opacities sit below the landing page's, because unlike that page this one
 * puts several thousand words of text on top of what the layer paints.
 *
 * NO STAR FIELD. The desktop layout already mounts <GradientBlobs />, and
 * `.insights-shell` declares no background of its own, so its constellation
 * field is visible on this route. A second scatter of dots would be two star
 * fields that almost match — the exact thing backdrop-figures.tsx exists to
 * stop.
 *
 * NO GRAIN. Same reasoning. This route already carries two full-screen
 * textures: that star field, and the `backdrop-1280.webp` wash on
 * `.insights-shell::before`. A dot lattice would be a third.
 *
 * ── Where it sits ──────────────────────────────────────────────────────────
 *
 * Mounted in the layout rather than inside the page, and deliberately outside
 * <PageTransition>: that is a framer-motion subtree animating `opacity` and
 * `scale`, so it is a stacking context, and anything rendered inside it cannot
 * be placed under `.dashboard-shell`'s `z-index: 1` from out here. As a
 * sibling ahead of it, at `z-index: 0` fixed, this paints below the card, below
 * `.insights-shell::before`'s wash, and above the page canvas.
 *
 * Nothing animates, for the same reason as the other two.
 */
export default function InsightsBackdrop() {
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <Rosette className={`${styles.shape} ${styles.rosette} ${styles.violet}`} />
      <ArcFan className={`${styles.shape} ${styles.arcsTop} ${styles.teal}`} />
      <Ribbon className={`${styles.shape} ${styles.ribbon} ${styles.teal}`} />
      <OrbitCluster className={`${styles.shape} ${styles.orbits} ${styles.gold}`} />
      <ArcFan className={`${styles.shape} ${styles.arcsBottom} ${styles.gold}`} />
    </div>
  );
}
