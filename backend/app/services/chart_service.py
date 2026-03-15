from datetime import date, datetime, time, timedelta, timezone
from functools import lru_cache

from app.config import get_settings
from app.db.session import get_mongo_database
from app.infrastructure.database_gateway import DatabaseGateway
from app.models.chart_models import (
    AccessMetadata,
    AspectInfo,
    AstroChartData,
    BirthDetails,
    CalculationAuditInfo,
    ChartResponse,
    ClientProfile,
    DashaInfo,
    DashaPeriodInfo,
    EngineMetadata,
    ForecastAspectInsight,
    ForecastReading,
    NakshatraInfo,
    NavamsaPositionInfo,
    TransitAspectInfo,
    TransitData,
    TransitPositionInfo,
)
from app.services.aspect_engine import AspectEngine
from app.services.engine_registry import EnginePreset, get_engine_preset, list_engine_presets
from app.services.nakshatra_engine import DASHA_YEARS, NAKSHATRA_SPAN, YEAR_DAYS, NakshatraEngine
from app.services.navamsa_engine import NavamsaEngine
from app.services.rule_engine import DeterministicRuleEngine, HOUSE_THEMES
from app.services.swiss_ephemeris_engine import SwissEphemerisEngine
from app.services.transit_engine import TransitEngine

PREMIUM_FEATURES = [
    "nakshatra_dasha",
    "planetary_aspects",
    "navamsa_d9",
    "live_transits",
]
ULTIMATE_FEATURES = [
    "life_domain_readings",
]

PLANET_THEMES = {
    "Sun": "identity, confidence, leadership, and visibility",
    "Moon": "emotions, home life, and inner steadiness",
    "Mars": "drive, conflict tolerance, and decisive action",
    "Mercury": "learning, negotiation, trade, and communication",
    "Jupiter": "growth, wisdom, guidance, and opportunity",
    "Venus": "relationships, pleasure, money flow, and aesthetics",
    "Saturn": "discipline, duty, structure, and long-range results",
    "Rahu": "ambition, disruption, foreign links, and unconventional openings",
    "Ketu": "release, spiritualization, detachment, and inner reset",
}

DASHA_FORECAST_THEMES = {
    "Sun": {
        "focus": "visibility, leadership, and self-definition",
        "opportunity": "Take ownership of decisions that need clarity, authority, and cleaner positioning.",
        "caution": "Do not let ego battles or overexertion drain momentum that should be invested in durable progress.",
    },
    "Moon": {
        "focus": "emotional life, family patterns, and responsiveness",
        "opportunity": "Strengthen home rhythms, emotional support, and work that depends on public trust or care.",
        "caution": "Mood-led decisions and overstretching for others can blur judgment if rest is inconsistent.",
    },
    "Mars": {
        "focus": "action, competition, initiative, and courage",
        "opportunity": "Push into tasks that reward bold execution, technical effort, and direct problem-solving.",
        "caution": "Watch impatience, reactive speech, conflict escalation, and physically draining overcommitment.",
    },
    "Mercury": {
        "focus": "strategy, communication, education, and commerce",
        "opportunity": "This is useful for writing, planning, study, trade, interviews, and clearer deal-making.",
        "caution": "Scattered focus, overanalysis, or saying yes too quickly can create avoidable noise.",
    },
    "Jupiter": {
        "focus": "growth, guidance, faith, and higher opportunity",
        "opportunity": "Lean into teaching, mentorship, planning, and long-horizon decisions that need wisdom.",
        "caution": "Optimism still needs structure; avoid assuming expansion is automatically sustainable.",
    },
    "Venus": {
        "focus": "relationships, comfort, resources, and artistry",
        "opportunity": "Favorable for alliances, attraction, aesthetics, and improving lifestyle quality with intention.",
        "caution": "Pleasure spending, passive avoidance, or idealizing people can weaken the practical signal.",
    },
    "Saturn": {
        "focus": "discipline, karma, responsibility, and endurance",
        "opportunity": "Work that needs consistency, maturity, and long-range restructuring can deepen substantially here.",
        "caution": "Delays are not always denials, but bitterness, exhaustion, and rigid thinking need active management.",
    },
    "Rahu": {
        "focus": "ambition, sudden openings, innovation, and appetite",
        "opportunity": "Foreign links, technology, reinvention, and unconventional pathways can produce sharp breakthroughs.",
        "caution": "Be extra careful with obsession, mixed signals, risky shortcuts, and people who oversell certainty.",
    },
    "Ketu": {
        "focus": "detachment, inner realignment, closure, and spiritual pruning",
        "opportunity": "Excellent for stepping back, refining intuition, and releasing patterns that no longer fit.",
        "caution": "Withdrawal, confusion, and loss of worldly motivation can appear if grounding routines are neglected.",
    },
}

ASPECT_TONES = {
    "Trine": "supportive",
    "Sextile": "supportive",
    "Square": "challenging",
    "Opposition": "challenging",
    "Conjunction": "mixed",
}


class ChartService:
    def __init__(self) -> None:
        self._settings = get_settings()
        self._engine = SwissEphemerisEngine(self._settings)
        self._rule_engine = DeterministicRuleEngine()
        self._gateway_factory = lambda: DatabaseGateway(get_mongo_database())
        self._nakshatra_engine = NakshatraEngine()
        self._aspect_engine = AspectEngine()
        self._navamsa_engine = NavamsaEngine()
        self._transit_engine = TransitEngine(self._settings)

    @staticmethod
    def _birth_local_moment(birth: BirthDetails) -> datetime:
        return datetime.combine(birth.birth_date, birth.birth_time)

    @staticmethod
    def _current_local_moment(birth: BirthDetails) -> datetime:
        return birth.utc_to_local(datetime.now(timezone.utc))

    @staticmethod
    def _target_local_noon(target_date: date) -> datetime:
        return datetime.combine(target_date, time(12, 0))

    @staticmethod
    def _local_to_utc(moment: datetime, birth: BirthDetails) -> datetime:
        return birth.local_to_utc(moment).replace(tzinfo=timezone.utc)

    @staticmethod
    def _iso_minute(moment: datetime) -> str:
        return moment.replace(second=0, microsecond=0).isoformat(timespec="minutes")

    @staticmethod
    def _aspect_tone(transit_planet: str, aspect_type: str) -> str:
        if aspect_type == "Conjunction":
            if transit_planet in {"Jupiter", "Venus"}:
                return "supportive"
            if transit_planet in {"Saturn", "Mars", "Rahu", "Ketu"}:
                return "challenging"
        return ASPECT_TONES.get(aspect_type, "mixed")

    @classmethod
    def _forecast_aspect_interpretation(
        cls,
        transit_planet: str,
        aspect_type: str,
        natal_planet: str,
    ) -> str:
        natal_theme = PLANET_THEMES.get(natal_planet, "that area of life")
        tone = cls._aspect_tone(transit_planet, aspect_type)
        if tone == "supportive":
            return (
                f"{transit_planet} {aspect_type.lower()} natal {natal_planet} supports "
                f"{natal_theme} with cleaner timing and less friction than usual."
            )
        if tone == "challenging":
            return (
                f"{transit_planet} {aspect_type.lower()} natal {natal_planet} puts pressure on "
                f"{natal_theme}, so pacing and judgment matter more than speed."
            )
        return (
            f"{transit_planet} {aspect_type.lower()} natal {natal_planet} strongly activates "
            f"{natal_theme}; the outcome depends on how deliberately you handle the surge."
        )

    @classmethod
    def _to_forecast_aspect(cls, aspect: TransitAspectInfo) -> ForecastAspectInsight:
        tone = cls._aspect_tone(aspect.transit_planet, aspect.aspect_type)
        return ForecastAspectInsight(
            transit_planet=aspect.transit_planet,
            natal_planet=aspect.natal_planet,
            aspect_type=aspect.aspect_type,
            orb=aspect.orb,
            tone=tone,  # type: ignore[arg-type]
            interpretation=cls._forecast_aspect_interpretation(
                aspect.transit_planet,
                aspect.aspect_type,
                aspect.natal_planet,
            ),
        )

    @staticmethod
    def _engine_metadata(engine_id: str, fallback_mode: bool) -> EngineMetadata:
        preset = get_engine_preset(engine_id)
        return EngineMetadata(
            engine_id=preset.engine_id,
            engine_label=preset.label,
            ephemeris_provider="Swiss Ephemeris (pyswisseph)",
            ayanamsha=preset.ayanamsha,
            house_system=preset.house_system,
            fallback_mode=fallback_mode,
            available_engines=[preset_item.to_metadata() for preset_item in list_engine_presets()],
        )

    def _build_nakshatra_and_dasha(
        self,
        birth: BirthDetails,
        planets,
        current_moment: datetime,
    ) -> tuple[NakshatraInfo, DashaInfo]:
        moon = next(p for p in planets if p.name == "Moon")
        nak_data = self._nakshatra_engine.calculate_nakshatra(moon.longitude)
        dasha_timeline = self._nakshatra_engine.calculate_dasha_timeline(
            nak_data,
            self._birth_local_moment(birth),
            current_moment,
        )

        nakshatra_info = NakshatraInfo(
            name=nak_data.name,
            index=nak_data.index,
            lord=nak_data.lord,
            pada=nak_data.pada,
            degree_in_nakshatra=round(nak_data.degree_in_nakshatra, 4),
        )

        dasha_info = DashaInfo(
            current_dasha=dasha_timeline.current_dasha.planet if dasha_timeline.current_dasha else "Unknown",
            current_antardasha=dasha_timeline.current_antardasha.sub_lord if dasha_timeline.current_antardasha else "Unknown",
            current_dasha_start=dasha_timeline.current_dasha_start,
            current_dasha_end=dasha_timeline.current_dasha_end,
            current_antardasha_start=dasha_timeline.current_antardasha_start,
            current_antardasha_end=dasha_timeline.current_antardasha_end,
            periods=[
                DashaPeriodInfo(
                    planet=period.planet,
                    start_date=period.start_date,
                    end_date=period.end_date,
                    years=round(period.years, 2),
                    sequence_start_date=period.sequence_start_date,
                    sequence_end_date=period.sequence_end_date,
                    is_partial=period.is_partial,
                )
                for period in dasha_timeline.periods
            ],
        )
        return nakshatra_info, dasha_info

    def _build_calculation_audit(
        self,
        birth: BirthDetails,
        preset: EnginePreset,
        planets,
        current_moment: datetime,
    ) -> CalculationAuditInfo:
        birth_local_moment = self._birth_local_moment(birth)
        birth_utc_moment = self._local_to_utc(birth_local_moment, birth)
        reference_utc_moment = self._local_to_utc(current_moment, birth)
        moon = next(p for p in planets if p.name == "Moon")
        nak_data = self._nakshatra_engine.calculate_nakshatra(moon.longitude)

        fraction_elapsed = nak_data.degree_in_nakshatra / NAKSHATRA_SPAN
        dasha_seed_total_years = float(DASHA_YEARS[nak_data.lord])
        dasha_seed_elapsed_years = fraction_elapsed * dasha_seed_total_years
        dasha_seed_remaining_years = max(dasha_seed_total_years - dasha_seed_elapsed_years, 0.0)
        dasha_seed_start_local = birth_local_moment - timedelta(days=dasha_seed_elapsed_years * YEAR_DAYS)
        dasha_seed_end_local = dasha_seed_start_local + timedelta(days=dasha_seed_total_years * YEAR_DAYS)

        return CalculationAuditInfo(
            engine_id=preset.engine_id,
            engine_label=preset.label,
            ayanamsha=preset.ayanamsha,
            house_system=preset.house_system,
            time_zone_id=birth.time_zone_id,
            timezone_offset_minutes=birth.resolved_timezone_offset_minutes(birth_local_moment),
            latitude=round(birth.latitude, 6),
            longitude=round(birth.longitude, 6),
            birth_local_iso=self._iso_minute(birth_local_moment),
            birth_utc_iso=self._iso_minute(birth_utc_moment),
            reference_local_iso=self._iso_minute(current_moment),
            reference_utc_iso=self._iso_minute(reference_utc_moment),
            moon_sidereal_longitude=round(moon.longitude, 4),
            moon_sign=moon.sign,
            moon_degree_in_sign=round(moon.degree_in_sign, 4),
            nakshatra_name=nak_data.name,
            nakshatra_lord=nak_data.lord,
            nakshatra_pada=nak_data.pada,
            degree_in_nakshatra=round(nak_data.degree_in_nakshatra, 4),
            nakshatra_progress_percent=round(fraction_elapsed * 100, 2),
            dasha_seed_lord=nak_data.lord,
            dasha_seed_total_years=round(dasha_seed_total_years, 2),
            dasha_seed_elapsed_years=round(dasha_seed_elapsed_years, 2),
            dasha_seed_remaining_years=round(dasha_seed_remaining_years, 2),
            dasha_seed_start_local_iso=self._iso_minute(dasha_seed_start_local),
            dasha_seed_end_local_iso=self._iso_minute(dasha_seed_end_local),
        )

    def build_chart(
        self,
        birth: BirthDetails,
        include_transits: bool = False,
        include_premium: bool = True,
        include_ultimate: bool = False,
        persist_result: bool = True,
        subscription_tier: str = "guest",
    ) -> ChartResponse:
        preset = get_engine_preset(birth.engine_id)
        computed = self._engine.calculate(birth, preset)
        current_moment = self._current_local_moment(birth)

        rules, summary = self._rule_engine.generate(
            ascendant_sign=computed.ascendant.sign,
            planets=computed.planets,
            houses=computed.houses,
        )

        nakshatra_info = None
        dasha_info = None
        calculation_audit = None
        aspects_info = None
        navamsa_info = None
        life_domain_insights = None

        if include_premium:
            nakshatra_info, dasha_info = self._build_nakshatra_and_dasha(
                birth,
                computed.planets,
                current_moment,
            )
            calculation_audit = self._build_calculation_audit(
                birth,
                preset,
                computed.planets,
                current_moment,
            )

            aspects_info = [
                AspectInfo(
                    planet1=a.planet1,
                    planet2=a.planet2,
                    aspect_type=a.aspect_type,
                    exact_angle=a.exact_angle,
                    orb=a.orb,
                    applying=a.applying,
                    vedic=a.vedic,
                )
                for a in self._aspect_engine.calculate_aspects(computed.planets)
            ]

            navamsa_info = [
                NavamsaPositionInfo(
                    name=n.name,
                    rashi_sign=n.rashi_sign,
                    navamsa_sign=n.navamsa_sign,
                    navamsa_division=n.navamsa_division,
                )
                for n in self._navamsa_engine.calculate_navamsa(computed.planets)
            ]

        if include_ultimate:
            life_domain_insights = self._rule_engine.generate_life_domain_insights(
                ascendant_sign=computed.ascendant.sign,
                planets=computed.planets,
                houses=computed.houses,
            )

        astro_chart = AstroChartData(
            julian_day_ut=computed.julian_day_ut,
            ascendant=computed.ascendant,
            planets=computed.planets,
            houses=computed.houses,
            deterministic_rules=rules,
            summary=summary,
            nakshatra=nakshatra_info,
            dasha=dasha_info,
            calculation_audit=calculation_audit,
            aspects=aspects_info,
            navamsa=navamsa_info,
            life_domain_insights=life_domain_insights,
        )

        client = ClientProfile(
            name=birth.name,
            country=birth.country,
            state=birth.state,
            city=birth.city,
            town=birth.town,
            latitude=birth.latitude,
            longitude=birth.longitude,
            timezone_offset_minutes=birth.resolved_timezone_offset_minutes(),
            time_zone_id=birth.time_zone_id,
        )

        transits_data = None
        if include_premium and include_transits:
            transit_positions = self._transit_engine.compute_current_positions(preset)
            transit_aspects = self._transit_engine.compute_transit_aspects(
                computed.planets, transit_positions
            )
            transits_data = TransitData(
                computed_at_utc=datetime.now(timezone.utc),
                positions=[
                    TransitPositionInfo(
                        name=tp.name,
                        longitude=tp.longitude,
                        sign=tp.sign,
                        degree_in_sign=tp.degree_in_sign,
                    )
                    for tp in transit_positions
                ],
                active_aspects=[
                    TransitAspectInfo(
                        transit_planet=ta.transit_planet,
                        natal_planet=ta.natal_planet,
                        aspect_type=ta.aspect_type,
                        orb=ta.orb,
                    )
                    for ta in transit_aspects
                ],
            )

        if persist_result:
            persistence_payload = {
                "client": client.model_dump(mode="json"),
                "chart": astro_chart.model_dump(mode="json"),
                "engine": {
                    "engine_id": preset.engine_id,
                    "engine_label": preset.label,
                    "ephemeris_provider": "Swiss Ephemeris (pyswisseph)",
                    "ayanamsha": preset.ayanamsha,
                    "house_system": preset.house_system,
                    "fallback_mode": computed.fallback_mode,
                },
                "birth": {
                    "birth_date": birth.birth_date.isoformat(),
                    "birth_time": birth.birth_time.isoformat(),
                },
            }
            storage_status = self._gateway_factory().persist_chart(persistence_payload)
        else:
            storage_status = {
                "configured": True,
                "persisted": False,
                "message": "Persistence skipped for this request.",
            }

        locked_features: list[str] = []
        if not include_premium:
            locked_features.extend(PREMIUM_FEATURES)
        if not include_ultimate:
            locked_features.extend(ULTIMATE_FEATURES)

        return ChartResponse(
            generated_at_utc=datetime.now(timezone.utc),
            client=client,
            chart=astro_chart,
            engine=self._engine_metadata(preset.engine_id, computed.fallback_mode),
            storage=storage_status,
            access=AccessMetadata(
                subscription_tier=subscription_tier,
                premium_features_enabled=include_premium,
                ultimate_features_enabled=include_ultimate,
                locked_features=locked_features,
            ),
            transits=transits_data,
        )

    def build_forecast(self, birth: BirthDetails, target_date: date) -> ForecastReading:
        preset = get_engine_preset(birth.engine_id)
        computed = self._engine.calculate(birth, preset)
        target_local_moment = self._target_local_noon(target_date)
        target_utc_moment = self._local_to_utc(target_local_moment, birth)

        _, dasha_info = self._build_nakshatra_and_dasha(
            birth,
            computed.planets,
            target_local_moment,
        )

        transit_positions = self._transit_engine.compute_positions(target_utc_moment, preset)
        transit_aspects = [
            TransitAspectInfo(
                transit_planet=aspect.transit_planet,
                natal_planet=aspect.natal_planet,
                aspect_type=aspect.aspect_type,
                orb=aspect.orb,
            )
            for aspect in self._transit_engine.compute_transit_aspects(
                computed.planets,
                transit_positions,
            )
        ]

        supportive_transits = [
            self._to_forecast_aspect(aspect)
            for aspect in transit_aspects
            if self._aspect_tone(aspect.transit_planet, aspect.aspect_type) == "supportive"
        ][:3]
        challenging_transits = [
            self._to_forecast_aspect(aspect)
            for aspect in transit_aspects
            if self._aspect_tone(aspect.transit_planet, aspect.aspect_type) == "challenging"
        ][:3]

        current_dasha_planet = next(
            planet for planet in computed.planets if planet.name == dasha_info.current_dasha
        )
        current_antardasha_planet = next(
            planet for planet in computed.planets if planet.name == dasha_info.current_antardasha
        )
        dasha_theme = DASHA_FORECAST_THEMES[dasha_info.current_dasha]
        antardasha_theme = DASHA_FORECAST_THEMES[dasha_info.current_antardasha]

        focus_areas = [
            (
                f"{dasha_info.current_dasha} Mahadasha keeps the long-range focus on "
                f"{HOUSE_THEMES[current_dasha_planet.house]} via natal house {current_dasha_planet.house}."
            ),
            (
                f"{dasha_info.current_antardasha} Antardasha sharpens the near-term story around "
                f"{HOUSE_THEMES[current_antardasha_planet.house]} via natal house {current_antardasha_planet.house}."
            ),
        ]
        if supportive_transits:
            focus_areas.append(supportive_transits[0].interpretation)
        if challenging_transits:
            focus_areas.append(challenging_transits[0].interpretation)

        opportunities = [
            dasha_theme["opportunity"],
            antardasha_theme["opportunity"],
        ]
        if supportive_transits:
            opportunities.extend(item.interpretation for item in supportive_transits[:2])

        cautions = [
            dasha_theme["caution"],
            antardasha_theme["caution"],
        ]
        if challenging_transits:
            cautions.extend(item.interpretation for item in challenging_transits[:2])

        headline = (
            f"{target_date.isoformat()} falls in {dasha_info.current_dasha} / "
            f"{dasha_info.current_antardasha}, a period centered on {antardasha_theme['focus']}."
        )
        overview = (
            f"On {target_date.isoformat()}, the broader timing cycle emphasizes {dasha_theme['focus']}, "
            f"while the active sub-period concentrates on {antardasha_theme['focus']}. "
            f"Natal house activation points toward {HOUSE_THEMES[current_dasha_planet.house]} and "
            f"{HOUSE_THEMES[current_antardasha_planet.house]}, so this is best handled as a period of "
            f"purposeful adjustment rather than passive waiting."
        )

        return ForecastReading(
            target_date=target_date,
            headline=headline,
            overview=overview,
            dasha=dasha_info,
            focus_areas=focus_areas[:4],
            opportunities=opportunities[:4],
            cautions=cautions[:4],
            supportive_transits=supportive_transits,
            challenging_transits=challenging_transits,
        )


@lru_cache
def get_chart_service() -> ChartService:
    return ChartService()
