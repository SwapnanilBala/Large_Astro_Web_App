/**
 * Copy tables, referenced from rule templates by name via the `{@table[$path]}`
 * token.
 *
 * These are the client-facing prose blocks that used to be inlined in
 * rule-engine.ts. They live here so a rule record stays a short data record and
 * the long copy is editable in one place.
 *
 * HOUSE_THEMES is additionally re-exported as a runtime named export from
 * lib/engines/rule-engine.ts -- chart-service.ts and rule-engine.test.ts both
 * import it from there.
 */

export const ASCENDANT_INSIGHTS: Record<string, string> = {
  Aries: "Direct, action-driven and competitive. You perform best with bold goals and quick execution loops.",
  Taurus: "Steady, practical and value-focused. Long-horizon consistency becomes your strongest advantage.",
  Gemini: "Adaptive, curious and mentally agile. You thrive through communication and cross-domain learning.",
  Cancer: "Protective, intuitive and family-centered. Emotional safety strongly influences peak performance.",
  Leo: "Expressive, leadership-oriented and generous. You gain momentum when your work is visible and creative.",
  Virgo: "Analytical, service-oriented and precision-focused. Systems, routines and quality standards matter deeply.",
  Libra: "Diplomatic, relational and aesthetics-oriented. Collaboration quality is a decisive growth factor.",
  Scorpio: "Intense, strategic and transformational. You excel in high-stakes or deeply investigative environments.",
  Sagittarius: "Vision-led, exploratory and principle-driven. Expansion, travel and knowledge seek expression.",
  Capricorn: "Disciplined, structured and legacy-focused. You build authority through strategic persistence.",
  Aquarius: "Innovative, system-level and future-facing. Originality and community impact energize your path.",
  Pisces: "Imaginative, empathic and spiritually receptive. Art, healing and compassion become key channels.",
};

export const SUN_SIGN_INSIGHTS: Record<string, string> = {
  Aries: "Core identity seeks challenge and autonomy.",
  Taurus: "Core identity seeks stability and material grounding.",
  Gemini: "Core identity seeks variety, ideas and exchange.",
  Cancer: "Core identity seeks emotional belonging and protection.",
  Leo: "Core identity seeks recognition and creative influence.",
  Virgo: "Core identity seeks mastery through detail and utility.",
  Libra: "Core identity seeks balance, fairness and partnership.",
  Scorpio: "Core identity seeks depth, truth and transformation.",
  Sagittarius: "Core identity seeks meaning, growth and freedom.",
  Capricorn: "Core identity seeks structure, achievement and respect.",
  Aquarius: "Core identity seeks innovation and social contribution.",
  Pisces: "Core identity seeks transcendence and compassionate purpose.",
};

export const MOON_SIGN_INSIGHTS: Record<string, string> = {
  Aries: "Emotional rhythm is quick and decisive, with rapid recovery after setbacks.",
  Taurus: "Emotional rhythm is calm and stable, preferring predictable comfort.",
  Gemini: "Emotional rhythm is cerebral and conversational, needing mental stimulation.",
  Cancer: "Emotional rhythm is sensitive and nurturing, requiring strong home anchors.",
  Leo: "Emotional rhythm is warm and expressive, supported by appreciation.",
  Virgo: "Emotional rhythm is precise and careful, soothed by order and routine.",
  Libra: "Emotional rhythm is harmony-seeking, distressed by unresolved conflict.",
  Scorpio: "Emotional rhythm is deep and private, requiring trust before openness.",
  Sagittarius: "Emotional rhythm is optimistic and freedom-seeking, supported by exploration.",
  Capricorn: "Emotional rhythm is reserved and responsible, comforted by control.",
  Aquarius: "Emotional rhythm is detached and objective, preferring conceptual distance.",
  Pisces: "Emotional rhythm is porous and intuitive, requiring energetic boundaries.",
};

export const HOUSE_THEMES: Record<number, string> = {
  1: "identity, appearance and direction",
  2: "assets, income and values",
  3: "communication, learning and siblings",
  4: "home, roots and emotional foundations",
  5: "creativity, romance and children",
  6: "service, routines and health",
  7: "partnerships and agreements",
  8: "shared resources and transformation",
  9: "beliefs, wisdom and long-distance journeys",
  10: "career, authority and public standing",
  11: "community, networks and long goals",
  12: "retreat, subconscious and spiritual closure",
};

export const CAREER_INSIGHTS: Record<string, string> = {
  Aries: "Leadership-driven career path. You excel in entrepreneurship, military, sports, or any role demanding initiative and speed.",
  Taurus: "Career stability through finance, agriculture, luxury goods, art, or banking. You build wealth through patience and material mastery.",
  Gemini: "Communication-centered career path. Journalism, writing, teaching, marketing, or trading leverage your intellectual agility.",
  Cancer: "Nurturing professions suit you best. Healthcare, hospitality, real estate, food industry, or counseling align with your protective nature.",
  Leo: "Careers in leadership, entertainment, politics, or creative direction fulfill your need for visibility and authority.",
  Virgo: "Service-oriented and analytical careers thrive. Medicine, accounting, research, quality assurance, or data science match your precision.",
  Libra: "Partnership-based and aesthetic careers prosper. Law, diplomacy, fashion, interior design, or mediation harness your balance-seeking nature.",
  Scorpio: "Investigative and transformative careers suit you. Research, psychology, surgery, detective work, or financial analysis leverage your depth.",
  Sagittarius: "Expansive careers in education, philosophy, travel, publishing, or international relations match your visionary drive.",
  Capricorn: "Structured careers with long-term growth. Government, corporate management, engineering, architecture, or administration reward your discipline.",
  Aquarius: "Innovative and humanitarian careers excel. Technology, social reform, science, aviation, or network-based businesses fit your originality.",
  Pisces: "Creative and healing careers flourish. Music, film, spirituality, charity work, therapy, or marine fields channel your compassion.",
};

export const LOVE_INSIGHTS: Record<string, string> = {
  Aries: "Passionate, direct and conquest-oriented in romance. You need a partner who matches your energy and respects your independence.",
  Taurus: "Loyal, sensual and stability-seeking in love. You value consistency, physical affection, and shared material comfort above all.",
  Gemini: "Intellectually stimulated in love. You need mental connection, variety in expression, and a partner who enjoys conversation.",
  Cancer: "Deeply nurturing and emotionally invested. You seek security, family bonds, and a partner who values emotional intimacy.",
  Leo: "Generous, warm and dramatic in love. You crave admiration, loyalty, and a partner who celebrates your creative spirit.",
  Virgo: "Thoughtful, devoted and service-oriented in love. You express care through practical acts and value reliability in a partner.",
  Libra: "Harmony-driven and partnership-oriented. You seek beauty, fairness, and deep companionship with someone who values balance.",
  Scorpio: "Intense, transformative and deeply loyal in love. You demand authenticity, emotional depth, and complete trust in partnerships.",
  Sagittarius: "Freedom-loving and adventure-seeking in romance. You need a partner who shares your love for exploration and growth.",
  Capricorn: "Committed, traditional and goal-oriented in love. You value long-term stability and a partner with matching ambition.",
  Aquarius: "Unconventional and friendship-based in love. You value intellectual equality, personal space, and a partner who embraces uniqueness.",
  Pisces: "Romantic, empathic and spiritually connected in love. You seek a soulmate bond, creative expression, and emotional transcendence.",
};

/** How each element tends to make decisions. Used by the dominant-element rule. */
export const ELEMENT_STYLE: Record<string, string> = {
  Fire: "move first and correct later, trusting momentum over analysis",
  Earth: "want proof before movement, and build in steps you can repeat",
  Air: "think a decision through out loud, and change your mind when the argument changes",
  Water: "read the room before the facts, and trust timing over logic",
};

/** What each planet is responsible for, in plain language. Used by dignity rules. */
export const PLANET_ROLE: Record<string, string> = {
  Sun: "your sense of self and the authority you carry",
  Moon: "your emotional pacing and what makes you feel safe",
  Mercury: "how you think, learn and explain",
  Venus: "how you love, attract and value things",
  Mars: "your drive, appetite for conflict and physical energy",
  Jupiter: "your optimism, generosity and sense of meaning",
  Saturn: "your discipline, patience and relationship with limits",
};

export const TABLES: Record<string, Record<string | number, string>> = {
  ascendant_insights: ASCENDANT_INSIGHTS,
  sun_sign_insights: SUN_SIGN_INSIGHTS,
  moon_sign_insights: MOON_SIGN_INSIGHTS,
  house_themes: HOUSE_THEMES,
  career_insights: CAREER_INSIGHTS,
  love_insights: LOVE_INSIGHTS,
  element_style: ELEMENT_STYLE,
  planet_role: PLANET_ROLE,
};
