/**
 * The Varshaphal engine's fixed English vocabularies, in a module of their own
 * so the yearly-chart panel can key on them without pulling the ephemeris into
 * the browser bundle. The engine reads them from here and re-exports them.
 *
 * The panel prints each one in the reader's language by its slug
 * (timing.varshaphal.profectionThemes.<theme>, timing.varshaphal.summary.
 * moonTones.<sign>, timing.varshaphal.summary.yearLordThemes.<planet>), and
 * lib/__tests__/desktop-pages-catalogs.test.ts holds the English catalog to
 * these words, so an edit here shows up as a failing test, not a silent drift.
 */

/* The profection themes of each house. */
export const HOUSE_THEMES: Record<number, string[]> = {
  1: ["Self", "identity", "personal direction"],
  2: ["Finances", "values", "material security"],
  3: ["Communication", "siblings", "short travel"],
  4: ["Home", "family", "emotional roots"],
  5: ["Creativity", "children", "romance"],
  6: ["Health", "service", "daily routines"],
  7: ["Partnerships", "marriage", "contracts"],
  8: ["Transformation", "shared resources", "occult"],
  9: ["Higher learning", "long travel", "philosophy"],
  10: ["Career", "public life", "authority"],
  11: ["Friends", "aspirations", "community"],
  12: ["Spirituality", "endings", "solitude"],
};

/* The solar return Moon's emotional tone, by sign. */
export const MOON_TONES: Record<string, string> = {
  Aries: "emotionally assertive, impulsive, and action-oriented",
  Taurus: "emotionally steady, comfort-seeking, and grounded",
  Gemini: "emotionally curious, communicative, and mentally active",
  Cancer: "emotionally deep, nurturing, and sensitive to surroundings",
  Leo: "emotionally warm, expressive, and seeking recognition",
  Virgo: "emotionally analytical, service-minded, and detail-focused",
  Libra: "emotionally diplomatic, harmony-seeking, and relationship-focused",
  Scorpio: "emotionally intense, transformative, and deeply perceptive",
  Sagittarius: "emotionally optimistic, freedom-loving, and philosophically inclined",
  Capricorn: "emotionally disciplined, ambitious, and practically grounded",
  Aquarius: "emotionally detached, humanitarian, and intellectually oriented",
  Pisces: "emotionally intuitive, compassionate, and spiritually open",
};

/* What the year lord (Varshesh) makes of the year. */
export const PLANET_YEAR_LORD_THEMES: Record<string, string> = {
  Sun: "A year of visibility, leadership, and self-definition. Authority figures play a key role.",
  Moon: "A year of emotional depth, nurturing, and domestic focus. Intuition guides decisions.",
  Mars: "A year of initiative, energy, and bold action. Conflict may arise but drives growth.",
  Mercury: "A year of communication, learning, and commerce. Mental agility is the prime asset.",
  Jupiter: "A year of expansion, wisdom, and opportunity. Growth comes through faith and generosity.",
  Venus: "A year of relationships, pleasure, and creative expression. Harmony and beauty matter.",
  Saturn: "A year of discipline, responsibility, and structure. Patience builds lasting results.",
  Rahu: "A year of ambition, unconventional paths, and disruption. Foreign connections expand horizons.",
  Ketu: "A year of spiritual depth, release, and inner transformation. Detachment brings clarity.",
};
