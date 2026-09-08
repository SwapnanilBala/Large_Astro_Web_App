/**
 * Copy and affinity tables for the weekly-energy reading.
 *
 * Strings and weights only — no math, no dates, no ephemeris. Kept beside the
 * engine rather than in the component because the response should carry
 * finished prose, the way ForecastReading.headline and
 * MuhurtaWindow.recommendation already do: the client renders a reading, it
 * does not assemble one.
 *
 * Every table here is a PRODUCT choice sitting on top of a classical one. The
 * classical part is which limb means what — chara (movable) nakshatras for
 * movement and travel, dhruva (fixed) for anything meant to last, mridu (soft)
 * for gentle and relational work, purna tithis for completion. The integers are
 * mine, and they are deliberately in the same shape and the same range as
 * ACTIVITY_PREFERENCES in muhurta-engine.ts so the two read as siblings rather
 * than as two unrelated scoring systems.
 */

import type { CalendarPlannerIntent } from "@/lib/astro-types";
import type { EnergyFactorKind } from "./weekly-energy-engine";

// ---------------------------------------------------------------------------
// The four "Weekly Forecast" cards
// ---------------------------------------------------------------------------

/**
 * Which limbs favour which intent.
 *
 * Same shape as ACTIVITY_PREFERENCES (muhurta-engine.ts): partial records, so
 * an unlisted key simply contributes nothing rather than needing a zero.
 */
export type IntentAffinity = {
  nakshatraQualities?: Partial<Record<string, number>>;
  tithiGroups?: Partial<Record<string, number>>;
  /** Keyed by the weekday's planetary lord, not by weekday index. */
  weekdayLords?: Partial<Record<string, number>>;
  /** Transit planets whose aspects to the natal chart support this intent. */
  transitPlanets?: Partial<Record<string, number>>;
  /** House of the transit Moon counted from the natal Moon. */
  chandraHouses?: Partial<Record<number, number>>;
};

export const INTENT_AFFINITY: Record<CalendarPlannerIntent, IntentAffinity> = {
  action: {
    nakshatraQualities: { movable: 8, sharp: 4, fixed: 2 },
    tithiGroups: { jaya: 8, purna: 4, rikta: -6 },
    weekdayLords: { Sun: 6, Mars: 8 },
    transitPlanets: { Mars: 6, Sun: 5 },
    chandraHouses: { 3: 6, 6: 6, 10: 8, 11: 6 },
  },
  rest: {
    nakshatraQualities: { soft: 8, fixed: 4, sharp: -6 },
    tithiGroups: { nanda: 6, purna: 5, rikta: 2 },
    weekdayLords: { Moon: 8, Venus: 4 },
    transitPlanets: { Moon: 5, Venus: 4, Saturn: -3 },
    chandraHouses: { 4: 8, 12: 6, 2: 3 },
  },
  communication: {
    nakshatraQualities: { movable: 8, mixed: 3 },
    tithiGroups: { bhadra: 6, jaya: 4 },
    weekdayLords: { Mercury: 8 },
    transitPlanets: { Mercury: 7 },
    chandraHouses: { 3: 8, 11: 5, 5: 3 },
  },
  relationships: {
    nakshatraQualities: { soft: 8, fixed: 5, sharp: -6 },
    tithiGroups: { purna: 8, nanda: 4, rikta: -6 },
    weekdayLords: { Venus: 8, Moon: 4 },
    transitPlanets: { Venus: 7, Moon: 4, Jupiter: 3 },
    chandraHouses: { 7: 8, 11: 5, 4: 3 },
  },
  money: {
    nakshatraQualities: { fixed: 8, movable: 2 },
    tithiGroups: { purna: 8, bhadra: 6, rikta: -8 },
    weekdayLords: { Jupiter: 6, Mercury: 5 },
    transitPlanets: { Jupiter: 7, Venus: 4, Mercury: 3 },
    chandraHouses: { 2: 8, 11: 8, 10: 4 },
  },
  study: {
    nakshatraQualities: { fixed: 8, mixed: 3, sharp: -4 },
    tithiGroups: { bhadra: 6, jaya: 6 },
    weekdayLords: { Mercury: 6, Jupiter: 7 },
    transitPlanets: { Mercury: 5, Jupiter: 6 },
    chandraHouses: { 5: 8, 9: 6, 4: 3 },
  },
  travel: {
    nakshatraQualities: { movable: 9, soft: 3, fixed: -6 },
    tithiGroups: { jaya: 5, nanda: 4, rikta: -5 },
    weekdayLords: { Mercury: 5, Moon: 5 },
    transitPlanets: { Mercury: 4, Moon: 4 },
    chandraHouses: { 3: 8, 9: 6, 12: 4 },
  },
};

/**
 * Card titles and bodies.
 *
 * The four names in the reference design map onto four of these seven intents;
 * the other three exist so the row is chosen by the week's numbers rather than
 * being the same four cards every week.
 */
export const INTENT_COPY: Record<
  CalendarPlannerIntent,
  { title: string; iconKey: string; bodies: Record<string, string> }
> = {
  action: {
    title: "New Opportunities",
    iconKey: "sparkles",
    bodies: {
      excellent: "A fresh perspective opens doors. {day} carries it best.",
      good: "Momentum is available if you start it. {day} is the opening.",
      fair: "Push gently rather than hard. {day} gives the most room.",
      poor: "Not a week for forcing anything new. Hold and prepare.",
    },
  },
  rest: {
    title: "Emotional Flow",
    iconKey: "heart",
    bodies: {
      excellent: "Greater ease in connection, with {day} the softest of them.",
      good: "Recovery comes easily this week. Take it on {day}.",
      fair: "Rest is available but has to be chosen. {day} is easiest.",
      poor: "Rest will feel effortful. Protect it anyway.",
    },
  },
  communication: {
    title: "Creative Spark",
    iconKey: "message",
    bodies: {
      excellent: "Your ideas find support. Say the thing on {day}.",
      good: "Words land well this week, {day} especially.",
      fair: "Be plainer than usual. {day} is the clearest window.",
      poor: "Expect to repeat yourself. Put it in writing.",
    },
  },
  money: {
    title: "Steady Progress",
    iconKey: "trending",
    bodies: {
      excellent: "Small steps create big shifts, and {day} compounds them.",
      good: "Practical matters move. {day} is the day to file it.",
      fair: "Progress is slow but real. {day} is the best of it.",
      poor: "Hold the line rather than extending it.",
    },
  },
  relationships: {
    title: "Shared Ground",
    iconKey: "users",
    bodies: {
      excellent: "Deeper trust is on offer. {day} is the day to ask.",
      good: "People meet you halfway this week, {day} most of all.",
      fair: "Go first and go gently. {day} is the kindest window.",
      poor: "Give conversations more room than they seem to need.",
    },
  },
  study: {
    title: "Deep Focus",
    iconKey: "book",
    bodies: {
      excellent: "Difficult material goes in cleanly, {day} above all.",
      good: "A good week to learn something structural. Start {day}.",
      fair: "Focus comes in bursts. {day} holds the longest one.",
      poor: "Review rather than take on anything new.",
    },
  },
  travel: {
    title: "Open Road",
    iconKey: "compass",
    bodies: {
      excellent: "Movement agrees with you. {day} is the day to go.",
      good: "A change of place would help. {day} is clearest.",
      fair: "Travel light and leave margin. {day} is smoothest.",
      poor: "Postpone what can be postponed.",
    },
  },
};

/** Weekday index (0=Sun) to its planetary lord, for INTENT_AFFINITY. */
export const WEEKDAY_LORDS = [
  "Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn",
];

// ---------------------------------------------------------------------------
// The headline
// ---------------------------------------------------------------------------

/** Noun, from the factor family that contributed the most POSITIVE total. */
export const HEADLINE_NOUNS: Record<EnergyFactorKind, string> = {
  nakshatra: "Clarity",
  tithi: "Fullness",
  yoga: "Grace",
  karana: "Steadiness",
  weekday: "Rhythm",
  tarabala: "Fortune",
  chandrabala: "Feeling",
  transit_aspect: "Support",
};

/** Verb, from the week's shape. */
export type HeadlineShape = "rises" | "settles" | "turns" | "holds" | "builds";

export const HEADLINE_VERBS: Record<HeadlineShape, string> = {
  rises: "Rises",
  settles: "Settles",
  turns: "Turns",
  holds: "Holds",
  builds: "Builds",
};

/** First sentence: what the week is. Keyed by noun family, then by shape. */
export const HEADLINE_OPENERS: Record<string, Record<HeadlineShape, string>> = {
  Clarity: {
    rises: "A week of illumination and gentle momentum.",
    settles: "A week that grows quieter and easier to read.",
    turns: "A week of sharp changes in visibility.",
    holds: "A week of steady, unhurried clarity.",
    builds: "A week that comes into focus around its middle.",
  },
  Fullness: {
    rises: "A week that fills out as it goes.",
    settles: "A week of completion rather than beginning.",
    turns: "A week of full days and empty ones in close succession.",
    holds: "A week with an even, generous weight to it.",
    builds: "A week that gathers toward something in the middle.",
  },
  Grace: {
    rises: "A week that opens up more the further in you go.",
    settles: "A week that resolves more kindly than it starts.",
    turns: "A week of uneven footing and sudden ease.",
    holds: "A week of quiet, reliable good will.",
    builds: "A week whose best hours sit at its centre.",
  },
  Steadiness: {
    rises: "A week that firms up as it goes.",
    settles: "A week that asks less of you by the end.",
    turns: "A week that changes its mind more than once.",
    holds: "A week of level ground throughout.",
    builds: "A week that consolidates around midweek.",
  },
  Rhythm: {
    rises: "A week that finds its stride late.",
    settles: "A week that slows into something more sustainable.",
    turns: "A week of shifting tempo.",
    holds: "A week with a consistent beat to it.",
    builds: "A week that hits its pace in the middle.",
  },
  Fortune: {
    rises: "A week of widening luck and easier timing.",
    settles: "A week whose difficulties recede as it goes.",
    turns: "A week of mixed fortune, unevenly spread.",
    holds: "A week of consistent, undramatic favour.",
    builds: "A week whose luckiest hours are at its centre.",
  },
  Feeling: {
    rises: "A week that warms as it goes.",
    settles: "A week that grows calmer and more inward.",
    turns: "A week of changeable mood.",
    holds: "A week of even temper.",
    builds: "A week that deepens toward its middle.",
  },
  Support: {
    rises: "A week of gathering support from outside you.",
    settles: "A week where the pressure eases off.",
    turns: "A week of help and hindrance in quick alternation.",
    holds: "A week of steady backing.",
    builds: "A week whose support concentrates midweek.",
  },
};

/**
 * Second sentence: what the week asks. Keyed by the dominant NEGATIVE family,
 * so the guidance names the actual friction rather than being generic. `clear`
 * is the fallback for a week with no meaningful negative total.
 */
export const HEADLINE_GUIDANCE: Record<string, Record<HeadlineShape, string>> = {
  clear: {
    rises: "Trust what feels light, and let it carry you.",
    settles: "Let things land rather than chasing them.",
    turns: "Stay loose about plans and firm about priorities.",
    holds: "Keep the routine that is already working.",
    builds: "Put the important thing in the middle of the week.",
  },
  nakshatra: {
    rises: "Trust what feels light, release what feels heavy.",
    settles: "Choose the gentler option where there is one.",
    turns: "Do not read a hard day as a verdict.",
    holds: "Sameness is not stagnation this week.",
    builds: "Save the delicate conversations for midweek.",
  },
  tithi: {
    rises: "Finish something before starting the next thing.",
    settles: "Close what is open rather than opening more.",
    turns: "Expect some days to give less than they promise.",
    holds: "Small consistent effort beats a single push.",
    builds: "Let the early days be preparation.",
  },
  yoga: {
    rises: "Let the awkward hours pass rather than fighting them.",
    settles: "Difficulty early is not a pattern for the week.",
    turns: "Keep a margin around anything that matters.",
    holds: "Work with the grain, not against it.",
    builds: "Protect the middle of the week from interruption.",
  },
  karana: {
    rises: "Leave slack in the schedule for the rough patches.",
    settles: "Do not commit to firm times on the difficult days.",
    turns: "Half-days will serve you better than whole ones.",
    holds: "Steady, and unremarkable, is the plan.",
    builds: "Front-load the easy work.",
  },
  weekday: {
    rises: "Move the demanding tasks toward the end of the week.",
    settles: "The early days will ask more than the later ones.",
    turns: "Match the task to the day rather than the reverse.",
    holds: "Any day will do; pick one and start.",
    builds: "Midweek is where the weight belongs.",
  },
  tarabala: {
    rises: "Timing improves as the week goes on. Wait where you can.",
    settles: "Let the harder days pass without conclusions.",
    turns: "Some days are simply not for deciding.",
    holds: "Nothing forces itself this week, in either direction.",
    builds: "Hold the decision until the middle of the week.",
  },
  chandrabala: {
    rises: "Your own mood is the variable. Watch it, do not obey it.",
    settles: "Give yourself more quiet than usual.",
    turns: "Feeling and fact will disagree. Prefer fact.",
    holds: "An even mood is worth protecting.",
    builds: "Rest early so the middle has something to spend.",
  },
  transit_aspect: {
    rises: "Outside pressure eases. Use the space when it comes.",
    settles: "What has been pressing on you lets go this week.",
    turns: "Others' timing, not yours, is what shifts.",
    holds: "Steady pressure, steadily handled.",
    builds: "Expect the most interference midweek.",
  },
};

/**
 * Which of the 23 quote strings in messages/en.json suit which dominant
 * factor. Values are the keys under `quotes`.
 *
 * Those strings had no consumer anywhere in the app before this. Returning the
 * KEY rather than the text keeps them going through useTranslation, so they
 * translate when the other locales get filled in.
 */
export const QUOTE_AFFINITY: Record<EnergyFactorKind, string[]> = {
  tithi: ["1", "5", "9"],
  nakshatra: ["2", "6", "11"],
  yoga: ["3", "7", "12"],
  karana: ["4", "8", "16"],
  weekday: ["10", "17", "21"],
  tarabala: ["13", "18", "22"],
  chandrabala: ["14", "19", "20"],
  transit_aspect: ["15", "23", "1"],
};
