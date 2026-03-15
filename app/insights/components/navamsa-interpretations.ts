/**
 * Deterministic Navamsa (D9) Interpretations.
 * Three lookup tables: sign meaning, planet-in-navamsa-sign, and Vargottama text.
 */

/* ── Navamsa Sign Meanings (D9 context: dharma, marriage, soul purpose) ── */

export const NAVAMSA_SIGN_MEANING: Record<string, string> = {
  Aries:
    "Navamsa Aries brings a pioneering, passionate energy to the soul's deeper purpose. In marriage, the partner carries initiative and courage. Spiritual growth comes through bold, independent action.",
  Taurus:
    "Navamsa Taurus grounds the soul in material beauty, sensual comfort, and artistic refinement. Marriage thrives on loyalty and shared pleasures. Dharma unfolds through patience and devotion.",
  Gemini:
    "Navamsa Gemini activates intellectual curiosity and communicative gifts at the soul level. Partnership flourishes through dialogue and mental stimulation. The dharmic path involves learning and sharing knowledge.",
  Cancer:
    "Navamsa Cancer deepens emotional sensitivity, nurturing instincts, and intuitive bonds. Marriage is rooted in emotional security and family devotion. Dharma unfolds through compassionate care.",
  Leo:
    "Navamsa Leo ignites creative confidence, dignity, and leadership in the soul's expression. Marriage brings warmth, romance, and mutual admiration. Dharma manifests through generous self-expression.",
  Virgo:
    "Navamsa Virgo refines the soul through service, analysis, and practical wisdom. Partnership demands purity of intention and shared growth. Dharma is found in humble, devoted work.",
  Libra:
    "Navamsa Libra harmonizes the soul through partnership, beauty, and diplomatic grace. Marriage is central to spiritual evolution. Dharma unfolds through balanced relationships and aesthetic refinement.",
  Scorpio:
    "Navamsa Scorpio intensifies the soul's transformative depths — passion, mystery, and regeneration. Marriage involves profound emotional bonds. Dharma emerges through surrender and spiritual rebirth.",
  Sagittarius:
    "Navamsa Sagittarius expands the soul through wisdom, faith, and philosophical quest. Marriage connects with higher learning and shared ideals. Dharma manifests through teaching and righteous living.",
  Capricorn:
    "Navamsa Capricorn structures the soul toward discipline, responsibility, and enduring achievement. Marriage demands maturity and commitment. Dharma unfolds through persistent, ethical effort.",
  Aquarius:
    "Navamsa Aquarius awakens the soul to humanitarian ideals, innovation, and detached wisdom. Partnership thrives on intellectual equality and shared vision. Dharma emerges through service to the collective.",
  Pisces:
    "Navamsa Pisces dissolves boundaries and elevates the soul toward compassion, imagination, and spiritual surrender. Marriage carries a mystical, selfless quality. Dharma unfolds through devotion and transcendence.",
};

/* ── Planet in Navamsa Sign (key planets: Venus, Jupiter, Moon, Sun, Saturn) ── */

export const PLANET_NAVAMSA_MEANING: Record<string, Record<string, string>> = {
  Venus: {
    Aries:
      "Venus in Navamsa Aries creates passionate, impulsive love. Attraction is immediate and fiery. The partner is active and assertive. Marriage benefits from maintaining excitement and independence.",
    Taurus:
      "Venus in Navamsa Taurus is exalted — love is deeply sensual, loyal, and enduring. The partner values beauty, comfort, and stability. One of the strongest placements for marital harmony.",
    Gemini:
      "Venus in Navamsa Gemini brings witty, communicative love. The partner is intellectually stimulating and socially charming. Marriage thrives on variety, conversation, and mental connection.",
    Cancer:
      "Venus in Navamsa Cancer creates nurturing, emotionally deep love. The partner is caring and family-oriented. Marriage revolves around emotional security and domestic harmony.",
    Leo:
      "Venus in Navamsa Leo brings dramatic, generous love. The partner is warm, proud, and affectionate. Marriage flourishes through mutual admiration, romance, and creative expression.",
    Virgo:
      "Venus in Navamsa Virgo is debilitated — love is tested through criticism and high standards. The partner values practicality over romance. Conscious effort toward acceptance strengthens the bond.",
    Libra:
      "Venus in Navamsa Libra is in its own sign — partnership is central to the soul's purpose. The partner is refined, graceful, and harmonious. Marriage brings deep aesthetic and social fulfillment.",
    Scorpio:
      "Venus in Navamsa Scorpio intensifies love to transformative depths. The partner is magnetic and emotionally powerful. Marriage involves passion, jealousy, and profound spiritual bonding.",
    Sagittarius:
      "Venus in Navamsa Sagittarius brings adventurous, philosophical love. The partner values freedom and higher ideals. Marriage thrives on shared exploration and spiritual growth.",
    Capricorn:
      "Venus in Navamsa Capricorn brings mature, committed love built on responsibility. The partner values tradition and long-term security. Marriage deepens slowly through shared discipline.",
    Aquarius:
      "Venus in Navamsa Aquarius creates unconventional, friendship-based love. The partner values intellectual equality and personal space. Marriage flourishes through shared humanitarian vision.",
    Pisces:
      "Venus in Navamsa Pisces is exalted — love becomes selfless, spiritual, and transcendent. The partner carries deep compassion and artistic sensitivity. The highest expression of devotional love.",
  },

  Jupiter: {
    Aries:
      "Jupiter in Navamsa Aries infuses dharma with pioneering zeal and righteous courage. Spiritual growth comes through independent seeking. Marriage benefits from the partner's optimistic initiative.",
    Taurus:
      "Jupiter in Navamsa Taurus grounds spiritual wisdom in practical abundance. Dharma unfolds through patient cultivation of resources and values. Marriage brings financial blessings.",
    Gemini:
      "Jupiter in Navamsa Gemini expands dharma through knowledge, teaching, and communication. Spiritual growth comes through diverse learning. The partner stimulates philosophical exchange.",
    Cancer:
      "Jupiter in Navamsa Cancer is exalted — dharma is deeply nurturing, intuitive, and emotionally wise. Spiritual growth through family and compassion. Marriage is blessed with protection and abundance.",
    Leo:
      "Jupiter in Navamsa Leo magnifies dharma through creative leadership and generous expression. Spiritual authority comes naturally. Marriage is warm, dignified, and growth-oriented.",
    Virgo:
      "Jupiter in Navamsa Virgo channels dharma through detailed service and analytical wisdom. Spiritual growth requires humility and practical devotion. Marriage benefits from shared discipline.",
    Libra:
      "Jupiter in Navamsa Libra expands dharma through harmonious relationships and justice. Spiritual growth comes through balance and diplomacy. Marriage is guided by fairness and mutual respect.",
    Scorpio:
      "Jupiter in Navamsa Scorpio deepens dharma through transformative research and hidden knowledge. Spiritual growth comes through intensity and occult studies. Marriage involves profound shared seeking.",
    Sagittarius:
      "Jupiter in Navamsa Sagittarius is in its own sign — dharma is pure, expansive, and philosophically aligned. The strongest placement for spiritual wisdom. Marriage is guided by shared faith and ideals.",
    Capricorn:
      "Jupiter in Navamsa Capricorn is debilitated — dharma requires patient effort against restriction. Spiritual growth comes slowly through disciplined practice. Marriage tests but strengthens faith.",
    Aquarius:
      "Jupiter in Navamsa Aquarius expands dharma through humanitarian vision and innovation. Spiritual growth comes through unconventional paths. Marriage thrives on shared ideals for the collective.",
    Pisces:
      "Jupiter in Navamsa Pisces is in its own sign — dharma is deeply compassionate, mystical, and transcendent. The highest spiritual placement. Marriage is guided by selfless devotion and spiritual union.",
  },

  Moon: {
    Aries:
      "Moon in Navamsa Aries creates an emotionally bold, impulsive inner nature. The soul's emotional needs center on independence and action. The partner should respect emotional autonomy.",
    Taurus:
      "Moon in Navamsa Taurus is exalted — the soul's emotional nature is stable, sensual, and deeply content. Inner peace comes through material and emotional security. Marriage is emotionally fulfilling.",
    Gemini:
      "Moon in Navamsa Gemini creates a restless, intellectually curious emotional nature. The soul needs mental stimulation and variety. Marriage benefits from engaging communication.",
    Cancer:
      "Moon in Navamsa Cancer is in its own sign — the soul's emotional nature is deeply nurturing, intuitive, and protective. Emotional fulfillment comes through family and home. Marriage is emotionally rich.",
    Leo:
      "Moon in Navamsa Leo creates a warm, expressive emotional nature with a need for recognition. The soul finds contentment through creative expression and admiration. Marriage is heartfelt and generous.",
    Virgo:
      "Moon in Navamsa Virgo creates an analytical, service-oriented emotional nature. The soul seeks emotional order and practical usefulness. Marriage benefits from shared routine and mutual care.",
    Libra:
      "Moon in Navamsa Libra creates a harmonious, relationship-oriented emotional nature. The soul finds peace through partnership and beauty. Marriage is central to emotional well-being.",
    Scorpio:
      "Moon in Navamsa Scorpio is debilitated — the soul's emotional nature is intense, secretive, and transformative. Deep emotional work is required. Marriage involves powerful emotional bonding.",
    Sagittarius:
      "Moon in Navamsa Sagittarius creates an optimistic, philosophically oriented emotional nature. The soul needs freedom and meaning. Marriage thrives on shared adventures and beliefs.",
    Capricorn:
      "Moon in Navamsa Capricorn creates a disciplined, reserved emotional nature. The soul seeks emotional stability through structure. Marriage benefits from patience and long-term commitment.",
    Aquarius:
      "Moon in Navamsa Aquarius creates a detached, humanitarian emotional nature. The soul finds fulfillment through friendship and ideals. Marriage thrives on intellectual equality.",
    Pisces:
      "Moon in Navamsa Pisces creates a compassionate, imaginative emotional nature. The soul is deeply intuitive and spiritually sensitive. Marriage carries a mystical, devotional quality.",
  },

  Sun: {
    Aries:
      "Sun in Navamsa Aries is exalted — the soul's core identity is strong, pioneering, and confident. Leadership ability is innate. Marriage benefits from a partner who respects autonomy and strength.",
    Taurus:
      "Sun in Navamsa Taurus steadies the soul's identity in practical values and aesthetic appreciation. The inner self seeks stability and sensory fulfillment. Marriage is grounded and loyal.",
    Gemini:
      "Sun in Navamsa Gemini makes the soul's identity flexible, communicative, and intellectually driven. Self-expression flows through ideas and networks. Marriage thrives on mental rapport.",
    Cancer:
      "Sun in Navamsa Cancer nurtures the soul's identity through emotional connection and family bonds. The inner self seeks protective roles. Marriage deepens through shared emotional responsibility.",
    Leo:
      "Sun in Navamsa Leo is in its own sign — the soul's identity is radiant, creative, and authoritative. Self-expression is powerful and dignified. Marriage brings warmth and mutual pride.",
    Virgo:
      "Sun in Navamsa Virgo refines the soul's identity through analytical skill and humble service. Self-expression is practical and detailed. Marriage benefits from shared goals and mutual improvement.",
    Libra:
      "Sun in Navamsa Libra is debilitated — the soul's identity depends heavily on partnership and external validation. Self-expression needs balance. Marriage is important but requires maintaining individuality.",
    Scorpio:
      "Sun in Navamsa Scorpio intensifies the soul's identity with depth, power, and transformative drive. Self-expression is magnetic and secretive. Marriage involves profound shared transformation.",
    Sagittarius:
      "Sun in Navamsa Sagittarius elevates the soul's identity through wisdom, teaching, and philosophical vision. Self-expression is expansive and righteous. Marriage thrives on shared faith.",
    Capricorn:
      "Sun in Navamsa Capricorn structures the soul's identity through discipline, ambition, and enduring effort. Self-expression matures over time. Marriage is built on respect and shared achievement.",
    Aquarius:
      "Sun in Navamsa Aquarius makes the soul's identity independent, humanitarian, and visionary. Self-expression is unconventional and progressive. Marriage thrives on intellectual freedom.",
    Pisces:
      "Sun in Navamsa Pisces dissolves ego boundaries and elevates the soul toward compassion and spiritual service. Self-expression is subtle and artistic. Marriage carries a selfless, devotional nature.",
  },

  Saturn: {
    Aries:
      "Saturn in Navamsa Aries is debilitated — the soul's karmic lessons involve overcoming impulsive frustration with patient discipline. Marriage tests initiative versus responsibility.",
    Taurus:
      "Saturn in Navamsa Taurus stabilizes karmic lessons through persistent material effort and practical endurance. The soul matures through patient accumulation. Marriage is solid but slow to warm.",
    Gemini:
      "Saturn in Navamsa Gemini structures karmic lessons through disciplined communication and serious study. The soul matures through focused learning. Marriage benefits from structured dialogue.",
    Cancer:
      "Saturn in Navamsa Cancer brings karmic lessons around emotional restriction and family duty. The soul matures through accepting emotional responsibility. Marriage requires patience with emotional walls.",
    Leo:
      "Saturn in Navamsa Leo brings karmic lessons around humility versus authority. The soul matures through tempering ego with discipline. Marriage tests pride but builds genuine dignity.",
    Virgo:
      "Saturn in Navamsa Virgo channels karmic lessons through meticulous service and health discipline. The soul matures through practical perfection. Marriage is dutiful and growth-oriented.",
    Libra:
      "Saturn in Navamsa Libra is exalted — karmic lessons are mastered through balanced justice and committed partnership. The soul achieves wisdom through fair relationships. Marriage is deeply committed.",
    Scorpio:
      "Saturn in Navamsa Scorpio intensifies karmic lessons through deep transformation and confrontation with hidden fears. The soul matures through releasing control. Marriage involves powerful karmic bonds.",
    Sagittarius:
      "Saturn in Navamsa Sagittarius structures karmic lessons through disciplined spiritual seeking and philosophical rigor. The soul matures through tested faith. Marriage benefits from shared ethical commitment.",
    Capricorn:
      "Saturn in Navamsa Capricorn is in its own sign — karmic lessons are naturally mastered through ambition, discipline, and enduring effort. The soul is structurally mature. Marriage is deeply committed and long-lasting.",
    Aquarius:
      "Saturn in Navamsa Aquarius is in its own sign — karmic lessons are mastered through humanitarian service and detached wisdom. The soul serves the collective. Marriage thrives on intellectual partnership and shared ideals.",
    Pisces:
      "Saturn in Navamsa Pisces dissolves karmic rigidity through spiritual surrender and compassion. The soul matures by releasing material attachment. Marriage carries a karmic, devotional quality.",
  },
};

/* ── Vargottama Significance ── */

export const VARGOTTAMA_SIGNIFICANCE =
  "Vargottama status means this planet occupies the same sign in both the Rashi (D1) and Navamsa (D9) charts. This exceptional alignment amplifies the planet's strength and purity — its significations become deeply integrated into both the worldly personality and the soul's dharmic path. In classical Vedic astrology, Vargottama planets are considered auspicious, as their energy operates with clarity and consistency across material and spiritual dimensions.";

/**
 * Look up Navamsa interpretation for a planet.
 * Returns sign meaning + planet-specific if available.
 */
export function getNavamsaInterpretation(
  planetName: string,
  navamsaSign: string,
  isVargottama: boolean
): { signMeaning: string; planetMeaning: string; vargottamaNote: string } {
  const signMeaning =
    NAVAMSA_SIGN_MEANING[navamsaSign] ??
    "This Navamsa sign shapes the planet's deeper spiritual expression and its influence on dharma and partnership.";

  const planetMeaning =
    PLANET_NAVAMSA_MEANING[planetName]?.[navamsaSign] ??
    `${planetName} in Navamsa ${navamsaSign} colors the soul's expression of this planet's themes through the qualities of ${navamsaSign} — influencing dharma, marriage, and spiritual growth.`;

  const vargottamaNote = isVargottama ? VARGOTTAMA_SIGNIFICANCE : "";

  return { signMeaning, planetMeaning, vargottamaNote };
}
