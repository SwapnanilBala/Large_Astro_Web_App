/**
 * Deterministic Transit Aspect Interpretations.
 * Two-tier lookup: specific planet combo first, fallback to general aspect type.
 */

/* ── Specific Transit Aspect Meanings (transit_planet-aspect_type-natal_planet) ── */

export const TRANSIT_ASPECT_MEANING: Record<string, string> = {
  /* Saturn transits — the most impactful slow-moving planet */
  "Saturn-Conjunction-Sun": "A sobering period of career restructuring and ego refinement. Responsibilities weigh heavily, but disciplined effort builds lasting authority.",
  "Saturn-Conjunction-Moon": "Emotional heaviness, isolation, and confrontation with inner fears. Nurturing duties intensify. Emotional maturity is forged through patient endurance.",
  "Saturn-Conjunction-Mars": "Frustrating energy blockages — action feels restricted. Channel anger into disciplined work. Physical endurance is tested but strengthened.",
  "Saturn-Conjunction-Mercury": "Mental discipline sharpens but thinking may feel slow or pessimistic. Excellent for serious study, contracts, and long-term planning.",
  "Saturn-Conjunction-Jupiter": "Expansion meets restriction — growth becomes structured and measured. Financial and spiritual lessons require patience. Lasting wisdom emerges.",
  "Saturn-Conjunction-Venus": "Relationships face reality checks — love matures through commitment or separation. Financial discipline is required. Lasting bonds are forged.",
  "Saturn-Opposition-Sun": "External pressures challenge identity and authority. Others may restrict your path. Balancing personal will with social obligation is the lesson.",
  "Saturn-Opposition-Moon": "Emotional distance in close relationships. Feeling unsupported or burdened by care duties. Inner strength develops through accepting emotional responsibility.",
  "Saturn-Square-Sun": "Career and identity face structural challenges. Authority figures may block progress. Persistent effort through obstacles builds genuine strength.",
  "Saturn-Square-Moon": "Emotional tension between duty and personal needs. Home and career may clash. Patience with emotional processes leads to maturity.",
  "Saturn-Trine-Sun": "Disciplined effort flows naturally toward achievement. Authority and responsibility are handled with grace. Career builds steadily.",
  "Saturn-Trine-Moon": "Emotional stability through practical structures. Family and home matters stabilize. Inner security deepens through responsible nurturing.",
  "Saturn-Sextile-Jupiter": "Opportunity for structured growth — education, business expansion, and spiritual deepening proceed steadily through disciplined effort.",

  /* Jupiter transits — expansion and fortune */
  "Jupiter-Conjunction-Sun": "Confidence, optimism, and opportunities for advancement expand. Leadership roles beckon. Health and vitality improve. A fortunate period for self-expression.",
  "Jupiter-Conjunction-Moon": "Emotional generosity, domestic expansion, and heightened intuition. Family life flourishes. Public appeal increases. A nurturing, optimistic period.",
  "Jupiter-Conjunction-Venus": "Love, beauty, and financial blessings multiply. Relationships deepen or new romance begins. Art, luxury, and pleasure are richly favored.",
  "Jupiter-Conjunction-Mercury": "Intellectual expansion through education, publishing, or business growth. Communication brings opportunities. A brilliant period for learning and networking.",
  "Jupiter-Conjunction-Mars": "Bold action supported by fortune. Physical energy and confidence surge. Competitive success, property gains, and courageous ventures are strongly favored.",
  "Jupiter-Conjunction-Saturn": "A pivotal cycle where wisdom meets discipline. Major life structures are rebuilt on ethical foundations. Career shifts toward meaningful purpose.",
  "Jupiter-Trine-Sun": "Natural flow of confidence, opportunity, and recognition. Leadership roles expand effortlessly. Health and vitality are supported.",
  "Jupiter-Trine-Moon": "Emotional well-being, domestic harmony, and intuitive wisdom flow naturally. A supportive period for family growth and inner peace.",
  "Jupiter-Square-Saturn": "Tension between expansion and restriction. Growth requires breaking through old limitations. Faith is tested but strengthened.",
  "Jupiter-Opposition-Sun": "Others bring opportunities and challenges to your growth. Partnerships may expand or create philosophical tension. Balance generosity with wisdom.",

  /* Rahu/Ketu transits — karmic and sudden */
  "Rahu-Conjunction-Sun": "Sudden ambition surge and unconventional identity shifts. Obsessive pursuit of recognition. Guard against ego inflation while seizing unique opportunities.",
  "Rahu-Conjunction-Moon": "Emotional intensity and psychic sensitivity peak. Unusual domestic situations arise. Obsessive thoughts require grounding through spiritual practice.",
  "Rahu-Conjunction-Mars": "Explosive energy and sudden aggression or ambition. Channel this powerful drive carefully — it can produce breakthroughs or reckless actions.",
  "Rahu-Conjunction-Venus": "Intense romantic attraction and material desires. Unconventional relationships or luxury pursuits emerge. Guard against obsessive attachments.",
  "Ketu-Conjunction-Sun": "Identity dissolution and spiritual ego release. Worldly recognition may diminish as inner truth emerges. A deeply transformative period of letting go.",
  "Ketu-Conjunction-Moon": "Emotional detachment and psychic sensitivity. Past-life memories or spiritual experiences intensify. Solitude becomes healing.",
  "Ketu-Conjunction-Venus": "Detachment from romantic attachment and material pleasure. Past relationships may resurface for karmic resolution. Spiritual love deepens.",

  /* Mars transits — energy and conflict */
  "Mars-Conjunction-Sun": "Vital energy and assertiveness peak. Excellent for initiating projects, physical challenges, and leadership action. Watch for aggression or burnout.",
  "Mars-Conjunction-Moon": "Emotional intensity and impulsive reactions. Energy around home and family matters surges. Channel emotional fire into productive domestic action.",
  "Mars-Conjunction-Saturn": "Frustration from blocked energy meets disciplined endurance. Hard work under pressure produces lasting results. Patience with anger is essential.",
  "Mars-Square-Saturn": "Intense friction between desire and restriction. Anger at limitations must be managed carefully. Disciplined action through obstacles is the path.",
  "Mars-Opposition-Saturn": "External forces block assertive action. Power struggles with authority figures. Channel frustration into strategic, patient effort rather than confrontation.",
  "Mars-Trine-Jupiter": "Confident, fortunate action — energy flows toward success. Physical vitality supports ambitious ventures. Sports, competition, and bold moves are favored.",

  /* Venus transits — love and beauty */
  "Venus-Conjunction-Moon": "Emotional warmth, artistic sensitivity, and nurturing love flow abundantly. Home beautification, family pleasures, and romantic tenderness are highlighted.",
  "Venus-Conjunction-Sun": "Personal charm, creative confidence, and social magnetism peak. Romance, artistic expression, and self-appreciation are beautifully supported.",
  "Venus-Conjunction-Mars": "Passionate energy merges desire with action. Romantic and creative pursuits are intensely motivated. Physical attraction and artistic drive surge.",
  "Venus-Trine-Jupiter": "The most auspicious transit for love, wealth, and happiness. All pleasures are magnified. Social gatherings, art, and romance flourish.",
  "Venus-Square-Saturn": "Love meets reality — relationships face practical tests. Financial constraints may limit pleasures. Enduring commitments are tested but strengthened.",

  /* Mercury transits — communication and intellect */
  "Mercury-Conjunction-Sun": "Mental clarity and self-expression peak. Excellent for important conversations, negotiations, and intellectual leadership. Ideas flow with confidence.",
  "Mercury-Conjunction-Jupiter": "Expansive thinking and fortunate communications. Excellent for publishing, teaching, legal matters, and philosophical discussions.",
  "Mercury-Square-Mars": "Sharp, aggressive communication. Mental energy is high but arguments are likely. Channel intellectual intensity into productive debate or writing.",
};

/* ── General Aspect Type Fallbacks ── */

export const TRANSIT_ASPECT_GENERAL: Record<string, string> = {
  Conjunction: "A powerful merging of planetary energies — the transit planet directly activates and amplifies the natal planet's themes. This is the strongest aspect, bringing both opportunities and intensity to the areas of life governed by the natal planet.",
  Trine: "A harmonious, flowing connection between planetary energies. The transit planet supports and enhances the natal planet's expression with ease and natural grace. Growth in related life areas comes without struggle.",
  Sextile: "A gentle opportunity aspect — the transit planet offers supportive openings for the natal planet's themes. Benefits arrive through conscious effort and awareness. Creative collaboration between the energies is favored.",
  Square: "A dynamic tension between planetary energies that demands action and adjustment. Challenges in the natal planet's life areas push you to grow. Friction produces motivation and eventual mastery through effort.",
  Opposition: "A polarizing aspect that creates awareness through relationship and contrast. The transit planet illuminates the natal planet's blind spots from the opposite perspective. Balance and integration are the lessons.",
};

/**
 * Look up interpretation for a transit aspect.
 * Tries specific planet combo first, falls back to general aspect type.
 */
export function getTransitInterpretation(
  transitPlanet: string,
  aspectType: string,
  natalPlanet: string
): string {
  const specificKey = `${transitPlanet}-${aspectType}-${natalPlanet}`;
  if (TRANSIT_ASPECT_MEANING[specificKey]) {
    return TRANSIT_ASPECT_MEANING[specificKey];
  }
  return TRANSIT_ASPECT_GENERAL[aspectType] ?? "This transit aspect influences the themes of the natal planet, creating a dynamic interplay of energies during this period.";
}
