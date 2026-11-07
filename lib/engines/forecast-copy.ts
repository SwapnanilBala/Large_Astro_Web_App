/**
 * The words the date forecast (buildForecast in chart-service.ts) is made of.
 *
 * Strings only, beside the engine rather than inside it, so the catalog test
 * (lib/__tests__/forecast-text.test.ts) can hold the English catalog to these
 * tables without loading the ephemeris. The engine still composes its English
 * sentences from them -- that output is data the Android app and the caches
 * read -- and the desktop forecast card re-words the same sentences in the
 * reader's language from the structured `parts` the engine sends beside them
 * (lib/forecast-text.ts), keyed by the planet's lower-case name.
 */

/** What a natal planet stands for when a transit touches it. */
export const FORECAST_PLANET_THEMES: Record<string, string> = {
  Sun: "identity, confidence, leadership, and visibility",
  Moon: "emotions, home life, and inner steadiness",
  Mars: "drive, conflict tolerance, and decisive action",
  Mercury: "learning, negotiation, trade, and communication",
  Jupiter: "growth, wisdom, guidance, and opportunity",
  Venus: "relationships, pleasure, money flow, and aesthetics",
  Saturn: "discipline, duty, structure, and long-range results",
  Rahu: "ambition, disruption, foreign links, and unconventional openings",
  Ketu: "release, spiritualization, detachment, and inner reset",
};

/** The stand-in for a natal point the table above does not name. */
export const FORECAST_PLANET_THEME_FALLBACK = "that area of life";

/** One row per period lord: what its period is about, where it helps, what to watch. */
export const DASHA_FORECAST_THEMES: Record<
  string,
  { focus: string; opportunity: string; caution: string }
> = {
  Sun: {
    focus: "visibility, leadership, and self-definition",
    opportunity: "Take ownership of decisions that need clarity, authority, and cleaner positioning.",
    caution: "Do not let ego battles or overexertion drain momentum that should be invested in durable progress.",
  },
  Moon: {
    focus: "emotional life, family patterns, and responsiveness",
    opportunity: "Strengthen home rhythms, emotional support, and work that depends on public trust or care.",
    caution: "Mood-led decisions and overstretching for others can blur judgment if rest is inconsistent.",
  },
  Mars: {
    focus: "action, competition, initiative, and courage",
    opportunity: "Push into tasks that reward bold execution, technical effort, and direct problem-solving.",
    caution: "Watch impatience, reactive speech, conflict escalation, and physically draining overcommitment.",
  },
  Mercury: {
    focus: "strategy, communication, education, and commerce",
    opportunity: "This is useful for writing, planning, study, trade, interviews, and clearer deal-making.",
    caution: "Scattered focus, overanalysis, or saying yes too quickly can create avoidable noise.",
  },
  Jupiter: {
    focus: "growth, guidance, faith, and higher opportunity",
    opportunity: "Lean into teaching, mentorship, planning, and long-horizon decisions that need wisdom.",
    caution: "Optimism still needs structure; avoid assuming expansion is automatically sustainable.",
  },
  Venus: {
    focus: "relationships, comfort, resources, and artistry",
    opportunity: "Favorable for alliances, attraction, aesthetics, and improving lifestyle quality with intention.",
    caution: "Pleasure spending, passive avoidance, or idealizing people can weaken the practical signal.",
  },
  Saturn: {
    focus: "discipline, karma, responsibility, and endurance",
    opportunity: "Work that needs consistency, maturity, and long-range restructuring can deepen substantially here.",
    caution: "Delays are not always denials, but bitterness, exhaustion, and rigid thinking need active management.",
  },
  Rahu: {
    focus: "ambition, sudden openings, innovation, and appetite",
    opportunity: "Foreign links, technology, reinvention, and unconventional pathways can produce sharp breakthroughs.",
    caution: "Be extra careful with obsession, mixed signals, risky shortcuts, and people who oversell certainty.",
  },
  Ketu: {
    focus: "detachment, inner realignment, closure, and spiritual pruning",
    opportunity: "Excellent for stepping back, refining intuition, and releasing patterns that no longer fit.",
    caution: "Withdrawal, confusion, and loss of worldly motivation can appear if grounding routines are neglected.",
  },
};
