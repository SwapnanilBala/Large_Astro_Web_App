from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_optional_current_user
from app.db.session import get_db_session
from app.infrastructure.database_gateway import DatabaseGateway
from app.models.chart_models import CompatibilityRequest, CompatibilityResponse
from app.services.compatibility_service import CompatibilityService

router = APIRouter(prefix="/compatibility", tags=["compatibility"])


def _build_query_string(payload: CompatibilityRequest) -> str:
    params = {
        "name": payload.primary.name,
        "birthDate": str(payload.primary.birth_date),
        "birthTime": payload.primary.birth_time.isoformat(timespec="minutes"),
        "timezoneOffsetMinutes": str(payload.primary.timezone_offset_minutes),
        "latitude": str(payload.primary.latitude),
        "longitude": str(payload.primary.longitude),
        "country": payload.primary.country,
        "state": payload.primary.state,
        "city": payload.primary.city,
        "town": payload.primary.town,
        "timeZoneId": payload.primary.time_zone_id,
        "partnerName": payload.partner.name,
        "partnerBirthDate": str(payload.partner.birth_date),
        "partnerBirthTime": payload.partner.birth_time.isoformat(timespec="minutes"),
        "partnerTimezoneOffsetMinutes": str(payload.partner.timezone_offset_minutes),
        "partnerLatitude": str(payload.partner.latitude),
        "partnerLongitude": str(payload.partner.longitude),
        "partnerCountry": payload.partner.country,
        "partnerState": payload.partner.state,
        "partnerCity": payload.partner.city,
        "partnerTown": payload.partner.town,
        "partnerTimeZoneId": payload.partner.time_zone_id,
    }
    return urlencode(params)


@router.post("", response_model=CompatibilityResponse)
def create_compatibility_report(
    payload: CompatibilityRequest,
    current_user: dict | None = Depends(get_optional_current_user),
    session: Session = Depends(get_db_session),
) -> CompatibilityResponse:
    service = CompatibilityService()
    response = service.build_compatibility(payload.primary, payload.partner)

    if payload.save_result:
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Sign in to save compatibility reports.",
            )

        saved = DatabaseGateway(session).save_comparison_for_user(
            user_id=current_user["sub"],
            primary_name=response.primary_client.name,
            partner_name=response.partner_client.name,
            compatibility_score=response.compatibility_score,
            summary=response.summary,
            query_string=_build_query_string(payload),
            report_json=response.model_dump(mode="json"),
        )
        response.saved_comparison_id = saved.saved_comparison_id

    return response
