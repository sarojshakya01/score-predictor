"""Repository for match database operations."""

from app.models.match import MatchStage
from app.services.setting_service import SettingService
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
            .options(
                selectinload(Match.team1),
                selectinload(Match.team2),
                selectinload(Match.winner),
            )
            .where(Match.id == match_id),
        )
        return result.scalar_one_or_none()

    async def list_matches(
        self,
        *,
        offset: int = 0,
        limit: int = 500,
        match_day: int | None = None,
        match_stage: str | None = None,
        match_locked: bool | None = None,
    ) -> list[Match]:
        """Fetch matches with optional filters and pagination."""
        statement = select(Match).options(
            selectinload(Match.team1),
            selectinload(Match.team2),
            selectinload(Match.winner),
        )

        if match_day is not None:
            statement = statement.where(Match.match_day == match_day)

        if match_stage is not None:
            statement = statement.where(Match.match_stage == match_stage)

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
        match_stage: str | None = None,
        match_locked: bool | None = None,
    ) -> int:
        """Count matches using the same filters as list_matches."""
        statement = select(func.count()).select_from(Match)

        if match_day is not None:
            statement = statement.where(Match.match_day == match_day)

        if match_stage is not None:
            statement = statement.where(Match.match_stage == match_stage)

        if match_locked is not None:
            statement = statement.where(Match.match_locked == match_locked)

        result = await self._db.execute(statement)
        return int(result.scalar_one())

    async def list_completed_matches(
        self,
        *,
        offset: int = 0,
        limit: int | None = None,
    ) -> list[Match]:
        """Fetch matches with final scores for standings calculations."""
        statement = (
            select(Match)
            .options(
                selectinload(Match.team1),
                selectinload(Match.team2),
                selectinload(Match.winner),
            )
            .where(Match.match_locked.is_(True))
            .where(Match.team1_score.is_not(None))
            .where(Match.team2_score.is_not(None))
            .order_by(Match.match_datetime.asc(), Match.id.asc())
        )

        if limit is not None:
            statement = statement.offset(offset).limit(limit)

        result = await self._db.execute(statement)
        return list(result.scalars().all())

    async def list_locked_matches(
        self,
        *,
        offset: int = 0,
        limit: int | None = None,
    ) -> list[Match]:
        """Fetch matches with final scores for standings calculations."""
        statement = (
            select(Match)
            .options(
                selectinload(Match.team1),
                selectinload(Match.team2),
                selectinload(Match.winner),
            )
            .where(Match.match_locked.is_(True))
            .order_by(Match.match_datetime.asc(), Match.id.asc())
        )

        if limit is not None:
            statement = statement.offset(offset).limit(limit)

        result = await self._db.execute(statement)
        return list(result.scalars().all())

    async def count_completed_matches(self) -> int:
        """Count matches with final scores."""
        statement = (
            select(func.count())
            .select_from(Match)
            .where(Match.match_locked.is_(True))
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
            .options(
                selectinload(Match.team1),
                selectinload(Match.team2),
                selectinload(Match.winner),
            )
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
        limit: int = 100,
        include_locked: bool = True,
    ) -> list[Match]:
        """Fetch upcoming matches ordered by match date."""

        first_match = await self.get_first_match()
        if first_match is None:
            return []

        # for upcooming matches with more than 10 (intentional multiple matches), do not bound by current match day
        if limit > 10:
            service = SettingService(self._db)
            current_match_day = await service.get_current_match_day()
        else:
            current_match_day = None
        

        match_day = None
        if current_match_day and current_match_day.value:
            match_day = int(current_match_day.value)

        statement = (
            select(Match)
            .options(
                selectinload(Match.team1),
                selectinload(Match.team2),
                selectinload(Match.winner),
            )
        )

        if not include_locked:
            statement = statement.where(Match.match_locked.is_(False))

        if match_day:
            statement = statement.where(Match.match_day == match_day)
        elif limit is None:
            # Convert naive datetime to local timezone-aware datetime
            # from_datetime = from_datetime.astimezone()

            first_match_datetime = first_match.match_datetime.replace(
                tzinfo=timezone.utc,
            )

            if first_match_datetime > to_datetime:
                to_datetime = first_match_datetime + timedelta(days=1)

            statement = statement.where(Match.match_datetime >= from_datetime)
            statement = statement.where(Match.match_datetime <= to_datetime)

        result = await self._db.execute(
            statement.order_by(Match.match_datetime.asc(), Match.id.asc())
            .offset(offset)
            .limit(limit),
        )
        return list(result.scalars().all())

    async def list_finals(
        self,
        *,
        include_locked: bool = True,
    ) -> list[Match]:
        """Fetch upcoming matches ordered by match date."""

        statement = (
            select(Match)
            .options(
                selectinload(Match.team1),
                selectinload(Match.team2),
                selectinload(Match.winner),
            )
        )

        if not include_locked:
            statement = statement.where(Match.match_locked.is_(False))

        statement = statement.where(
            (Match.match_stage == MatchStage.THIRD_PLACE) |
            (Match.match_stage == MatchStage.FINAL)
        )

        result = await self._db.execute(
            statement.order_by(Match.match_datetime.asc(), Match.id.asc()),
        )

        return list(result.scalars().all())

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
            if field_name == "match_datetime":
                if value.tzinfo is None:
                    value = value.replace(tzinfo=timezone.utc)
                else:
                    value = value.astimezone(timezone.utc)
            setattr(match, field_name, value)

        await self._db.commit()
        await self._db.refresh(match)
        return match

    async def delete(self, match: Match) -> None:
        """Delete an existing match."""
        await self._db.delete(match)
        await self._db.commit()
