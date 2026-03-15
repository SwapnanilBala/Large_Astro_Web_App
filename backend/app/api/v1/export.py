from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse

from app.api.deps import get_current_user
from app.config import get_settings, Settings
from app.services.excel_export_service import ExcelExportService

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/excel")
def export_excel(
    current_user: dict = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> FileResponse:
    service = ExcelExportService(settings)
    try:
        file_path = service.export_user_workspace(current_user["sub"])
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return FileResponse(
        path=file_path,
        filename="astro_workspace.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
