/*
 * Each Vimshottari lord's theme, in English for the sentence the current-period
 * card shows until its written reading arrives, and as a label in the reader's
 * language (dasha.panel.themes.<planet>) beside a planet in the period card.
 */

export const DASHA_LORD_THEMES: Record<string, { theme: string; keywords: string[] }> = {
  Sun: { theme: "Authority & Self-Expression", keywords: ["leadership", "government", "father figures", "vitality", "recognition"] },
  Moon: { theme: "Emotions & Public Life", keywords: ["mother", "mind", "nurturing", "public", "travel", "comfort"] },
  Mars: { theme: "Energy & Courage", keywords: ["action", "property", "siblings", "competition", "strength"] },
  Mercury: { theme: "Intellect & Communication", keywords: ["business", "writing", "learning", "trade", "humor", "adaptability"] },
  Jupiter: { theme: "Wisdom & Expansion", keywords: ["spirituality", "children", "fortune", "teaching", "dharma", "growth"] },
  Venus: { theme: "Love & Luxury", keywords: ["marriage", "arts", "wealth", "pleasure", "beauty", "vehicles"] },
  Saturn: { theme: "Discipline & Karma", keywords: ["hard work", "delays", "structure", "service", "lessons"] },
  Rahu: { theme: "Ambition & Transformation", keywords: ["foreign", "obsession", "unconventional", "technology", "sudden gains", "illusion"] },
  Ketu: { theme: "Spirituality & Detachment", keywords: ["liberation", "loss", "intuition", "past lives", "renunciation", "healing"] },
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
