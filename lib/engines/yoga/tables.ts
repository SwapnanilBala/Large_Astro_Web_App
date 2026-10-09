// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

export const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

export const SIGN_RULERS: Record<string, string> = {
  Aries: "Mars", Taurus: "Venus", Gemini: "Mercury", Cancer: "Moon",
  Leo: "Sun", Virgo: "Mercury", Libra: "Venus", Scorpio: "Mars",
  Sagittarius: "Jupiter", Capricorn: "Saturn", Aquarius: "Saturn", Pisces: "Jupiter",
};

export const PLANET_OWN_SIGNS: Record<string, string[]> = {
  Sun: ["Leo"],
  Moon: ["Cancer"],
  Mercury: ["Gemini", "Virgo"],
  Venus: ["Taurus", "Libra"],
  Mars: ["Aries", "Scorpio"],
  Jupiter: ["Sagittarius", "Pisces"],
  Saturn: ["Capricorn", "Aquarius"],
};

export const PLANET_EXALTATIONS: Record<string, string> = {
  Sun: "Aries", Moon: "Taurus", Mercury: "Virgo", Venus: "Pisces",
  Mars: "Capricorn", Jupiter: "Cancer", Saturn: "Libra",
};

export const PLANET_DEBILITATIONS: Record<string, string> = {
  Sun: "Libra", Moon: "Scorpio", Mercury: "Pisces", Venus: "Virgo",
  Mars: "Cancer", Jupiter: "Capricorn", Saturn: "Aries",
};

/* Natural friendship (naisargika maitri), as Varahamihira gives it (Brihat
   Jataka 2.15): whom each planet counts a friend and an enemy; everyone else
   is neutral. Not symmetric -- the Moon counts Mercury a friend, Mercury
   counts the Moon an enemy. Rahu and Ketu are not in it. The shadbala engine
   keeps its own copy as Sets. */
export const NATURAL_FRIENDS: Record<string, string[]> = {
  Sun: ["Moon", "Mars", "Jupiter"],
  Moon: ["Sun", "Mercury"],
  Mars: ["Sun", "Moon", "Jupiter"],
  Mercury: ["Sun", "Venus"],
  Jupiter: ["Sun", "Moon", "Mars"],
  Venus: ["Mercury", "Saturn"],
  Saturn: ["Mercury", "Venus"],
};

export const NATURAL_ENEMIES: Record<string, string[]> = {
  Sun: ["Venus", "Saturn"],
  Moon: [],
  Mars: ["Mercury"],
  Mercury: ["Moon"],
  Jupiter: ["Mercury", "Venus"],
  Venus: ["Sun", "Moon"],
  Saturn: ["Sun", "Moon", "Mars"],
};

export const NATURAL_BENEFICS = ["Jupiter", "Venus", "Mercury"];
export const NATURAL_MALEFICS = ["Sun", "Mars", "Saturn", "Rahu", "Ketu"];
export const CLASSICAL_PLANETS = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
export const YOGA_OCCURRENCE_THRESHOLD = 30;

/* Sign modality. Used by the Nabhasa Ashraya figures and by Kusuma, which is
   why these sit here rather than beside the Nabhasa definitions. */
export const MOVABLE_SIGNS = ["Aries", "Cancer", "Libra", "Capricorn"];
export const FIXED_SIGNS = ["Taurus", "Leo", "Scorpio", "Aquarius"];
export const DUAL_SIGNS = ["Gemini", "Virgo", "Sagittarius", "Pisces"];
