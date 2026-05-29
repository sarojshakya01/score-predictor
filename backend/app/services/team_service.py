"""Team business logic."""

import logging

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.team import Team
from app.repositories.team_repository import TeamRepository
from app.schemas.team import TeamCreate, TeamListResponse, TeamResponse, TeamUpdate

logger = logging.getLogger(__name__)

class TeamService:
    """Handles team validation and orchestration."""
    flag_base_url = "https://api.fifa.com/api/v3/picture/flags-sq-1/"

    def __init__(self, db: AsyncSession) -> None:
        self._team_repository = TeamRepository(db)

    async def list_teams(
        self,
        *,
        offset: int,
        limit: int,
        group: str | None = None,
        search: str | None = None,
    ) -> TeamListResponse:
        """Return paginated teams for admin management."""
        try:
            teams = await self._team_repository.list_teams(
                offset=offset,
                limit=limit,
                group=group,
                search=search,
            )
            total = await self._team_repository.count_teams(
                group=group,
                search=search,
            )
            return self._build_list_response(
                teams=teams,
                total=total,
                limit=limit,
                offset=offset,
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Unexpected error during list_teams", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred: could not list teams",
            )

    async def create_team(self, data: TeamCreate) -> TeamResponse:
        """Create a team after validating uniqueness."""
        if await self._team_repository.name_exists(data.name):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Team name already exists",
            )

        team = Team(**data.model_dump())
        try:
            created_team = await self._team_repository.create(team)
        except IntegrityError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Team name already exists",
            )
        return TeamResponse.model_validate({**created_team.__dict__, "flag_url": TeamService.flag_base_url + created_team.fifa_code})

    async def update_team(
        self,
        *,
        team_id: int,
        data: TeamUpdate,
    ) -> TeamResponse:
        """Update a team after validating uniqueness."""
        team = await self._get_team_or_404(team_id)
        values = data.model_dump(exclude_unset=True)

        if not values:
            return TeamResponse.model_validate(team)

        new_name = values.get("name")
        if isinstance(new_name, str) and await self._team_repository.name_exists(
            new_name,
            exclude_team_id=team_id,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Team name already exists",
            )

        try:
            updated_team = await self._team_repository.update(team, values)
        except IntegrityError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Team name already exists",
            )
        return TeamResponse.model_validate({**updated_team.__dict__, "flag_url": TeamService.flag_base_url + updated_team.fifa_code})

    async def delete_team(self, team_id: int) -> None:
        """Delete an existing team."""
        team = await self._get_team_or_404(team_id)
        try:
            await self._team_repository.delete({**team.__dict__, "flag_url": TeamService.flag_base_url + team.fifa_code})
        except IntegrityError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Team cannot be deleted because it is in use",
            )

    async def _get_team_or_404(self, team_id: int) -> Team:
        """Fetch a team or raise a 404."""
        team = await self._team_repository.get_by_id(team_id)
        if team is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Team not found",
            )
        return team

    @staticmethod
    def _build_list_response(
        *,
        teams: list[Team],
        total: int,
        limit: int,
        offset: int,
    ) -> TeamListResponse:
        """Build a paginated team response."""
        return TeamListResponse(
            items=[TeamResponse.model_validate({**team.__dict__, "flag_url": TeamService.flag_base_url + team.fifa_code}) for team in teams],
            total=total,
            limit=limit,
            offset=offset,
        )
