from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user, get_database_gateway
from app.infrastructure.database_gateway import DatabaseGateway
from app.models.chart_models import (
    SavedComparisonNoteUpdateRequest,
    SavedComparisonResponse,
    SavedRecordArchiveRequest,
)

router = APIRouter(prefix="/saved-comparisons", tags=["saved-comparisons"])


@router.get("", response_model=list[SavedComparisonResponse])
def list_saved_comparisons(
    q: str | None = Query(default=None, min_length=1),
    status_filter: str = Query(default="active", alias="status", pattern="^(active|archived|all)$"),
    current_user: dict = Depends(get_current_user),
    gateway: DatabaseGateway = Depends(get_database_gateway),
) -> list[SavedComparisonResponse]:
    try:
        return gateway.list_saved_comparisons_for_user(current_user["sub"], search=q, status=status_filter)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.patch("/{saved_comparison_id}", response_model=SavedComparisonResponse)
def update_saved_comparison_notes(
    saved_comparison_id: str,
    payload: SavedComparisonNoteUpdateRequest,
    current_user: dict = Depends(get_current_user),
    gateway: DatabaseGateway = Depends(get_database_gateway),
) -> SavedComparisonResponse:
    try:
        record = gateway.update_saved_comparison_notes(
            current_user["sub"],
            saved_comparison_id,
            payload.notes,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved comparison not found.")
    return record


@router.patch("/{saved_comparison_id}/archive", response_model=SavedComparisonResponse)
def archive_saved_comparison(
    saved_comparison_id: str,
    payload: SavedRecordArchiveRequest,
    current_user: dict = Depends(get_current_user),
    gateway: DatabaseGateway = Depends(get_database_gateway),
) -> SavedComparisonResponse:
    try:
        record = gateway.archive_saved_comparison(
            current_user["sub"],
            saved_comparison_id,
            payload.archived,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved comparison not found.")
    return record


@router.delete("/{saved_comparison_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_comparison(
    saved_comparison_id: str,
    current_user: dict = Depends(get_current_user),
    gateway: DatabaseGateway = Depends(get_database_gateway),
) -> None:
    try:
        deleted = gateway.delete_saved_comparison(current_user["sub"], saved_comparison_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved comparison not found.")
