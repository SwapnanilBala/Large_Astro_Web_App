from datetime import datetime, timezone

from app.models.chart_models import (
    BirthDetails,
    ClientProfile,
    CompatibilityResponse,
    CompatibilityTheme,
    SynastryAspectInfo,
)
from app.services.chart_service import ChartService

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

ASPECT_DEFS = {
    "Conjunction": (0.0, 8.0),
    "Opposition": (180.0, 8.0),
    "Trine": (120.0, 8.0),
    "Square": (90.0, 7.0),
    "Sextile": (60.0, 6.0),
}

HARMONIOUS = {"Conjunction", "Trine", "Sextile"}
PRIORITY_PLANETS = {"Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"}


class CompatibilityService:
    def __init__(self) -> None:
        self._chart_service = ChartService()

    @staticmethod
    def _angle_between(lon1: float, lon2: float) -> float:
        diff = abs(lon1 - lon2) % 360.0
        return diff if diff <= 180.0 else 360.0 - diff

    def _build_synastry_aspects(self, primary_planets, partner_planets) -> list[SynastryAspectInfo]:
        aspects: list[SynastryAspectInfo] = []
        for primary in primary_planets:
            if primary.name not in PRIORITY_PLANETS:
                continue
            for partner in partner_planets:
                if partner.name not in PRIORITY_PLANETS:
                    continue
                angle = self._angle_between(primary.longitude, partner.longitude)
                for aspect_type, (target, max_orb) in ASPECT_DEFS.items():
                    orb = abs(angle - target)
                    if orb <= max_orb:
                        aspects.append(
                            SynastryAspectInfo(
                                primary_planet=primary.name,
                                partner_planet=partner.name,
                                aspect_type=aspect_type,
                                orb=round(orb, 4),
                                harmonious=aspect_type in HARMONIOUS,
                            )
                        )
                        break
        aspects.sort(key=lambda item: item.orb)
        return aspects[:18]

    @staticmethod
    def _client_profile_from_birth(birth: BirthDetails) -> ClientProfile:
        return ClientProfile(
            name=birth.name,
            country=birth.country,
            state=birth.state,
            city=birth.city,
            town=birth.town,
            latitude=birth.latitude,
            longitude=birth.longitude,
            timezone_offset_minutes=birth.timezone_offset_minutes,
            time_zone_id=birth.time_zone_id,
        )

    def build_compatibility(self, primary: BirthDetails, partner: BirthDetails) -> CompatibilityResponse:
        primary_chart = self._chart_service.build_chart(
            primary,
            include_transits=False,
            include_premium=False,
            persist_result=False,
            subscription_tier="premium",
        )
        partner_chart = self._chart_service.build_chart(
            partner,
            include_transits=False,
            include_premium=False,
            persist_result=False,
            subscription_tier="premium",
        )

        synastry_aspects = self._build_synastry_aspects(
            primary_chart.chart.planets,
            partner_chart.chart.planets,
        )

        primary_moon = next(planet for planet in primary_chart.chart.planets if planet.name == "Moon")
        partner_moon = next(planet for planet in partner_chart.chart.planets if planet.name == "Moon")
        primary_sun = next(planet for planet in primary_chart.chart.planets if planet.name == "Sun")
        partner_sun = next(planet for planet in partner_chart.chart.planets if planet.name == "Sun")
        primary_venus = next(planet for planet in primary_chart.chart.planets if planet.name == "Venus")
        partner_mars = next(planet for planet in partner_chart.chart.planets if planet.name == "Mars")
        primary_mercury = next(planet for planet in primary_chart.chart.planets if planet.name == "Mercury")
        partner_mercury = next(planet for planet in partner_chart.chart.planets if planet.name == "Mercury")

        harmonious_count = sum(1 for aspect in synastry_aspects if aspect.harmonious)
        tense_count = len(synastry_aspects) - harmonious_count

        score = 58.0
        if SIGN_ELEMENTS[primary_moon.sign] == SIGN_ELEMENTS[partner_moon.sign]:
            score += 12
        if SIGN_ELEMENTS[primary_sun.sign] == SIGN_ELEMENTS[partner_sun.sign]:
            score += 8

        venus_mars_link = next(
            (
                aspect
                for aspect in synastry_aspects
                if aspect.primary_planet == "Venus" and aspect.partner_planet == "Mars"
            ),
            None,
        )
        if venus_mars_link:
            score += 14 if venus_mars_link.harmonious else -8

        moon_links = [
            aspect for aspect in synastry_aspects
            if {aspect.primary_planet, aspect.partner_planet} & {"Moon", "Sun"}
        ]
        if any(aspect.harmonious for aspect in moon_links):
            score += 10

        mercury_link = next(
            (
                aspect
                for aspect in synastry_aspects
                if aspect.primary_planet == "Mercury" and aspect.partner_planet == "Mercury"
            ),
            None,
        )
        if mercury_link:
            score += 8 if mercury_link.harmonious else -5

        score += harmonious_count * 1.5
        score -= tense_count * 1.2
        score = max(20.0, min(98.0, round(score, 1)))

        themes = [
            CompatibilityTheme(
                title="Emotional Rhythm",
                insight=(
                    f"{primary.name}'s Moon in {primary_moon.sign} meets {partner.name}'s Moon in {partner_moon.sign}. "
                    f"Both charts lean into {SIGN_ELEMENTS[primary_moon.sign].lower()} and "
                    f"{SIGN_ELEMENTS[partner_moon.sign].lower()} emotional styles, which shapes how safety and closeness are built."
                ),
                confidence_score=0.86,
            ),
            CompatibilityTheme(
                title="Attraction Pattern",
                insight=(
                    f"{primary.name}'s Venus in {primary_venus.sign} and {partner.name}'s Mars in {partner_mars.sign} "
                    "show the chemistry between affection and desire. Harmonious contact increases natural pull; harder contact creates heat that needs maturity."
                ),
                confidence_score=0.82,
            ),
            CompatibilityTheme(
                title="Communication Style",
                insight=(
                    f"Mercury links between {primary.name} and {partner.name} indicate how quickly misunderstandings get resolved. "
                    f"With Mercury in {primary_mercury.sign} and {partner_mercury.sign}, clarity depends on whether both people process feelings through the same element."
                ),
                confidence_score=0.74,
            ),
        ]

        if tense_count > harmonious_count:
            themes.append(
                CompatibilityTheme(
                    title="Growth Edge",
                    insight="This pairing has real magnetism, but it also carries enough friction that conscious communication and pacing matter. The bond improves when both people build structure around conflict instead of relying on chemistry alone.",
                    confidence_score=0.77,
                )
            )
        else:
            themes.append(
                CompatibilityTheme(
                    title="Long-Term Potential",
                    insight="The synastry leans more supportive than difficult, which usually means this connection has enough ease to grow. Shared rituals, emotional honesty, and clear commitments can turn attraction into durability.",
                    confidence_score=0.79,
                )
            )

        summary = (
            f"{primary.name} and {partner.name} show a compatibility score of {score:.1f}/100. "
            f"The connection is shaped by {harmonious_count} supportive synastry contacts and {tense_count} high-friction contacts."
        )

        return CompatibilityResponse(
            generated_at_utc=datetime.now(timezone.utc),
            primary_client=self._client_profile_from_birth(primary),
            partner_client=self._client_profile_from_birth(partner),
            compatibility_score=score,
            summary=summary,
            themes=themes,
            synastry_aspects=synastry_aspects,
        )
