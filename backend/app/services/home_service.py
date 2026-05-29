"""Home-page summary business logic."""

import logging
import math
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.match import Match
from app.repositories.match_repository import MatchRepository
from app.repositories.prediction_repository import PredictionRepository
from app.schemas.home import HomeNextLockResponse, HomeSummaryResponse

logger = logging.getLogger(__name__)


class HomeService:
    """Builds public summary data for the home page."""

    def __init__(self, db: AsyncSession) -> None:
        self._match_repository = MatchRepository(db)
        self._prediction_repository = PredictionRepository(db)

    async def get_summary(self) -> HomeSummaryResponse:
        """Return current tournament summary stats."""
        try:
            now = datetime.now(timezone.utc)
            locking_window_end = now + timedelta(hours=24)
            next_lock_match = await self._match_repository.get_next_open_match(now)

            return HomeSummaryResponse(
                open_matches=await self._match_repository.count_open_matches(now),
                predictions_made=await self._count_predictions(),
                locking_soon=await self._match_repository.count_locking_matches(
                    from_datetime=now,
                    to_datetime=locking_window_end,
                ),
                completed_matches=await self._match_repository.count_completed_matches(),
                next_lock=self._build_next_lock_response(
                    match=next_lock_match,
                    now=now,
                ),
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Unexpected error during get_home_summary: ", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred: could not get home summary",
            )

    async def _count_predictions(self) -> int:
        """Count predictions, tolerating local databases before prediction setup."""
        try:
            return await self._prediction_repository.count_all_predictions()
        except ProgrammingError as error:
            if self._is_missing_predictions_table_error(error):
                logger.warning("Predictions table is missing; returning 0 predictions")
                return 0

            raise

    @staticmethod
    def _build_next_lock_response(
        *,
        match: Match | None,
        now: datetime,
    ) -> HomeNextLockResponse | None:
        """Build next lock data for display."""
        if match is None:
            return None

        lock_datetime = HomeService._as_aware_utc(match.match_datetime) - timedelta(
            hours=1,
        )
        minutes_until_lock = max(
            0,
            math.ceil((lock_datetime - now).total_seconds() / 60),
        )

        return HomeNextLockResponse(
            match_id=match.id,
            label=f"{match.team1.name} vs {match.team2.name}",
            lock_datetime=lock_datetime,
            minutes_until_lock=minutes_until_lock,
        )

    @staticmethod
    def _is_missing_predictions_table_error(error: ProgrammingError) -> bool:
        """Return whether a DB error is caused by a missing predictions table."""
        original_error_args = getattr(error.orig, "args", ())
        if original_error_args and original_error_args[0] == 1146:
            return True

        error_text = str(error).lower()
        return "predictions" in error_text and "doesn't exist" in error_text

    @staticmethod
    def _as_aware_utc(value: datetime) -> datetime:
        """Return a timezone-aware UTC datetime."""
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)

        return value.astimezone(timezone.utc)
