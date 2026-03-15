"""Navamsa (D9) divisional chart calculation engine for Vedic astrology."""

from dataclasses import dataclass

from app.models.chart_models import PlanetPosition

# ── Constants ────────────────────────────────────────────────

SIGNS: list[str] = [
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

# Starting Navamsa sign index for each rashi, grouped by element.
# Fire signs  → start from Aries     (index 0)
# Earth signs → start from Capricorn (index 9)
# Air signs   → start from Libra     (index 6)
# Water signs → start from Cancer    (index 3)

NAVAMSA_START: dict[str, int] = {
    # Fire
    "Aries": 0,
    "Leo": 0,
    "Sagittarius": 0,
    # Earth
    "Taurus": 9,
    "Virgo": 9,
    "Capricorn": 9,
    # Air
    "Gemini": 6,
    "Libra": 6,
    "Aquarius": 6,
    # Water
    "Cancer": 3,
    "Scorpio": 3,
    "Pisces": 3,
}

# Each sign spans 30°; divided into 9 Navamsa padas → 3°20' each.
NAVAMSA_SPAN: float = 3.333333333  # 30 / 9


@dataclass
class NavamsaPosition:
    """Navamsa position for a single planet."""

    name: str
    rashi_sign: str
    navamsa_sign: str
    navamsa_division: int


class NavamsaEngine:
    """Calculate Navamsa (D9) divisional chart positions."""

    @classmethod
    def calculate_navamsa(
        cls,
        planets: list[PlanetPosition],
    ) -> list[NavamsaPosition]:
        """Compute the Navamsa sign for every planet.

        Parameters
        ----------
        planets:
            List of planet positions from the rashi (D1) chart.

        Returns
        -------
        list[NavamsaPosition]
            One entry per planet with its Navamsa sign and division (0-8).
        """
        results: list[NavamsaPosition] = []

        for planet in planets:
            # Which of the 9 divisions (0-8) does the planet fall in?
            division = int(planet.degree_in_sign / NAVAMSA_SPAN)
            division = max(0, min(division, 8))  # clamp to 0-8

            start_index = NAVAMSA_START.get(planet.sign, 0)
            navamsa_sign_index = (start_index + division) % 12
            navamsa_sign = SIGNS[navamsa_sign_index]

            results.append(
                NavamsaPosition(
                    name=planet.name,
                    rashi_sign=planet.sign,
                    navamsa_sign=navamsa_sign,
                    navamsa_division=division,
                )
            )

        return results
