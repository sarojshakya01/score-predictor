"""Match API routes."""
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin_user
from app.db.session import get_db
from app.schemas.match import (
    MatchCreate,
    MatchListResponse,
    MatchResponse,
    MatchUpdate,
)
from app.services.match_service import MatchService

router = APIRouter(prefix="/matches", tags=["Matches"])

admin_router = APIRouter(
    prefix="/admin/matches",
    tags=["Admin Matches"],
    dependencies=[Depends(get_current_admin_user)],
)


@router.get(
    "/upcoming/",
    response_model=MatchListResponse,
    summary="List upcoming matches",
)
async def list_upcoming_matches(
    db: Annotated[AsyncSession, Depends(get_db)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    include_locked: bool = True,
) -> MatchListResponse:
    """Return upcoming matches for prediction and home-page flows."""
    service = MatchService(db)
    return await service.list_upcoming(
        offset=offset,
        limit=limit,
        include_locked=include_locked,
    )


@admin_router.get(
    "",
    response_model=MatchListResponse,
    summary="List matches",
)
async def list_matches(
    db: Annotated[AsyncSession, Depends(get_db)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    match_day: Annotated[int | None, Query(gt=0)] = None,
    match_locked: bool | None = None,
) -> MatchListResponse:
    """Return paginated matches for admin management."""
    service = MatchService(db)
    return await service.list_matches(
        offset=offset,
        limit=limit,
        match_day=match_day,
        match_locked=match_locked,
    )


@admin_router.get(
    "/{match_id}",
    response_model=MatchResponse,
    summary="Get match",
)
async def get_match(
    match_id: Annotated[int, Path(gt=0)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MatchResponse:
    """Return a single match by id."""
    service = MatchService(db)
    return await service.get_match(match_id)


@admin_router.post(
    "",
    response_model=MatchResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create match",
)
async def create_match(
    data: MatchCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MatchResponse:
    """Create a match."""
    service = MatchService(db)
    return await service.create_match(data)


@admin_router.put(
    "/{match_id}",
    response_model=MatchResponse,
    summary="Update match",
)
async def update_match(
    match_id: Annotated[int, Path(gt=0)],
    data: MatchUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MatchResponse:
    """Update a match."""
    service = MatchService(db)
    return await service.update_match(match_id=match_id, data=data)


@admin_router.delete(
    "/{match_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete match",
)
async def delete_match(
    match_id: Annotated[int, Path(gt=0)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Delete a match."""
    service = MatchService(db)
    await service.delete_match(match_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
