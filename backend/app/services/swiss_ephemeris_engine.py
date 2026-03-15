from dataclasses import dataclass
from datetime import datetime

try:
    import swisseph as swe
except ImportError:  # pragma: no cover - dependency presence is environment specific
    swe = None

from app.config import Settings
from app.models.chart_models import AscendantData, BirthDetails, HousePlacement, PlanetPosition
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


@dataclass
class SwissEngineResult:
    julian_day_ut: float
    ascendant: AscendantData
    planets: list[PlanetPosition]
    houses: list[HousePlacement]
    fallback_mode: bool


class SwissEphemerisEngine:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._engine_available = swe is not None
        if not self._engine_available:
            return
        swe.set_ephe_path(settings.ephemeris_path)

    def _set_sidereal_mode(self, preset: EnginePreset) -> None:
        self._assert_engine_available()
        sidereal_mode = getattr(swe, preset.sidereal_mode_name, swe.SIDM_LAHIRI)
        swe.set_sid_mode(sidereal_mode, 0, 0)

    def _assert_engine_available(self) -> None:
        if not self._engine_available:
            raise RuntimeError(
                "Swiss Ephemeris dependency is unavailable. Install backend requirements "
                "and ensure pyswisseph builds correctly on this machine."
            )

    @staticmethod
    def _normalize(angle: float) -> float:
        return angle % 360.0

    def _get_sign(self, longitude: float) -> tuple[str, float, int]:
        norm_longitude = self._normalize(longitude)
        sign_index = int(norm_longitude // 30)
        return SIGNS[sign_index], norm_longitude % 30, sign_index

    @staticmethod
    def _datetime_to_julian(utc_datetime: datetime) -> float:
        decimal_hour = (
            utc_datetime.hour
            + (utc_datetime.minute / 60.0)
            + (utc_datetime.second / 3600.0)
        )
        return swe.julday(
            utc_datetime.year, utc_datetime.month, utc_datetime.day, decimal_hour
        )

    def _compute_planets(
        self, jd_ut: float, sidereal_flags: int
    ) -> list[tuple[str, float]]:
        placements: list[tuple[str, float]] = []
        for planet_name, planet_code in PLANET_CODES.items():
            values, _ = swe.calc_ut(jd_ut, planet_code, sidereal_flags)
            placements.append((planet_name, self._normalize(values[0])))

        rahu_longitude = next(longitude for name, longitude in placements if name == "Rahu")
        ketu_longitude = self._normalize(rahu_longitude + 180.0)
        placements.append(("Ketu", ketu_longitude))
        return placements

    def _compute_ascendant(
        self,
        jd_ut: float,
        birth: BirthDetails,
        sidereal_flags: int,
    ) -> float:
        _, ascmc = swe.houses_ex(
            jd_ut, birth.latitude, birth.longitude, b"P", sidereal_flags
        )
        return self._normalize(ascmc[0])

    def calculate(self, birth: BirthDetails, preset: EnginePreset) -> SwissEngineResult:
        self._assert_engine_available()
        self._set_sidereal_mode(preset)
        utc_datetime = birth.utc_datetime
        jd_ut = self._datetime_to_julian(utc_datetime)
        sidereal_flags = swe.FLG_SWIEPH | swe.FLG_SIDEREAL
        fallback_mode = False

        try:
            asc_longitude = self._compute_ascendant(jd_ut, birth, sidereal_flags)
            placements = self._compute_planets(jd_ut, sidereal_flags)
        except swe.Error:
            fallback_mode = True
            sidereal_flags = swe.FLG_MOSEPH | swe.FLG_SIDEREAL
            self._set_sidereal_mode(preset)
            asc_longitude = self._compute_ascendant(jd_ut, birth, sidereal_flags)
            placements = self._compute_planets(jd_ut, sidereal_flags)

        asc_sign, asc_degree, asc_sign_index = self._get_sign(asc_longitude)
        ascendant = AscendantData(
            longitude=round(asc_longitude, 4),
            sign=asc_sign,
            degree_in_sign=round(asc_degree, 4),
        )

        planets: list[PlanetPosition] = []
        for planet_name, longitude in placements:
            sign, degree_in_sign, sign_index = self._get_sign(longitude)
            house_number = ((sign_index - asc_sign_index) % 12) + 1
            planets.append(
                PlanetPosition(
                    name=planet_name,
                    longitude=round(longitude, 4),
                    sign=sign,
                    degree_in_sign=round(degree_in_sign, 4),
                    house=house_number,
                )
            )

        houses: list[HousePlacement] = []
        for house_number in range(1, 13):
            house_sign = SIGNS[(asc_sign_index + house_number - 1) % 12]
            house_planets = [planet.name for planet in planets if planet.house == house_number]
            houses.append(
                HousePlacement(
                    house_number=house_number,
                    sign=house_sign,
                    planets=house_planets,
                )
            )

        return SwissEngineResult(
            julian_day_ut=round(jd_ut, 6),
            ascendant=ascendant,
            planets=planets,
            houses=houses,
            fallback_mode=fallback_mode,
        )
