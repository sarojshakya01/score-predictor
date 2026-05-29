"""Prediction API routes."""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.schemas.prediction import (
    PredictionCreate,
    PredictionListResponse,
    PredictionResponse,
    PredictionUpdate,
)
from app.services.prediction_service import PredictionService

router = APIRouter(prefix="/predictions", tags=["Predictions"])


@router.post(
    "",
    response_model=PredictionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create prediction",
)
async def create_prediction(
    data: PredictionCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PredictionResponse:
    """Create a prediction for the current authenticated user."""
    service = PredictionService(db)
    return await service.create_prediction(user_id=current_user.id, data=data)


@router.put(
    "/{prediction_id}",
    response_model=PredictionResponse,
    summary="Update prediction",
)
async def update_prediction(
    prediction_id: Annotated[int, Path(gt=0)],
    data: PredictionUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PredictionResponse:
    """Update a prediction owned by the current authenticated user."""
    service = PredictionService(db)
    return await service.update_prediction(
        user_id=current_user.id,
        prediction_id=prediction_id,
        data=data,
    )


@router.get(
    "/me",
    response_model=PredictionListResponse,
    summary="List current user predictions",
)
async def list_current_user_predictions(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    match_id: Annotated[int | None, Query(gt=0)] = None,
) -> PredictionListResponse:
    """Return paginated predictions for the current authenticated user."""
    service = PredictionService(db)
    return await service.list_current_user_predictions(
        user_id=current_user.id,
        offset=offset,
        limit=limit,
        match_id=match_id,
    )
