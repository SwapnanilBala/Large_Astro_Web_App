from fastapi import APIRouter

from app.models.chart_models import CompatibilityRequest, CompatibilityResponse
from app.services.compatibility_service import CompatibilityService

router = APIRouter(prefix="/compatibility", tags=["compatibility"])


@router.post("", response_model=CompatibilityResponse)
def create_compatibility_report(payload: CompatibilityRequest) -> CompatibilityResponse:
    service = CompatibilityService()
    return service.build_compatibility(payload.primary, payload.partner)
