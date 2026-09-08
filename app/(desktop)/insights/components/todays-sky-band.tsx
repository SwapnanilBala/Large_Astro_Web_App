"use client";

import PlanetOrb, { type PlanetName } from "@/app/components/PlanetOrb";
import type { ChartApiResponse } from "@/lib/astro-types";
import styles from "../insights.module.css";

/*
 * Today's Sky — a full-bleed strip of where the planets actually are.
 *
 * Fed from payload.transits, not payload.chart.planets. getChartPayload builds
 * with includeTransits: true, so live positions are already on the page and
 * this costs no extra request. That matters for the label as much as for the
 * cost: a strip headed "Today's Sky" showing natal placements would simply be
 * false, and it is the kind of false that nobody notices because both sets of
 * numbers look equally plausible.
 *
 * Nine planets, not the ten a Western strip would carry. Uranus, Neptune and
 * Pluto do not exist anywhere in this engine -- they are not omitted here, they
 * are unavailable. The nine are the seven classical grahas plus Rahu and Ketu,
 * which is what a Vedic chart uses.
 *
 * The rail chrome, the horizontal scroll with its edge mask, the scroll-snap
 * and the gentle arc the orbs sit on are all reused from the .heroPlanet* rules
 * in insights.module.css. Those were written and then never wired to anything;
 * only .heroPlanetRow's `display: flex` was missing, which is probably why.
 */

/** The engine's nine. PlanetOrb has a class for each and nothing else. */
const ORB_PLANETS: ReadonlySet<string> = new Set<PlanetName>([
  "Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Rahu", "Ketu",
]);

function isOrbPlanet(name: string): name is PlanetName {
  return ORB_PLANETS.has(name);
}

/*
 * Explicit en-US rather than the runtime locale.
 *
 * `Intl.DateTimeFormat(undefined, ...)` resolves differently in Node and in the
 * browser, and this string is rendered on both sides -- which is a hydration
 * mismatch, and React discards the tree rather than patching it.
 */
const SKY_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export type TodaysSkyBandProps = {
  transits: ChartApiResponse["transits"];
};

export default function TodaysSkyBand({ transits }: TodaysSkyBandProps) {
  const positions = (transits?.positions ?? []).filter((position) =>
    isOrbPlanet(position.name)
  );

  /* Nothing to draw rather than an empty rail: transits are optional on the
     payload type, and a rail with no orbs in it reads as a broken component. */
  if (positions.length === 0) return null;

  const asOf = transits?.computed_at_utc
    ? SKY_DATE.format(new Date(transits.computed_at_utc))
    : null;

  return (
    <section
      className={`${styles.band} ${styles.bandFlush} ${styles.skyBand}`}
      aria-labelledby="todays-sky-heading"
    >
      <div className={styles.skyLabel}>
        <p className={styles.heroPlanetKicker}>Today&apos;s sky</p>
        <h2 id="todays-sky-heading" className={styles.heroPlanetTitle}>
          {asOf ?? "Right now"}
        </h2>
      </div>

      <div className={styles.heroPlanetRail}>
        <div className={styles.heroPlanetScroller}>
          <ul className={styles.heroPlanetRow}>
            {positions.map((position) => (
              <li key={position.name} className={styles.skyPlanet}>
                <PlanetOrb
                  planet={position.name as PlanetName}
                  size="sm"
                  ariaLabel={`${position.name} in ${position.sign}`}
                />
                <span className={styles.skyPlanetName}>{position.name}</span>
                <span className={styles.skyPlanetSign}>in {position.sign}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className={styles.skyNote}>
        Where the planets are today
        <span>not where they were at your birth</span>
      </p>
    </section>
  );
}
