import { TRANSIT_ORB_LIMIT } from "./transit-engine";

/*
 * Which of today's transits is actually news.
 *
 * The forecast used to pick its two transit lines by tightest orb:
 *
 *     aspects.sort((a, b) => a.orb - b.orb)   // transit-engine
 *     ...filter(supportive).slice(0, 1)       // chart-service
 *
 * Tightest orb is a measure of magnitude, not of newness, and the two come
 * apart badly because the planets move at wildly different rates. Saturn
 * covers about 0.03 degrees a day, so once it parks half a degree from a natal
 * point it is the tightest aspect in the chart for weeks -- measured on one
 * real chart, "Saturn conjunction natal Mars" was the challenging line on both
 * the 11th and the 24th of the same month, the same sentence thirteen days
 * apart with only the orb differing underneath. The Moon covers 13 degrees a
 * day and was available the whole time.
 *
 * So rank by two things a reader would recognise as new:
 *
 *   freshness  -- how long this aspect has already been inside the orb. An
 *                 aspect that arrived yesterday is news; one that has been
 *                 sitting there since spring has already been reported, every
 *                 day, for months.
 *
 *   imminence  -- how close it is to exact, and only while still closing. This
 *                 is what earns a slow planet its turn: Saturn is not news for
 *                 the 200 days it spends drifting through the orb, but it is
 *                 news in the few days around exact. Weighted by planet,
 *                 because a slow transit perfecting is the rarer event.
 *
 * Both come from the same measurement -- the orb one day either side of the
 * target -- so this costs two extra ephemeris samples and no stored state.
 *
 * On "have I already been told this": a per-reader ledger would need somewhere
 * to write, and the forecast is a pure function behind a shared cache, so
 * there is nowhere to write it that would not also have to be keyed per
 * reader. `ageInOrbDays` is the stateless stand-in and it answers the same
 * question for the case that actually hurts -- anything that has been true for
 * weeks has necessarily already been shown, whether or not we wrote it down.
 * It cannot know that a reader skipped three days; a real ledger could.
 */

/** A transit aspect as transit-engine reports it, before any interpretation. */
export type RawAspect = {
  transit_planet: string;
  natal_planet: string;
  aspect_type: string;
  orb: number;
};

export type AspectMotion = {
  /** Degrees of orb closed per day. Positive closes, negative opens. */
  driftPerDay: number;
  /** Degrees of orb travelled per day, sign discarded. */
  speedPerDay: number;
  /** True while the aspect is still closing on exact. */
  applying: boolean;
  /** Days until exact. Null once separating, or when motion is too slow to say. */
  daysToExact: number | null;
  /** Roughly how many days this aspect has already been inside the orb. */
  ageInOrbDays: number;
  /** The ranking score. Higher is more worth leading with. */
  noveltyScore: number;
};

export type RankedAspect = RawAspect & AspectMotion;

/*
 * How much a slow planet's exact hit outranks a fast one's.
 *
 * Roughly the inverse of mean daily motion, normalised. Saturn perfecting an
 * aspect happens a handful of times a decade for a given natal point; the Moon
 * does it every month, so it has to earn its place on freshness instead.
 */
const PLANET_SIGNIFICANCE: Record<string, number> = {
  Saturn: 1,
  Jupiter: 0.95,
  Rahu: 0.9,
  Ketu: 0.9,
  Mars: 0.7,
  Sun: 0.65,
  Venus: 0.6,
  Mercury: 0.55,
  Moon: 0.4,
};

const DEFAULT_SIGNIFICANCE = 0.6;

/** Days over which "just arrived" decays to "been here a while". */
const FRESHNESS_SCALE_DAYS = 3;

/** How far out an approaching exact aspect starts to count as imminent. */
const IMMINENCE_WINDOW_DAYS = 7;

/* Below this the planet is effectively stationary and the direction of travel
   cannot be read from the sample. */
const MIN_READABLE_SPEED = 1e-4;

/*
 * How far either side of the target the orb is sampled, in days.
 *
 * Six hours, not a day. The Moon covers about 13 degrees of longitude a day,
 * so day-apart samples straddle 26 degrees -- more than three times the 8
 * degree orb, which means a lunar aspect can enter, perfect and leave entirely
 * between two samples. Differencing across that gap does not measure the
 * Moon's speed, it aliases it: measured on a real chart it reported 1.9
 * degrees a day for a Moon aspect instead of ~13, which inflated the computed
 * age of every tight lunar aspect and let a 7.8 degree one lead the day.
 *
 * At six hours the Moon moves ~3.3 degrees, comfortably inside the orb, and
 * Saturn still moves ~0.008 -- two orders of magnitude above the readable
 * floor above. So one spacing serves both ends of the range.
 */
const DEFAULT_SAMPLE_SPACING_DAYS = 0.25;

export const FORECAST_SAMPLE_SPACING_DAYS = DEFAULT_SAMPLE_SPACING_DAYS;

const WEIGHT_FRESHNESS = 0.9;
const WEIGHT_IMMINENCE = 1.3;
/*
 * Tightness has to carry real weight, not just break ties.
 *
 * An aspect's age is (limit - orb) / speed, so "just arrived" and "barely in
 * orb" are the same statement -- anything entering the window arrives at 8
 * degrees. Freshness alone therefore prefers the widest aspect available,
 * which is backwards. Its job is to separate fast movers from parked ones at a
 * comparable orb; tightness is what keeps the winner worth reading today.
 */
const WEIGHT_TIGHTNESS = 0.55;

export function aspectKey(aspect: RawAspect): string {
  return `${aspect.transit_planet}|${aspect.natal_planet}|${aspect.aspect_type}`;
}

function orbLookup(aspects: RawAspect[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const aspect of aspects) {
    /* Same triple can only appear once per snapshot, but take the tighter of
       any duplicates rather than whichever happened to be last. */
    const existing = map.get(aspectKey(aspect));
    if (existing === undefined || aspect.orb < existing) {
      map.set(aspectKey(aspect), aspect.orb);
    }
  }
  return map;
}

/**
 * Measures how an aspect is moving, from the orb a day either side.
 *
 * `orbBefore` and `orbAfter` are the same aspect's orb on the previous and
 * next day. Either may be missing: an aspect that entered the orb today has no
 * reading for yesterday, which is itself the strongest possible freshness
 * signal and is treated as such.
 */
export function measureAspect(
  aspect: RawAspect,
  orbBefore: number | undefined,
  orbAfter: number | undefined,
  spacingDays: number = DEFAULT_SAMPLE_SPACING_DAYS
): RankedAspect {
  const orb = aspect.orb;

  /* Speed from whichever neighbours exist. Around the exact moment the orb is
     a V -- down to zero and back up -- so a centred difference reads as nearly
     stationary exactly when the aspect matters most. Taking the larger of the
     two one-sided steps keeps the speed honest through the turn.
     Divided by the spacing, because the samples are hours apart, not a day. */
  const stepBefore = orbBefore === undefined ? undefined : Math.abs(orb - orbBefore);
  const stepAfter = orbAfter === undefined ? undefined : Math.abs(orbAfter - orb);
  const steps = [stepBefore, stepAfter].filter((s): s is number => s !== undefined);
  const speedPerDay = steps.length > 0 ? Math.max(...steps) / spacingDays : 0;

  /* Direction needs the pair. With only one neighbour, compare against it;
     with neither, call it separating so it cannot claim imminence it has not
     been shown to have. */
  let driftPerDay: number;
  if (orbBefore !== undefined && orbAfter !== undefined) {
    driftPerDay = (orbBefore - orbAfter) / (2 * spacingDays);
  } else if (orbBefore !== undefined) {
    driftPerDay = (orbBefore - orb) / spacingDays;
  } else if (orbAfter !== undefined) {
    driftPerDay = (orb - orbAfter) / spacingDays;
  } else {
    driftPerDay = 0;
  }

  /* Perfecting right now: lower than both neighbours. The centred difference
     is ~0 here, so this case has to be recognised rather than derived. */
  const atTurn =
    orbBefore !== undefined && orbAfter !== undefined && orb < orbBefore && orb < orbAfter;

  const readable = speedPerDay >= MIN_READABLE_SPEED;
  const applying = atTurn || (readable && driftPerDay > 0);

  let daysToExact: number | null = null;
  if (atTurn) {
    daysToExact = 0;
  } else if (applying && readable) {
    daysToExact = orb / speedPerDay;
  }

  /*
   * Time already spent inside the orb.
   *
   * Still closing: it has crossed from the edge to here, so (limit - orb).
   * Already separating: it came in from the edge, perfected, and travelled
   * back out to here, so (limit - orb) + 2 * orb. A separating aspect has
   * always been around longer than an applying one at the same orb, which is
   * the asymmetry that stops a departing Saturn from reading as new.
   */
  let ageInOrbDays: number;
  if (!readable) {
    /* Effectively stationary inside the orb: as old as it gets. */
    ageInOrbDays = Number.POSITIVE_INFINITY;
  } else if (orbBefore === undefined) {
    /* No reading yesterday means it was outside the orb then. */
    ageInOrbDays = 0;
  } else {
    const travelled = applying
      ? TRANSIT_ORB_LIMIT - orb
      : TRANSIT_ORB_LIMIT - orb + 2 * orb;
    ageInOrbDays = Math.max(0, travelled) / speedPerDay;
  }

  const freshness = 1 / (1 + ageInOrbDays / FRESHNESS_SCALE_DAYS);

  const significance =
    PLANET_SIGNIFICANCE[aspect.transit_planet] ?? DEFAULT_SIGNIFICANCE;
  const imminence =
    daysToExact === null
      ? 0
      : Math.max(0, 1 - daysToExact / IMMINENCE_WINDOW_DAYS) * significance;

  const tightness = 1 - Math.min(orb, TRANSIT_ORB_LIMIT) / TRANSIT_ORB_LIMIT;

  const noveltyScore =
    WEIGHT_FRESHNESS * freshness +
    WEIGHT_IMMINENCE * imminence +
    WEIGHT_TIGHTNESS * tightness;

  return {
    ...aspect,
    driftPerDay,
    speedPerDay,
    applying,
    daysToExact,
    ageInOrbDays,
    noveltyScore,
  };
}

/**
 * Ranks the target day's aspects by how much of a change they represent.
 *
 * The three snapshots are the same aspect set computed `spacingDays` before the
 * target moment, on it, and the same distance after. Only the target's aspects
 * are ranked; the neighbours exist to measure motion.
 */
export function rankAspectsByNovelty(
  onTarget: RawAspect[],
  sampleBefore: RawAspect[],
  sampleAfter: RawAspect[],
  spacingDays: number = DEFAULT_SAMPLE_SPACING_DAYS
): RankedAspect[] {
  const before = orbLookup(sampleBefore);
  const after = orbLookup(sampleAfter);

  return onTarget
    .map((aspect) =>
      measureAspect(
        aspect,
        before.get(aspectKey(aspect)),
        after.get(aspectKey(aspect)),
        spacingDays
      )
    )
    .sort((left, right) => {
      if (right.noveltyScore !== left.noveltyScore) {
        return right.noveltyScore - left.noveltyScore;
      }
      /* Stable and deterministic: the cache and the server render have to
         agree, so ties cannot fall to input order. */
      return aspectKey(left).localeCompare(aspectKey(right));
    });
}
