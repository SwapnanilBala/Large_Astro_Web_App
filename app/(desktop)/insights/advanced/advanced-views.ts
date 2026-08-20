export const ADVANCED_FOCUS_VIEWS = ["transits", "palm"] as const;

export type AdvancedFocusView = (typeof ADVANCED_FOCUS_VIEWS)[number];

export function getAdvancedFocusView(
  value: string | undefined
): AdvancedFocusView | null {
  return ADVANCED_FOCUS_VIEWS.includes(value as AdvancedFocusView)
    ? (value as AdvancedFocusView)
    : null;
}
