/**
 * One colour per graha, shared by the constellation wheel and the chart card's
 * positions list, so a planet is the same colour in both.
 *
 * Its own module because the wheel is a lazily loaded chunk: importing the
 * constant from constellation-chart.tsx would pull the whole wheel into the
 * results page's first load.
 */
export const PLANET_COLORS: Record<string, string> = {
  Sun: "#f2c26c",
  Moon: "#c8d8e8",
  Mars: "#ff6b5b",
  Mercury: "#6ce1a0",
  Jupiter: "#ffd966",
  Venus: "#f0a0c8",
  Saturn: "#7eaadf",
  Rahu: "#a0a8b0",
  Ketu: "#c49a6c",
};

/** Traditional order for listing the grahas. */
export const GRAHA_ORDER = [
  "Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu",
] as const;
