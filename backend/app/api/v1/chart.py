from datetime import date, time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.models.chart_models import BirthDetails, ChartResponse, ForecastReading, SubPeriodInfo
from app.services.chart_service import ChartService, get_chart_service
from app.services.nakshatra_engine import NakshatraEngine

router = APIRouter(prefix="/chart", tags=["chart"])


def _safe_build_chart(
    service: ChartService,
    payload: BirthDetails,
    include_transits: bool = False,
    include_premium: bool = False,
    include_ultimate: bool = False,
    subscription_tier: str = "guest",
) -> ChartResponse:
    try:
        return service.build_chart(
            payload,
            include_transits=include_transits,
            include_premium=include_premium,
            include_ultimate=include_ultimate,
            subscription_tier=subscription_tier,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


@router.post("", response_model=ChartResponse)
def create_chart(
    payload: BirthDetails,
    include_transits: bool = Query(False),
    service: ChartService = Depends(get_chart_service),
) -> ChartResponse:
    return _safe_build_chart(
        service,
        payload,
        include_transits=include_transits,
        include_premium=True,
        include_ultimate=True,
        subscription_tier="guest",
    )


@router.get("", response_model=ChartResponse)
def get_chart(
    name: str = Query(..., min_length=2, max_length=120),
    birth_date: date = Query(...),
    birth_time: time = Query(...),
    engine_id: str = "lahiri_classic",
    timezone_offset_minutes: int = Query(..., ge=-720, le=840),
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    country: str = Query(""),
    state: str = Query(""),
    city: str = Query(""),
    town: str = Query(""),
    time_zone_id: str = Query(""),
    include_transits: bool = Query(False),
    service: ChartService = Depends(get_chart_service),
) -> ChartResponse:
    payload = BirthDetails(
        name=name,
        birth_date=birth_date,
        birth_time=birth_time,
        engine_id=engine_id,
        timezone_offset_minutes=timezone_offset_minutes,
        latitude=latitude,
        longitude=longitude,
        country=country,
        state=state,
        city=city,
        town=town,
        time_zone_id=time_zone_id,
    )
    return _safe_build_chart(
        service,
        payload,
        include_transits=include_transits,
        include_premium=True,
        include_ultimate=True,
        subscription_tier="guest",
    )


@router.get("/dasha-subperiods", response_model=list[SubPeriodInfo])
def get_dasha_subperiods(
    parent_lord: str = Query(..., description="Planetary lord of the parent period"),
    parent_start: date = Query(..., description="Start date of the parent period"),
    parent_end: date = Query(..., description="End date of the parent period"),
    sequence_start: Optional[date] = Query(
        None,
        description="Actual sequence start date when the visible parent period is clipped",
    ),
    sequence_end: Optional[date] = Query(
        None,
        description="Actual sequence end date when the visible parent period is clipped",
    ),
    level: int = Query(..., ge=2, le=5, description="Sub-period level: 2-5"),
    parent_lords: Optional[str] = Query(
        None,
        description="Comma-separated hierarchy of lords from Maha Dasha down",
    ),
) -> list[SubPeriodInfo]:
    """Compute the 9 sub-periods within a parent dasha period."""
    lords_list = parent_lords.split(",") if parent_lords else []
    raw = NakshatraEngine.compute_sub_periods(
        parent_lord=parent_lord,
        parent_start=parent_start,
        parent_end=parent_end,
        level=level,
        parent_lords=lords_list,
        sequence_start=sequence_start,
        sequence_end=sequence_end,
    )
    return [SubPeriodInfo(**item) for item in raw]


@router.get("/forecast", response_model=ForecastReading)
def get_forecast(
    name: str = Query(..., min_length=2, max_length=120),
    birth_date: date = Query(...),
    birth_time: time = Query(...),
    target_date: date = Query(...),
    engine_id: str = "lahiri_classic",
    timezone_offset_minutes: int = Query(..., ge=-720, le=840),
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    country: str = Query(""),
    state: str = Query(""),
    city: str = Query(""),
    town: str = Query(""),
    time_zone_id: str = Query(""),
    service: ChartService = Depends(get_chart_service),
) -> ForecastReading:
    payload = BirthDetails(
        name=name,
        birth_date=birth_date,
        birth_time=birth_time,
        engine_id=engine_id,
        timezone_offset_minutes=timezone_offset_minutes,
        latitude=latitude,
        longitude=longitude,
        country=country,
        state=state,
        city=city,
        town=town,
        time_zone_id=time_zone_id,
    )
    try:
        return service.build_forecast(payload, target_date)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
