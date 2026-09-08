/**
 * Weekly energy — a seven-day personal score.
 *
 * ── Why this is not just the muhurta scorer over seven days ────────────────
 *
 * scoreHour() in muhurta-engine.ts derives entirely from the Sun's and Moon's
 * longitudes plus a latitude and a timezone. It never reads the natal chart. So
 * aggregating it would produce a panel titled "Your Weekly Energy" that is
 * identical for every user in the same city — a lie told in the second person.
 *
 * Half of this score is therefore natal: tarabala and chandrabala (both counted
 * FROM the natal Moon, so the whole cycle is offset per person) and transit
 * aspects to the natal planets. The panchanga half is shared, and is the same
 * `general_auspicious` weighting the muhurta engine already uses, so the two
 * features cannot disagree about whether a day is a good one.
 *
 * ── Sampling: one instant per day, at local sunrise ────────────────────────
 *
 * Seven ephemeris calls, not 168. Tithi, nakshatra, yoga and karana are
 * day-level qualities lasting 20-26 hours, and classical practice quotes them
 * at sunrise — which is also where the Vedic day begins, so the day boundary
 * agrees with the weekday factor rather than with UTC midnight.
 *
 * Rahukaala, Yamaghantaka and the hora are deliberately EXCLUDED, though
 * scoreHour includes all three. They are 60-90 minute windows: every day has a
 * Rahukaala, so including it either penalises all seven days identically (no
 * signal at all) or penalises whichever day the sample happens to land inside
 * one (pure sampling artifact). They are electional filters for choosing when
 * to *start* something, not statements about a day's quality.
 *
 * ── The arithmetic ─────────────────────────────────────────────────────────
 *
 *   dayScore = 50 + panchangaTerm + personalTerm
 *
 * with each term bounded to ±25, so the result is always within [0, 100] and
 * the final clamp never actually fires. That matters: a clamp that fires
 * discards ranking information between two days that both pinned.
 */

import type { PlanetPosition } from "./swiss-ephemeris-engine";
import { computeTransitPositions } from "./swiss-ephemeris-engine";
import { computeTransitAspects, type TransitPosition } from "./transit-engine";
import { calculateNakshatra } from "./nakshatra-engine";
import { getSunrise } from "./muhurta-engine";
import {
  computeNakshatraFromLongitude,
  computeTithi,
  computeYoga,
  getKarana,
  getKaranaHalf,
  NAKSHATRA_QUALITY,
  type NakshatraQuality,
  type TithiGroup,
} from "./panchanga";
import { SIGN_RULERS, ZODIAC_SIGNS } from "@/lib/rules/context";
import { parseDateString, weekDays, weekEnd, formatWeekRangeLabel, formatDayShort } from "@/lib/format-week";
import {
  HEADLINE_GUIDANCE,
  HEADLINE_NOUNS,
  HEADLINE_OPENERS,
  HEADLINE_VERBS,
  INTENT_AFFINITY,
  INTENT_COPY,
  QUOTE_AFFINITY,
  WEEKDAY_LORDS,
  type HeadlineShape,
} from "./weekly-energy-copy";
import type {
  CalendarPlannerIntent,
  EnergyBand,
  EnergyFactorKind,
  WeeklyEnergyCard,
  WeeklyEnergyDay,
  WeeklyEnergyFactor,
  WeeklyEnergyHeadline,
  WeeklyEnergyWeek,
} from "@/lib/astro-types";

/* Re-exported so callers can take the model and its shapes from one import. */
export type {
  EnergyBand,
  EnergyFactorKind,
  WeeklyEnergyCard,
  WeeklyEnergyDay,
  WeeklyEnergyFactor,
  WeeklyEnergyHeadline,
  WeeklyEnergyWeek,
};

/**
 * Bumped whenever any weight, threshold or copy table below changes.
 *
 * Participates in the cache key, so a model change is visible immediately
 * instead of hiding behind up to six hours of warm cache. Same trick as
 * RULES_SCHEMA_VERSION and LIFE_DOMAIN_RULES_VERSION.
 */
export const WEEKLY_ENERGY_MODEL_VERSION = "weekly-energy-1";

/**
 * Fixed thresholds, NOT relative to the week.
 *
 * The bands are horizontal lines on the chart. A band computed from the week's
 * own min and max is a band that moves, so the identical absolute day would sit
 * in "High" one week and "Low" the next — and the pager puts those two weeks
 * side by side, which makes the contradiction visible. Relative banding also
 * guarantees every week has a High day and a Low day, including a genuinely
 * flat week, which is exactly the false confidence this panel should not have.
 *
 * MEASURED, not reasoned. Over 8 charts x 52 weeks x 7 days = 2,912 real days
 * the score lands median 56, p25 46, p75 66, and these thresholds put 26.3% of
 * days in High, 46.5% in Balanced and 27.1% in Low. That shape is the point:
 * the two tails are comparably exceptional and Balanced is the norm, which is
 * what those three words have to mean for the band to tell the reader
 * anything.
 *
 * The first attempt at this reasoned the thresholds from the weight tables
 * instead and got 62/45, which measured at 67.6% of all days in High -- a
 * panel assuring everyone that two thirds of their days were exceptional. The
 * lesson is in lib/__tests__/weekly-energy-engine.test.ts, which freezes the
 * distribution so a later weight change cannot quietly undo this.
 */
export const ENERGY_BAND_THRESHOLDS = { high: 66, low: 46 } as const;

/**
 * Below this spread the week is flat and naming a peak would overclaim.
 *
 * A guard for degenerate inputs rather than a common case: across the same 416
 * measured weeks the narrowest spread was 15, so this never fired for a
 * mid-latitude chart. It is kept for the cases that flatten the inputs --
 * above |lat| 66 the sunrise approximation returns a fixed day length, which
 * takes the variation out of everything derived from it.
 */
export const PEAK_SIGNIFICANCE_SPREAD = 8;

export type WeeklyEnergyInput = {
  /** A Saturday, `YYYY-MM-DD`. Validated at the route. */
  weekStart: string;
  latitude: number;
  longitude: number;
  timezoneOffsetMinutes: number;
  engineId?: string;
  natalPlanets: PlanetPosition[];
  ascendantSign: string;
};

// ---------------------------------------------------------------------------
// Panchanga term — ±25, identical for every chart at a given place
// ---------------------------------------------------------------------------

/* Lifted from ACTIVITY_PREFERENCES.general_auspicious in muhurta-engine.ts so
   the two features agree about what makes a day auspicious. */
const TITHI_GROUP_POINTS: Record<TithiGroup, number> = {
  purna: 18, nanda: 15, bhadra: 12, jaya: 5, rikta: -15,
};
const NAKSHATRA_QUALITY_POINTS: Record<NakshatraQuality, number> = {
  movable: 15, soft: 15, fixed: 12, mixed: 5, sharp: -12,
};
const YOGA_POINTS = { auspicious: 15, neutral: 0, inauspicious: -12 } as const;
const KARANA_POINTS = { auspicious: 8, neutral: 0, inauspicious: -10 } as const;
const WEEKDAY_POINTS: Record<number, number> = { 1: 8, 3: 10, 4: 12, 5: 10 };

/*
 * Centre the sum before scaling it, then scale each side separately.
 *
 * Both steps are needed and for different reasons.
 *
 * CENTRING: these weights are not symmetric around zero. Twelve of the fifteen
 * tithi numbers score +12 or better, twenty-three of twenty-seven nakshatras
 * are positive, and sixteen of twenty-seven yogas are auspicious -- an ordinary
 * day scores well above nothing. Averaged over every limb the sum is +28.0,
 * computed analytically rather than guessed: E[tithi] 7.0 + E[nakshatra] 7.963
 * + E[yoga] 4.889 + E[karana] 2.433 + E[weekday] 5.714. Without subtracting it
 * a median day scored 68 out of 100, which measured at 67.6% of all days
 * landing in the top band -- a panel telling every reader that two thirds of
 * their days are exceptional. Subtracting it makes 50 mean "an average day",
 * which is what a 0-100 score has to mean for the number to be worth showing.
 *
 * SEPARATE SCALING: once centred the range is [-77, +40], so dividing both
 * sides by one figure would either clip the good end or leave the bad end
 * unable to reach the cap. Scaling each independently means a best-possible
 * and a worst-possible day both reach ±25.
 */
const PANCHANGA_EXPECTED = 28;
const PANCHANGA_ABOVE = 40; // 68 best case  - 28 expected
const PANCHANGA_BELOW = 77; // 28 expected   + 49 worst case
const PANCHANGA_CAP = 25;

function normalisePanchanga(raw: number): number {
  const centred = raw - PANCHANGA_EXPECTED;
  return centred >= 0
    ? PANCHANGA_CAP * (centred / PANCHANGA_ABOVE)
    : PANCHANGA_CAP * (centred / PANCHANGA_BELOW);
}

// ---------------------------------------------------------------------------
// Personal term — ±25, and the reason this panel is about the reader
// ---------------------------------------------------------------------------

/**
 * Tarabala: the nine-fold star cycle counted from the natal Moon's nakshatra.
 *
 * The classical technique for personalising a day, and the single term that
 * guarantees two people in the same city get different weeks — the whole cycle
 * is offset by wherever their natal Moon sits.
 */
const TARA_NAMES = [
  "Janma", "Sampat", "Vipat", "Kshema", "Pratyari",
  "Sadhaka", "Vadha", "Mitra", "Ati-Mitra",
];
const TARA_POINTS: Record<number, number> = {
  1: -2, 2: 12, 3: -12, 4: 10, 5: -9, 6: 12, 7: -12, 8: 9, 9: 7,
};

/* Mean over the nine taras: five are positive and the strongest positives
   outweigh the strongest negatives, so an average day carries +1.667 here for
   free. Subtracted for the same reason as PANCHANGA_EXPECTED. */
const TARA_EXPECTED = 15 / 9;

/** Chandrabala: house of the transit Moon counted from the natal Moon's sign. */
const CHANDRA_HOUSE_POINTS: Record<number, number> = {
  1: 4, 2: 2, 3: 8, 4: -8, 5: 2, 6: 8,
  7: 6, 8: -8, 9: 3, 10: 8, 11: 8, 12: -6,
};

/* Mean over the twelve houses: eight of them are positive, so this too pays a
   bonus to an average day unless it is subtracted. */
const CHANDRA_EXPECTED = 27 / 12;

const ASPECT_HARMONY: Record<string, number> = {
  Trine: 1.0, Sextile: 0.8, Conjunction: 0.5, Opposition: -0.7, Square: -1.0,
};

const TRANSIT_BENEFIC: Record<string, number> = {
  Jupiter: 1.0, Venus: 0.9, Mercury: 0.5, Sun: 0.4,
  Mars: -0.7, Saturn: -1.0, Rahu: -0.6,
};

const NATAL_SENSITIVITY: Record<string, number> = {
  Moon: 1.0, Sun: 0.9,
  Mars: 0.6, Mercury: 0.6, Jupiter: 0.6, Venus: 0.6, Saturn: 0.6,
  Rahu: 0.4, Ketu: 0.4,
};

const ASPECT_ORB_LIMIT = 8;
const ASPECT_CAP = 10;
const ASPECT_SOFTNESS = 3;
const PERSONAL_CAP = 25;

/**
 * Transit planets excluded from the ASPECT term specifically.
 *
 * MOON: it moves ~13°/day, so an aspect exact at 18:00 still reads as a ~7°
 * orb at sunrise on both the day before and the day after. Sampling once a day
 * therefore turns a single event into a three-day plateau — an artifact of the
 * sampling rate, not a real feature of the week. The Moon is NOT excluded from
 * the model: it drives tithi, nakshatra, yoga, karana, tarabala and
 * chandrabala, six of the eight factors. Only its aspects are dropped. Please
 * do not "fix" this by putting it back.
 *
 * KETU: computeTransitPositions derives it as Rahu + 180, so every Rahu
 * conjunction is also a Ketu opposition. Counting both would score one physical
 * alignment twice, with opposite harmony.
 */
const ASPECT_TRANSIT_EXCLUDED = new Set(["Moon", "Ketu"]);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function signIndex(sign: string): number {
  return ZODIAC_SIGNS.indexOf(sign);
}

function houseFrom(fromSign: string, toSign: string): number {
  const from = signIndex(fromSign);
  const to = signIndex(toSign);
  if (from < 0 || to < 0) return 1;
  return ((to - from + 12) % 12) + 1;
}

// ---------------------------------------------------------------------------
// Per-day scoring
// ---------------------------------------------------------------------------

type DayComputation = {
  day: WeeklyEnergyDay;
  transits: TransitPosition[];
  transitMoonSign: string;
};

function computeDay(
  date: string,
  input: WeeklyEnergyInput,
  natalMoon: PlanetPosition,
  natalMoonNakIndex: number,
  lagnaLord: string
): DayComputation {
  const localNoon = parseDateString(date);
  const sunriseUtc = getSunrise(localNoon, input.latitude, input.timezoneOffsetMinutes);

  const transits = computeTransitPositions(sunriseUtc, input.engineId);
  const sun = transits.find((p) => p.name === "Sun");
  const moon = transits.find((p) => p.name === "Moon");

  const factors: WeeklyEnergyFactor[] = [];

  // The weekday is the local one at sunrise, which is the Vedic vaara.
  const weekdayIndex = localNoon.getDay();

  let panchangaRaw = 0;
  let taraNumber = 1;
  let taraPoints = 0;
  let chandraHouse = 1;
  let chandraPoints = 0;

  if (sun && moon) {
    const tithi = computeTithi(moon.longitude, sun.longitude);
    const tithiPoints = TITHI_GROUP_POINTS[tithi.group] ?? 0;
    panchangaRaw += tithiPoints;
    factors.push({ kind: "tithi", label: "Tithi", value: tithi.name, contribution: tithiPoints });

    const nak = computeNakshatraFromLongitude(moon.longitude);
    const nakPoints = NAKSHATRA_QUALITY_POINTS[nak.quality] ?? 0;
    panchangaRaw += nakPoints;
    factors.push({ kind: "nakshatra", label: "Nakshatra", value: nak.name, contribution: nakPoints });

    const yoga = computeYoga(sun.longitude, moon.longitude);
    const yogaPoints = YOGA_POINTS[yoga.quality];
    panchangaRaw += yogaPoints;
    factors.push({ kind: "yoga", label: "Yoga", value: yoga.name, contribution: yogaPoints });

    const karana = getKarana(tithi.num, getKaranaHalf(moon.longitude, sun.longitude));
    const karanaPoints = KARANA_POINTS[karana.quality];
    panchangaRaw += karanaPoints;
    factors.push({ kind: "karana", label: "Karana", value: karana.name, contribution: karanaPoints });

    // Tarabala. Both nakshatra indices come from calculateNakshatra so the
    // count cannot drift from the one stored on the payload.
    const transitMoonNakIndex = calculateNakshatra(moon.longitude).index;
    taraNumber = (((transitMoonNakIndex - natalMoonNakIndex + 27) % 27) % 9) + 1;
    taraPoints = TARA_POINTS[taraNumber] ?? 0;
    factors.push({
      kind: "tarabala",
      label: "Tarabala",
      value: TARA_NAMES[taraNumber - 1],
      contribution: taraPoints,
    });

    chandraHouse = houseFrom(natalMoon.sign, moon.sign);
    chandraPoints = CHANDRA_HOUSE_POINTS[chandraHouse] ?? 0;
    factors.push({
      kind: "chandrabala",
      label: "Chandrabala",
      value: `Moon in your ${chandraHouse}${ordinalSuffix(chandraHouse)}`,
      contribution: chandraPoints,
    });
  }

  const weekdayPoints = WEEKDAY_POINTS[weekdayIndex] ?? 0;
  panchangaRaw += weekdayPoints;
  factors.push({
    kind: "weekday",
    label: "Weekday",
    value: `${WEEKDAY_LORDS[weekdayIndex]}'s day`,
    contribution: weekdayPoints,
  });

  // Transit-to-natal aspect pressure.
  const aspectable = transits.filter((p) => !ASPECT_TRANSIT_EXCLUDED.has(p.name));
  const aspects = computeTransitAspects(input.natalPlanets, aspectable);
  let aspectRaw = 0;
  for (const aspect of aspects) {
    const harmony = ASPECT_HARMONY[aspect.aspect_type];
    if (harmony === undefined) continue;
    const benefic = TRANSIT_BENEFIC[aspect.transit_planet] ?? 0;
    const sensitivity =
      aspect.natal_planet === lagnaLord
        ? 0.9
        : NATAL_SENSITIVITY[aspect.natal_planet] ?? 0.5;
    const tightness = 1 - aspect.orb / ASPECT_ORB_LIMIT;
    /* Additive, not multiplicative. Multiplying benefic by harmony cannot tell
       Jupiter-square from Saturn-trine -- both come out mildly negative -- and
       makes Saturn-square positive, since two negatives multiply. The additive
       form reads correctly across all 35 combinations. */
    aspectRaw += tightness * sensitivity * (0.6 * benefic + 0.4 * harmony);
  }
  /* tanh rather than a hard clip, so a chart with an unusual pile-up of
     aspects still ranks its seven days instead of returning seven flat -10s. */
  const aspectPoints = ASPECT_CAP * Math.tanh(aspectRaw / ASPECT_SOFTNESS);
  factors.push({
    kind: "transit_aspect",
    label: "Transits",
    value: describeAspectPressure(aspectPoints),
    contribution: round1(aspectPoints),
  });

  /* Each natal term is centred on its own mean, so this half of the score is
     also zero for an average day and 50 stays the midpoint. The aspect term
     needs no centring -- tanh of a signed sum is already centred on zero. */
  const personalTerm = clamp(
    (taraPoints - TARA_EXPECTED) + (chandraPoints - CHANDRA_EXPECTED) + aspectPoints,
    -PERSONAL_CAP,
    PERSONAL_CAP
  );

  const score = Math.round(50 + normalisePanchanga(panchangaRaw) + personalTerm);

  return {
    day: {
      date,
      weekday_index: weekdayIndex,
      score,
      band: bandFor(score),
      factors,
      tara: { number: taraNumber, name: TARA_NAMES[taraNumber - 1] },
      chandra_house: chandraHouse,
    },
    transits,
    transitMoonSign: transits.find((p) => p.name === "Moon")?.sign ?? natalMoon.sign,
  };
}

function ordinalSuffix(n: number): string {
  if (n % 10 === 1 && n !== 11) return "st";
  if (n % 10 === 2 && n !== 12) return "nd";
  if (n % 10 === 3 && n !== 13) return "rd";
  return "th";
}

function describeAspectPressure(points: number): string {
  if (points >= 4) return "Strong support";
  if (points >= 1.5) return "Mild support";
  if (points > -1.5) return "Quiet";
  if (points > -4) return "Mild pressure";
  return "Strong pressure";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function bandFor(score: number): EnergyBand {
  if (score >= ENERGY_BAND_THRESHOLDS.high) return "high";
  if (score <= ENERGY_BAND_THRESHOLDS.low) return "low";
  return "balanced";
}

// ---------------------------------------------------------------------------
// The four cards
// ---------------------------------------------------------------------------

const INTENT_ORDER: CalendarPlannerIntent[] = [
  "action", "rest", "communication", "relationships", "money", "study", "travel",
];

const CARD_COUNT = 4;

function scoreIntents(
  days: WeeklyEnergyDay[],
  moonSigns: string[],
  natalMoonSign: string
): WeeklyEnergyCard[] {
  const scored = INTENT_ORDER.map((intent) => {
    const affinity = INTENT_AFFINITY[intent];
    let best = { date: days[0].date, value: -Infinity };
    let total = 0;

    days.forEach((day, index) => {
      let bonus = 0;
      for (const factor of day.factors) {
        if (factor.kind === "nakshatra") {
          // The quality, not the name, is what the affinity table keys on.
          const quality = qualityOfNakshatra(factor.value);
          bonus += affinity.nakshatraQualities?.[quality] ?? 0;
        }
        if (factor.kind === "tithi") {
          bonus += affinity.tithiGroups?.[groupOfTithiPoints(factor.contribution)] ?? 0;
        }
      }
      bonus += affinity.weekdayLords?.[WEEKDAY_LORDS[day.weekday_index]] ?? 0;
      bonus += affinity.chandraHouses?.[houseFrom(natalMoonSign, moonSigns[index])] ?? 0;
      const aspectFactor = day.factors.find((f) => f.kind === "transit_aspect");
      bonus += (aspectFactor?.contribution ?? 0) * 0.5;

      const value = day.score + bonus;
      total += value;
      if (value > best.value) best = { date: day.date, value };
    });

    return { intent, score: Math.round(total / days.length), bestDay: best.date };
  });

  /* Ties broken by INTENT_ORDER, which the map above preserves, so the same
     week always yields the same four cards in the same order. */
  const top = [...scored]
    .sort((a, b) => b.score - a.score || INTENT_ORDER.indexOf(a.intent) - INTENT_ORDER.indexOf(b.intent))
    .slice(0, CARD_COUNT);

  return top.map(({ intent, score, bestDay }) => {
    const quality = qualityFor(score);
    const copy = INTENT_COPY[intent];
    return {
      intent,
      title: copy.title,
      body: copy.bodies[quality].replace("{day}", formatDayShort(bestDay)),
      icon_key: copy.iconKey,
      quality,
      score,
      best_day: bestDay,
    };
  });
}

/* Same four-way ladder as the muhurta engine's window quality. */
function qualityFor(score: number): "excellent" | "good" | "fair" | "poor" {
  if (score >= 75) return "excellent";
  if (score >= 60) return "good";
  if (score >= 45) return "fair";
  return "poor";
}

/* The factor row already carries the nakshatra's name, and NAKSHATRA_QUALITY
   is keyed by name with the same "mixed" default computeNakshatraFromLongitude
   applies -- so this agrees with the scoring pass without re-deriving the
   longitude. */
function qualityOfNakshatra(name: string): NakshatraQuality {
  return NAKSHATRA_QUALITY[name] ?? "mixed";
}

/* The tithi group is recoverable from the points it contributed, because the
   five values are distinct. Cheaper than threading the group through the
   factor row, and asserted by the engine test. */
function groupOfTithiPoints(points: number): TithiGroup {
  const entry = (Object.entries(TITHI_GROUP_POINTS) as Array<[TithiGroup, number]>).find(
    ([, value]) => value === points
  );
  return entry?.[0] ?? "jaya";
}

// ---------------------------------------------------------------------------
// The headline
// ---------------------------------------------------------------------------

const SHAPE_SLOPE = 4;
const SHAPE_WIDE_SPREAD = 22;
const SHAPE_FLAT_SPREAD = 8;
const NEGATIVE_NOTICE = 3;

function weekShape(days: WeeklyEnergyDay[]): HeadlineShape {
  const scores = days.map((d) => d.score);
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  const slope = mean(scores.slice(4)) - mean(scores.slice(0, 3));
  const spread = Math.max(...scores) - Math.min(...scores);

  if (slope > SHAPE_SLOPE) return "rises";
  if (slope < -SHAPE_SLOPE) return "settles";
  if (spread > SHAPE_WIDE_SPREAD) return "turns";
  if (spread < SHAPE_FLAT_SPREAD) return "holds";
  return "builds";
}

function familyTotals(days: WeeklyEnergyDay[]): Map<EnergyFactorKind, number> {
  const totals = new Map<EnergyFactorKind, number>();
  for (const day of days) {
    for (const factor of day.factors) {
      totals.set(factor.kind, (totals.get(factor.kind) ?? 0) + factor.contribution);
    }
  }
  return totals;
}

function buildHeadline(days: WeeklyEnergyDay[], natalMoonNakIndex: number, weekStart: string): WeeklyEnergyHeadline {
  const totals = familyTotals(days);
  const shape = weekShape(days);

  let dominantPositive: EnergyFactorKind = "nakshatra";
  let bestPositive = -Infinity;
  let dominantNegative: EnergyFactorKind | null = null;
  let worstNegative = 0;
  for (const [kind, total] of totals) {
    if (total > bestPositive) { bestPositive = total; dominantPositive = kind; }
    if (total < worstNegative) { worstNegative = total; dominantNegative = kind; }
  }

  const noun = HEADLINE_NOUNS[dominantPositive];
  const title = `${noun} ${HEADLINE_VERBS[shape]}`;

  const opener = HEADLINE_OPENERS[noun]?.[shape] ?? HEADLINE_OPENERS.Clarity[shape];
  const guidanceKey =
    dominantNegative && Math.abs(worstNegative) > NEGATIVE_NOTICE ? dominantNegative : "clear";
  const guidance = HEADLINE_GUIDANCE[guidanceKey]?.[shape] ?? HEADLINE_GUIDANCE.clear[shape];

  /* Deterministic: the same week must produce the same words on every load, or
     paging away and back appears to rewrite history. Seeded by the week and the
     natal Moon so two people do not get the same quote in the same week. */
  const pool = QUOTE_AFFINITY[dominantPositive];
  const seed = hashString(weekStart) + natalMoonNakIndex;
  const quoteKey = pool[seed % pool.length];

  return { title, paragraph: `${opener} ${guidance}`, quote_key: quoteKey };
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 100003;
  }
  return hash;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function computeWeeklyEnergy(input: WeeklyEnergyInput): WeeklyEnergyWeek {
  const natalMoon =
    input.natalPlanets.find((p) => p.name === "Moon") ?? input.natalPlanets[0];
  const natalMoonNakIndex = calculateNakshatra(natalMoon.longitude).index;
  const lagnaLord = SIGN_RULERS[input.ascendantSign] ?? "Sun";

  const dates = weekDays(input.weekStart);
  const computed = dates.map((date) =>
    computeDay(date, input, natalMoon, natalMoonNakIndex, lagnaLord)
  );
  const days = computed.map((c) => c.day);
  const moonSigns = computed.map((c) => c.transitMoonSign);

  const scores = days.map((d) => d.score);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const peakDay = days[scores.indexOf(maxScore)];
  const troughDay = days[scores.indexOf(minScore)];

  const headline = buildHeadline(days, natalMoonNakIndex, input.weekStart);
  const isSignificant = maxScore - minScore >= PEAK_SIGNIFICANCE_SPREAD;

  return {
    model_version: WEEKLY_ENERGY_MODEL_VERSION,
    week: {
      start_date: input.weekStart,
      end_date: weekEnd(input.weekStart),
      label: formatWeekRangeLabel(input.weekStart),
    },
    bands: { high_min: ENERGY_BAND_THRESHOLDS.high, low_max: ENERGY_BAND_THRESHOLDS.low },
    days,
    peak: {
      date: peakDay.date,
      weekday_index: peakDay.weekday_index,
      score: peakDay.score,
      /* When the week is flat, the callout says so rather than pinning a day
         two points above its neighbours and calling it a peak. */
      label: isSignificant ? `Peak ${headline.title.split(" ")[0]}` : "Steady week",
      is_significant: isSignificant,
    },
    trough: { date: troughDay.date, score: troughDay.score },
    average_score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    headline,
    cards: scoreIntents(days, moonSigns, natalMoon.sign),
    /* Composed here, with the same numbers the line is drawn from, so the
       screen-reader text and the chart cannot disagree. */
    chart_alt_text:
      `Weekly energy for ${formatWeekRangeLabel(input.weekStart)}: ` +
      days.map((d) => `${formatDayShort(d.date)} ${d.score} (${d.band})`).join(", ") +
      `. Average ${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}.`,
  };
}
