"""Repository for match database operations."""

from collections.abc import Mapping
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.match import Match


class MatchRepository:
    """Encapsulates all database operations for the Match model."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_id(self, match_id: int) -> Match | None:
        """Fetch a match by primary key."""
        result = await self._db.execute(
            select(Match)
            .options(selectinload(Match.team1), selectinload(Match.team2))
            .where(Match.id == match_id),
        )
        return result.scalar_one_or_none()

    async def list_matches(
        self,
        *,
        offset: int = 0,
        limit: int = 50,
        match_day: int | None = None,
        match_locked: bool | None = None,
    ) -> list[Match]:
        """Fetch matches with optional filters and pagination."""
        statement = select(Match).options(
            selectinload(Match.team1),
            selectinload(Match.team2),
        )

        if match_day is not None:
            statement = statement.where(Match.match_day == match_day)

        if match_locked is not None:
            statement = statement.where(Match.match_locked == match_locked)

        result = await self._db.execute(
            statement.order_by(Match.match_datetime.asc(), Match.id.asc())
            .offset(offset)
            .limit(limit),
        )
        return list(result.scalars().all())

    async def count_matches(
        self,
        *,
        match_day: int | None = None,
        match_locked: bool | None = None,
    ) -> int:
        """Count matches using the same filters as list_matches."""
        statement = select(func.count()).select_from(Match)

        if match_day is not None:
            statement = statement.where(Match.match_day == match_day)

        if match_locked is not None:
            statement = statement.where(Match.match_locked == match_locked)

        result = await self._db.execute(statement)
        return int(result.scalar_one())

    async def list_completed_matches(self) -> list[Match]:
        """Fetch matches with final scores for standings calculations."""
        statement = (
            select(Match)
            .options(selectinload(Match.team1), selectinload(Match.team2))
            .where(Match.team1_score.is_not(None))
            .where(Match.team2_score.is_not(None))
            .order_by(Match.match_datetime.asc(), Match.id.asc())
        )

        result = await self._db.execute(statement)
        return list(result.scalars().all())

    async def count_completed_matches(self) -> int:
        """Count matches with final scores."""
        statement = (
            select(func.count())
            .select_from(Match)
            .where(Match.team1_score.is_not(None))
            .where(Match.team2_score.is_not(None))
        )

        result = await self._db.execute(statement)
        return int(result.scalar_one())

    async def count_open_matches(self, from_datetime: datetime) -> int:
        """Count future matches still open for predictions."""
        prediction_deadline_floor = from_datetime.astimezone() + timedelta(hours=1)
        statement = (
            select(func.count())
            .select_from(Match)
            .where(Match.match_locked.is_(False))
            .where(Match.match_datetime > prediction_deadline_floor)
        )

        result = await self._db.execute(statement)
        return int(result.scalar_one())

    async def count_locking_matches(
        self,
        *,
        from_datetime: datetime,
        to_datetime: datetime,
    ) -> int:
        """Count matches whose prediction lock is inside the supplied window."""
        from_match_datetime = from_datetime.astimezone() + timedelta(hours=1)
        to_match_datetime = to_datetime.astimezone() + timedelta(hours=1)
        statement = (
            select(func.count())
            .select_from(Match)
            .where(Match.match_locked.is_(False))
            .where(Match.match_datetime >= from_match_datetime)
            .where(Match.match_datetime <= to_match_datetime)
        )

        result = await self._db.execute(statement)
        return int(result.scalar_one())

    async def get_next_open_match(self, from_datetime: datetime) -> Match | None:
        """Fetch the next match whose prediction lock has not passed."""
        prediction_deadline_floor = from_datetime.astimezone() + timedelta(hours=1)
        statement = (
            select(Match)
            .options(selectinload(Match.team1), selectinload(Match.team2))
            .where(Match.match_locked.is_(False))
            .where(Match.match_datetime > prediction_deadline_floor)
            .order_by(Match.match_datetime.asc(), Match.id.asc())
            .limit(1)
        )

        result = await self._db.execute(statement)
        return result.scalar_one_or_none()

    async def list_upcoming(
        self,
        *,
        from_datetime: datetime,
        to_datetime: datetime,
        offset: int = 0,
        limit: int = 50,
        include_locked: bool = True,
    ) -> list[Match]:
        """Fetch upcoming matches ordered by match date."""

        first_match = await self.get_first_match()
        if first_match is None:
            return []

        # Convert naive datetime to local timezone-aware datetime
        from_datetime = from_datetime.astimezone()

        first_match_datetime = first_match.match_datetime.replace(
            tzinfo=timezone.utc,
        ).astimezone()

        if first_match_datetime > to_datetime:
            to_datetime = first_match_datetime + timedelta(days=1)

        statement = (
            select(Match)
            .options(selectinload(Match.team1), selectinload(Match.team2))
            .where(Match.match_datetime >= from_datetime)
            .where(Match.match_datetime <= to_datetime)
        )

        if not include_locked:
            statement = statement.where(Match.match_locked.is_(False))

        result = await self._db.execute(
            statement.order_by(Match.match_datetime.asc(), Match.id.asc())
            .offset(offset)
            .limit(limit),
        )
        return list(result.scalars().all())

    async def count_upcoming(
        self,
        *,
        from_datetime: datetime,
        to_datetime: datetime,
        include_locked: bool = True,
    ) -> int:
        """Count upcoming matches using the same filters as list_upcoming."""
        first_match = await self.get_first_match()
        if first_match is None:
            return 0

        # Convert naive datetime to local timezone-aware datetime
        from_datetime = from_datetime.astimezone()

        first_match_datetime = first_match.match_datetime.replace(
            tzinfo=timezone.utc,
        ).astimezone()

        if first_match_datetime > to_datetime:
            to_datetime = first_match_datetime + timedelta(days=1)

        statement = (
            select(func.count())
            .select_from(Match)
            .where(Match.match_datetime >= from_datetime)
            .where(Match.match_datetime <= to_datetime)
        )

        if not include_locked:
            statement = statement.where(Match.match_locked.is_(False))

        result = await self._db.execute(statement)
        return int(result.scalar_one())

    async def get_first_match(self) -> Match | None:
        statement = select(Match)
        result = await self._db.execute(
            statement.order_by(Match.match_datetime.asc(), Match.id.asc())
            .limit(1),
        )
        return result.scalar_one_or_none()

    async def get_last_match(self) -> Match | None:
        statement = select(Match)
        result = await self._db.execute(
            statement.order_by(Match.match_datetime.desc(), Match.id.desc())
            .limit(1),
        )
        return result.scalar_one_or_none()

    async def create(self, match: Match) -> Match:
        """Persist a new match and return the refreshed instance."""
        self._db.add(match)
        await self._db.commit()
        await self._db.refresh(match)
        return match

    async def update(self, match: Match, values: Mapping[str, object]) -> Match:
        """Update an existing match and return the refreshed instance."""
        for field_name, value in values.items():
            setattr(match, field_name, value)

        await self._db.commit()
        await self._db.refresh(match)
        return match

    async def delete(self, match: Match) -> None:
        """Delete an existing match."""
        await self._db.delete(match)
        await self._db.commit()
