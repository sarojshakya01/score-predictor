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
    tags=["Matches"],
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
    include_locked: bool = None,
) -> MatchListResponse:
    """Return upcoming matches for prediction and home-page flows."""
    service = MatchService(db)
    return await service.list_upcoming(
        offset=offset,
        limit=limit,
        include_locked=include_locked,
    )

@router.get(
    "/finals/",
    response_model=MatchListResponse,
    summary="List final matches (3rd Place and Final)",
)
async def list_final_matches(
    db: Annotated[AsyncSession, Depends(get_db)],
    include_locked: bool = None,
) -> MatchListResponse:
    """Return final matches for prediction and home-page flows."""
    service = MatchService(db)
    return await service.list_finals(
        include_locked=include_locked,
    )

@router.get(
    "/results/",
    response_model=MatchListResponse,
    summary="List completed match results",
)
async def list_match_results(
    db: Annotated[AsyncSession, Depends(get_db)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 6,
) -> MatchListResponse:
    """Return completed matches for home-page results."""
    service = MatchService(db)
    return await service.list_results(
        offset=offset,
        limit=limit,
    )

@router.get(
    "",
    response_model=MatchListResponse,
    summary="List matches",
)
async def list_asked_matches(
    db: Annotated[AsyncSession, Depends(get_db)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    match_day: Annotated[int | None, Query(gt=0)] = None,
    match_stage: Annotated[str | None, Query(min_length=1)] = None,
) -> MatchListResponse:
    """Return paginated matches for public match views."""
    service = MatchService(db)
    return await service.list_matches(
        offset=offset,
        limit=limit,
        match_day=match_day,
        match_stage=match_stage,
        all_matches=True
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
    match_locked: bool | None = None,
) -> MatchListResponse:
    """Return paginated matches for admin management."""
    service = MatchService(db)
    return await service.list_matches(
        offset=offset,
        limit=limit,
        is_admin=True,
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
