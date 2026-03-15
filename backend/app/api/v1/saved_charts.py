from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user, get_database_gateway
from app.infrastructure.database_gateway import DatabaseGateway
from app.models.chart_models import (
    SavedRecordArchiveRequest,
    SavedChartNoteUpdateRequest,
    SavedChartResponse,
    SavedChartUpsertRequest,
)

router = APIRouter(prefix="/saved-charts", tags=["saved-charts"])


@router.get("", response_model=list[SavedChartResponse])
def list_saved_charts(
    q: str | None = Query(default=None, min_length=1),
    status_filter: str = Query(default="active", alias="status", pattern="^(active|archived|all)$"),
    current_user: dict = Depends(get_current_user),
    gateway: DatabaseGateway = Depends(get_database_gateway),
) -> list[SavedChartResponse]:
    try:
        return gateway.list_saved_charts_for_user(current_user["sub"], search=q, status=status_filter)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("", response_model=SavedChartResponse, status_code=status.HTTP_201_CREATED)
def save_chart(
    payload: SavedChartUpsertRequest,
    current_user: dict = Depends(get_current_user),
    gateway: DatabaseGateway = Depends(get_database_gateway),
) -> SavedChartResponse:
    try:
        return gateway.save_chart_for_user(current_user["sub"], payload.model_dump(mode="json"))
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.patch("/{saved_chart_id}", response_model=SavedChartResponse)
def update_saved_chart_notes(
    saved_chart_id: str,
    payload: SavedChartNoteUpdateRequest,
    current_user: dict = Depends(get_current_user),
    gateway: DatabaseGateway = Depends(get_database_gateway),
) -> SavedChartResponse:
    try:
        record = gateway.update_saved_chart_notes(current_user["sub"], saved_chart_id, payload.notes)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved chart not found.")
    return record


@router.patch("/{saved_chart_id}/archive", response_model=SavedChartResponse)
def archive_saved_chart(
    saved_chart_id: str,
    payload: SavedRecordArchiveRequest,
    current_user: dict = Depends(get_current_user),
    gateway: DatabaseGateway = Depends(get_database_gateway),
) -> SavedChartResponse:
    try:
        record = gateway.archive_saved_chart(current_user["sub"], saved_chart_id, payload.archived)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved chart not found.")
    return record


@router.delete("/{saved_chart_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_chart(
    saved_chart_id: str,
    current_user: dict = Depends(get_current_user),
    gateway: DatabaseGateway = Depends(get_database_gateway),
) -> None:
    try:
        deleted = gateway.delete_saved_chart(current_user["sub"], saved_chart_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved chart not found.")
