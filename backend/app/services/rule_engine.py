from collections import Counter

from app.models.chart_models import (
    DeterministicRule,
    HousePlacement,
    LifeDomainInsight,
    PlanetPosition,
)

ZODIAC_SIGNS = [
    "Aries",
    "Taurus",
    "Gemini",
    "Cancer",
    "Leo",
    "Virgo",
    "Libra",
    "Scorpio",
    "Sagittarius",
    "Capricorn",
    "Aquarius",
    "Pisces",
]

SIGN_ELEMENTS = {
    "Aries": "Fire",
    "Leo": "Fire",
    "Sagittarius": "Fire",
    "Taurus": "Earth",
    "Virgo": "Earth",
    "Capricorn": "Earth",
    "Gemini": "Air",
    "Libra": "Air",
    "Aquarius": "Air",
    "Cancer": "Water",
    "Scorpio": "Water",
    "Pisces": "Water",
}

SIGN_RULERS = {
    "Aries": "Mars",
    "Taurus": "Venus",
    "Gemini": "Mercury",
    "Cancer": "Moon",
    "Leo": "Sun",
    "Virgo": "Mercury",
    "Libra": "Venus",
    "Scorpio": "Mars",
    "Sagittarius": "Jupiter",
    "Capricorn": "Saturn",
    "Aquarius": "Saturn",
    "Pisces": "Jupiter",
}

PLANET_OWN_SIGNS = {
    "Sun": {"Leo"},
    "Moon": {"Cancer"},
    "Mercury": {"Gemini", "Virgo"},
    "Venus": {"Taurus", "Libra"},
    "Mars": {"Aries", "Scorpio"},
    "Jupiter": {"Sagittarius", "Pisces"},
    "Saturn": {"Capricorn", "Aquarius"},
}

PLANET_EXALTATIONS = {
    "Sun": "Aries",
    "Moon": "Taurus",
    "Mercury": "Virgo",
    "Venus": "Pisces",
    "Mars": "Capricorn",
    "Jupiter": "Cancer",
    "Saturn": "Libra",
}

PLANET_DEBILITATIONS = {
    "Sun": "Libra",
    "Moon": "Scorpio",
    "Mercury": "Pisces",
    "Venus": "Virgo",
    "Mars": "Cancer",
    "Jupiter": "Capricorn",
    "Saturn": "Aries",
}

ASCENDANT_INSIGHTS = {
    "Aries": "Direct, action-driven and competitive. You perform best with bold goals and quick execution loops.",
    "Taurus": "Steady, practical and value-focused. Long-horizon consistency becomes your strongest advantage.",
    "Gemini": "Adaptive, curious and mentally agile. You thrive through communication and cross-domain learning.",
    "Cancer": "Protective, intuitive and family-centered. Emotional safety strongly influences peak performance.",
    "Leo": "Expressive, leadership-oriented and generous. You gain momentum when your work is visible and creative.",
    "Virgo": "Analytical, service-oriented and precision-focused. Systems, routines and quality standards matter deeply.",
    "Libra": "Diplomatic, relational and aesthetics-oriented. Collaboration quality is a decisive growth factor.",
    "Scorpio": "Intense, strategic and transformational. You excel in high-stakes or deeply investigative environments.",
    "Sagittarius": "Vision-led, exploratory and principle-driven. Expansion, travel and knowledge seek expression.",
    "Capricorn": "Disciplined, structured and legacy-focused. You build authority through strategic persistence.",
    "Aquarius": "Innovative, system-level and future-facing. Originality and community impact energize your path.",
    "Pisces": "Imaginative, empathic and spiritually receptive. Art, healing and compassion become key channels.",
}

SUN_SIGN_INSIGHTS = {
    "Aries": "Core identity seeks challenge and autonomy.",
    "Taurus": "Core identity seeks stability and material grounding.",
    "Gemini": "Core identity seeks variety, ideas and exchange.",
    "Cancer": "Core identity seeks emotional belonging and protection.",
    "Leo": "Core identity seeks recognition and creative influence.",
    "Virgo": "Core identity seeks mastery through detail and utility.",
    "Libra": "Core identity seeks balance, fairness and partnership.",
    "Scorpio": "Core identity seeks depth, truth and transformation.",
    "Sagittarius": "Core identity seeks meaning, growth and freedom.",
    "Capricorn": "Core identity seeks structure, achievement and respect.",
    "Aquarius": "Core identity seeks innovation and social contribution.",
    "Pisces": "Core identity seeks transcendence and compassionate purpose.",
}

MOON_SIGN_INSIGHTS = {
    "Aries": "Emotional rhythm is quick and decisive, with rapid recovery after setbacks.",
    "Taurus": "Emotional rhythm is calm and stable, preferring predictable comfort.",
    "Gemini": "Emotional rhythm is cerebral and conversational, needing mental stimulation.",
    "Cancer": "Emotional rhythm is sensitive and nurturing, requiring strong home anchors.",
    "Leo": "Emotional rhythm is warm and expressive, supported by appreciation.",
    "Virgo": "Emotional rhythm is precise and careful, soothed by order and routine.",
    "Libra": "Emotional rhythm is harmony-seeking, distressed by unresolved conflict.",
    "Scorpio": "Emotional rhythm is deep and private, requiring trust before openness.",
    "Sagittarius": "Emotional rhythm is optimistic and freedom-seeking, supported by exploration.",
    "Capricorn": "Emotional rhythm is reserved and responsible, comforted by control.",
    "Aquarius": "Emotional rhythm is detached and objective, preferring conceptual distance.",
    "Pisces": "Emotional rhythm is porous and intuitive, requiring energetic boundaries.",
}

HOUSE_THEMES = {
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
}

CAREER_INSIGHTS = {
    "Aries": "Leadership-driven career path. You excel in entrepreneurship, military, sports, or any role demanding initiative and speed.",
    "Taurus": "Career stability through finance, agriculture, luxury goods, art, or banking. You build wealth through patience and material mastery.",
    "Gemini": "Communication-centered career path. Journalism, writing, teaching, marketing, or trading leverage your intellectual agility.",
    "Cancer": "Nurturing professions suit you best. Healthcare, hospitality, real estate, food industry, or counseling align with your protective nature.",
    "Leo": "Careers in leadership, entertainment, politics, or creative direction fulfill your need for visibility and authority.",
    "Virgo": "Service-oriented and analytical careers thrive. Medicine, accounting, research, quality assurance, or data science match your precision.",
    "Libra": "Partnership-based and aesthetic careers prosper. Law, diplomacy, fashion, interior design, or mediation harness your balance-seeking nature.",
    "Scorpio": "Investigative and transformative careers suit you. Research, psychology, surgery, detective work, or financial analysis leverage your depth.",
    "Sagittarius": "Expansive careers in education, philosophy, travel, publishing, or international relations match your visionary drive.",
    "Capricorn": "Structured careers with long-term growth. Government, corporate management, engineering, architecture, or administration reward your discipline.",
    "Aquarius": "Innovative and humanitarian careers excel. Technology, social reform, science, aviation, or network-based businesses fit your originality.",
    "Pisces": "Creative and healing careers flourish. Music, film, spirituality, charity work, therapy, or marine fields channel your compassion.",
}

LOVE_INSIGHTS = {
    "Aries": "Passionate, direct and conquest-oriented in romance. You need a partner who matches your energy and respects your independence.",
    "Taurus": "Loyal, sensual and stability-seeking in love. You value consistency, physical affection, and shared material comfort above all.",
    "Gemini": "Intellectually stimulated in love. You need mental connection, variety in expression, and a partner who enjoys conversation.",
    "Cancer": "Deeply nurturing and emotionally invested. You seek security, family bonds, and a partner who values emotional intimacy.",
    "Leo": "Generous, warm and dramatic in love. You crave admiration, loyalty, and a partner who celebrates your creative spirit.",
    "Virgo": "Thoughtful, devoted and service-oriented in love. You express care through practical acts and value reliability in a partner.",
    "Libra": "Harmony-driven and partnership-oriented. You seek beauty, fairness, and deep companionship with someone who values balance.",
    "Scorpio": "Intense, transformative and deeply loyal in love. You demand authenticity, emotional depth, and complete trust in partnerships.",
    "Sagittarius": "Freedom-loving and adventure-seeking in romance. You need a partner who shares your love for exploration and growth.",
    "Capricorn": "Committed, traditional and goal-oriented in love. You value long-term stability and a partner with matching ambition.",
    "Aquarius": "Unconventional and friendship-based in love. You value intellectual equality, personal space, and a partner who embraces uniqueness.",
    "Pisces": "Romantic, empathic and spiritually connected in love. You seek a soulmate bond, creative expression, and emotional transcendence.",
}

SIGN_STYLE_PHRASES = {
    "Aries": "fast-moving, bold, and initiative-heavy",
    "Taurus": "steady, resource-aware, and stabilizing",
    "Gemini": "curious, adaptable, and communication-led",
    "Cancer": "protective, emotional, and security-seeking",
    "Leo": "visible, expressive, and leadership-oriented",
    "Virgo": "practical, detail-sensitive, and improvement-focused",
    "Libra": "relational, balanced, and diplomacy-driven",
    "Scorpio": "intense, strategic, and transformative",
    "Sagittarius": "expansive, principle-led, and exploratory",
    "Capricorn": "structured, disciplined, and long-range",
    "Aquarius": "independent, unconventional, and network-aware",
    "Pisces": "intuitive, fluid, and spiritually receptive",
}

ELEMENT_GUIDANCE = {
    "Fire": "take initiative early, but pair momentum with pacing so you do not burn through opportunities too quickly.",
    "Earth": "build through consistency, measurable habits, and patient accumulation rather than dramatic leaps.",
    "Air": "keep communication open, ask better questions, and let perspective changes become part of the strategy.",
    "Water": "trust intuitive timing, but protect boundaries so emotion stays informative instead of overwhelming.",
}

LIFE_DOMAIN_CONFIG = {
    "love_life": {
        "label": "Love Life",
        "primary_house": 7,
        "secondary_house": 5,
        "anchor_planet": "Venus",
        "summary_focus": "partnership, attraction, emotional availability, and long-term bonding",
    },
    "career": {
        "label": "Career",
        "primary_house": 10,
        "secondary_house": 6,
        "anchor_planet": "Saturn",
        "summary_focus": "career growth, authority, public standing, and work ethic",
    },
    "family": {
        "label": "Family",
        "primary_house": 4,
        "secondary_house": 2,
        "anchor_planet": "Moon",
        "summary_focus": "home life, emotional grounding, lineage, and support systems",
    },
    "inheritance": {
        "label": "Inheritance",
        "primary_house": 8,
        "secondary_house": 2,
        "anchor_planet": "Jupiter",
        "summary_focus": "inheritance, shared assets, legacies, and resource transitions",
    },
    "influence": {
        "label": "Influence",
        "primary_house": 11,
        "secondary_house": 10,
        "anchor_planet": "Sun",
        "summary_focus": "influence, network effect, social reach, and the ability to move people",
    },
    "life_cycle": {
        "label": "Life Cycle",
        "primary_house": 1,
        "secondary_house": 8,
        "anchor_planet": "Moon",
        "summary_focus": "major life phases, reinvention, recovery, and long-range personal evolution",
    },
}


class DeterministicRuleEngine:
    @staticmethod
    def _planet_by_name(planets: list[PlanetPosition], name: str) -> PlanetPosition:
        return next(planet for planet in planets if planet.name == name)

    @staticmethod
    def _sign_distance(start_sign: str, target_sign: str) -> int:
        start_index = ZODIAC_SIGNS.index(start_sign)
        target_index = ZODIAC_SIGNS.index(target_sign)
        return ((target_index - start_index) % 12) + 1

    @staticmethod
    def _planet_dignity(planet: PlanetPosition) -> str:
        if planet.sign == PLANET_EXALTATIONS.get(planet.name):
            return "exalted"
        if planet.sign == PLANET_DEBILITATIONS.get(planet.name):
            return "debilitated"
        if planet.sign in PLANET_OWN_SIGNS.get(planet.name, set()):
            return "own_sign"
        return "neutral"

    @staticmethod
    def _house_by_number(houses: list[HousePlacement], house_number: int) -> HousePlacement:
        return next(house for house in houses if house.house_number == house_number)

    @staticmethod
    def _ordinal(value: int) -> str:
        if 10 <= value % 100 <= 20:
            suffix = "th"
        else:
            suffix = {1: "st", 2: "nd", 3: "rd"}.get(value % 10, "th")
        return f"{value}{suffix}"

    def _dignity_summary(self, planet: PlanetPosition) -> str:
        dignity = self._planet_dignity(planet)
        if dignity == "exalted":
            return f"{planet.name} is exalted, so its results tend to express strongly and with clean timing."
        if dignity == "own_sign":
            return f"{planet.name} is in its own sign, which gives this area steadiness and better internal coherence."
        if dignity == "debilitated":
            return f"{planet.name} is debilitated, so this area develops through correction, maturity, and repeated refinement."
        return f"{planet.name} is neutral by dignity here, so outcomes depend more on discipline and surrounding support."

    @staticmethod
    def _planet_list_sentence(planet_names: list[str]) -> str:
        if not planet_names:
            return "There are no direct planetary occupants, so the house lord carries most of the story."
        return (
            f"This house is further activated by {', '.join(planet_names)}, which bring their themes directly into view."
        )

    def _build_domain_strengths(
        self,
        primary_house: HousePlacement,
        secondary_house: HousePlacement,
        primary_lord: PlanetPosition,
        anchor_planet: PlanetPosition,
    ) -> list[str]:
        strengths = [
            (
                f"{primary_house.sign} on the {self._ordinal(primary_house.house_number)} house gives this area a "
                f"{SIGN_STYLE_PHRASES[primary_house.sign]} tone."
            ),
            (
                f"{primary_lord.name} rules the area and operates from house {primary_lord.house}, tying outcomes to "
                f"{HOUSE_THEMES[primary_lord.house]}."
            ),
        ]
        if primary_house.planets:
            strengths.append(
                f"Planetary activation in the primary house ({', '.join(primary_house.planets)}) makes this domain easier to notice and work with consciously."
            )
        else:
            strengths.append(
                f"The secondary support house in {secondary_house.sign} helps reinforce this topic through {HOUSE_THEMES[secondary_house.house_number]}."
            )

        strengths.append(self._dignity_summary(anchor_planet))
        return strengths[:3]

    def _build_domain_watchouts(
        self,
        primary_house: HousePlacement,
        primary_lord: PlanetPosition,
        anchor_planet: PlanetPosition,
    ) -> list[str]:
        watchouts: list[str] = []
        if primary_lord.house in {6, 8, 12}:
            watchouts.append(
                f"The lord of this area sits in house {primary_lord.house}, so delays, hidden work, or emotionally expensive lessons may come before results stabilize."
            )
        if self._planet_dignity(primary_lord) == "debilitated":
            watchouts.append(
                f"{primary_lord.name} is debilitated, so confidence in this area may lag behind potential unless routines and mentorship are strong."
            )
        if self._planet_dignity(anchor_planet) == "debilitated":
            watchouts.append(
                f"{anchor_planet.name} is strained by dignity, which can create mixed signals between instinct and timing."
            )
        if not primary_house.planets:
            watchouts.append(
                "Because the primary house is unoccupied, results depend more on long-term consistency than on dramatic turning points."
            )
        return watchouts[:2]

    def _domain_guidance(
        self,
        dominant_element: str,
        primary_house: HousePlacement,
        primary_lord: PlanetPosition,
        label: str,
    ) -> str:
        return (
            f"For {label.lower()}, lean into your {dominant_element.lower()} dominance: "
            f"{ELEMENT_GUIDANCE[dominant_element]} The clearest gains come when you deliberately strengthen "
            f"{primary_lord.name}-style habits and keep returning to {HOUSE_THEMES[primary_house.house_number]} as a long-term practice."
        )

    def _domain_timing_triggers(
        self,
        config: dict,
        primary_house: HousePlacement,
        primary_lord: PlanetPosition,
        anchor_planet: PlanetPosition,
    ) -> list[str]:
        triggers = [
            (
                f"{primary_lord.name} periods and major transits tend to move {config['label'].lower()} more quickly, "
                f"because that planet rules your {self._ordinal(primary_house.house_number)} house."
            ),
            (
                f"{anchor_planet.name} activations change the tone of this area through "
                f"{HOUSE_THEMES[anchor_planet.house]}, so timing often feels personal rather than abstract."
            ),
        ]
        if primary_house.planets:
            triggers.append(
                f"When {', '.join(primary_house.planets)} are activated by dasha or transit, this domain becomes louder and harder to ignore."
            )
        return triggers[:3]

    def _domain_supporting_patterns(
        self,
        primary_house: HousePlacement,
        secondary_house: HousePlacement,
        primary_lord: PlanetPosition,
        anchor_planet: PlanetPosition,
    ) -> list[str]:
        return [
            (
                f"The primary pattern runs through {primary_house.sign} on the {self._ordinal(primary_house.house_number)} house, "
                f"so the area tends to express in a {SIGN_STYLE_PHRASES[primary_house.sign]} way."
            ),
            (
                f"The secondary support comes from the {self._ordinal(secondary_house.house_number)} house in {secondary_house.sign}, "
                f"which adds {HOUSE_THEMES[secondary_house.house_number]} to the background story."
            ),
            (
                f"{anchor_planet.name} sits in house {anchor_planet.house}, so instinctive decisions here are filtered through "
                f"{HOUSE_THEMES[anchor_planet.house]}."
            ),
            self._dignity_summary(primary_lord),
        ][:4]

    def _domain_long_game(
        self,
        label: str,
        primary_house: HousePlacement,
        primary_lord: PlanetPosition,
        dominant_element: str,
    ) -> str:
        return (
            f"The long game in {label.lower()} is not speed but coherence. Because {primary_lord.name} carries the main load "
            f"from house {primary_lord.house}, results improve when your decisions keep returning to "
            f"{HOUSE_THEMES[primary_house.house_number]} and are paced according to your {dominant_element.lower()} temperament."
        )

    def _build_life_domain_insight(
        self,
        key: str,
        planets: list[PlanetPosition],
        houses: list[HousePlacement],
        dominant_element: str,
    ) -> LifeDomainInsight:
        config = LIFE_DOMAIN_CONFIG[key]
        primary_house = self._house_by_number(houses, config["primary_house"])
        secondary_house = self._house_by_number(houses, config["secondary_house"])
        primary_lord_name = SIGN_RULERS[primary_house.sign]
        primary_lord = self._planet_by_name(planets, primary_lord_name)
        anchor_planet = self._planet_by_name(planets, config["anchor_planet"])

        confidence = 0.72
        if primary_house.planets:
            confidence += 0.05
        if self._planet_dignity(primary_lord) in {"exalted", "own_sign"}:
            confidence += 0.06
        if self._planet_dignity(anchor_planet) in {"exalted", "own_sign"}:
            confidence += 0.04
        if self._planet_dignity(primary_lord) == "debilitated":
            confidence -= 0.03
        if self._planet_dignity(anchor_planet) == "debilitated":
            confidence -= 0.02
        confidence = max(0.66, min(0.91, round(confidence, 2)))

        headline = (
            f"{config['label']} runs through {primary_house.sign} {self._ordinal(primary_house.house_number)}-house themes, "
            f"with {primary_lord.name} steering results from house {primary_lord.house}."
        )
        overview = (
            f"This domain is primarily read through your {self._ordinal(primary_house.house_number)} house in {primary_house.sign}, "
            f"so {config['summary_focus']} tend to unfold in a {SIGN_STYLE_PHRASES[primary_house.sign]} way. "
            f"{primary_lord.name} rules that house and sits in the {self._ordinal(primary_lord.house)} house in {primary_lord.sign}, "
            f"which ties outcomes to {HOUSE_THEMES[primary_lord.house]}. "
            f"The secondary support comes from your {self._ordinal(secondary_house.house_number)} house in {secondary_house.sign}, "
            f"adding a {SIGN_STYLE_PHRASES[secondary_house.sign]} background pattern. "
            f"{self._planet_list_sentence(primary_house.planets)} {self._dignity_summary(primary_lord)}"
        )

        return LifeDomainInsight(
            key=key,
            label=config["label"],
            headline=headline,
            overview=overview,
            strengths=self._build_domain_strengths(
                primary_house,
                secondary_house,
                primary_lord,
                anchor_planet,
            ),
            watchouts=self._build_domain_watchouts(
                primary_house,
                primary_lord,
                anchor_planet,
            ),
            timing_triggers=self._domain_timing_triggers(
                config,
                primary_house,
                primary_lord,
                anchor_planet,
            ),
            supporting_patterns=self._domain_supporting_patterns(
                primary_house,
                secondary_house,
                primary_lord,
                anchor_planet,
            ),
            guidance=self._domain_guidance(
                dominant_element,
                primary_house,
                primary_lord,
                config["label"],
            ),
            long_game=self._domain_long_game(
                config["label"],
                primary_house,
                primary_lord,
                dominant_element,
            ),
            confidence_score=confidence,
        )

    def _career_rules(
        self, planets: list[PlanetPosition], houses: list[HousePlacement]
    ) -> list[DeterministicRule]:
        rules: list[DeterministicRule] = []

        house_10 = next(house for house in houses if house.house_number == 10)
        tenth_lord_name = SIGN_RULERS[house_10.sign]
        tenth_lord = self._planet_by_name(planets, tenth_lord_name)

        tension_note = ""
        if tenth_lord.house in {6, 8, 12}:
            tension_note = (
                "The 10th-lord placement suggests career growth comes through delays, service pressure, "
                "or behind-the-scenes restructuring before authority stabilizes."
            )

        rules.append(
            DeterministicRule(
                title=f"Career Axis: 10th House in {house_10.sign}",
                insight=CAREER_INSIGHTS[house_10.sign],
                basis=(
                    f"10th house sign: {house_10.sign}. "
                    f"Lord {tenth_lord_name} placed in house {tenth_lord.house} in {tenth_lord.sign}."
                ),
                priority="high",
                category="career",
                confidence_score=0.82,
                tension_note=tension_note,
            )
        )

        if house_10.planets:
            rules.append(
                DeterministicRule(
                    title="Career Activators in House 10",
                    insight=(
                        f"{', '.join(house_10.planets)} directly energize your professional identity, "
                        "bringing their qualities into public standing and career ambition."
                    ),
                    basis=f"Planets in 10th house ({house_10.sign}): {', '.join(house_10.planets)}.",
                    priority="medium",
                    category="career",
                    confidence_score=0.75,
                )
            )

        return rules

    def _love_rules(
        self, planets: list[PlanetPosition], houses: list[HousePlacement]
    ) -> list[DeterministicRule]:
        rules: list[DeterministicRule] = []

        house_7 = next(house for house in houses if house.house_number == 7)
        house_5 = next(house for house in houses if house.house_number == 5)
        seventh_lord_name = SIGN_RULERS[house_7.sign]
        seventh_lord = self._planet_by_name(planets, seventh_lord_name)
        venus = self._planet_by_name(planets, "Venus")

        axis_tension = ""
        if seventh_lord.house in {6, 8, 12}:
            axis_tension = (
                "Partnership may demand more maturity than chemistry at first. The chart shows lessons "
                "around pacing, trust, or unequal effort before stability is reached."
            )

        venus_tension = ""
        if SIGN_ELEMENTS[venus.sign] != SIGN_ELEMENTS[house_7.sign]:
            venus_tension = (
                f"Venus expresses love through {SIGN_ELEMENTS[venus.sign].lower()} qualities, while the 7th house "
                f"asks for {SIGN_ELEMENTS[house_7.sign].lower()} partnership habits. Desire and commitment style "
                "may need deliberate alignment."
            )

        rules.append(
            DeterministicRule(
                title=f"Partnership Axis: 7th House in {house_7.sign}",
                insight=LOVE_INSIGHTS[house_7.sign],
                basis=(
                    f"7th house sign: {house_7.sign}. "
                    f"Lord {seventh_lord_name} in house {seventh_lord.house} ({seventh_lord.sign})."
                ),
                priority="high",
                category="love",
                confidence_score=0.81,
                tension_note=axis_tension,
            )
        )

        rules.append(
            DeterministicRule(
                title=f"Venus in {venus.sign} (House {venus.house})",
                insight=(
                    f"Venus governs love expression. In {venus.sign}, romance channels through "
                    f"{SIGN_ELEMENTS[venus.sign].lower()} qualities, shaping how you attract and give affection."
                ),
                basis=f"Venus at {venus.degree_in_sign:.2f} deg in {venus.sign}, house {venus.house}.",
                priority="medium",
                category="love",
                confidence_score=0.77,
                tension_note=venus_tension,
            )
        )

        if house_5.planets:
            rules.append(
                DeterministicRule(
                    title="Romance House Activators",
                    insight=(
                        f"{', '.join(house_5.planets)} in the 5th house bring creative and romantic energy, "
                        "enhancing self-expression and passionate connection."
                    ),
                    basis=f"5th house in {house_5.sign} with {', '.join(house_5.planets)}.",
                    priority="medium",
                    category="love",
                    confidence_score=0.72,
                )
            )

        return rules

    def _dignity_rules(self, planets: list[PlanetPosition]) -> list[DeterministicRule]:
        rules: list[DeterministicRule] = []

        for planet_name in ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"]:
            planet = self._planet_by_name(planets, planet_name)
            dignity = self._planet_dignity(planet)
            if dignity == "neutral":
                continue

            if dignity == "exalted":
                insight = (
                    f"{planet.name} is exalted in {planet.sign}, so this planet can express its strengths "
                    "cleanly and with unusually high capacity."
                )
                priority = "high"
                confidence = 0.86
                tension = ""
            elif dignity == "own_sign":
                insight = (
                    f"{planet.name} is in its own sign in {planet.sign}, which stabilizes how this planet "
                    "operates and makes its agenda easier to trust."
                )
                priority = "medium"
                confidence = 0.8
                tension = ""
            else:
                insight = (
                    f"{planet.name} is debilitated in {planet.sign}, which can make this planetary function "
                    "feel inconsistent until it is strengthened through conscious practice."
                )
                priority = "high"
                confidence = 0.79
                tension = (
                    "This placement is not a verdict, but it does mean this area of life improves when you use "
                    "structure, mentorship, and repetition instead of raw instinct."
                )

            category = "core"
            if planet.name in {"Mercury", "Jupiter", "Saturn"}:
                category = "career"
            elif planet.name in {"Venus", "Moon", "Mars"}:
                category = "love"

            rules.append(
                DeterministicRule(
                    title=f"{planet.name} Strength: {dignity.replace('_', ' ').title()}",
                    insight=insight,
                    basis=f"{planet.name} placed in {planet.sign}, house {planet.house}.",
                    priority=priority,
                    category=category,
                    confidence_score=confidence,
                    tension_note=tension,
                )
            )

        return rules

    def _yoga_rules(
        self, planets: list[PlanetPosition], houses: list[HousePlacement]
    ) -> list[DeterministicRule]:
        rules: list[DeterministicRule] = []
        sun = self._planet_by_name(planets, "Sun")
        moon = self._planet_by_name(planets, "Moon")
        mercury = self._planet_by_name(planets, "Mercury")
        mars = self._planet_by_name(planets, "Mars")
        jupiter = self._planet_by_name(planets, "Jupiter")

        if sun.house == mercury.house:
            rules.append(
                DeterministicRule(
                    title="Budha-Aditya Pattern",
                    insight=(
                        "Sun and Mercury occupy the same house, which often sharpens intellect, message control, "
                        "and the ability to turn ideas into influence."
                    ),
                    basis=f"Sun and Mercury are both in house {sun.house}.",
                    priority="medium",
                    category="career",
                    confidence_score=0.78,
                )
            )

        moon_to_jupiter = self._sign_distance(moon.sign, jupiter.sign)
        if moon_to_jupiter in {1, 4, 7, 10}:
            rules.append(
                DeterministicRule(
                    title="Gaja-Kesari Support",
                    insight=(
                        "Jupiter holds a kendra relationship from the Moon, which usually supports resilience, "
                        "social grace, and the ability to recover perspective after emotional turbulence."
                    ),
                    basis=f"Moon in {moon.sign}; Jupiter in {jupiter.sign} ({moon_to_jupiter} houses from Moon).",
                    priority="medium",
                    category="core",
                    confidence_score=0.76,
                )
            )

        if moon.house == mars.house:
            rules.append(
                DeterministicRule(
                    title="Chandra-Mangala Drive",
                    insight=(
                        "Moon and Mars share the same house, creating strong emotional activation, financial hunger, "
                        "and quick response energy. This can be productive when directed well."
                    ),
                    basis=f"Moon and Mars are both in house {moon.house}.",
                    priority="medium",
                    category="career",
                    confidence_score=0.73,
                    tension_note=(
                        "The same pattern can also increase impatience or emotional overreaction if pressure has no "
                        "healthy outlet."
                    ),
                )
            )

        house_9 = next(house for house in houses if house.house_number == 9)
        if house_9.planets:
            rules.append(
                DeterministicRule(
                    title="Fortune House Activation",
                    insight=(
                        "The 9th house is active, which often magnifies teachers, belief systems, long-range luck, "
                        "and the role of guidance in the life path."
                    ),
                    basis=f"9th house in {house_9.sign} with {', '.join(house_9.planets)}.",
                    priority="low",
                    category="core",
                    confidence_score=0.68,
                )
            )

        return rules

    def _core_path_rules(
        self,
        ascendant_sign: str,
        planets: list[PlanetPosition],
        houses: list[HousePlacement],
    ) -> list[DeterministicRule]:
        rules: list[DeterministicRule] = []
        lagna_lord_name = SIGN_RULERS[ascendant_sign]
        lagna_lord = self._planet_by_name(planets, lagna_lord_name)
        moon = self._planet_by_name(planets, "Moon")
        rahu = self._planet_by_name(planets, "Rahu")
        ketu = self._planet_by_name(planets, "Ketu")

        lagna_tension = ""
        if lagna_lord.house in {6, 8, 12}:
            lagna_tension = (
                "The ascendant lord works through a dusthana house, so your path grows through pressure, hidden effort, "
                "or repeated reinvention rather than immediate ease."
            )

        rules.append(
            DeterministicRule(
                title=f"Ascendant Lord: {lagna_lord.name} in House {lagna_lord.house}",
                insight=(
                    f"The ruler of your lagna is {lagna_lord.name}, and its placement ties life direction to "
                    f"{HOUSE_THEMES[lagna_lord.house]}. This is one of the clearest signatures for how your chart actually moves."
                ),
                basis=(
                    f"{lagna_lord.name} rules {ascendant_sign} and is placed in {lagna_lord.sign}, house {lagna_lord.house}."
                ),
                priority="high",
                category="core",
                confidence_score=0.86,
                tension_note=lagna_tension,
            )
        )

        rules.append(
            DeterministicRule(
                title=f"Emotional Focus: Moon in House {moon.house}",
                insight=(
                    f"Your emotional attention repeatedly returns to {HOUSE_THEMES[moon.house]}, which tells us where "
                    "you instinctively seek reassurance, rhythm, and belonging."
                ),
                basis=f"Moon placed in {moon.sign}, house {moon.house}.",
                priority="medium",
                category="core",
                confidence_score=0.77,
            )
        )

        rules.append(
            DeterministicRule(
                title=f"Nodal Axis: Rahu {rahu.house} / Ketu {ketu.house}",
                insight=(
                    f"Rahu pulls growth toward {HOUSE_THEMES[rahu.house]}, while Ketu asks for detachment and maturity around "
                    f"{HOUSE_THEMES[ketu.house]}. This axis often describes the chart's deeper hunger-and-release pattern."
                ),
                basis=(
                    f"Rahu in {rahu.sign}, house {rahu.house}; Ketu in {ketu.sign}, house {ketu.house}."
                ),
                priority="medium",
                category="core",
                confidence_score=0.74,
                tension_note=(
                    "When Rahu is loud, urgency can outrun clarity. When Ketu is loud, detachment can look like drift. "
                    "The work is to keep both ends of the axis conscious."
                ),
            )
        )

        kendra_planets = [
            planet.name for planet in planets if planet.house in {1, 4, 7, 10}
        ]
        if len(kendra_planets) >= 3:
            rules.append(
                DeterministicRule(
                    title="Angular House Emphasis",
                    insight=(
                        f"{', '.join(kendra_planets)} occupy angular houses, which makes the chart more visible, eventful, "
                        "and responsive to decisive action in the outer world."
                    ),
                    basis=f"Planets in kendras: {', '.join(kendra_planets)}.",
                    priority="medium",
                    category="core",
                    confidence_score=0.73,
                )
            )

        return rules

    def generate(
        self,
        ascendant_sign: str,
        planets: list[PlanetPosition],
        houses: list[HousePlacement],
    ) -> tuple[list[DeterministicRule], str]:
        rules: list[DeterministicRule] = []

        sun = self._planet_by_name(planets, "Sun")
        moon = self._planet_by_name(planets, "Moon")
        venus = self._planet_by_name(planets, "Venus")

        sun_moon_tension = ""
        if SIGN_ELEMENTS[sun.sign] != SIGN_ELEMENTS[moon.sign]:
            sun_moon_tension = (
                f"Your core drive runs through {SIGN_ELEMENTS[sun.sign].lower()} energy while your emotional body "
                f"leans {SIGN_ELEMENTS[moon.sign].lower()}. Motivation and emotional pacing may not always want the same thing."
            )

        rules.append(
            DeterministicRule(
                title=f"Lagna Signature: {ascendant_sign}",
                insight=ASCENDANT_INSIGHTS[ascendant_sign],
                basis=f"Ascendant computed in {ascendant_sign}.",
                priority="high",
                category="core",
                confidence_score=0.89,
            )
        )
        rules.append(
            DeterministicRule(
                title=f"Solar Identity in {sun.sign}",
                insight=SUN_SIGN_INSIGHTS[sun.sign],
                basis=f"Sun sign placement: {sun.sign} ({sun.degree_in_sign:.2f} deg).",
                priority="high",
                category="core",
                confidence_score=0.84,
                tension_note=sun_moon_tension,
            )
        )
        rules.append(
            DeterministicRule(
                title=f"Lunar Mindset in {moon.sign}",
                insight=MOON_SIGN_INSIGHTS[moon.sign],
                basis=f"Moon sign placement: {moon.sign} ({moon.degree_in_sign:.2f} deg).",
                priority="high",
                category="core",
                confidence_score=0.85,
                tension_note=sun_moon_tension,
            )
        )

        classical_planets = [
            planet
            for planet in planets
            if planet.name in {"Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"}
        ]
        element_counter = Counter(SIGN_ELEMENTS[planet.sign] for planet in classical_planets)
        dominant_element, dominant_count = element_counter.most_common(1)[0]
        element_tension = ""
        if SIGN_ELEMENTS[venus.sign] != dominant_element:
            element_tension = (
                f"Your dominant element is {dominant_element.lower()}, but Venus expresses through "
                f"{SIGN_ELEMENTS[venus.sign].lower()} dynamics. Attraction and default momentum may pull in different directions."
            )

        rules.append(
            DeterministicRule(
                title=f"Dominant Element: {dominant_element}",
                insight=(
                    f"{dominant_count} of 7 classical planets are in {dominant_element} signs, "
                    "which shapes your default decision style and energetic baseline."
                ),
                basis=f"Element distribution: {dict(element_counter)}.",
                priority="medium",
                category="core",
                confidence_score=0.78,
                tension_note=element_tension,
            )
        )

        dense_house = max(houses, key=lambda house: len(house.planets))
        if dense_house.planets:
            rules.append(
                DeterministicRule(
                    title=f"Focused House: {dense_house.house_number}",
                    insight=(
                        f"Multiple planetary activations highlight house {dense_house.house_number}: "
                        f"{HOUSE_THEMES[dense_house.house_number]}."
                    ),
                    basis=(
                        f"House {dense_house.house_number} in {dense_house.sign} carries "
                        f"{', '.join(dense_house.planets)}."
                    ),
                    priority="medium",
                    category="core",
                    confidence_score=0.74,
                )
            )

        rules.extend(self._core_path_rules(ascendant_sign, planets, houses))
        rules.extend(self._dignity_rules(planets))
        rules.extend(self._career_rules(planets, houses))
        rules.extend(self._love_rules(planets, houses))
        rules.extend(self._yoga_rules(planets, houses))

        strongest_planets = [
            planet.name
            for planet in classical_planets
            if self._planet_dignity(planet) in {"exalted", "own_sign"}
        ]
        strength_line = (
            f" Strongest support comes from {', '.join(strongest_planets[:2])}."
            if strongest_planets
            else ""
        )

        summary = (
            f"Chart core: {ascendant_sign} Lagna with Sun in {sun.sign} and Moon in {moon.sign}. "
            f"Dominant elemental tone is {dominant_element}.{strength_line}"
        )
        return rules, summary

    def generate_life_domain_insights(
        self,
        ascendant_sign: str,
        planets: list[PlanetPosition],
        houses: list[HousePlacement],
    ) -> list[LifeDomainInsight]:
        del ascendant_sign  # Reserved for future refinement; current logic reads directly from houses and planets.

        classical_planets = [
            planet
            for planet in planets
            if planet.name in {"Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"}
        ]
        element_counter = Counter(SIGN_ELEMENTS[planet.sign] for planet in classical_planets)
        dominant_element = element_counter.most_common(1)[0][0]

        return [
            self._build_life_domain_insight(
                key,
                planets,
                houses,
                dominant_element,
            )
            for key in LIFE_DOMAIN_CONFIG
        ]
