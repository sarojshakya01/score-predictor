"""Team API routes."""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin_user
from app.db.session import get_db
from app.schemas.group import GroupTableListResponse
from app.schemas.team import TeamCreate, TeamListResponse, TeamResponse, TeamUpdate
from app.services.group_service import GroupService
from app.services.team_service import TeamService

group_router = APIRouter(prefix="/teams/groups", tags=["Teams"])

router = APIRouter(prefix="/teams", tags=["Teams"])

admin_router = APIRouter(
    prefix="/admin/teams",
    tags=["Teams"],
    dependencies=[Depends(get_current_admin_user)],
)

@router.get(
    "",
    response_model=TeamListResponse,
    summary="List teams",
)
async def list_all_teams(
    db: Annotated[AsyncSession, Depends(get_db)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> TeamListResponse:
    """Return all teams for admin final/runnerup and third place predictions."""
    service = TeamService(db)
    return await service.list_teams(
        offset=offset,
        limit=limit,
        group=None,
        search=None,
    )


@group_router.get(
    "",
    response_model=GroupTableListResponse,
    summary="List group standings",
)
async def list_group_tables(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GroupTableListResponse:
    """Return group-stage standings for the public groups page."""
    service = GroupService(db)
    return await service.list_group_tables()


@admin_router.get(
    "",
    response_model=TeamListResponse,
    summary="List teams",
)
async def list_teams(
    db: Annotated[AsyncSession, Depends(get_db)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    group: Annotated[str | None, Query(min_length=1, max_length=20)] = None,
    search: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
) -> TeamListResponse:
    """Return paginated teams for admin management."""
    service = TeamService(db)
    return await service.list_teams(
        offset=offset,
        limit=limit,
        group=group,
        search=search,
    )


@admin_router.post(
    "",
    response_model=TeamResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create team",
)
async def create_team(
    data: TeamCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TeamResponse:
    """Create a team."""
    service = TeamService(db)
    return await service.create_team(data)


@admin_router.put(
    "/{team_id}",
    response_model=TeamResponse,
    summary="Update team",
)
async def update_team(
    team_id: Annotated[int, Path(gt=0)],
    data: TeamUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TeamResponse:
    """Update a team."""
    service = TeamService(db)
    return await service.update_team(team_id=team_id, data=data)


@admin_router.delete(
    "/{team_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete team",
)
async def delete_team(
    team_id: Annotated[int, Path(gt=0)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Delete a team."""
    service = TeamService(db)
    await service.delete_team(team_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
