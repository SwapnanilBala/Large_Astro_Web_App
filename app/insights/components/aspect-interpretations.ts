export const ASPECT_SYMBOLS: Record<string, string> = {
  conjunction: "\u260C",
  trine: "\u25B3",
  square: "\u25A1",
  sextile: "\u26B9",
  opposition: "\u260D",
};

const ASPECT_BRIEF: Record<string, string> = {
  conjunction:
    "Fusion of energies \u2014 intensified expression of both planets\u2019 themes",
  trine:
    "Harmonious flow \u2014 natural talent and ease between these planetary energies",
  square:
    "Dynamic tension \u2014 growth through friction and conscious integration",
  sextile:
    "Opportunity aspect \u2014 cooperative potential activated through effort",
  opposition:
    "Polarity \u2014 balancing opposing forces for wholeness and perspective",
};

export function getAspectBriefInterpretation(
  _planet1: string,
  _planet2: string,
  aspectType: string
): string {
  const normalizedType = aspectType.toLowerCase();
  return (
    ASPECT_BRIEF[normalizedType] ??
    "A significant planetary relationship influencing this chart."
  );
}
