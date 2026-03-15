from dataclasses import dataclass
from datetime import datetime, timezone

try:
    import swisseph as swe
except ImportError:  # pragma: no cover - dependency presence is environment specific
    swe = None

from app.config import Settings
from app.models.chart_models import PlanetPosition
from app.services.engine_registry import EnginePreset

SIGNS = [
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

PLANET_CODES = (
    {
        "Sun": swe.SUN,
        "Moon": swe.MOON,
        "Mercury": swe.MERCURY,
        "Venus": swe.VENUS,
        "Mars": swe.MARS,
        "Jupiter": swe.JUPITER,
        "Saturn": swe.SATURN,
        "Rahu": swe.MEAN_NODE,
    }
    if swe is not None
    else {}
)

ASPECT_ANGLES: dict[str, float] = {
    "Conjunction": 0,
    "Opposition": 180,
    "Trine": 120,
    "Square": 90,
    "Sextile": 60,
}


@dataclass
class TransitPosition:
    name: str
    longitude: float
    sign: str
    degree_in_sign: float


@dataclass
class TransitAspect:
    transit_planet: str
    natal_planet: str
    aspect_type: str
    orb: float


class TransitEngine:
    """Calculates current planetary positions and compares them against a natal chart."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._engine_available = swe is not None
        if not self._engine_available:
            return
        swe.set_ephe_path(settings.ephemeris_path)

    def _set_sidereal_mode(self, preset: EnginePreset) -> None:
        if not self._engine_available:
            return
        sidereal_mode = getattr(swe, preset.sidereal_mode_name, swe.SIDM_LAHIRI)
        swe.set_sid_mode(sidereal_mode, 0, 0)

    @staticmethod
    def _normalize(angle: float) -> float:
        return angle % 360.0

    def _get_sign(self, longitude: float) -> tuple[str, float]:
        norm_longitude = self._normalize(longitude)
        sign_index = int(norm_longitude // 30)
        return SIGNS[sign_index], norm_longitude % 30

    def compute_positions(
        self,
        reference_moment: datetime,
        preset: EnginePreset,
    ) -> list[TransitPosition]:
        """Compute sidereal planetary positions for a specific UTC moment."""
        if not self._engine_available:
            return []

        if reference_moment.tzinfo is None:
            now_utc = reference_moment.replace(tzinfo=timezone.utc)
        else:
            now_utc = reference_moment.astimezone(timezone.utc)

        self._set_sidereal_mode(preset)
        decimal_hour = (
            now_utc.hour + (now_utc.minute / 60.0) + (now_utc.second / 3600.0)
        )
        jd_ut = swe.julday(now_utc.year, now_utc.month, now_utc.day, decimal_hour)
        sidereal_flags = swe.FLG_SWIEPH | swe.FLG_SIDEREAL

        positions: list[TransitPosition] = []
        rahu_longitude: float = 0.0

        for planet_name, planet_code in PLANET_CODES.items():
            values, _ = swe.calc_ut(jd_ut, planet_code, sidereal_flags)
            longitude = self._normalize(values[0])
            sign, degree_in_sign = self._get_sign(longitude)
            positions.append(
                TransitPosition(
                    name=planet_name,
                    longitude=round(longitude, 4),
                    sign=sign,
                    degree_in_sign=round(degree_in_sign, 4),
                )
            )
            if planet_name == "Rahu":
                rahu_longitude = longitude

        # Ketu is always 180 degrees opposite Rahu
        ketu_longitude = self._normalize(rahu_longitude + 180.0)
        ketu_sign, ketu_degree = self._get_sign(ketu_longitude)
        positions.append(
            TransitPosition(
                name="Ketu",
                longitude=round(ketu_longitude, 4),
                sign=ketu_sign,
                degree_in_sign=round(ketu_degree, 4),
            )
        )

        return positions

    def compute_current_positions(self, preset: EnginePreset) -> list[TransitPosition]:
        return self.compute_positions(datetime.now(timezone.utc), preset)

    def compute_transit_aspects(
        self,
        natal_planets: list[PlanetPosition],
        transit_positions: list[TransitPosition],
    ) -> list[TransitAspect]:
        """Compare transit positions against natal chart positions and find active aspects."""
        if not self._engine_available:
            return []

        orb_limit = 8.0
        aspects: list[TransitAspect] = []

        for transit in transit_positions:
            for natal in natal_planets:
                raw_diff = abs(transit.longitude - natal.longitude)
                angular_distance = min(raw_diff, 360.0 - raw_diff)

                for aspect_type, target_angle in ASPECT_ANGLES.items():
                    orb = abs(angular_distance - target_angle)
                    if orb <= orb_limit:
                        aspects.append(
                            TransitAspect(
                                transit_planet=transit.name,
                                natal_planet=natal.name,
                                aspect_type=aspect_type,
                                orb=round(orb, 4),
                            )
                        )

        # Sort by tightest orb (smallest first)
        aspects.sort(key=lambda a: a.orb)
        return aspects
