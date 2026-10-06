export const ADVANCED_FOCUS_VIEWS = ["transits", "palm"] as const;

/* The modules whose stand-in, when the chart has no data for them, is a locked
   preview: advanced.locked.<module>.title and .description. */
export const LOCKED_PREVIEWS = [
  "dasha",
  "aspects",
  "navamsa",
  "divisional",
  "transits",
  "ashtakavarga",
] as const;

export type AdvancedFocusView = (typeof ADVANCED_FOCUS_VIEWS)[number];

export function getAdvancedFocusView(
  value: string | undefined
): AdvancedFocusView | null {
  return ADVANCED_FOCUS_VIEWS.includes(value as AdvancedFocusView)
    ? (value as AdvancedFocusView)
    : null;
}
