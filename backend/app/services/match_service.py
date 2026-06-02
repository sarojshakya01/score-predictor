"""Match business logic."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.match import Match
from app.repositories.match_repository import MatchRepository
from app.repositories.setting_repository import SettingRepository
from app.repositories.team_repository import TeamRepository
from app.repositories.user_repository import UserRepository
from app.schemas.match import (
    MatchCreate,
    MatchListResponse,
    MatchResponse,
    MatchUpdate,
)
from app.services.team_service import TeamService

logger = logging.getLogger(__name__)

class MatchService:
    """Handles match validation and orchestration."""

    def __init__(self, db: AsyncSession) -> None:
        self._match_repository = MatchRepository(db)
        self._team_repository = TeamRepository(db)
        self._setting_repository = SettingRepository(db)
        self._user_repository = UserRepository(db)

    async def list_matches(
        self,
        *,
        offset: int,
        limit: int,
        is_admin: bool = False,
        match_stage: str | None = None,
        match_day: int | None = None,
        match_locked: bool | None = None,
    ) -> MatchListResponse:
        """Return paginated matches for admin screens."""
        try:

            if not is_admin and match_day is None and match_stage is None:
                setting = await self._setting_repository.get_by_name("current_match_day")
                match_day = int(setting.value) if setting else None

            matches = await self._match_repository.list_matches(
                offset=offset,
                limit=limit,
                match_day=match_day,
                match_stage=match_stage,
                match_locked=match_locked,
            )
            total = await self._match_repository.count_matches(
                match_day=match_day,
                match_stage=match_stage,
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
                first_goal_in=values.get("first_goal_in"),
            )
            if self._scores_have_no_goals(
                team1_score=values.get("team1_score"),
                team2_score=values.get("team2_score"),
            ):
                values["first_scoring_team_id"] = None
                values["first_goal_in"] = None

            await self._validate_team_references(
                team1_id=data.team1_id,
                team2_id=data.team2_id,
                kick_off_team_id=data.kick_off_team_id,
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
            was_locked = match.match_locked
            values = data.model_dump(exclude_unset=True)

            if not values:
                return MatchResponse.model_validate(self._build_response_payload(match))

            team1_id = values.get("team1_id", match.team1_id)
            team2_id = values.get("team2_id", match.team2_id)
            kick_off_team_id = values.get("kick_off_team_id", match.kick_off_team_id)
            first_scoring_team_id = values.get(
                "first_scoring_team_id",
                match.first_scoring_team_id,
            )
            team1_score = values.get("team1_score", match.team1_score)
            team2_score = values.get("team2_score", match.team2_score)
            is_goal_in_first_half = values.get(
                "first_goal_in",
                match.first_goal_in,
            )

            self._validate_goal_timeline_fields(
                team1_score=team1_score,
                team2_score=team2_score,
                first_scoring_team_id=first_scoring_team_id,
                first_goal_in=is_goal_in_first_half,
            )
            if self._scores_have_no_goals(
                team1_score=team1_score,
                team2_score=team2_score,
            ):
                first_scoring_team_id = None
                is_goal_in_first_half = None
                values["first_scoring_team_id"] = None
                values["first_goal_in"] = None

            await self._validate_team_references(
                team1_id=team1_id,
                team2_id=team2_id,
                kick_off_team_id=kick_off_team_id,
                first_scoring_team_id=first_scoring_team_id,
            )

            updated_match = await self._match_repository.update(match, values)

            # Notify all active users when a locked match is unlocked.
            now_locked = values.get("match_locked", was_locked)
            if was_locked and not now_locked:
                try:
                    from app.services.email_service import send_match_unlocked_email  # noqa: PLC0415
                    active_users = await self._user_repository.list_active_users()
                    recipient_emails = [u.email for u in active_users]
                    payload = self._build_response_payload(updated_match)
                    asyncio.create_task(send_match_unlocked_email(
                        recipients=recipient_emails,
                        team1_name=payload["team1_name"],
                        team2_name=payload["team2_name"],
                    ))
                except Exception:
                    logger.exception(
                        "Failed to send match-unlocked email for match %s", match_id
                    )

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
        kick_off_team_id: Any,
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

        if kick_off_team_id is not None and kick_off_team_id not in {
            team1_id,
            team2_id,
        }:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="kick_off_team_id must match one of the match teams",
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
        for team_id in {team1_id, team2_id, kick_off_team_id, first_scoring_team_id}:
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
        first_goal_in: Any,
    ) -> None:
        """Validate fields that only apply when a match has goals."""
        if team1_score is None or team2_score is None:
            return

        has_goals = team1_score + team2_score > 0
        if not has_goals:
            return

        if first_goal_in is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="first_goal_in is required when match scores include goals",
            )

        if first_scoring_team_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="first_scoring_team_id is required when match scores include goals",
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
            "team1_name": match.team1.name.replace("-H", "").replace("-A", ""),
            "team1_name_short": match.team1.fifa_code if match.team1.fifa_code != "NEP" else match.team1.name.replace("-H", "").replace("-A", ""),
            "team1_group": match.team1.group,
            "team1_flag_url": TeamService.team_flag_url(match.team1),
            "team2_name": match.team2.name.replace("-H", "").replace("-A", ""),
            "team2_name_short": match.team2.fifa_code if match.team2.fifa_code != "NEP" else match.team2.name.replace("-H", "").replace("-A", ""),
            "team2_group": match.team2.group,
            "team2_flag_url": TeamService.team_flag_url(match.team2),
        }
