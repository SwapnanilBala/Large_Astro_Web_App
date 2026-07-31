/**
 * Coarse birth-time handling.
 *
 * When a visitor does not know their exact birth time they pick a window
 * instead. Each window maps to a representative clock time so the engine has
 * something to compute with, and the choice is recorded separately as
 * birthTimeAccuracy so time-sensitive output can be qualified rather than
 * presented as exact.
 *
 * Shared by the desktop and mobile intake so both produce identical charts
 * for the same answers.
 */

export const COARSE_TIME_FALLBACKS: Record<string, string> = {
  morning: "08:00",
  afternoon: "13:30",
  evening: "18:30",
  unknown: "12:00",
};

export const COARSE_TIME_OPTIONS = [
  { value: "morning", labelKey: "home.coarseMorning" },
  { value: "afternoon", labelKey: "home.coarseAfternoon" },
  { value: "evening", labelKey: "home.coarseEvening" },
  { value: "unknown", labelKey: "home.coarseUnknown" },
] as const;

export function hasCoarseTimeFallback(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(COARSE_TIME_FALLBACKS, value);
}

export function getBirthTimeFallback(value: string): string {
  return COARSE_TIME_FALLBACKS[value] ?? COARSE_TIME_FALLBACKS.unknown;
}
