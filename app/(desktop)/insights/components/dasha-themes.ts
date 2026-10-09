/*
 * Each Vimshottari lord's theme. The reader sees it in their own language
 * (dasha.panel.themes.<planet>), beside a planet in the period card and in the
 * sentence the current-period card shows until its written reading arrives;
 * the English here is which lords have a theme, and what shows if a catalog
 * lacks one.
 */

export const DASHA_LORD_THEMES: Record<string, { theme: string }> = {
  Sun: { theme: "Authority & Self-Expression" },
  Moon: { theme: "Emotions & Public Life" },
  Mars: { theme: "Energy & Courage" },
  Mercury: { theme: "Intellect & Communication" },
  Jupiter: { theme: "Wisdom & Expansion" },
  Venus: { theme: "Love & Luxury" },
  Saturn: { theme: "Discipline & Karma" },
  Rahu: { theme: "Ambition & Transformation" },
  Ketu: { theme: "Spirituality & Detachment" },
};

export const DASHA_THEME_PLANETS = Object.keys(DASHA_LORD_THEMES);

/** A lord's theme as a label in the reader's language, or its English theme if the catalog lacks it. */
export function themeLabelFor(planet: string, t: (key: string) => string): string | null {
  const theme = DASHA_LORD_THEMES[planet]?.theme;
  if (!theme) return null;
  const key = `dasha.panel.themes.${planet.toLowerCase()}`;
  const text = t(key);
  return text === key ? theme : text;
}
