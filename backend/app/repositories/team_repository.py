"""Repository for team database operations."""

from collections.abc import Mapping

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.team import Team


class TeamRepository:
    """Encapsulates all database operations for the Team model."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_id(self, team_id: int) -> Team | None:
        """Fetch a team by primary key."""
        result = await self._db.execute(
            select(Team).where(Team.id == team_id),
        )
        return result.scalar_one_or_none()

    async def get_by_name(self, name: str) -> Team | None:
        """Fetch a team by unique name."""
        result = await self._db.execute(
            select(Team).where(Team.name == name),
        )
        return result.scalar_one_or_none()

    async def list_all_teams(self) -> list[Team]:
        """Fetch all teams ordered for group table display."""
        result = await self._db.execute(
            select(Team).where(Team.name != "TBD-H").where(Team.name != "TBD-A").order_by(Team.group.asc(), Team.name.asc(), Team.id.asc()),
        )
        return list(result.scalars().all())

    async def name_exists(
        self,
        name: str,
        *,
        exclude_team_id: int | None = None,
    ) -> bool:
        """Check whether a team name is already used."""
        statement = select(Team.id).where(Team.name == name)

        if exclude_team_id is not None:
            statement = statement.where(Team.id != exclude_team_id)

        result = await self._db.execute(statement)
        return result.scalar_one_or_none() is not None

    async def list_teams(
        self,
        *,
        offset: int = 0,
        limit: int = 100,
        group: str | None = None,
        search: str | None = None,
    ) -> list[Team]:
        """Fetch teams with optional filters and pagination."""
        statement = select(Team)

        statement = statement.where(Team.name != "TBD-H").where(Team.name != "TBD-A")

        if group is not None:
            statement = statement.where(Team.group == group)

        if search is not None:
            statement = statement.where(Team.name.ilike(f"%{search}%"))

        result = await self._db.execute(
            statement.order_by(Team.group.asc(), Team.name.asc(), Team.id.asc())
            .offset(offset)
            .limit(limit),
        )
        return list(result.scalars().all())

    async def count_teams(
        self,
        *,
        group: str | None = None,
        search: str | None = None,
    ) -> int:
        """Count teams using the same filters as list_teams."""
        statement = select(func.count()).select_from(Team)

        if group is not None:
            statement = statement.where(Team.group == group)

        if search is not None:
            statement = statement.where(Team.name.ilike(f"%{search}%"))

        result = await self._db.execute(statement)
        return int(result.scalar_one())

    async def create(self, team: Team) -> Team:
        """Persist a new team and return the refreshed instance."""
        self._db.add(team)
        await self._db.commit()
        await self._db.refresh(team)
        return team

    async def update(self, team: Team, values: Mapping[str, object]) -> Team:
        """Update an existing team and return the refreshed instance."""
        for field_name, value in values.items():
            setattr(team, field_name, value)

        await self._db.commit()
        await self._db.refresh(team)
        return team

    async def delete(self, team: Team) -> None:
        """Delete an existing team."""
        await self._db.delete(team)
        await self._db.commit()
