from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db_session
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
    session: Session = Depends(get_db_session),
) -> list[SavedComparisonResponse]:
    gateway = DatabaseGateway(session)
    return gateway.list_saved_comparisons_for_user(current_user["sub"], search=q, status=status_filter)


@router.patch("/{saved_comparison_id}", response_model=SavedComparisonResponse)
def update_saved_comparison_notes(
    saved_comparison_id: str,
    payload: SavedComparisonNoteUpdateRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> SavedComparisonResponse:
    gateway = DatabaseGateway(session)
    record = gateway.update_saved_comparison_notes(
        current_user["sub"],
        saved_comparison_id,
        payload.notes,
    )
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved comparison not found.")
    return record


@router.patch("/{saved_comparison_id}/archive", response_model=SavedComparisonResponse)
def archive_saved_comparison(
    saved_comparison_id: str,
    payload: SavedRecordArchiveRequest,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> SavedComparisonResponse:
    gateway = DatabaseGateway(session)
    record = gateway.archive_saved_comparison(
        current_user["sub"],
        saved_comparison_id,
        payload.archived,
    )
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved comparison not found.")
    return record


@router.delete("/{saved_comparison_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_comparison(
    saved_comparison_id: str,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> None:
    gateway = DatabaseGateway(session)
    deleted = gateway.delete_saved_comparison(current_user["sub"], saved_comparison_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved comparison not found.")
