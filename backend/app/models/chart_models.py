from datetime import date, datetime, time, timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, Field, computed_field


class BirthDetails(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    birth_date: date
    birth_time: time
    engine_id: str = "lahiri_classic"
    timezone_offset_minutes: int = Field(
        description="Offset from UTC in minutes. Example: +330 for IST, -300 for EST.",
        ge=-720,
        le=840,
    )
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    country: str = ""
    state: str = ""
    city: str = ""
    town: str = ""
    time_zone_id: str = ""

    def _zoneinfo(self) -> ZoneInfo | None:
        if not self.time_zone_id.strip():
            return None
        try:
            return ZoneInfo(self.time_zone_id.strip())
        except ZoneInfoNotFoundError:
            return None

    def resolved_timezone_offset_minutes(self, local_dt: datetime | None = None) -> int:
        zone = self._zoneinfo()
        if zone is None:
            return self.timezone_offset_minutes

        reference = local_dt or datetime.combine(self.birth_date, self.birth_time)
        offset = reference.replace(tzinfo=zone).utcoffset()
        if offset is None:
            return self.timezone_offset_minutes
        return int(offset.total_seconds() // 60)

    def local_to_utc(self, local_dt: datetime) -> datetime:
        zone = self._zoneinfo()
        if zone is None:
            return local_dt - timedelta(minutes=self.timezone_offset_minutes)
        return local_dt.replace(tzinfo=zone).astimezone(timezone.utc).replace(tzinfo=None)

    def utc_to_local(self, utc_dt: datetime) -> datetime:
        zone = self._zoneinfo()
        if zone is None:
            return utc_dt + timedelta(minutes=self.timezone_offset_minutes)

        aware_utc = utc_dt if utc_dt.tzinfo is not None else utc_dt.replace(tzinfo=timezone.utc)
        return aware_utc.astimezone(zone).replace(tzinfo=None)

    @computed_field
    @property
    def utc_datetime(self) -> datetime:
        local_dt = datetime.combine(self.birth_date, self.birth_time)
        return self.local_to_utc(local_dt)


class ClientProfile(BaseModel):
    name: str
    country: str
    state: str
    city: str
    town: str
    latitude: float
    longitude: float
    timezone_offset_minutes: int
    time_zone_id: str = ""


class PlanetPosition(BaseModel):
    name: str
    longitude: float
    sign: str
    degree_in_sign: float
    house: int


class AscendantData(BaseModel):
    longitude: float
    sign: str
    degree_in_sign: float


class HousePlacement(BaseModel):
    house_number: int = Field(ge=1, le=12)
    sign: str
    planets: list[str]


class DeterministicRule(BaseModel):
    title: str
    insight: str
    basis: str
    priority: Literal["high", "medium", "low"]
    category: str = "core"
    confidence_score: float = Field(default=0.72, ge=0, le=1)
    tension_note: str = ""


class LifeDomainInsight(BaseModel):
    key: Literal[
        "love_life",
        "career",
        "family",
        "inheritance",
        "influence",
        "life_cycle",
    ]
    label: str
    headline: str
    overview: str
    strengths: list[str] = Field(default_factory=list)
    watchouts: list[str] = Field(default_factory=list)
    timing_triggers: list[str] = Field(default_factory=list)
    supporting_patterns: list[str] = Field(default_factory=list)
    guidance: str
    long_game: str
    confidence_score: float = Field(default=0.75, ge=0, le=1)


# ── Nakshatra & Dasha models ──────────────────────────────────

class NakshatraInfo(BaseModel):
    name: str
    index: int
    lord: str
    pada: int
    degree_in_nakshatra: float


class DashaPeriodInfo(BaseModel):
    planet: str
    start_date: date
    end_date: date
    years: float
    sequence_start_date: date | None = None
    sequence_end_date: date | None = None
    is_partial: bool = False


class DashaInfo(BaseModel):
    current_dasha: str
    current_antardasha: str
    current_dasha_start: date
    current_dasha_end: date
    current_antardasha_start: date
    current_antardasha_end: date
    periods: list[DashaPeriodInfo]


class CalculationAuditInfo(BaseModel):
    engine_id: str
    engine_label: str
    ayanamsha: str
    house_system: str
    time_zone_id: str = ""
    timezone_offset_minutes: int
    latitude: float
    longitude: float
    birth_local_iso: str
    birth_utc_iso: str
    reference_local_iso: str
    reference_utc_iso: str
    moon_sidereal_longitude: float
    moon_sign: str
    moon_degree_in_sign: float
    nakshatra_name: str
    nakshatra_lord: str
    nakshatra_pada: int
    degree_in_nakshatra: float
    nakshatra_progress_percent: float = Field(ge=0, le=100)
    dasha_seed_lord: str
    dasha_seed_total_years: float
    dasha_seed_elapsed_years: float
    dasha_seed_remaining_years: float
    dasha_seed_start_local_iso: str
    dasha_seed_end_local_iso: str


# ── Sub-Period (Dasha drill-down) models ─────────────────────

class SubPeriodInfo(BaseModel):
    level: int = Field(ge=2, le=5, description="2=Antardasha, 3=Pratyantardasha, 4=Sookshma, 5=Prana")
    planet: str
    lords: list[str] = Field(description="Hierarchy of lords from Maha Dasha down")
    start_date: date
    end_date: date
    sequence_start_date: date | None = None
    sequence_end_date: date | None = None
    is_partial: bool = False


# ── Aspect models ─────────────────────────────────────────────

class AspectInfo(BaseModel):
    planet1: str
    planet2: str
    aspect_type: str
    exact_angle: float
    orb: float
    applying: bool
    vedic: bool


# ── Navamsa (D9) models ──────────────────────────────────────

class NavamsaPositionInfo(BaseModel):
    name: str
    rashi_sign: str
    navamsa_sign: str
    navamsa_division: int


# ── Transit models ────────────────────────────────────────────

class TransitPositionInfo(BaseModel):
    name: str
    longitude: float
    sign: str
    degree_in_sign: float


class TransitAspectInfo(BaseModel):
    transit_planet: str
    natal_planet: str
    aspect_type: str
    orb: float


class TransitData(BaseModel):
    computed_at_utc: datetime
    positions: list[TransitPositionInfo]
    active_aspects: list[TransitAspectInfo]


# ── Chart data (extended) ────────────────────────────────────

class AstroChartData(BaseModel):
    julian_day_ut: float
    ascendant: AscendantData
    planets: list[PlanetPosition]
    houses: list[HousePlacement]
    deterministic_rules: list[DeterministicRule]
    summary: str
    # New optional fields (backward compatible)
    nakshatra: NakshatraInfo | None = None
    dasha: DashaInfo | None = None
    calculation_audit: CalculationAuditInfo | None = None
    aspects: list[AspectInfo] | None = None
    navamsa: list[NavamsaPositionInfo] | None = None
    life_domain_insights: list[LifeDomainInsight] | None = None


class EnginePresetInfo(BaseModel):
    engine_id: str
    label: str
    ayanamsha: str
    house_system: str
    description: str


class EngineMetadata(BaseModel):
    engine_id: str
    engine_label: str
    ephemeris_provider: str
    ayanamsha: str
    house_system: str
    fallback_mode: bool
    available_engines: list[EnginePresetInfo] = Field(default_factory=list)


class StorageStatus(BaseModel):
    configured: bool
    persisted: bool
    message: str


class AccessMetadata(BaseModel):
    subscription_tier: str = "guest"
    premium_features_enabled: bool = False
    ultimate_features_enabled: bool = False
    locked_features: list[str] = Field(default_factory=list)


class ChartResponse(BaseModel):
    generated_at_utc: datetime
    client: ClientProfile
    chart: AstroChartData
    engine: EngineMetadata
    storage: StorageStatus
    access: AccessMetadata = Field(default_factory=AccessMetadata)
    transits: TransitData | None = None


class SavedChartUpsertRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    city: str = ""
    birth_date: date
    birth_time: str = ""
    timezone_offset_minutes: int = 0
    country: str = ""
    state: str = ""
    town: str = ""
    latitude: float = 0
    longitude: float = 0
    time_zone_id: str = ""
    ascendant_sign: str = Field(min_length=2, max_length=32)
    query_string: str = Field(min_length=1)
    notes: str = ""


class SavedChartResponse(BaseModel):
    saved_chart_id: str
    name: str
    city: str
    birth_date: date
    birth_time: str
    timezone_offset_minutes: int
    country: str
    state: str
    town: str
    latitude: float
    longitude: float
    time_zone_id: str
    ascendant_sign: str
    query_string: str
    notes: str
    saved_at: datetime
    updated_at: datetime
    archived_at: datetime | None = None


class SavedChartNoteUpdateRequest(BaseModel):
    notes: str = ""


class SavedRecordArchiveRequest(BaseModel):
    archived: bool = True


class SynastryAspectInfo(BaseModel):
    primary_planet: str
    partner_planet: str
    aspect_type: str
    orb: float
    harmonious: bool


class CompatibilityTheme(BaseModel):
    title: str
    insight: str
    confidence_score: float = Field(default=0.75, ge=0, le=1)


class CompatibilityRequest(BaseModel):
    primary: BirthDetails
    partner: BirthDetails
    save_result: bool = False


class CompatibilityResponse(BaseModel):
    generated_at_utc: datetime
    primary_client: ClientProfile
    partner_client: ClientProfile
    compatibility_score: float = Field(ge=0, le=100)
    summary: str
    themes: list[CompatibilityTheme]
    synastry_aspects: list[SynastryAspectInfo]
    saved_comparison_id: str | None = None


class ForecastAspectInsight(BaseModel):
    transit_planet: str
    natal_planet: str
    aspect_type: str
    orb: float
    tone: Literal["supportive", "challenging", "mixed"]
    interpretation: str


class ForecastReading(BaseModel):
    target_date: date
    headline: str
    overview: str
    dasha: DashaInfo
    focus_areas: list[str] = Field(default_factory=list)
    opportunities: list[str] = Field(default_factory=list)
    cautions: list[str] = Field(default_factory=list)
    supportive_transits: list[ForecastAspectInsight] = Field(default_factory=list)
    challenging_transits: list[ForecastAspectInsight] = Field(default_factory=list)


class SavedComparisonResponse(BaseModel):
    saved_comparison_id: str
    primary_name: str
    partner_name: str
    compatibility_score: float
    summary: str
    query_string: str
    notes: str
    saved_at: datetime
    updated_at: datetime
    archived_at: datetime | None = None


class SavedComparisonNoteUpdateRequest(BaseModel):
    notes: str = ""
