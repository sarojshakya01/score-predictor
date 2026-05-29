"""Match business logic."""

import logging

from datetime import timedelta
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.match import Match
from app.repositories.match_repository import MatchRepository
from app.repositories.team_repository import TeamRepository
from app.schemas.match import (
    MatchCreate,
    MatchListResponse,
    MatchResponse,
    MatchUpdate,
)

logger = logging.getLogger(__name__)

class MatchService:
    """Handles match validation and orchestration."""

    def __init__(self, db: AsyncSession) -> None:
        self._match_repository = MatchRepository(db)
        self._team_repository = TeamRepository(db)

    async def list_matches(
        self,
        *,
        offset: int,
        limit: int,
        match_day: int | None = None,
        match_locked: bool | None = None,
    ) -> MatchListResponse:
        """Return paginated matches for admin screens."""
        try:
            matches = await self._match_repository.list_matches(
                offset=offset,
                limit=limit,
                match_day=match_day,
                match_locked=match_locked,
            )
            total = await self._match_repository.count_matches(
                match_day=match_day,
                match_locked=match_locked,
            )
            return self._build_list_response(
                matches=matches,
                total=total,
                limit=limit,
                offset=offset,
            )
        except HTTPException:
            # Re-raise FastAPI HTTP exceptions
            raise
        except Exception as e:
            logger.exception("Unexpected error during list_matches", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred: could not list matches",
            )

    async def list_upcoming(
        self,
        *,
        offset: int,
        limit: int,
        include_locked: bool,
    ) -> MatchListResponse:
        """Return upcoming matches for public prediction flows."""
        try:
            now = datetime.now(timezone.utc)
            matches = await self._match_repository.list_upcoming(
                from_datetime=now,
                to_datetime=now + timedelta(days=2),
                offset=offset,
                limit=limit,
                include_locked=include_locked,
            )
            total = await self._match_repository.count_upcoming(
                from_datetime=now,
                to_datetime=now + timedelta(days=2),
                include_locked=include_locked,
            )
            return self._build_list_response(
                matches=matches,
                total=total,
                limit=limit,
                offset=offset,
            )
        except HTTPException:
            # Re-raise FastAPI HTTP exceptions
            raise
        except Exception as e:
            logger.exception("Unexpected error during list_upcoming", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred: could not list upcoming matches",
            )

    async def get_match(self, match_id: int) -> MatchResponse:
        """Return a single match by id."""
        try:
            match = await self._get_match_or_404(match_id)
            return MatchResponse.model_validate(self._build_response_payload(match))
        except HTTPException:
            # Re-raise FastAPI HTTP exceptions
            raise
        except Exception as e:
            logger.exception("Unexpected error during get_match", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred: could not read match",
            )

    async def create_match(self, data: MatchCreate) -> MatchResponse:
        """Create a match after validating referenced teams."""
        try:
            values = data.model_dump()
            self._validate_goal_timeline_fields(
                team1_score=values.get("team1_score"),
                team2_score=values.get("team2_score"),
                first_scoring_team_id=values.get("first_scoring_team_id"),
                is_goal_in_first_half=values.get("is_goal_in_first_half"),
            )
            if self._scores_have_no_goals(
                team1_score=values.get("team1_score"),
                team2_score=values.get("team2_score"),
            ):
                values["first_scoring_team_id"] = None
                values["is_goal_in_first_half"] = None

            await self._validate_team_references(
                team1_id=data.team1_id,
                team2_id=data.team2_id,
                opening_team_id=data.opening_team_id,
                first_scoring_team_id=values.get("first_scoring_team_id"),
            )

            match = Match(**values)
            created_match = await self._match_repository.create(match)
            return MatchResponse.model_validate(
                self._build_response_payload(created_match),
            )
        except HTTPException:
            # Re-raise FastAPI HTTP exceptions
            raise
        except Exception as e:
            logger.exception("Unexpected error during create_match", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred: could not create match",
            )

    async def update_match(
        self,
        *,
        match_id: int,
        data: MatchUpdate,
    ) -> MatchResponse:
        """Update a match after validating changed fields."""
        try:
            match = await self._get_match_or_404(match_id)
            values = data.model_dump(exclude_unset=True)

            if not values:
                return MatchResponse.model_validate(self._build_response_payload(match))

            team1_id = values.get("team1_id", match.team1_id)
            team2_id = values.get("team2_id", match.team2_id)
            opening_team_id = values.get("opening_team_id", match.opening_team_id)
            first_scoring_team_id = values.get(
                "first_scoring_team_id",
                match.first_scoring_team_id,
            )
            team1_score = values.get("team1_score", match.team1_score)
            team2_score = values.get("team2_score", match.team2_score)
            is_goal_in_first_half = values.get(
                "is_goal_in_first_half",
                match.is_goal_in_first_half,
            )

            self._validate_goal_timeline_fields(
                team1_score=team1_score,
                team2_score=team2_score,
                first_scoring_team_id=first_scoring_team_id,
                is_goal_in_first_half=is_goal_in_first_half,
            )
            if self._scores_have_no_goals(
                team1_score=team1_score,
                team2_score=team2_score,
            ):
                first_scoring_team_id = None
                is_goal_in_first_half = None
                values["first_scoring_team_id"] = None
                values["is_goal_in_first_half"] = None

            await self._validate_team_references(
                team1_id=team1_id,
                team2_id=team2_id,
                opening_team_id=opening_team_id,
                first_scoring_team_id=first_scoring_team_id,
            )

            updated_match = await self._match_repository.update(match, values)
            return MatchResponse.model_validate(
                self._build_response_payload(updated_match),
            )
        except HTTPException:
            # Re-raise FastAPI HTTP exceptions
            raise
        except Exception as e:
            logger.exception("Unexpected error during update_match", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred: could not update match",
            )

    async def delete_match(self, match_id: int) -> None:
        """Delete an existing match."""
        try:
            match = await self._get_match_or_404(match_id)
            await self._match_repository.delete(match)
        except HTTPException:
            # Re-raise FastAPI HTTP exceptions
            raise
        except Exception as e:
            logger.exception("Unexpected error during delete_match", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred: could not delete match",
            )

    async def _get_match_or_404(self, match_id: int) -> Match:
        """Fetch a match or raise a 404."""
        match = await self._match_repository.get_by_id(match_id)
        if match is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Match not found",
            )
        return match

    async def _validate_team_references(
        self,
        *,
        team1_id: Any,
        team2_id: Any,
        opening_team_id: Any,
        first_scoring_team_id: Any,
    ) -> None:
        """Validate match team relationships and references."""
        if not isinstance(team1_id, int) or not isinstance(team2_id, int):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="team1_id and team2_id are required",
            )

        if team1_id == team2_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="team1_id and team2_id must be different",
            )

        if opening_team_id is not None and opening_team_id not in {
            team1_id,
            team2_id,
        }:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="opening_team_id must match one of the match teams",
            )

        if first_scoring_team_id is not None and first_scoring_team_id not in {
            team1_id,
            team2_id,
        }:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="first_scoring_team_id must match one of the match teams",
            )

        missing_team_ids: list[int] = []
        for team_id in {team1_id, team2_id, opening_team_id, first_scoring_team_id}:
            if team_id is None:
                continue

            team = await self._team_repository.get_by_id(team_id)
            if team is None:
                missing_team_ids.append(team_id)

        if missing_team_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Team not found: {min(missing_team_ids)}",
            )

    @staticmethod
    def _validate_goal_timeline_fields(
        *,
        team1_score: Any,
        team2_score: Any,
        first_scoring_team_id: Any,
        is_goal_in_first_half: Any,
    ) -> None:
        """Validate fields that only apply when a match has goals."""
        if team1_score is None or team2_score is None:
            return

        has_goals = team1_score + team2_score > 0
        if not has_goals:
            return

        if first_scoring_team_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="first_scoring_team_id is required when match scores include goals",
            )

        if is_goal_in_first_half is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="is_goal_in_first_half is required when match scores include goals",
            )

    @staticmethod
    def _scores_have_no_goals(*, team1_score: Any, team2_score: Any) -> bool:
        """Return whether both final score fields are known and goal-less."""
        return team1_score == 0 and team2_score == 0

    @staticmethod
    def _build_list_response(
        *,
        matches: list[Match],
        total: int,
        limit: int,
        offset: int,
    ) -> MatchListResponse:
        """Build a paginated match response."""
        return MatchListResponse(
            items=[
                MatchResponse.model_validate(
                    MatchService._build_response_payload(match),
                )
                for match in matches
            ],
            total=total,
            limit=limit,
            offset=offset,
        )

    @staticmethod
    def _build_response_payload(match: Match) -> dict[str, object]:
        """Build a match response payload with team display fields."""
        return {
            **match.__dict__,
            "team1_name": match.team1.name,
            "team2_name": match.team2.name,
            "team1_group": match.team1.group,
            "team2_group": match.team2.group,
        }
